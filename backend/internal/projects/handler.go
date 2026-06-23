package projects

import (
	"context"
	"net/http"

	"kanban/internal/auth"
	"kanban/internal/members"
	"kanban/internal/platform/httpx"
)

// roleGuard returns the caller's role inside a project (or "" if not a member)
// and answers ownership queries. Satisfied by *members.Repository.
type roleGuard interface {
	RoleByProject(ctx context.Context, projectID, userID string) (string, error)
	IsProjectOwner(ctx context.Context, projectID, userID string) (bool, error)
}

type Handler struct {
	svc   *Service
	guard roleGuard
}

func NewHandler(svc *Service, guard roleGuard) *Handler {
	return &Handler{svc: svc, guard: guard}
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/projects", h.list)
	mux.HandleFunc("POST /api/projects", h.create)
	mux.HandleFunc("PUT /api/projects/{id}", h.update)
	mux.HandleFunc("DELETE /api/projects/{id}", h.delete)
	mux.HandleFunc("POST /api/projects/{id}/transfer-ownership", h.transferOwnership)
}

func (h *Handler) list(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromCtx(r.Context())
	projects, err := h.svc.List(r.Context(), u.ID)
	if err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	httpx.WriteJSON(w, 200, projects)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Name          string            `json:"name"`
		Color         string            `json:"color"`
		Icon          string            `json:"icon"`
		Template      string            `json:"template"`
		MemberIDs     []string          `json:"memberIds"`
		MemberRoles   map[string]string `json:"memberRoles"`
		CustomColumns []string          `json:"customColumns"`
		InviteEmails  []struct {
			Email string `json:"email"`
			Role  string `json:"role"`
		} `json:"inviteEmails"`
	}
	if err := httpx.Decode(r, &body); err != nil || body.Name == "" {
		httpx.ErrJSON(w, 400, "name required")
		return
	}
	emailInvites := make([]EmailInvite, len(body.InviteEmails))
	for i, e := range body.InviteEmails {
		emailInvites[i] = EmailInvite{Email: e.Email, Role: e.Role}
	}
	u, _ := auth.UserFromCtx(r.Context())
	project, err := h.svc.Create(r.Context(), CreateInput{
		Name:          body.Name,
		Color:         body.Color,
		Icon:          body.Icon,
		Template:      body.Template,
		OwnerID:       u.ID,
		MemberIDs:     body.MemberIDs,
		MemberRoles:   body.MemberRoles,
		CustomColumns: body.CustomColumns,
		InviteEmails:  emailInvites,
	})
	if err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	httpx.WriteJSON(w, 201, project)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	u, _ := auth.UserFromCtx(r.Context())
	role, _ := h.guard.RoleByProject(r.Context(), id, u.ID)
	if !members.CanManageProject(role) {
		httpx.ErrJSON(w, 403, "forbidden")
		return
	}
	var body struct {
		Name          *string `json:"name"`
		Color         *string `json:"color"`
		Icon          *string `json:"icon"`
		ActiveBoardID *string `json:"activeBoardId"`
		Status        *string `json:"status"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.ErrJSON(w, 400, "invalid json")
		return
	}
	if err := h.svc.Update(r.Context(), id, body.Name, body.Color, body.Icon, body.ActiveBoardID, body.Status); err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	u, _ := auth.UserFromCtx(r.Context())
	owner, _ := h.guard.IsProjectOwner(r.Context(), id, u.ID)
	if !owner {
		httpx.ErrJSON(w, 403, "only project owner can delete the project")
		return
	}
	if err := h.svc.Delete(r.Context(), id); err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) transferOwnership(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	u, _ := auth.UserFromCtx(r.Context())
	owner, _ := h.guard.IsProjectOwner(r.Context(), id, u.ID)
	if !owner {
		httpx.ErrJSON(w, 403, "only project owner can transfer ownership")
		return
	}
	var body struct {
		UserID string `json:"userId"`
	}
	if err := httpx.Decode(r, &body); err != nil || body.UserID == "" {
		httpx.ErrJSON(w, 400, "userId required")
		return
	}
	if body.UserID == u.ID {
		httpx.ErrJSON(w, 400, "already the owner")
		return
	}
	if err := h.svc.TransferOwnership(r.Context(), id, body.UserID); err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
