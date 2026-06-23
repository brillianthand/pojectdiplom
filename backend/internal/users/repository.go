package users

import (
	"context"
	"database/sql"

	"kanban/internal/platform/ids"
	"golang.org/x/crypto/bcrypt"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

const userCols = `id, email, name, color, avatar_url, is_admin, is_blocked, created_at`

func (r *Repository) Create(ctx context.Context, email, name, password string) (User, error) {
	hash, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)
	if err != nil {
		return User{}, err
	}
	id := ids.New()
	color := ColorForID(id)
	var u User
	err = r.db.QueryRowContext(ctx,
		`INSERT INTO users (id, email, name, password_hash, color)
		 VALUES ($1,$2,$3,$4,$5)
		 RETURNING `+userCols,
		id, email, name, string(hash), color,
	).Scan(&u.ID, &u.Email, &u.Name, &u.Color, &u.AvatarURL, &u.IsAdmin, &u.IsBlocked, &u.CreatedAt)
	if err != nil {
		return User{}, err
	}
	u.Initials = InitialsFor(u.Name)
	return u, nil
}

func (r *Repository) FindByEmail(ctx context.Context, email string) (User, string, error) {
	var u User
	var hash string
	err := r.db.QueryRowContext(ctx,
		`SELECT `+userCols+`, password_hash FROM users WHERE email = $1`, email,
	).Scan(&u.ID, &u.Email, &u.Name, &u.Color, &u.AvatarURL, &u.IsAdmin, &u.IsBlocked, &u.CreatedAt, &hash)
	if err != nil {
		return User{}, "", err
	}
	u.Initials = InitialsFor(u.Name)
	return u, hash, nil
}

func (r *Repository) List(ctx context.Context) ([]User, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT `+userCols+` FROM users ORDER BY name`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []User
	for rows.Next() {
		var u User
		if err := rows.Scan(&u.ID, &u.Email, &u.Name, &u.Color, &u.AvatarURL, &u.IsAdmin, &u.IsBlocked, &u.CreatedAt); err != nil {
			return nil, err
		}
		u.Initials = InitialsFor(u.Name)
		out = append(out, u)
	}
	if out == nil {
		out = []User{}
	}
	return out, rows.Err()
}

func (r *Repository) FindByID(ctx context.Context, id string) (User, error) {
	var u User
	err := r.db.QueryRowContext(ctx,
		`SELECT `+userCols+` FROM users WHERE id = $1`, id,
	).Scan(&u.ID, &u.Email, &u.Name, &u.Color, &u.AvatarURL, &u.IsAdmin, &u.IsBlocked, &u.CreatedAt)
	if err != nil {
		return User{}, err
	}
	u.Initials = InitialsFor(u.Name)
	return u, nil
}

func (r *Repository) UpdateProfile(ctx context.Context, id, name, avatarURL string) (User, error) {
	_, err := r.db.ExecContext(ctx,
		`UPDATE users SET name = $2, avatar_url = $3 WHERE id = $1`,
		id, name, avatarURL)
	if err != nil {
		return User{}, err
	}
	return r.FindByID(ctx, id)
}

func (r *Repository) GetPasswordHash(ctx context.Context, id string) (string, error) {
	var hash string
	err := r.db.QueryRowContext(ctx,
		`SELECT password_hash FROM users WHERE id = $1`, id,
	).Scan(&hash)
	return hash, err
}

func (r *Repository) HasAdmin(ctx context.Context) (bool, error) {
	var n int
	err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM users WHERE is_admin = TRUE`).Scan(&n)
	return n > 0, err
}

func (r *Repository) PromoteToAdmin(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE users SET is_admin = TRUE WHERE id = $1`, id)
	return err
}

func (r *Repository) UpdatePassword(ctx context.Context, id, newPassword string) error {
	hash, err := bcrypt.GenerateFromPassword([]byte(newPassword), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	_, err = r.db.ExecContext(ctx,
		`UPDATE users SET password_hash = $2 WHERE id = $1`, id, string(hash))
	return err
}

