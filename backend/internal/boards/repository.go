package boards

import (
	"context"
	"database/sql"
	"encoding/json"

	"kanban/internal/platform/ids"
	"kanban/internal/tasks"
)

type Querier interface {
	ExecContext(ctx context.Context, q string, args ...any) (sql.Result, error)
	QueryContext(ctx context.Context, q string, args ...any) (*sql.Rows, error)
	QueryRowContext(ctx context.Context, q string, args ...any) *sql.Row
}

type Repository struct {
	db    *sql.DB
	tasks *tasks.Repository
}

func NewRepository(db *sql.DB, tasksRepo *tasks.Repository) *Repository {
	return &Repository{db: db, tasks: tasksRepo}
}

func (r *Repository) InsertBoard(ctx context.Context, q Querier, projectID, name string) (string, error) {
	id := ids.New()
	_, err := q.ExecContext(ctx,
		`INSERT INTO boards (id, project_id, name) VALUES ($1, $2, $3)`, id, projectID, name)
	return id, err
}

func (r *Repository) InsertColumn(ctx context.Context, q Querier, c Column) error {
	_, err := q.ExecContext(ctx,
		`INSERT INTO columns (id,board_id,title,color,text_color,position)
		 VALUES ($1,$2,$3,$4,$5,$6)`,
		c.ID, c.BoardID, c.Title, c.Color, c.TextColor, c.Position)
	return err
}

func (r *Repository) InsertTemplateColumns(ctx context.Context, q Querier, boardID, templateID string) error {
	tmpl := TemplateOrDefault(templateID)
	for i, c := range tmpl.Columns {
		c.ID = ids.New()
		c.BoardID = boardID
		c.Position = i
		if err := r.InsertColumn(ctx, q, c); err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) DeleteBoard(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE projects SET active_board_id = (
			SELECT id FROM boards WHERE project_id = projects.id AND id != $1 ORDER BY position, created_at LIMIT 1
		) WHERE active_board_id = $1`, id)
	if err != nil {
		return err
	}
	_, err = r.db.ExecContext(ctx, `DELETE FROM boards WHERE id = $1`, id)
	return err
}

func (r *Repository) UpdateBoard(ctx context.Context, id, name string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE boards SET name = $1 WHERE id = $2`, name, id)
	return err
}

func (r *Repository) GetBoardName(ctx context.Context, id string) (string, error) {
	var name string
	err := r.db.QueryRowContext(ctx, `SELECT name FROM boards WHERE id = $1`, id).Scan(&name)
	return name, err
}

// GetSettings reads the board's settings JSONB and merges it on top of defaults.
// Missing/zero fields fall through to DefaultSettings so older boards behave the
// same as freshly created ones.
func (r *Repository) GetSettings(ctx context.Context, boardID string) (BoardSettings, error) {
	var raw []byte
	err := r.db.QueryRowContext(ctx,
		`SELECT settings FROM boards WHERE id = $1`, boardID).Scan(&raw)
	if err != nil {
		return BoardSettings{}, err
	}
	s := DefaultSettings()
	if len(raw) > 0 && string(raw) != "{}" {
		_ = json.Unmarshal(raw, &s)
	}
	if s.AutoArchiveDays <= 0 {
		s.AutoArchiveDays = 7
	}
	return s, nil
}

// SetSettings overwrites the board's settings JSONB with the marshaled value.
func (r *Repository) SetSettings(ctx context.Context, boardID string, s BoardSettings) error {
	return r.SetSettingsTx(ctx, r.db, boardID, s)
}

// SetSettingsTx overwrites the board's settings JSONB with the marshaled value inside a transaction.
func (r *Repository) SetSettingsTx(ctx context.Context, q Querier, boardID string, s BoardSettings) error {
	raw, err := json.Marshal(s)
	if err != nil {
		return err
	}
	_, err = q.ExecContext(ctx,
		`UPDATE boards SET settings = $1::jsonb WHERE id = $2`, string(raw), boardID)
	return err
}

// LastColumnID returns the id of the right-most column on the board (highest
// position). Returns "" if the board has no columns.
func (r *Repository) LastColumnID(ctx context.Context, boardID string) (string, error) {
	var id sql.NullString
	err := r.db.QueryRowContext(ctx,
		`SELECT id FROM columns WHERE board_id = $1 ORDER BY position DESC LIMIT 1`, boardID).Scan(&id)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return id.String, nil
}

