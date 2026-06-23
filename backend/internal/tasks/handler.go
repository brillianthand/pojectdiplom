package tasks

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strconv"
	"strings"

	"kanban/internal/auth"
	"kanban/internal/members"
	"kanban/internal/platform/httpx"
	"kanban/internal/realtime"
)

var mentionRe = regexp.MustCompile(`@<([^>]+)>`)

// NotificationCreator is satisfied by notifications.Service.
type NotificationCreator interface {
	Create(ctx context.Context, userID, notifType, title string) error
	CreateAssigned(ctx context.Context, userID, title, taskID, boardID string) error
	CreateCommented(ctx context.Context, userID, actorID, taskID, boardID, taskTitle string) error
	CreateMentioned(ctx context.Context, userID, actorID, taskID, boardID, taskTitle string) error
}

// roleGuard resolves the caller's project role from any task-scoped entity ID.
// Satisfied by *members.Repository.
type roleGuard interface {
	RoleByColumn(ctx context.Context, columnID, userID string) (string, error)
	RoleByTask(ctx context.Context, taskID, userID string) (string, error)
	RoleByComment(ctx context.Context, commentID, userID string) (string, error)
	RoleBySubtask(ctx context.Context, subtaskID, userID string) (string, error)
	RoleByBoard(ctx context.Context, boardID, userID string) (string, error)
}

type Handler struct {
	svc   *Service
	hub   *realtime.Hub
	notif NotificationCreator
	guard roleGuard
}

func NewHandler(svc *Service, hub *realtime.Hub, notif NotificationCreator, guard roleGuard) *Handler {
	return &Handler{svc: svc, hub: hub, notif: notif, guard: guard}
}

func (h *Handler) callerID(r *http.Request) string {
	u, _ := auth.UserFromCtx(r.Context())
	return u.ID
}

// requireExecutor enforces "executor or above" — the bar for any write on tasks/comments/subtasks.
func (h *Handler) requireExecutor(w http.ResponseWriter, role string) bool {
	if members.CanEditTasks(role) {
		return true
	}
	httpx.ErrJSON(w, 403, "forbidden")
	return false
}

// RegisterPublic registers routes that don't need auth middleware.
func (h *Handler) RegisterPublic(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/attachments/{id}", h.serveAttachment)
}

// decodeDataURL strips the "data:<mime>;base64," prefix and decodes the payload.
func decodeDataURL(dataURL string) ([]byte, error) {
	idx := strings.Index(dataURL, ",")
	if idx < 0 {
		return base64.StdEncoding.DecodeString(dataURL)
	}
	return base64.StdEncoding.DecodeString(dataURL[idx+1:])
}

func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/search", h.search)
	mux.HandleFunc("GET /api/tasks/{id}", h.get)
	mux.HandleFunc("GET /api/tasks/{id}/events", h.listEvents)
	mux.HandleFunc("POST /api/columns/{id}/tasks", h.create)
	mux.HandleFunc("PUT /api/tasks/{id}", h.update)
	mux.HandleFunc("DELETE /api/tasks/{id}", h.delete)
	mux.HandleFunc("PUT /api/tasks/{id}/move", h.move)
	mux.HandleFunc("POST /api/tasks/{id}/duplicate", h.duplicate)
	mux.HandleFunc("POST /api/tasks/{id}/archive", h.archive)
	mux.HandleFunc("POST /api/tasks/{id}/restore", h.restore)
	mux.HandleFunc("GET /api/boards/{id}/archive", h.listArchived)
	mux.HandleFunc("POST /api/tasks/{id}/comments", h.addComment)
	mux.HandleFunc("PUT /api/tasks/{tid}/comments/{cid}", h.updateComment)
	mux.HandleFunc("DELETE /api/comments/{id}", h.deleteComment)

	mux.HandleFunc("POST /api/tasks/{id}/subtasks", h.addSubtask)
	mux.HandleFunc("PUT /api/subtasks/{id}", h.updateSubtask)
	mux.HandleFunc("DELETE /api/subtasks/{id}", h.deleteSubtask)

	mux.HandleFunc("POST /api/tasks/{id}/star", h.star)
	mux.HandleFunc("DELETE /api/tasks/{id}/star", h.unstar)
	mux.HandleFunc("GET /api/stars", h.listStars)

	mux.HandleFunc("GET /api/feed", h.feed)
}

