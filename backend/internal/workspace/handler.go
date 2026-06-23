package workspace

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
	mux.HandleFunc("GET /api/workspace", h.get)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromCtx(r.Context())
	ws, err := h.svc.Get(r.Context(), u.ID)
	if err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	httpx.WriteJSON(w, 200, ws)
}
