package personaltasks

import (
	"database/sql"
	"encoding/json"
	"errors"
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
	mux.HandleFunc("GET /api/personal-tasks", h.list)
	mux.HandleFunc("POST /api/personal-tasks", h.create)
	mux.HandleFunc("PUT /api/personal-tasks/{id}", h.update)
	mux.HandleFunc("DELETE /api/personal-tasks/{id}", h.delete)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	u, ok := auth.UserFromCtx(r.Context())
	if !ok {
		httpx.ErrJSON(w, 401, "unauthorized")
		return
	}
	items, err := h.svc.List(r.Context(), u.ID)
	if err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	httpx.WriteJSON(w, 200, items)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	u, ok := auth.UserFromCtx(r.Context())
	if !ok {
		httpx.ErrJSON(w, 401, "unauthorized")
		return
	}
	var body struct {
		Title   string  `json:"title"`
		Notes   string  `json:"notes"`
		DueDate *string `json:"dueDate"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.ErrJSON(w, 400, "invalid body")
		return
	}
	task, err := h.svc.Create(r.Context(), u.ID, CreateInput{
		Title:   body.Title,
		Notes:   body.Notes,
		DueDate: body.DueDate,
	})
	if err != nil {
		httpx.ErrJSON(w, 400, err.Error())
		return
	}
	httpx.WriteJSON(w, 201, task)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
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

	// Decode into raw keys so we can distinguish "field omitted" from "field set to null/empty".
	raw := map[string]json.RawMessage{}
	if err := httpx.Decode(r, &raw); err != nil {
		httpx.ErrJSON(w, 400, "invalid body")
		return
	}

	var in UpdateInput
	if v, ok := raw["title"]; ok {
		var s string
		if json.Unmarshal(v, &s) == nil {
			in.Title = &s
		}
	}
	if v, ok := raw["notes"]; ok {
		var s string
		if json.Unmarshal(v, &s) == nil {
			in.Notes = &s
		}
	}
	if v, ok := raw["completed"]; ok {
		var b bool
		if json.Unmarshal(v, &b) == nil {
			in.Completed = &b
		}
	}
	if v, ok := raw["dueDate"]; ok {
		in.DueDateSet = true
		var s *string
		if json.Unmarshal(v, &s) == nil {
			in.DueDate = s
		}
	}

	task, err := h.svc.Update(r.Context(), u.ID, id, in)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			httpx.ErrJSON(w, 404, "not found")
			return
		}
		httpx.ErrJSON(w, 400, err.Error())
		return
	}
	httpx.WriteJSON(w, 200, task)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
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
	if err := h.svc.Delete(r.Context(), u.ID, id); err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
