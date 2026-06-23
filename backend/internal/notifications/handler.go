package notifications

import (
	"net/http"

	"kanban/internal/auth"
	"kanban/internal/platform/httpx"
)

type Handler struct {
	svc *Service
}

func NewHandler(svc *Service) *Handler {
	return &Handler{svc: svc}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/notifications",            h.list)
	mux.HandleFunc("GET /api/notifications/count",      h.count)
	mux.HandleFunc("PUT /api/notifications/read",       h.markAllRead)
	mux.HandleFunc("PUT /api/notifications/{id}/read",  h.markOneRead)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	u, ok := auth.UserFromCtx(r.Context())
	if !ok {
		httpx.ErrJSON(w, 401, "unauthorized")
		return
	}
	before := r.URL.Query().Get("before")
	items, hasMore, err := h.svc.List(r.Context(), u.ID, before)
	if err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	httpx.WriteJSON(w, 200, map[string]any{"items": items, "hasMore": hasMore})
}

func (h *Handler) count(w http.ResponseWriter, r *http.Request) {
	u, ok := auth.UserFromCtx(r.Context())
	if !ok {
		httpx.ErrJSON(w, 401, "unauthorized")
		return
	}
	n, err := h.svc.UnreadCount(r.Context(), u.ID)
	if err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	httpx.WriteJSON(w, 200, map[string]int{"count": n})
}

func (h *Handler) markAllRead(w http.ResponseWriter, r *http.Request) {
	u, ok := auth.UserFromCtx(r.Context())
	if !ok {
		httpx.ErrJSON(w, 401, "unauthorized")
		return
	}
	if err := h.svc.MarkAllRead(r.Context(), u.ID); err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) markOneRead(w http.ResponseWriter, r *http.Request) {
	u, ok := auth.UserFromCtx(r.Context())
	if !ok {
		httpx.ErrJSON(w, 401, "unauthorized")
		return
	}
	id := r.PathValue("id")
	if id == "" {
		httpx.ErrJSON(w, 400, "missing id")
		return
	}
	if err := h.svc.MarkOneRead(r.Context(), u.ID, id); err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