func (h *Handler) feed(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromCtx(r.Context())
	limit := 20
	if v := r.URL.Query().Get("limit"); v != "" {
		if n, err := strconv.Atoi(v); err == nil {
			limit = n
		}
	}
	items, err := h.svc.FeedForUser(r.Context(), u.ID, limit)
	if err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	httpx.WriteJSON(w, 200, items)
}

func (h *Handler) star(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	u, _ := auth.UserFromCtx(r.Context())
	role, _ := h.guard.RoleByTask(r.Context(), id, u.ID)
	if !members.CanView(role) {
		httpx.ErrJSON(w, 403, "forbidden")
		return
	}
	if err := h.svc.Star(r.Context(), u.ID, id); err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) unstar(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	u, _ := auth.UserFromCtx(r.Context())
	if err := h.svc.Unstar(r.Context(), u.ID, id); err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) listStars(w http.ResponseWriter, r *http.Request) {
	u, _ := auth.UserFromCtx(r.Context())
	ids, err := h.svc.ListStarredIDs(r.Context(), u.ID)
	if err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	httpx.WriteJSON(w, 200, ids)
}

func (h *Handler) listEvents(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	events, err := h.svc.ListEvents(r.Context(), id)
	if err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	httpx.WriteJSON(w, 200, events)
}

func (h *Handler) publish(r *http.Request, boardID, eventType string) {
	if boardID != "" {
		h.hub.Publish(boardID, eventType, r.Header.Get("X-Client-ID"))
	}
}

func (h *Handler) search(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if len(q) < 2 {
		httpx.WriteJSON(w, 200, []struct{}{})
		return
	}
	u, _ := auth.UserFromCtx(r.Context())
	results, err := h.svc.Search(r.Context(), u.ID, q, 15)
	if err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	httpx.WriteJSON(w, 200, results)
}

func (h *Handler) get(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	task, err := h.svc.GetByID(r.Context(), id)
	if err != nil {
		httpx.ErrJSON(w, 404, "task not found")
		return
	}
	httpx.WriteJSON(w, 200, task)
}

func (h *Handler) listArchived(w http.ResponseWriter, r *http.Request) {
	boardID := r.PathValue("id")
	tasks, err := h.svc.ListArchived(r.Context(), boardID)
	if err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	httpx.WriteJSON(w, 200, tasks)
}

func (h *Handler) restore(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	role, _ := h.guard.RoleByTask(r.Context(), id, h.callerID(r))
	if !h.requireExecutor(w, role) {
		return
	}
	boardID := h.svc.BoardIDForTask(r.Context(), id)
	if err := h.svc.Restore(r.Context(), id); err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	u, _ := auth.UserFromCtx(r.Context())
	h.svc.LogEvent(r.Context(), id, u.ID, EvRestored, nil)
	h.publish(r, boardID, "taskRestored")
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) archive(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	role, _ := h.guard.RoleByTask(r.Context(), id, h.callerID(r))
	if !h.requireExecutor(w, role) {
		return
	}
	boardID := h.svc.BoardIDForTask(r.Context(), id)
	if err := h.svc.Archive(r.Context(), id); err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	u, _ := auth.UserFromCtx(r.Context())
	h.svc.LogEvent(r.Context(), id, u.ID, EvArchived, nil)
	h.publish(r, boardID, "taskArchived")
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) duplicate(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	role, _ := h.guard.RoleByTask(r.Context(), id, h.callerID(r))
	if !h.requireExecutor(w, role) {
		return
	}
	boardID := h.svc.BoardIDForTask(r.Context(), id)
	task, err := h.svc.Duplicate(r.Context(), id)
	if err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	h.publish(r, boardID, "taskCreated")
	httpx.WriteJSON(w, 201, task)
}

func (h *Handler) create(w http.ResponseWriter, r *http.Request) {
	columnID := r.PathValue("id")
	role, _ := h.guard.RoleByColumn(r.Context(), columnID, h.callerID(r))
	if !h.requireExecutor(w, role) {
		return
	}
	var body struct {
		Title string `json:"title"`
	}
	if err := httpx.Decode(r, &body); err != nil || body.Title == "" {
		httpx.ErrJSON(w, 400, "title required")
		return
	}
	task, err := h.svc.Create(r.Context(), columnID, body.Title)
	if err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	u, _ := auth.UserFromCtx(r.Context())
	h.svc.LogEvent(r.Context(), task.ID, u.ID, EvCreated, nil)
	h.publish(r, h.svc.BoardIDForColumn(r.Context(), columnID), "taskCreated")
	httpx.WriteJSON(w, 201, task)
}

