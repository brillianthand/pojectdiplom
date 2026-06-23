package admin

import (
	"net/http"
	"strings"

	"kanban/internal/auth"
	"kanban/internal/platform/httpx"
)

type Handler struct {
	repo *Repository
}

func NewHandler(repo *Repository) *Handler {
	return &Handler{repo: repo}
}

// RequireAdmin must wrap routes after auth.RequireAuth — relies on UserFromCtx.
func RequireAdmin(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		u, ok := auth.UserFromCtx(r.Context())
		if !ok {
			httpx.ErrJSON(w, 401, "unauthorized")
			return
		}
		if !u.IsAdmin {
			httpx.ErrJSON(w, 403, "только для администраторов")
			return
		}
		next.ServeHTTP(w, r)
	})
}

func (h *Handler) Register(mux *http.ServeMux) {
	wrap := func(fn http.HandlerFunc) http.HandlerFunc {
		return RequireAdmin(fn).ServeHTTP
	}
	mux.HandleFunc("GET /api/admin/users",       wrap(h.listUsers))
	mux.HandleFunc("GET /api/admin/stats",       wrap(h.stats))
	mux.HandleFunc("PATCH /api/admin/users/{id}", wrap(h.patchUser))
	mux.HandleFunc("DELETE /api/admin/users/{id}", wrap(h.deleteUser))
}

func (h *Handler) listUsers(w http.ResponseWriter, r *http.Request) {
	rows, err := h.repo.ListUsers(r.Context())
	if err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	httpx.WriteJSON(w, 200, rows)
}

func (h *Handler) stats(w http.ResponseWriter, r *http.Request) {
	s, err := h.repo.Stats(r.Context())
	if err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	httpx.WriteJSON(w, 200, s)
}

func (h *Handler) patchUser(w http.ResponseWriter, r *http.Request) {
	me, _ := auth.UserFromCtx(r.Context())
	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		httpx.ErrJSON(w, 400, "id is required")
		return
	}

	var body struct {
		IsAdmin   *bool `json:"isAdmin"`
		IsBlocked *bool `json:"isBlocked"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.ErrJSON(w, 400, "invalid json")
		return
	}

	// Запреты на саморазрушение.
	if id == me.ID {
		if body.IsAdmin != nil && !*body.IsAdmin {
			httpx.ErrJSON(w, 400, "нельзя снять с себя права администратора")
			return
		}
		if body.IsBlocked != nil && *body.IsBlocked {
			httpx.ErrJSON(w, 400, "нельзя заблокировать самого себя")
			return
		}
	}

	// Нельзя оставить систему без админов.
	if body.IsAdmin != nil && !*body.IsAdmin {
		n, err := h.repo.CountAdmins(r.Context())
		if err != nil {
			httpx.ErrJSON(w, 500, err.Error())
			return
		}
		if n <= 1 {
			httpx.ErrJSON(w, 400, "в системе должен оставаться хотя бы один администратор")
			return
		}
	}

	if body.IsAdmin != nil {
		if err := h.repo.SetAdmin(r.Context(), id, *body.IsAdmin); err != nil {
			httpx.ErrJSON(w, 500, err.Error())
			return
		}
	}
	if body.IsBlocked != nil {
		if err := h.repo.SetBlocked(r.Context(), id, *body.IsBlocked); err != nil {
			httpx.ErrJSON(w, 500, err.Error())
			return
		}
	}
	httpx.WriteJSON(w, 200, map[string]string{"status": "ok"})
}

func (h *Handler) deleteUser(w http.ResponseWriter, r *http.Request) {
	me, _ := auth.UserFromCtx(r.Context())
	id := strings.TrimSpace(r.PathValue("id"))
	if id == "" {
		httpx.ErrJSON(w, 400, "id is required")
		return
	}
	if id == me.ID {
		httpx.ErrJSON(w, 400, "нельзя удалить свою собственную учётную запись")
		return
	}
	// Не даём удалить последнего админа.
	n, err := h.repo.CountAdmins(r.Context())
	if err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	// Если удаляемый — админ и он последний, отказ.
	if n <= 1 {
		// проверим, не его ли удаляют
		var isAdmin bool
		_ = h.repo.db.QueryRowContext(r.Context(), `SELECT is_admin FROM users WHERE id = $1`, id).Scan(&isAdmin)
		if isAdmin {
			httpx.ErrJSON(w, 400, "нельзя удалить последнего администратора")
			return
		}
	}
	if err := h.repo.Delete(r.Context(), id); err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	w.WriteHeader(204)
}
