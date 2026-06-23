package sprints

import (
	"context"
	"net/http"

	"kanban/internal/auth"
	"kanban/internal/members"
	"kanban/internal/platform/httpx"
)

type roleGuard interface {
	RoleByBoard(ctx context.Context, boardID, userID string) (string, error)
	RoleByTask(ctx context.Context, taskID, userID string) (string, error)
}

type Handler struct {
	svc   *Service
	guard roleGuard
}

func NewHandler(svc *Service, guard roleGuard) *Handler {
	return &Handler{svc: svc, guard: guard}
}

func (h *Handler) callerID(r *http.Request) string {
	u, _ := auth.UserFromCtx(r.Context())
	return u.ID
}

func (h *Handler) isManager(r *http.Request, boardID string) bool {
	role, _ := h.guard.RoleByBoard(r.Context(), boardID, h.callerID(r))
	return members.CanManageBoards(role)
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/boards/{id}/sprints", h.listBacklog)
	mux.HandleFunc("POST /api/boards/{id}/sprints", h.create)
	mux.HandleFunc("PUT /api/sprints/{id}", h.update)
	mux.HandleFunc("POST /api/sprints/{id}/start", h.start)
	mux.HandleFunc("POST /api/sprints/{id}/complete", h.complete)
	mux.HandleFunc("DELETE /api/sprints/{id}", h.delete)
	mux.HandleFunc("PATCH /api/tasks/{id}/sprint", h.setTaskSprint)
}

// GET /api/boards/{id}/sprints
func (h *Handler) listBacklog(w http.ResponseWriter, r *http.Request) {
	boardID := r.PathValue("id")
	resp, err := h.svc.GetBacklog(r.Context(), boardID)
	if err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	httpx.WriteJSON(w, 200, resp)
}

// POST /api/boards/{id}/sprints
func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	boardID := r.PathValue("id")
	if !h.isManager(r, boardID) {
		httpx.ErrJSON(w, 403, "forbidden")
		return
	}
	var body struct {
		Name      string  `json:"name"`
		Goal      string  `json:"goal"`
		StartDate *string `json:"startDate"`
		EndDate   *string `json:"endDate"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.ErrJSON(w, 400, "invalid json")
		return
	}
	sp, err := h.svc.Create(r.Context(), boardID, body.Name, body.Goal, body.StartDate, body.EndDate)
	if err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	httpx.WriteJSON(w, 201, sp)
}

// PUT /api/sprints/{id}
func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	sprintID := r.PathValue("id")
	sp, err := h.svc.repo.GetByID(r.Context(), sprintID)
	if err != nil {
		httpx.ErrJSON(w, 404, "sprint not found")
		return
	}
	if !h.isManager(r, sp.BoardID) {
		httpx.ErrJSON(w, 403, "forbidden")
		return
	}
	var body struct {
		Name      string  `json:"name"`
		Goal      string  `json:"goal"`
		StartDate *string `json:"startDate"`
		EndDate   *string `json:"endDate"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.ErrJSON(w, 400, "invalid json")
		return
	}
	updated, err := h.svc.Update(r.Context(), sprintID, body.Name, body.Goal, body.StartDate, body.EndDate)
	if err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	httpx.WriteJSON(w, 200, updated)
}

// POST /api/sprints/{id}/start
func (h *Handler) start(w http.ResponseWriter, r *http.Request) {
	sprintID := r.PathValue("id")
	sp, err := h.svc.repo.GetByID(r.Context(), sprintID)
	if err != nil {
		httpx.ErrJSON(w, 404, "sprint not found")
		return
	}
	if !h.isManager(r, sp.BoardID) {
		httpx.ErrJSON(w, 403, "forbidden")
		return
	}
	started, err := h.svc.Start(r.Context(), sprintID)
	if err != nil {
		httpx.ErrJSON(w, 400, err.Error())
		return
	}
	httpx.WriteJSON(w, 200, started)
}

// POST /api/sprints/{id}/complete
func (h *Handler) complete(w http.ResponseWriter, r *http.Request) {
	sprintID := r.PathValue("id")
	sp, err := h.svc.repo.GetByID(r.Context(), sprintID)
	if err != nil {
		httpx.ErrJSON(w, 404, "sprint not found")
		return
	}
	if !h.isManager(r, sp.BoardID) {
		httpx.ErrJSON(w, 403, "forbidden")
		return
	}
	completed, returned, err := h.svc.Complete(r.Context(), sprintID)
	if err != nil {
		httpx.ErrJSON(w, 400, err.Error())
		return
	}
	httpx.WriteJSON(w, 200, map[string]any{
		"sprint":   completed,
		"returned": returned,
	})
}

// DELETE /api/sprints/{id}
func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	sprintID := r.PathValue("id")
	sp, err := h.svc.repo.GetByID(r.Context(), sprintID)
	if err != nil {
		httpx.ErrJSON(w, 404, "sprint not found")
		return
	}
	if !h.isManager(r, sp.BoardID) {
		httpx.ErrJSON(w, 403, "forbidden")
		return
	}
	if err := h.svc.Delete(r.Context(), sprintID); err != nil {
		httpx.ErrJSON(w, 400, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// PATCH /api/tasks/{id}/sprint  — body: { sprintId: "id" | null }
func (h *Handler) setTaskSprint(w http.ResponseWriter, r *http.Request) {
	taskID := r.PathValue("id")
	var body struct {
		SprintID *string `json:"sprintId"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.ErrJSON(w, 400, "invalid json")
		return
	}
	if err := h.svc.SetTaskSprint(r.Context(), taskID, body.SprintID); err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
