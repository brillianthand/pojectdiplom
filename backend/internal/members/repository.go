package members

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

func (r *Repository) List(ctx context.Context, projectID string) ([]Member, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT u.id, u.email, u.name, u.color, u.avatar_url, pm.role, pm.status
		FROM project_members pm
		JOIN users u ON u.id = pm.user_id
		WHERE pm.project_id = $1
		ORDER BY pm.status DESC, pm.added_at`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Member{}
	for rows.Next() {
		var m Member
		if err := rows.Scan(&m.ID, &m.Email, &m.Name, &m.Color, &m.AvatarURL, &m.Role, &m.Status); err != nil {
			return nil, err
		}
		m.Initials = users.InitialsFor(m.Name)
		out = append(out, m)
	}
	return out, rows.Err()
}

func (r *Repository) FindUserByEmail(ctx context.Context, email string) (users.User, error) {
	var u users.User
	err := r.db.QueryRowContext(ctx,
		`SELECT id, email, name, color, avatar_url FROM users WHERE LOWER(email) = LOWER($1)`, email,
	).Scan(&u.ID, &u.Email, &u.Name, &u.Color, &u.AvatarURL)
	if err != nil {
		return users.User{}, err
	}
	u.Initials = users.InitialsFor(u.Name)
	return u, nil
}

// Add inserts a member row with the given role and status. Returns the full hydrated row.
func (r *Repository) Add(ctx context.Context, projectID, userID, role, status string) (Member, error) {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO project_members (project_id, user_id, role, status)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (project_id, user_id) DO NOTHING`,
		projectID, userID, role, status)
	if err != nil {
		return Member{}, err
	}
	return r.Find(ctx, projectID, userID)
}

func (r *Repository) Find(ctx context.Context, projectID, userID string) (Member, error) {
	var m Member
	err := r.db.QueryRowContext(ctx, `
		SELECT u.id, u.email, u.name, u.color, u.avatar_url, pm.role, pm.status
		FROM project_members pm
		JOIN users u ON u.id = pm.user_id
		WHERE pm.project_id = $1 AND pm.user_id = $2`, projectID, userID,
	).Scan(&m.ID, &m.Email, &m.Name, &m.Color, &m.AvatarURL, &m.Role, &m.Status)
	if err != nil {
		return Member{}, err
	}
	m.Initials = users.InitialsFor(m.Name)
	return m, nil
}

func (r *Repository) Remove(ctx context.Context, projectID, userID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM project_members WHERE project_id = $1 AND user_id = $2`,
		projectID, userID)
	return err
}

func (r *Repository) UpdateRole(ctx context.Context, projectID, userID, role string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE project_members SET role = $3 WHERE project_id = $1 AND user_id = $2`,
		projectID, userID, role)
	return err
}

func (r *Repository) Accept(ctx context.Context, projectID, userID string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE project_members SET status = 'accepted'
		 WHERE project_id = $1 AND user_id = $2 AND status = 'pending'`,
		projectID, userID)
	return err
}

func (r *Repository) AddTx(ctx context.Context, tx *sql.Tx, projectID, userID, role string) error {
	_, err := tx.ExecContext(ctx,
		`INSERT INTO project_members (project_id, user_id, role, status)
		 VALUES ($1, $2, $3, 'accepted')
		 ON CONFLICT (project_id, user_id) DO NOTHING`,
		projectID, userID, role)
	return err
}

func (r *Repository) FindUserIDByEmail(ctx context.Context, email string) (string, error) {
	var id string
	err := r.db.QueryRowContext(ctx,
		`SELECT id FROM users WHERE LOWER(email) = LOWER($1)`, email,
	).Scan(&id)
	return id, err
}

func (r *Repository) AddPendingTx(ctx context.Context, tx *sql.Tx, projectID, userID, role string) error {
	_, err := tx.ExecContext(ctx,
		`INSERT INTO project_members (project_id, user_id, role, status)
		 VALUES ($1, $2, $3, 'pending')
		 ON CONFLICT (project_id, user_id) DO NOTHING`,
		projectID, userID, role)
	return err
}
