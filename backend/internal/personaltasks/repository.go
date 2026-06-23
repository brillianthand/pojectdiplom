package personaltasks

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

func scanTask(s interface{ Scan(...any) error }) (PersonalTask, error) {
	var (
		t           PersonalTask
		dueDate     sql.NullString
		completedAt sql.NullTime
	)
	if err := s.Scan(&t.ID, &t.Title, &t.Notes, &t.Completed, &completedAt, &dueDate, &t.CreatedAt); err != nil {
		return t, err
	}
	if dueDate.Valid {
		t.DueDate = &dueDate.String
	}
	if completedAt.Valid {
		t.CompletedAt = &completedAt.Time
	}
	return t, nil
}

const selectCols = `id, title, notes, completed, completed_at, TO_CHAR(due_date, 'YYYY-MM-DD'), created_at`

func (r *Repository) List(ctx context.Context, userID string) ([]PersonalTask, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT `+selectCols+`
		FROM personal_tasks
		WHERE user_id = $1
		ORDER BY completed ASC, position ASC, created_at ASC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []PersonalTask{}
	for rows.Next() {
		t, err := scanTask(rows)
		if err != nil {
			return nil, err
		}
		out = append(out, t)
	}
	return out, rows.Err()
}

type CreateInput struct {
	Title   string
	Notes   string
	DueDate *string
}

func (r *Repository) Create(ctx context.Context, userID string, in CreateInput) (PersonalTask, error) {
	id := ids.New()
	var maxPos sql.NullFloat64
	if err := r.db.QueryRowContext(ctx,
		`SELECT MAX(position) FROM personal_tasks WHERE user_id = $1`, userID,
	).Scan(&maxPos); err != nil {
		return PersonalTask{}, err
	}
	pos := maxPos.Float64 + 1

	row := r.db.QueryRowContext(ctx, `
		INSERT INTO personal_tasks (id, user_id, title, notes, due_date, position)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING `+selectCols, id, userID, in.Title, in.Notes, in.DueDate, pos)
	return scanTask(row)
}

// UpdateInput carries optional field changes; nil pointers leave the field unchanged.
type UpdateInput struct {
	Title      *string
	Notes      *string
	Completed  *bool
	DueDate    *string // value present + empty string clears the date
	DueDateSet bool    // whether the dueDate key was present in the request
}

func (r *Repository) Update(ctx context.Context, userID, id string, in UpdateInput) (PersonalTask, error) {
	row := r.db.QueryRowContext(ctx, `
		UPDATE personal_tasks SET
			title        = COALESCE($3, title),
			notes        = COALESCE($4, notes),
			completed    = COALESCE($5, completed),
			completed_at = CASE
				WHEN $5 IS NULL THEN completed_at
				WHEN $5 = TRUE  THEN NOW()
				ELSE NULL
			END,
			due_date = CASE
				WHEN $7 = FALSE THEN due_date
				WHEN $6 = ''    THEN NULL
				ELSE $6::date
			END
		WHERE id = $1 AND user_id = $2
		RETURNING `+selectCols,
		id, userID, in.Title, in.Notes, in.Completed, nullStr(in.DueDate), in.DueDateSet)
	return scanTask(row)
}

func (r *Repository) Delete(ctx context.Context, userID, id string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM personal_tasks WHERE id = $1 AND user_id = $2`, id, userID)
	return err
}

func nullStr(p *string) any {
	if p == nil {
		return ""
	}
	return *p
}
