package boards

import (
	"context"
	"encoding/json"
	"net/http"

	"kanban/internal/auth"
	"kanban/internal/members"
	"kanban/internal/platform/httpx"
	"kanban/internal/realtime"
)

// roleGuard returns the caller's role inside a project, resolved by entity ID.
// Satisfied by *members.Repository.
type roleGuard interface {
	RoleByProject(ctx context.Context, projectID, userID string) (string, error)
	RoleByBoard(ctx context.Context, boardID, userID string) (string, error)
	RoleByColumn(ctx context.Context, columnID, userID string) (string, error)
}

type Handler struct {
	svc   *Service
	hub   *realtime.Hub
	guard roleGuard
}

func NewHandler(svc *Service, hub *realtime.Hub, guard roleGuard) *Handler {
	return &Handler{svc: svc, hub: hub, guard: guard}
}

// requireManager returns true if the caller has manager+ rights for the role they hold,
// otherwise writes 403 and returns false.
func (h *Handler) requireManager(w http.ResponseWriter, role string) bool {
	if members.CanManageBoards(role) {
		return true
	}
	httpx.ErrJSON(w, 403, "forbidden")
	return false
}

func (h *Handler) callerID(r *http.Request) string {
	u, _ := auth.UserFromCtx(r.Context())
	return u.ID
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/projects/{id}/boards", h.create)
	mux.HandleFunc("PUT /api/boards/{id}", h.update)
	mux.HandleFunc("DELETE /api/boards/{id}", h.delete)
	mux.HandleFunc("GET /api/boards/{id}", h.get)
	mux.HandleFunc("PUT /api/boards/{id}/columns/reorder", h.reorderColumns)
	mux.HandleFunc("POST /api/boards/{id}/share", h.share)
	mux.HandleFunc("PUT /api/boards/{id}/settings", h.updateSettings)

	mux.HandleFunc("POST /api/boards/{id}/columns", h.createColumn)
	mux.HandleFunc("PUT /api/columns/{id}", h.updateColumn)
	mux.HandleFunc("DELETE /api/columns/{id}", h.deleteColumn)
}

// RegisterPublic регистрирует публичные маршруты (без auth).
func (h *Handler) RegisterPublic(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/shared/{token}", h.sharedBoard)
}

func (h *Handler) publish(r *http.Request, boardID, eventType string) {
	if boardID != "" {
		h.hub.Publish(boardID, eventType, r.Header.Get("X-Client-ID"))
	}
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	projectID := r.PathValue("id")
	role, _ := h.guard.RoleByProject(r.Context(), projectID, h.callerID(r))
	if !h.requireManager(w, role) {
		return
	}
	var body struct {
		Name     string `json:"name"`
		Template string `json:"template"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.ErrJSON(w, 400, "invalid json")
		return
	}
	board, err := h.svc.CreateForProject(r.Context(), projectID, body.Name, body.Template)
	if err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	httpx.WriteJSON(w, 201, board)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	role, _ := h.guard.RoleByBoard(r.Context(), id, h.callerID(r))
	if !h.requireManager(w, role) {
		return
	}
	var body struct {
		Name string `json:"name"`
	}
	if err := httpx.Decode(r, &body); err != nil || body.Name == "" {
		httpx.ErrJSON(w, 400, "name required")
		return
	}
	if err := h.svc.Rename(r.Context(), id, body.Name); err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	h.publish(r, id, "board.updated")
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	role, _ := h.guard.RoleByBoard(r.Context(), id, h.callerID(r))
	if !h.requireManager(w, role) {
		return
	}
	if err := h.svc.Delete(r.Context(), id); err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	detail, err := h.svc.GetDetail(r.Context(), r.PathValue("id"))
	if err != nil {
		httpx.ErrJSON(w, 404, "board not found")
		return
	}
	httpx.WriteJSON(w, 200, detail)
}

func (h *Handler) reorderColumns(w http.ResponseWriter, r *http.Request) {
	boardID := r.PathValue("id")
	role, _ := h.guard.RoleByBoard(r.Context(), boardID, h.callerID(r))
	if !h.requireManager(w, role) {
		return
	}
	var ids []string
	if err := json.NewDecoder(r.Body).Decode(&ids); err != nil {
		httpx.ErrJSON(w, 400, "invalid json")
		return
	}
	if err := h.svc.ReorderColumns(r.Context(), boardID, ids); err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	h.publish(r, boardID, "columnsReordered")
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) createColumn(w http.ResponseWriter, r *http.Request) {
	boardID := r.PathValue("id")
	role, _ := h.guard.RoleByBoard(r.Context(), boardID, h.callerID(r))
	if !h.requireManager(w, role) {
		return
	}
	var body struct {
		Title     string `json:"title"`
		Color     string `json:"color"`
		TextColor string `json:"textColor"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.ErrJSON(w, 400, "invalid json")
		return
	}
	col, err := h.svc.CreateColumn(r.Context(), boardID, body.Title, body.Color, body.TextColor)
	if err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	h.publish(r, boardID, "columnCreated")
	httpx.WriteJSON(w, 201, col)
}

func (h *Handler) updateColumn(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	role, _ := h.guard.RoleByColumn(r.Context(), id, h.callerID(r))
	if !h.requireManager(w, role) {
		return
	}
	boardID := h.svc.BoardIDForColumn(r.Context(), id)
	var body struct {
		Title     *string `json:"title"`
		Color     *string `json:"color"`
		TextColor *string `json:"textColor"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.ErrJSON(w, 400, "invalid json")
		return
	}
	if err := h.svc.UpdateColumn(r.Context(), id, body.Title, body.Color, body.TextColor); err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	h.publish(r, boardID, "columnUpdated")
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) updateSettings(w http.ResponseWriter, r *http.Request) {
	boardID := r.PathValue("id")
	role, _ := h.guard.RoleByBoard(r.Context(), boardID, h.callerID(r))
	if !h.requireManager(w, role) {
		return
	}
	var body BoardSettings
	if err := httpx.Decode(r, &body); err != nil {
		httpx.ErrJSON(w, 400, "invalid json")
		return
	}
	if err := h.svc.UpdateSettings(r.Context(), boardID, body); err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	h.publish(r, boardID, "board.settings.updated")
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) share(w http.ResponseWriter, r *http.Request) {
	boardID := r.PathValue("id")
	role, _ := h.guard.RoleByBoard(r.Context(), boardID, h.callerID(r))
	if !h.requireManager(w, role) {
		return
	}
	token, err := h.svc.EnsureShareToken(r.Context(), boardID)
	if err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	httpx.WriteJSON(w, 200, map[string]string{"token": token})
}

func (h *Handler) sharedBoard(w http.ResponseWriter, r *http.Request) {
	detail, err := h.svc.GetDetailByToken(r.Context(), r.PathValue("token"))
	if err != nil {
		httpx.ErrJSON(w, 404, "board not found")
		return
	}
	httpx.WriteJSON(w, 200, detail)
}

func (h *Handler) deleteColumn(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	role, _ := h.guard.RoleByColumn(r.Context(), id, h.callerID(r))
	if !h.requireManager(w, role) {
		return
	}
	boardID := h.svc.BoardIDForColumn(r.Context(), id)
	if err := h.svc.DeleteColumn(r.Context(), id); err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	h.publish(r, boardID, "columnDeleted")
	w.WriteHeader(http.StatusNoContent)
}
