package notifications

import (
	"context"
	"database/sql"

	"kanban/internal/platform/ids"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

const notifPageSize = 20

// List returns up to notifPageSize notifications for userID, ordered newest first.
// before is an optional ISO-8601 cursor: only notifications older than that timestamp are returned.
// The second return value indicates whether more items exist beyond this page.
func (r *Repository) List(ctx context.Context, userID, before string) ([]Notification, bool, error) {
	var (
		rows *sql.Rows
		err  error
	)
	if before != "" {
		rows, err = r.db.QueryContext(ctx, `
			SELECT id, type, title, read, created_at,
			       COALESCE(project_id, ''), COALESCE(invited_by, ''),
			       COALESCE(task_id, ''),    COALESCE(board_id, ''),
			       COALESCE(actor_id, '')
			FROM notifications
			WHERE user_id = $1 AND created_at < $2::timestamptz
			ORDER BY created_at DESC
			LIMIT $3`, userID, before, notifPageSize+1)
	} else {
		rows, err = r.db.QueryContext(ctx, `
			SELECT id, type, title, read, created_at,
			       COALESCE(project_id, ''), COALESCE(invited_by, ''),
			       COALESCE(task_id, ''),    COALESCE(board_id, ''),
			       COALESCE(actor_id, '')
			FROM notifications
			WHERE user_id = $1
			ORDER BY created_at DESC
			LIMIT $2`, userID, notifPageSize+1)
	}
	if err != nil {
		return nil, false, err
	}
	defer rows.Close()

	out := []Notification{}
	for rows.Next() {
		var n Notification
		if err := rows.Scan(&n.ID, &n.Type, &n.Title, &n.Read, &n.CreatedAt,
			&n.ProjectID, &n.InvitedBy, &n.TaskID, &n.BoardID, &n.ActorID); err != nil {
			return nil, false, err
		}
		out = append(out, n)
	}
	if err := rows.Err(); err != nil {
		return nil, false, err
	}

	hasMore := len(out) > notifPageSize
	if hasMore {
		out = out[:notifPageSize]
	}
	return out, hasMore, nil
}

func (r *Repository) UnreadCount(ctx context.Context, userID string) (int, error) {
	var n int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM notifications WHERE user_id = $1 AND read = FALSE`, userID,
	).Scan(&n)
	return n, err
}

// CreateInput captures all fields used when inserting a notification.
type CreateInput struct {
	UserID    string
	Type      string
	Title     string
	ProjectID string
	InvitedBy string
	TaskID    string
	BoardID   string
	ActorID   string
}

func (r *Repository) Create(ctx context.Context, in CreateInput) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO notifications (id, user_id, type, title, project_id, invited_by, task_id, board_id, actor_id)
		 VALUES ($1, $2, $3, $4, NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, ''), NULLIF($8, ''), NULLIF($9, ''))`,
		ids.New(), in.UserID, in.Type, in.Title,
		in.ProjectID, in.InvitedBy, in.TaskID, in.BoardID, in.ActorID)
	return err
}

func (r *Repository) MarkAllRead(ctx context.Context, userID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE notifications SET read = TRUE WHERE user_id = $1`, userID)
	return err
}

// MarkOneRead marks a single notification belonging to userID as read.
// Scoped by user_id so a user can't flip another user's notification.
func (r *Repository) MarkOneRead(ctx context.Context, userID, notifID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE notifications SET read = TRUE WHERE id = $1 AND user_id = $2`,
		notifID, userID)
	return err
}

// MarkInviteRead marks all invite notifications for (user, project) as read.
// Used when accepting or declining so the notification disappears from "unread".
func (r *Repository) MarkInviteRead(ctx context.Context, userID, projectID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE notifications SET read = TRUE
		 WHERE user_id = $1 AND project_id = $2 AND type = 'invite'`,
		userID, projectID)
	return err
}
