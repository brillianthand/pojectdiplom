package realtime

import (
	"net/http"

	"kanban/internal/auth"
	"kanban/internal/platform/httpx"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// ServeWS upgrades the connection and subscribes the client to the board.
// Auth is done via ?token= query param because browsers can't set custom
// headers on WebSocket connections.
func ServeWS(hub *Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		boardID := r.PathValue("id")
		userID, err := auth.ParseToken(r.URL.Query().Get("token"))
		if err != nil {
			http.Error(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			return
		}
		c := newClient(hub, boardID, userID, conn)
		hub.subscribe(boardID, c)
		go c.writePump()
		go c.readPump()
	}
}

// PresenceHandler returns the IDs of all users currently connected via WebSocket.
func PresenceHandler(hub *Hub) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		httpx.WriteJSON(w, 200, map[string]any{"ids": hub.OnlineUserIDs()})
	}
}
