package projects

import (
	"context"
	"database/sql"

	"kanban/internal/platform/ids"
)

type Querier interface {
	ExecContext(ctx context.Context, q string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, q string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, q string, args ...any) *sql.Row
}

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) List(ctx context.Context, userID string) ([]Project, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT p.id, p.name, p.color, p.icon, COALESCE(p.owner_id, ''), COALESCE(p.active_board_id, ''), p.status
		 FROM projects p
		 JOIN project_members pm ON pm.project_id = p.id
		 WHERE pm.user_id = $1 AND pm.status = 'accepted'
		 ORDER BY p.created_at`,
		userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	projects := []Project{}
	for rows.Next() {
		var p Project
		if err := rows.Scan(&p.ID, &p.Name, &p.Color, &p.Icon, &p.OwnerID, &p.ActiveBoardID, &p.Status); err != nil {
			return nil, err
		}
		projects = append(projects, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	for i := range projects {
		boards, err := r.listBoards(ctx, projects[i].ID)
		if err != nil {
			return nil, err
		}
		projects[i].Boards = boards
		validID := false
		for _, b := range boards {
			if b.ID == projects[i].ActiveBoardID {
				validID = true
				break
			}
		}
		if (!validID || projects[i].ActiveBoardID == "") && len(boards) > 0 {
			projects[i].ActiveBoardID = boards[0].ID
		}
	}
	return projects, nil
}

func (r *Repository) listBoards(ctx context.Context, projectID string) ([]BoardSummary, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, name FROM boards WHERE project_id = $1 ORDER BY position, created_at`, projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []BoardSummary{}
	for rows.Next() {
		var b BoardSummary
		if err := rows.Scan(&b.ID, &b.Name); err != nil {
			return nil, err
		}
		out = append(out, b)
	}
	return out, rows.Err()
}

func (r *Repository) InsertTx(ctx context.Context, tx *sql.Tx, name, color, icon, ownerID string, _ []string) (string, error) {
	id := ids.New()
	_, err := tx.ExecContext(ctx,
		`INSERT INTO projects (id, name, color, icon, owner_id) VALUES ($1, $2, $3, $4, NULLIF($5, ''))`,
		id, name, color, icon, ownerID)
	if err != nil {
		return "", err
	}
	if ownerID != "" {
		if _, err := tx.ExecContext(ctx,
			`INSERT INTO project_members (project_id, user_id, role, status)
			 VALUES ($1, $2, 'admin', 'accepted')
			 ON CONFLICT (project_id, user_id) DO NOTHING`,
			id, ownerID); err != nil {
			return "", err
		}
	}
	return id, nil
}

func (r *Repository) SetActiveBoardTx(ctx context.Context, tx *sql.Tx, projectID, boardID string) error {
	_, err := tx.ExecContext(ctx,
		`UPDATE projects SET active_board_id = $1 WHERE id = $2`, boardID, projectID)
	return err
}

func (r *Repository) Update(ctx context.Context, id string, name, color, icon, activeBoardID, status *string) error {
	if name != nil {
		if _, err := r.db.ExecContext(ctx, `UPDATE projects SET name = $1 WHERE id = $2`, *name, id); err != nil {
			return err
		}
	}
	if color != nil {
		if _, err := r.db.ExecContext(ctx, `UPDATE projects SET color = $1 WHERE id = $2`, *color, id); err != nil {
			return err
		}
	}
	if icon != nil {
		if _, err := r.db.ExecContext(ctx, `UPDATE projects SET icon = $1 WHERE id = $2`, *icon, id); err != nil {
			return err
		}
	}
	if activeBoardID != nil {
		if _, err := r.db.ExecContext(ctx,
			`UPDATE projects SET active_board_id = $1 WHERE id = $2`, *activeBoardID, id); err != nil {
			return err
		}
	}
	if status != nil {
		if _, err := r.db.ExecContext(ctx, `UPDATE projects SET status = $1 WHERE id = $2`, *status, id); err != nil {
			return err
		}
	}
	return nil
}

// TransferOwnershipTx moves ownership to newOwnerID and guarantees that user
// has an accepted admin row in project_members. The previous owner is left
// untouched (still admin) so the operation never strands the project.
func (r *Repository) TransferOwnershipTx(ctx context.Context, tx *sql.Tx, projectID, newOwnerID string) error {
	if _, err := tx.ExecContext(ctx,
		`UPDATE projects SET owner_id = $1 WHERE id = $2`,
		newOwnerID, projectID,
	); err != nil {
		return err
	}
	_, err := tx.ExecContext(ctx,
		`INSERT INTO project_members (project_id, user_id, role, status)
		 VALUES ($1, $2, 'admin', 'accepted')
		 ON CONFLICT (project_id, user_id)
		 DO UPDATE SET role = 'admin', status = 'accepted'`,
		projectID, newOwnerID)
	return err
}

func (r *Repository) Delete(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM projects WHERE id = $1`, id)
	return err
}

func (r *Repository) Count(ctx context.Context) (int, error) {
	var n int
	err := r.db.QueryRowContext(ctx, `SELECT COUNT(*) FROM projects`).Scan(&n)
	return n, err
}

func (r *Repository) Name(ctx context.Context, id string) (string, error) {
	var n string
	err := r.db.QueryRowContext(ctx, `SELECT name FROM projects WHERE id = $1`, id).Scan(&n)
	return n, err
}
