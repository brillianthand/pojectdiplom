package admin

import (
	"context"
	"database/sql"
	"time"

	"kanban/internal/users"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// UserRow — расширенный пользователь для админки: базовые поля + агрегаты.
type UserRow struct {
	users.User
	ProjectsCount int        `json:"projectsCount"`
	OwnedCount    int        `json:"ownedCount"`
	TasksCreated  int        `json:"tasksCreated"`
	LastActivity  *time.Time `json:"lastActivity"`
}

// Stats — KPI для шапки.
type Stats struct {
	Total       int `json:"total"`
	Admins      int `json:"admins"`
	Blocked     int `json:"blocked"`
	Active      int `json:"active"`
	NewLast7d   int `json:"newLast7d"`
	NewLast30d  int `json:"newLast30d"`
}

func (r *Repository) ListUsers(ctx context.Context) ([]UserRow, error) {
	const q = `
WITH
  proj_member AS (
    SELECT user_id, COUNT(*) AS cnt
      FROM project_members
     WHERE status = 'accepted'
     GROUP BY user_id
  ),
  proj_owner AS (
    SELECT owner_id AS user_id, COUNT(*) AS cnt
      FROM projects
     WHERE owner_id IS NOT NULL
     GROUP BY owner_id
  ),
  task_created AS (
    SELECT created_by AS user_id, COUNT(*) AS cnt, MAX(created_at) AS last_at
      FROM tasks
     WHERE created_by IS NOT NULL
     GROUP BY created_by
  ),
  event_activity AS (
    SELECT user_id, MAX(created_at) AS last_at
      FROM task_events
     WHERE user_id IS NOT NULL
     GROUP BY user_id
  ),
  comment_activity AS (
    SELECT user_id, MAX(created_at) AS last_at
      FROM comments
     WHERE user_id IS NOT NULL
     GROUP BY user_id
  )
SELECT u.id, u.email, u.name, u.color, u.avatar_url, u.is_admin, u.is_blocked, u.created_at,
       COALESCE(pm.cnt, 0) AS projects_count,
       COALESCE(po.cnt, 0) AS owned_count,
       COALESCE(tc.cnt, 0) AS tasks_created,
       GREATEST(
         COALESCE(tc.last_at, 'epoch'::timestamptz),
         COALESCE(ea.last_at, 'epoch'::timestamptz),
         COALESCE(ca.last_at, 'epoch'::timestamptz)
       ) AS last_activity
  FROM users u
  LEFT JOIN proj_member       pm ON pm.user_id = u.id
  LEFT JOIN proj_owner        po ON po.user_id = u.id
  LEFT JOIN task_created      tc ON tc.user_id = u.id
  LEFT JOIN event_activity    ea ON ea.user_id = u.id
  LEFT JOIN comment_activity  ca ON ca.user_id = u.id
 ORDER BY u.is_admin DESC, u.created_at DESC, u.id ASC`
	rows, err := r.db.QueryContext(ctx, q)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []UserRow
	for rows.Next() {
		var u UserRow
		var last time.Time
		if err := rows.Scan(
			&u.ID, &u.Email, &u.Name, &u.Color, &u.AvatarURL,
			&u.IsAdmin, &u.IsBlocked, &u.CreatedAt,
			&u.ProjectsCount, &u.OwnedCount, &u.TasksCreated,
			&last,
		); err != nil {
			return nil, err
		}
		u.Initials = users.InitialsFor(u.Name)
		if !last.IsZero() && last.Year() > 1971 {
			t := last
			u.LastActivity = &t
		}
		out = append(out, u)
	}
	if out == nil {
		out = []UserRow{}
	}
	return out, rows.Err()
}

func (r *Repository) Stats(ctx context.Context) (Stats, error) {
	const q = `
SELECT
  COUNT(*)                                                    AS total,
  COUNT(*) FILTER (WHERE is_admin)                            AS admins,
  COUNT(*) FILTER (WHERE is_blocked)                          AS blocked,
  COUNT(*) FILTER (WHERE NOT is_blocked)                      AS active,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')  AS new_7d,
  COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '30 days') AS new_30d
FROM users`
	var s Stats
	err := r.db.QueryRowContext(ctx, q).Scan(
		&s.Total, &s.Admins, &s.Blocked, &s.Active, &s.NewLast7d, &s.NewLast30d,
	)
	return s, err
}

func (r *Repository) CountAdmins(ctx context.Context) (int, error) {
	var n int
	err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM users WHERE is_admin = TRUE`).Scan(&n)
	return n, err
}

func (r *Repository) SetAdmin(ctx context.Context, id string, isAdmin bool) error {
	_, err := r.db.ExecContext(ctx, `UPDATE users SET is_admin = $2 WHERE id = $1`, id, isAdmin)
	return err
}

func (r *Repository) SetBlocked(ctx context.Context, id string, isBlocked bool) error {
	_, err := r.db.ExecContext(ctx, `UPDATE users SET is_blocked = $2 WHERE id = $1`, id, isBlocked)
	return err
}

func (r *Repository) Delete(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM users WHERE id = $1`, id)
	return err
}