func (h *Handler) update(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	role, _ := h.guard.RoleByTask(r.Context(), id, h.callerID(r))
	if !h.requireExecutor(w, role) {
		return
	}
	boardID := h.svc.BoardIDForTask(r.Context(), id)

	var raw map[string]json.RawMessage
	if err := json.NewDecoder(r.Body).Decode(&raw); err != nil {
		httpx.ErrJSON(w, 400, "invalid json")
		return
	}

	// Reject assignees who lack executor+ in this project — observers cannot own work.
	if assigneesRaw, ok := raw["assignees"]; ok {
		var requested []string
		if err := json.Unmarshal(assigneesRaw, &requested); err == nil {
			for _, uid := range requested {
				if uid == "" {
					continue
				}
				assigneeRole, _ := h.guard.RoleByTask(r.Context(), id, uid)
				if !members.CanBeAssignee(assigneeRole) {
					httpx.ErrJSON(w, 400, "assignee must be at least an executor in this project")
					return
				}
			}
		}
	}

	// Snapshot before update — used both for assignee notifications and event-log diff.
	before, _ := h.svc.GetByID(r.Context(), id)

	if err := h.svc.Update(r.Context(), id, raw); err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}

	caller, _ := auth.UserFromCtx(r.Context())

	// Notify users who were newly assigned.
	if h.notif != nil {
		if assigneesRaw, ok := raw["assignees"]; ok {
			var newAssignees []string
			json.Unmarshal(assigneesRaw, &newAssignees)
			title := h.svc.GetTitle(r.Context(), id)
			oldSet := make(map[string]bool, len(before.Assignees))
			for _, a := range before.Assignees {
				oldSet[a] = true
			}
			for _, aID := range newAssignees {
				if !oldSet[aID] && aID != caller.ID {
					h.notif.CreateAssigned(r.Context(), aID, "Вас назначили на задачу: "+title, id, boardID)
				}
			}
		}
	}

	h.logUpdateDiff(r, id, before, raw, caller.ID)
	h.publish(r, boardID, "taskUpdated")
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) logUpdateDiff(r *http.Request, taskID string, before Task, raw map[string]json.RawMessage, userID string) {
	ctx := r.Context()
	logIfChangedStr := func(key, evType, oldVal string) {
		v, ok := raw[key]
		if !ok {
			return
		}
		var s string
		json.Unmarshal(v, &s)
		if s != oldVal {
			h.svc.LogEvent(ctx, taskID, userID, evType, map[string]string{"from": oldVal, "to": s})
		}
	}
	logIfChangedStr("title", EvTitle, before.Title)
	logIfChangedStr("priority", EvPriority, before.Priority)
	logIfChangedStr("type", EvType, before.Type)

	if v, ok := raw["description"]; ok {
		var s string
		json.Unmarshal(v, &s)
		if s != before.Description {
			h.svc.LogEvent(ctx, taskID, userID, EvDescription, nil)
		}
	}

	if v, ok := raw["completed"]; ok {
		var b bool
		json.Unmarshal(v, &b)
		if b != before.Completed {
			h.svc.LogEvent(ctx, taskID, userID, EvCompleted, map[string]bool{"completed": b})
		}
	}

	logDate := func(key, evType string, oldVal *string) {
		v, ok := raw[key]
		if !ok {
			return
		}
		var s *string
		json.Unmarshal(v, &s)
		oldStr := ""
		if oldVal != nil {
			oldStr = *oldVal
		}
		newStr := ""
		if s != nil {
			newStr = *s
		}
		if oldStr != newStr {
			h.svc.LogEvent(ctx, taskID, userID, evType, map[string]string{"from": oldStr, "to": newStr})
		}
	}
	logDate("startDate", EvStartDate, before.StartDate)
	logDate("dueDate", EvDueDate, before.DueDate)

	if v, ok := raw["tags"]; ok {
		var tags []string
		json.Unmarshal(v, &tags)
		oldSet := make(map[string]bool, len(before.Tags))
		for _, t := range before.Tags {
			oldSet[t] = true
		}
		newSet := make(map[string]bool, len(tags))
		for _, t := range tags {
			newSet[t] = true
		}
		for _, t := range tags {
			if !oldSet[t] {
				h.svc.LogEvent(ctx, taskID, userID, EvTagAdded, map[string]string{"tag": t})
			}
		}
		for _, t := range before.Tags {
			if !newSet[t] {
				h.svc.LogEvent(ctx, taskID, userID, EvTagRemoved, map[string]string{"tag": t})
			}
		}
	}

	if v, ok := raw["assignees"]; ok {
		var assignees []string
		json.Unmarshal(v, &assignees)
		oldSet := make(map[string]bool, len(before.Assignees))
		for _, a := range before.Assignees {
			oldSet[a] = true
		}
		newSet := make(map[string]bool, len(assignees))
		for _, a := range assignees {
			newSet[a] = true
		}
		for _, a := range assignees {
			if !oldSet[a] {
				h.svc.LogEvent(ctx, taskID, userID, EvAssigneeAdded, map[string]string{"userId": a})
			}
		}
		for _, a := range before.Assignees {
			if !newSet[a] {
				h.svc.LogEvent(ctx, taskID, userID, EvAssigneeRemoved, map[string]string{"userId": a})
			}
		}
	}
}