// SweepAutoArchive archives tasks on the board that have been completed for
// more than `days` days. Safe to call on every detail fetch — it only writes
// when there are eligible rows.
func (r *Repository) SweepAutoArchive(ctx context.Context, boardID string, days int) error {
	if days <= 0 {
		return nil
	}
	_, err := r.db.ExecContext(ctx, `
		UPDATE tasks
		SET archived_at = NOW()
		WHERE archived_at IS NULL
		  AND completed = TRUE
		  AND completed_at IS NOT NULL
		  AND completed_at < NOW() - ($1 || ' days')::interval
		  AND column_id IN (SELECT id FROM columns WHERE board_id = $2)`,
		days, boardID)
	return err
}

func (r *Repository) ListColumns(ctx context.Context, boardID string) ([]Column, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, title, color, text_color, position
		 FROM columns WHERE board_id = $1 ORDER BY position`, boardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []Column{}
	for rows.Next() {
		var c Column
		if err := rows.Scan(&c.ID, &c.Title, &c.Color, &c.TextColor, &c.Position); err != nil {
			return nil, err
		}
		out = append(out, c)
	}
	return out, rows.Err()
}

func (r *Repository) NextColumnPosition(ctx context.Context, boardID string) (int, error) {
	var pos int
	err := r.db.QueryRowContext(ctx,
		`SELECT COALESCE(MAX(position)+1, 0) FROM columns WHERE board_id = $1`, boardID).Scan(&pos)
	return pos, err
}

func (r *Repository) UpdateColumnFields(ctx context.Context, q Querier, id string, title, color, textColor *string) error {
	if title != nil {
		if _, err := q.ExecContext(ctx, `UPDATE columns SET title = $1 WHERE id = $2`, *title, id); err != nil {
			return err
		}
	}
	if color != nil {
		if _, err := q.ExecContext(ctx, `UPDATE columns SET color = $1 WHERE id = $2`, *color, id); err != nil {
			return err
		}
	}
	if textColor != nil {
		if _, err := q.ExecContext(ctx, `UPDATE columns SET text_color = $1 WHERE id = $2`, *textColor, id); err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) DeleteColumn(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM columns WHERE id = $1`, id)
	return err
}

func (r *Repository) ReorderColumnsTx(ctx context.Context, tx *sql.Tx, boardID string, ids []string) error {
	for i, colID := range ids {
		if _, err := tx.ExecContext(ctx,
			`UPDATE columns SET position = $1 WHERE id = $2 AND board_id = $3`,
			i, colID, boardID); err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) GetBoardDetail(ctx context.Context, id string) (*Detail, error) {
	name, err := r.GetBoardName(ctx, id)
	if err != nil {
		return nil, err
	}

	settings, err := r.GetSettings(ctx, id)
	if err != nil {
		return nil, err
	}

	// Lazy auto-archive sweep — runs on board fetch when the toggle is on.
	// Errors here are non-fatal: a failed sweep shouldn't block board loading.
	if settings.AutoArchiveEnabled {
		_ = r.SweepAutoArchive(ctx, id, settings.AutoArchiveDays)
	}

	cols, err := r.ListColumns(ctx, id)
	if err != nil {
		return nil, err
	}

	tasksByCol := make(map[string][]tasks.Task, len(cols))
	colIDs := make([]string, len(cols))
	for i, c := range cols {
		tasksByCol[c.ID] = []tasks.Task{}
		colIDs[i] = c.ID
	}

	if len(colIDs) > 0 {
		grouped, err := r.tasks.ListByColumns(ctx, colIDs)
		if err != nil {
			return nil, err
		}
		for colID, ts := range grouped {
			tasksByCol[colID] = ts
		}
	}

	return &Detail{ID: id, Name: name, Settings: settings, Columns: cols, Tasks: tasksByCol}, nil
}

func (r *Repository) GetShareToken(ctx context.Context, boardID string) (string, error) {
	var token sql.NullString
	err := r.db.QueryRowContext(ctx, `SELECT share_token FROM boards WHERE id = $1`, boardID).Scan(&token)
	if err != nil {
		return "", err
	}
	return token.String, nil
}

func (r *Repository) SetShareToken(ctx context.Context, boardID, token string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE boards SET share_token = $1 WHERE id = $2`, token, boardID)
	return err
}

func (r *Repository) GetDetailByToken(ctx context.Context, token string) (*Detail, error) {
	var id string
	err := r.db.QueryRowContext(ctx, `SELECT id FROM boards WHERE share_token = $1`, token).Scan(&id)
	if err != nil {
		return nil, err
	}
	return r.GetBoardDetail(ctx, id)
}
