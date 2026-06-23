package users

import (
	"net/http"

	"kanban/internal/platform/httpx"
)

type Handler struct {
	repo *Repository
}

func NewHandler(repo *Repository) *Handler {
	return &Handler{repo: repo}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/users", h.list)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	users, err := h.repo.List(r.Context())
	if err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	httpx.WriteJSON(w, 200, users)
}