func (h *Handler) delete(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	role, _ := h.guard.RoleByTask(r.Context(), id, h.callerID(r))
	if !h.requireExecutor(w, role) {
		return
	}
	boardID := h.svc.BoardIDForTask(r.Context(), id)
	if err := h.svc.Delete(r.Context(), id); err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	h.publish(r, boardID, "taskDeleted")
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) move(w http.ResponseWriter, r *http.Request) {
	taskID := r.PathValue("id")
	role, _ := h.guard.RoleByTask(r.Context(), taskID, h.callerID(r))
	if !h.requireExecutor(w, role) {
		return
	}
	var body struct {
		ToColumnID string   `json:"toColumnId"`
		FromIds    []string `json:"fromIds"`
		ToIds      []string `json:"toIds"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.ErrJSON(w, 400, "invalid json")
		return
	}
	boardID := h.svc.BoardIDForColumn(r.Context(), body.ToColumnID)

	// Snapshot the source column to log a meaningful "moved" event after the mutation succeeds.
	before, _ := h.svc.GetByID(r.Context(), taskID)
	fromColID := before.ColumnID

	if err := h.svc.Move(r.Context(), taskID, body.ToColumnID, body.FromIds, body.ToIds); err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	if fromColID != "" && fromColID != body.ToColumnID {
		u, _ := auth.UserFromCtx(r.Context())
		h.svc.LogEvent(r.Context(), taskID, u.ID, EvMoved, map[string]string{
			"fromColumnId":    fromColID,
			"toColumnId":      body.ToColumnID,
			"fromColumnTitle": h.svc.ColumnTitle(r.Context(), fromColID),
			"toColumnTitle":   h.svc.ColumnTitle(r.Context(), body.ToColumnID),
		})
	}
	h.publish(r, boardID, "taskMoved")
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) serveAttachment(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	filename, contentType, data, err := h.svc.GetAttachment(r.Context(), id)
	if err != nil {
		http.NotFound(w, r)
		return
	}
	if contentType == "" {
		contentType = "application/octet-stream"
	}
	w.Header().Set("Content-Type", contentType)
	w.Header().Set("Content-Disposition", fmt.Sprintf(`inline; filename="%s"`, filename))
	w.Header().Set("Cache-Control", "private, max-age=86400")
	w.Write(data)
}

func (h *Handler) addComment(w http.ResponseWriter, r *http.Request) {
	taskID := r.PathValue("id")
	role, _ := h.guard.RoleByTask(r.Context(), taskID, h.callerID(r))
	if !members.CanComment(role) {
		httpx.ErrJSON(w, 403, "forbidden")
		return
	}
	boardID := h.svc.BoardIDForTask(r.Context(), taskID)
	var body struct {
		Text        string `json:"text"`
		Attachments []struct {
			Filename    string `json:"filename"`
			ContentType string `json:"contentType"`
			Data        string `json:"data"` // base64 data URL
		} `json:"attachments"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.ErrJSON(w, 400, "invalid json")
		return
	}
	const maxFileSize = 10 << 20 // 10 MB
	var attachments []NewAttachment
	for _, a := range body.Attachments {
		raw, err := decodeDataURL(a.Data)
		if err != nil || len(raw) > maxFileSize {
			continue
		}
		attachments = append(attachments, NewAttachment{
			Filename:    a.Filename,
			ContentType: a.ContentType,
			Data:        raw,
		})
	}
	u, _ := auth.UserFromCtx(r.Context())
	author := u.Name
	if author == "" {
		author = "Anonymous"
	}
	c, err := h.svc.AddComment(r.Context(), taskID, u.ID, author, u.Color, u.Initials, body.Text, attachments)
	if err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}

	if h.notif != nil {
		task, _ := h.svc.GetByID(r.Context(), taskID)
		taskTitle := task.Title

		// Collect mentioned user IDs first so assignees who are also mentioned
		// only receive the more specific "mentioned" notification.
		mentionedSet := make(map[string]bool)
		for _, m := range mentionRe.FindAllStringSubmatch(body.Text, -1) {
			uid := m[1]
			if uid != u.ID {
				mentionedSet[uid] = true
			}
		}

		// Notify assignees (excluding the commenter and mentioned users).
		for _, aID := range task.Assignees {
			if aID != u.ID && !mentionedSet[aID] {
				h.notif.CreateCommented(r.Context(), aID, u.ID, taskID, boardID, taskTitle)
			}
		}

		// Notify @mentioned users.
		for uid := range mentionedSet {
			h.notif.CreateMentioned(r.Context(), uid, u.ID, taskID, boardID, taskTitle)
		}
	}

	h.publish(r, boardID, "commentAdded")
	httpx.WriteJSON(w, 201, c)
}

