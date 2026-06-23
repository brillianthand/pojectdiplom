package main

import (
	"log"
	"net/http"
	"os"

	"kanban/internal/admin"
	"kanban/internal/auth"
	"kanban/internal/boards"
	"kanban/internal/members"
	"kanban/internal/notifications"
	"kanban/internal/personaltasks"
	platformdb "kanban/internal/platform/db"
	"kanban/internal/platform/httpx"
	"kanban/internal/projects"
	"kanban/internal/realtime"
	"kanban/internal/seed"
	"kanban/internal/sprints"
	"kanban/internal/tasks"
	"kanban/internal/users"
	"kanban/internal/workspace"
)

func main() {
	connStr := getenv("DATABASE_URL",
		"host=localhost port=5432 user=postgres password=1234 dbname=kanban sslmode=disable")

	db, err := platformdb.Open(connStr)
	if err != nil {
		log.Fatal("db:", err)
	}
	defer db.Close()

	if err := platformdb.ApplyMigrations(db); err != nil {
		log.Fatal("migrations:", err)
	}

	// Wire up modules
	usersRepo := users.NewRepository(db)
	tasksRepo := tasks.NewRepository(db)
	boardsRepo := boards.NewRepository(db, tasksRepo)
	boardsSvc := boards.NewService(db, boardsRepo)
	tasksSvc := tasks.NewService(db, tasksRepo)
	membersRepo := members.NewRepository(db)

	notifRepo := notifications.NewRepository(db)
	notifSvc := notifications.NewService(notifRepo)

	projectsRepo := projects.NewRepository(db)
	projectsSvc := projects.NewService(db, projectsRepo, boardsSvc, membersRepo, notifSvc)
	membersSvc := members.NewService(membersRepo, notifSvc, projectsSvc)

	mux := http.NewServeMux()

	// Public routes
	mux.HandleFunc("GET /api/health", func(w http.ResponseWriter, r *http.Request) {
		httpx.WriteJSON(w, 200, map[string]string{"status": "ok"})
	})
	authHandler := auth.NewHandler(usersRepo)
	authHandler.Register(mux)

	hub := realtime.NewHub()

	// WS endpoint is on the public mux — auth is done via ?token= query param
	// because browsers cannot set custom headers on WebSocket connections.
	mux.HandleFunc("GET /api/boards/{id}/ws", realtime.ServeWS(hub))

	boardsHandler := boards.NewHandler(boardsSvc, hub, membersRepo)
	boardsHandler.RegisterPublic(mux)

	tasksHandler := tasks.NewHandler(tasksSvc, hub, notifSvc, membersRepo)
	tasksHandler.RegisterPublic(mux)

	// Protected routes — all other /api/* require a valid JWT
	protected := http.NewServeMux()
	authHandler.RegisterProtected(protected)
	users.NewHandler(usersRepo).Register(protected)
	projects.NewHandler(projectsSvc, membersRepo).Register(protected)
	boardsHandler.Register(protected)
	protected.HandleFunc("GET /api/presence", realtime.PresenceHandler(hub))
	tasksHandler.Register(protected)
	members.NewHandler(membersSvc, membersRepo, notifSvc).Register(protected)
	notifications.NewHandler(notifSvc).Register(protected)
	personaltasks.NewHandler(personaltasks.NewService(personaltasks.NewRepository(db))).Register(protected)
	workspace.NewHandler(workspace.NewService(workspace.NewRepository(db))).Register(protected)
	sprints.NewHandler(sprints.NewService(sprints.NewRepository(db)), membersRepo).Register(protected)
	adminHandler := admin.NewHandler(admin.NewRepository(db))
	adminHandler.Register(protected)
	// Seed is only accessible to system admins
	protected.Handle("POST /api/seed", admin.RequireAdmin(seed.Handler(db)))
	mux.Handle("/api/", auth.RequireAuth(usersRepo)(protected))

	corsOrigin := getenv("CORS_ORIGIN", "http://localhost:5173")
	addr := ":" + getenv("PORT", "8080")
	log.Printf("listening on %s  cors=%s", addr, corsOrigin)
	log.Fatal(http.ListenAndServe(addr, httpx.CORS(corsOrigin)(mux)))
}

func getenv(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
