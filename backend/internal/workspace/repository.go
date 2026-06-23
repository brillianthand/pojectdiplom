package workspace

import (
	"context"
	"database/sql"

	"kanban/internal/users"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) ProjectStats(ctx context.Context, userID string) ([]ProjectStat, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT
			p.id, p.name, p.color, p.icon, COALESCE(p.owner_id, ''), COALESCE(p.active_board_id, ''), p.status,
			(SELECT COUNT(*) FROM project_members
			   WHERE project_id = p.id AND status = 'accepted') AS members_count,
			(SELECT COUNT(*) FROM boards WHERE project_id = p.id) AS boards_count,
			COALESCE((
				SELECT COUNT(*) FROM tasks t
				JOIN columns c ON c.id = t.column_id
				JOIN boards b ON b.id = c.board_id
				WHERE b.project_id = p.id AND t.archived_at IS NULL
			), 0) AS tasks_total,
			COALESCE((
				SELECT COUNT(*) FROM tasks t
				JOIN columns c ON c.id = t.column_id
				JOIN boards b ON b.id = c.board_id
				WHERE b.project_id = p.id AND t.completed AND t.archived_at IS NULL
			), 0) AS tasks_done,
			(
				SELECT MAX(t.created_at) FROM tasks t
				JOIN columns c ON c.id = t.column_id
				JOIN boards b ON b.id = c.board_id
				WHERE b.project_id = p.id AND t.archived_at IS NULL
			) AS last_activity
		FROM projects p
		JOIN project_members pm ON pm.project_id = p.id
		WHERE pm.user_id = $1 AND pm.status = 'accepted'
		ORDER BY p.created_at`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []ProjectStat{}
	for rows.Next() {
		var p ProjectStat
		if err := rows.Scan(
			&p.ID, &p.Name, &p.Color, &p.Icon, &p.OwnerID, &p.ActiveBoardID, &p.Status,
			&p.MembersCount, &p.BoardsCount,
			&p.TasksTotal, &p.TasksDone, &p.LastActivity,
		); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *Repository) People(ctx context.Context, userID string) ([]Person, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT u.id, u.email, u.name, u.color, u.avatar_url, COUNT(DISTINCT pm.project_id) AS projects_count
		FROM users u
		JOIN project_members pm ON pm.user_id = u.id AND pm.status = 'accepted'
		WHERE pm.project_id IN (
			SELECT project_id FROM project_members
			WHERE user_id = $1 AND status = 'accepted'
		)
		GROUP BY u.id, u.email, u.name, u.color, u.avatar_url
		ORDER BY u.name`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Person{}
	for rows.Next() {
		var p Person
		if err := rows.Scan(&p.ID, &p.Email, &p.Name, &p.Color, &p.AvatarURL, &p.ProjectsCount); err != nil {
			return nil, err
		}
		p.Initials = users.InitialsFor(p.Name)
		p.IsYou = p.ID == userID
		out = append(out, p)
	}
	return out, rows.Err()
}

func (r *Repository) MyOpenTasksCount(ctx context.Context, userID string) (int, error) {
	var n int
	err := r.db.QueryRowContext(ctx, `
		SELECT COUNT(*)
		FROM tasks t
		JOIN task_assignees ta ON ta.task_id = t.id
		WHERE ta.member_id = $1 AND NOT t.completed AND t.archived_at IS NULL
	`, userID).Scan(&n)
	return n, err
}

// PendingInvites returns users who have pending invitations to any project visible to userID.
func (r *Repository) PendingInvites(ctx context.Context, userID string) ([]PendingInvite, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT u.email, COUNT(*) AS projects_count
		FROM project_members pm
		JOIN users u ON u.id = pm.user_id
		WHERE pm.status = 'pending' AND pm.project_id IN (
			SELECT project_id FROM project_members
			WHERE user_id = $1 AND status = 'accepted'
		)
		GROUP BY u.email
		ORDER BY u.email`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []PendingInvite{}
	for rows.Next() {
		var p PendingInvite
		if err := rows.Scan(&p.Email, &p.ProjectsCount); err != nil {
			return nil, err
		}
		out = append(out, p)
	}
	return out, rows.Err()
}
