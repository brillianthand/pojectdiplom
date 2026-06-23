package members

import (
	"context"
	"errors"
	"fmt"
	"net/http"

	"kanban/internal/auth"
	"kanban/internal/platform/httpx"
)

// RoleNotifier delivers role-change notifications. Satisfied by notifications.Service.
type RoleNotifier interface {
	CreateRoleChanged(ctx context.Context, userID, actorID, projectID, title string) error
}

type Handler struct {
	svc   *Service
	repo  *Repository
	notif RoleNotifier
}

func NewHandler(svc *Service, repo *Repository, notif RoleNotifier) *Handler {
	return &Handler{svc: svc, repo: repo, notif: notif}
}

// roleLabel — Russian display name for a project role. Used in notification copy.
func roleLabel(r string) string {
	switch r {
	case RoleAdmin:
		return "Администратор"
	case RoleManager:
		return "Менеджер"
	case RoleExecutor:
		return "Исполнитель"
	case RoleObserver:
		return "Наблюдатель"
	}
	return r
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/projects/{id}/members",             h.list)
	mux.HandleFunc("POST /api/projects/{id}/members",            h.invite)
	mux.HandleFunc("PATCH /api/projects/{id}/members/{userId}",  h.updateRole)
	mux.HandleFunc("DELETE /api/projects/{id}/members/{userId}", h.remove)

	mux.HandleFunc("POST /api/invitations/{projectId}/accept",   h.accept)
	mux.HandleFunc("POST /api/invitations/{projectId}/decline",  h.decline)
}

// callerRole returns the caller's role in projectID, or "" if not an accepted member.
func (h *Handler) callerRole(r *http.Request, projectID string) string {
	u, _ := auth.UserFromCtx(r.Context())
	role, _ := h.repo.RoleByProject(r.Context(), projectID, u.ID)
	return role
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	projectID := r.PathValue("id")
	if !CanView(h.callerRole(r, projectID)) {
		httpx.ErrJSON(w, 403, "forbidden")
		return
	}
	members, err := h.svc.List(r.Context(), projectID)
	if err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	httpx.WriteJSON(w, 200, members)
}