func (h *Handler) updateComment(w http.ResponseWriter, r *http.Request) {
	taskID := r.PathValue("tid")
	commentID := r.PathValue("cid")
	u, _ := auth.UserFromCtx(r.Context())
	role, _ := h.guard.RoleByComment(r.Context(), commentID, u.ID)
	if !members.CanComment(role) {
		httpx.ErrJSON(w, 403, "forbidden")
		return
	}
	var body struct {
		Text string `json:"text"`
	}
	if err := httpx.Decode(r, &body); err != nil || body.Text == "" {
		httpx.ErrJSON(w, 400, "text required")
		return
	}
	// Service enforces author-only edit; project role just gates write access.
	if err := h.svc.UpdateComment(r.Context(), commentID, u.ID, body.Text); err != nil {
		httpx.ErrJSON(w, 403, "cannot edit comment")
		return
	}
	boardID := h.svc.BoardIDForTask(r.Context(), taskID)
	h.publish(r, boardID, "commentUpdated")
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) deleteComment(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	role, _ := h.guard.RoleByComment(r.Context(), id, h.callerID(r))
	if !members.CanComment(role) {
		httpx.ErrJSON(w, 403, "forbidden")
		return
	}
	if err := h.svc.DeleteComment(r.Context(), id); err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) addSubtask(w http.ResponseWriter, r *http.Request) {
	taskID := r.PathValue("id")
	role, _ := h.guard.RoleByTask(r.Context(), taskID, h.callerID(r))
	if !h.requireExecutor(w, role) {
		return
	}
	var body struct {
		Title string `json:"title"`
	}
	if err := httpx.Decode(r, &body); err != nil || body.Title == "" {
		httpx.ErrJSON(w, 400, "title required")
		return
	}
	s, err := h.svc.AddSubtask(r.Context(), taskID, body.Title)
	if err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	h.publish(r, h.svc.BoardIDForTask(r.Context(), taskID), "subtaskCreated")
	httpx.WriteJSON(w, 201, s)
}

func (h *Handler) updateSubtask(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	role, _ := h.guard.RoleBySubtask(r.Context(), id, h.callerID(r))
	if !h.requireExecutor(w, role) {
		return
	}
	var body struct {
		Title     *string `json:"title"`
		Completed *bool   `json:"completed"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.ErrJSON(w, 400, "invalid json")
		return
	}
	if err := h.svc.UpdateSubtask(r.Context(), id, body.Title, body.Completed); err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	h.publish(r, h.svc.BoardIDForSubtask(r.Context(), id), "subtaskUpdated")
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handler) deleteSubtask(w http.ResponseWriter, r *http.Request) {
	id := r.PathValue("id")
	role, _ := h.guard.RoleBySubtask(r.Context(), id, h.callerID(r))
	if !h.requireExecutor(w, role) {
		return
	}
	boardID := h.svc.BoardIDForSubtask(r.Context(), id)
	if err := h.svc.DeleteSubtask(r.Context(), id); err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	h.publish(r, boardID, "subtaskDeleted")
	w.WriteHeader(http.StatusNoContent)
}