func (h *Handler) invite(w http.ResponseWriter, r *http.Request) {
	projectID := r.PathValue("id")
	u, _ := auth.UserFromCtx(r.Context())

	callerRole, _ := h.repo.RoleByProject(r.Context(), projectID, u.ID)
	if !CanManageMembers(callerRole) {
		httpx.ErrJSON(w, 403, "forbidden")
		return
	}

	var body struct {
		Email string `json:"email"`
		Role  string `json:"role"`
	}
	if err := httpx.Decode(r, &body); err != nil || body.Email == "" {
		httpx.ErrJSON(w, 400, "email required")
		return
	}
	if !IsValidRole(body.Role) {
		httpx.ErrJSON(w, 400, "invalid role")
		return
	}
	if body.Role == RoleAdmin && !CanAssignAdmin(callerRole) {
		httpx.ErrJSON(w, 403, "only admins can assign the admin role")
		return
	}

	member, err := h.svc.Invite(r.Context(), projectID, body.Email, body.Role, u.ID)
	switch {
	case errors.Is(err, ErrUserNotFound):
		httpx.ErrJSON(w, 404, "user not found")
		return
	case errors.Is(err, ErrAlreadyMember):
		httpx.ErrJSON(w, 409, "user already in project")
		return
	case errors.Is(err, ErrInvalidRole):
		httpx.ErrJSON(w, 400, "invalid role")
		return
	case err != nil:
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	httpx.WriteJSON(w, 201, member)
}

func (h *Handler) updateRole(w http.ResponseWriter, r *http.Request) {
	projectID := r.PathValue("id")
	targetID  := r.PathValue("userId")
	u, _ := auth.UserFromCtx(r.Context())

	callerRole, _ := h.repo.RoleByProject(r.Context(), projectID, u.ID)
	if !CanManageMembers(callerRole) {
		httpx.ErrJSON(w, 403, "forbidden")
		return
	}

	var body struct {
		Role string `json:"role"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.ErrJSON(w, 400, "invalid json")
		return
	}
	if !IsValidRole(body.Role) {
		httpx.ErrJSON(w, 400, "invalid role")
		return
	}

	// Owner is the sole admin who must stay admin — only ownership transfer can change that.
	isOwnerTarget, _ := h.repo.IsProjectOwner(r.Context(), projectID, targetID)
	if isOwnerTarget && body.Role != RoleAdmin {
		httpx.ErrJSON(w, 400, "project owner must remain admin")
		return
	}

	// Look up the target's current role to see whether the change touches admin status.
	current, err := h.repo.Find(r.Context(), projectID, targetID)
	if err != nil {
		httpx.ErrJSON(w, 404, "member not found")
		return
	}

	// Only an admin can grant or revoke the admin role.
	touchesAdmin := body.Role == RoleAdmin || current.Role == RoleAdmin
	if touchesAdmin && !CanAssignAdmin(callerRole) {
		httpx.ErrJSON(w, 403, "only admins can change the admin role")
		return
	}

	// Demoting the last admin would leave the project unmanageable.
	if current.Role == RoleAdmin && body.Role != RoleAdmin {
		n, _ := h.repo.AdminCount(r.Context(), projectID)
		if n <= 1 {
			httpx.ErrJSON(w, 400, "project must have at least one admin")
			return
		}
	}

	if err := h.svc.UpdateRole(r.Context(), projectID, targetID, body.Role); err != nil {
		if errors.Is(err, ErrInvalidRole) {
			httpx.ErrJSON(w, 400, "invalid role")
			return
		}
		httpx.ErrJSON(w, 500, err.Error())
		return
	}

	// Notify the target — but only if it's a real change made by someone else.
	if h.notif != nil && body.Role != current.Role && u.ID != targetID {
		projectName := h.svc.ProjectName(r.Context(), projectID)
		title := fmt.Sprintf("В проекте «%s»: ваша роль изменена с «%s» на «%s»",
			projectName, roleLabel(current.Role), roleLabel(body.Role))
		_ = h.notif.CreateRoleChanged(r.Context(), targetID, u.ID, projectID, title)
	}

	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) remove(w http.ResponseWriter, r *http.Request) {
	projectID := r.PathValue("id")
	targetID  := r.PathValue("userId")

	u, _ := auth.UserFromCtx(r.Context())
	if u.ID == targetID {
		httpx.ErrJSON(w, 400, "cannot remove yourself")
		return
	}

	callerRole, _ := h.repo.RoleByProject(r.Context(), projectID, u.ID)
	if !CanManageMembers(callerRole) {
		httpx.ErrJSON(w, 403, "forbidden")
		return
	}

	// The owner cannot be removed — ownership must be transferred first.
	isOwnerTarget, _ := h.repo.IsProjectOwner(r.Context(), projectID, targetID)
	if isOwnerTarget {
		httpx.ErrJSON(w, 400, "transfer ownership before removing the owner")
		return
	}

	// Removing an admin is itself an admin-only action.
	target, err := h.repo.Find(r.Context(), projectID, targetID)
	if err == nil && target.Role == RoleAdmin && !CanAssignAdmin(callerRole) {
		httpx.ErrJSON(w, 403, "only admins can remove an admin")
		return
	}

	if err := h.svc.Remove(r.Context(), projectID, targetID); err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) accept(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromCtx(r.Context())
	projectID := r.PathValue("projectId")
	m, err := h.svc.Accept(r.Context(), projectID, u.ID)
	if err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	httpx.WriteJSON(w, 200, m)
}

func (h *Handler) decline(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromCtx(r.Context())
	projectID := r.PathValue("projectId")
	if err := h.svc.Decline(r.Context(), projectID, u.ID); err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
