package sprints

import (
	"context"
	"database/sql"
	"fmt"

	"kanban/internal/platform/ids"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

// ListByBoard returns all sprints for a board with task aggregates.
func (r *Repository) ListByBoard(ctx context.Context, boardID string) ([]Sprint, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT s.id, s.board_id, s.name, s.goal, s.status,
		       s.start_date::text, s.end_date::text, s.created_at,
		       COUNT(t.id)                                        AS total,
		       COUNT(t.id) FILTER (WHERE t.completed = TRUE)     AS done
		FROM sprints s
		LEFT JOIN tasks t ON t.sprint_id = s.id AND t.archived_at IS NULL
		WHERE s.board_id = $1
		GROUP BY s.id
		ORDER BY s.created_at DESC
	`, boardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []Sprint
	for rows.Next() {
		var sp Sprint
		var sd, ed sql.NullString
		if err := rows.Scan(
			&sp.ID, &sp.BoardID, &sp.Name, &sp.Goal, &sp.Status,
			&sd, &ed, &sp.CreatedAt,
			&sp.TotalTasks, &sp.CompletedTasks,
		); err != nil {
			return nil, err
		}
		if sd.Valid {
			sp.StartDate = &sd.String
		}
		if ed.Valid {
			sp.EndDate = &ed.String
		}
		out = append(out, sp)
	}
	if out == nil {
		out = []Sprint{}
	}
	return out, rows.Err()
}

// ListBacklogTasks returns tasks without a sprint on this board (not archived).
func (r *Repository) ListBacklogTasks(ctx context.Context, boardID string) ([]BacklogTask, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT t.id, t.column_id, t.title, t.priority, t.type,
		       t.completed, t.due_date::text, t.sprint_id
		FROM tasks t
		JOIN columns c ON c.id = t.column_id
		WHERE c.board_id = $1
		  AND t.archived_at IS NULL
		  AND (t.sprint_id IS NULL OR t.sprint_id IN (SELECT id FROM sprints WHERE board_id = $1 AND status != 'completed'))
		ORDER BY
		  CASE t.priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 WHEN 'low' THEN 3 ELSE 4 END,
		  t.created_at ASC
	`, boardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var out []BacklogTask
	for rows.Next() {
		var bt BacklogTask
		var dueDate, sprintID sql.NullString
		if err := rows.Scan(
			&bt.ID, &bt.ColumnID, &bt.Title, &bt.Priority, &bt.Type,
			&bt.Completed, &dueDate, &sprintID,
		); err != nil {
			return nil, err
		}
		if dueDate.Valid {
			bt.DueDate = &dueDate.String
		}
		if sprintID.Valid {
			bt.SprintID = &sprintID.String
		}
		// Load assignees
		bt.Assignees = r.loadAssignees(ctx, bt.ID)
		out = append(out, bt)
	}
	if out == nil {
		out = []BacklogTask{}
	}
	return out, rows.Err()
}

func (r *Repository) loadAssignees(ctx context.Context, taskID string) []string {
	rows, _ := r.db.QueryContext(ctx,
		`SELECT user_id FROM task_assignees WHERE task_id = $1`, taskID)
	if rows == nil {
		return []string{}
	}
	defer rows.Close()
	var ids []string
	for rows.Next() {
		var uid string
		if rows.Scan(&uid) == nil {
			ids = append(ids, uid)
		}
	}
	if ids == nil {
		return []string{}
	}
	return ids
}

// Insert creates a new sprint and returns it.
func (r *Repository) Insert(ctx context.Context, boardID, name, goal string, startDate, endDate *string) (Sprint, error) {
	id := ids.New()
	var sd, ed interface{}
	if startDate != nil {
		sd = *startDate
	}
	if endDate != nil {
		ed = *endDate
	}
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO sprints (id, board_id, name, goal, start_date, end_date)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, id, boardID, name, goal, sd, ed)
	if err != nil {
		return Sprint{}, err
	}
	return r.GetByID(ctx, id)
}

// GetByID fetches a single sprint.
func (r *Repository) GetByID(ctx context.Context, id string) (Sprint, error) {
	var sp Sprint
	var sd, ed sql.NullString
	err := r.db.QueryRowContext(ctx, `
		SELECT s.id, s.board_id, s.name, s.goal, s.status,
		       s.start_date::text, s.end_date::text, s.created_at,
		       COUNT(t.id),
		       COUNT(t.id) FILTER (WHERE t.completed = TRUE)
		FROM sprints s
		LEFT JOIN tasks t ON t.sprint_id = s.id AND t.archived_at IS NULL
		WHERE s.id = $1
		GROUP BY s.id
	`, id).Scan(
		&sp.ID, &sp.BoardID, &sp.Name, &sp.Goal, &sp.Status,
		&sd, &ed, &sp.CreatedAt,
		&sp.TotalTasks, &sp.CompletedTasks,
	)
	if err != nil {
		return Sprint{}, err
	}
	if sd.Valid {
		sp.StartDate = &sd.String
	}
	if ed.Valid {
		sp.EndDate = &ed.String
	}
	return sp, nil
}

// Update patches name/goal/dates of a sprint.
func (r *Repository) Update(ctx context.Context, id, name, goal string, startDate, endDate *string) error {
	var sd, ed interface{}
	if startDate != nil {
		sd = *startDate
	}
	if endDate != nil {
		ed = *endDate
	}
	_, err := r.db.ExecContext(ctx,
		`UPDATE sprints SET name=$1, goal=$2, start_date=$3, end_date=$4 WHERE id=$5`,
		name, goal, sd, ed, id)
	return err
}

// SetStatus changes the sprint status.
func (r *Repository) SetStatus(ctx context.Context, id, status string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE sprints SET status=$1 WHERE id=$2`, status, id)
	return err
}

// ActiveSprintForBoard returns the active sprint ID for a board, or "".
func (r *Repository) ActiveSprintForBoard(ctx context.Context, boardID string) (string, error) {
	var id sql.NullString
	err := r.db.QueryRowContext(ctx,
		`SELECT id FROM sprints WHERE board_id=$1 AND status='active' LIMIT 1`, boardID).Scan(&id)
	if err == sql.ErrNoRows {
		return "", nil
	}
	return id.String, err
}

// ReturnIncompleteToBacklog sets sprint_id=NULL and moves to backlog column for all incomplete tasks.
func (r *Repository) ReturnIncompleteToBacklog(ctx context.Context, sprintID string) (int, error) {
	var firstCol string
	r.db.QueryRowContext(ctx, `
		SELECT c.id FROM columns c
		JOIN sprints s ON s.board_id = c.board_id
		WHERE s.id=$1 ORDER BY c.position ASC LIMIT 1`, sprintID).Scan(&firstCol)

	var res sql.Result
	var err error
	if firstCol != "" {
		res, err = r.db.ExecContext(ctx,
			`UPDATE tasks SET sprint_id=NULL, column_id=$2 WHERE sprint_id=$1 AND completed=FALSE`, sprintID, firstCol)
	} else {
		res, err = r.db.ExecContext(ctx,
			`UPDATE tasks SET sprint_id=NULL WHERE sprint_id=$1 AND completed=FALSE`, sprintID)
	}
	
	if err != nil {
		return 0, err
	}
	n, _ := res.RowsAffected()
	return int(n), nil
}

// MoveSprintTasksToNextColumn moves tasks that are physically in the backlog column (index 0)
// into the next available column (index 1) so they appear on the board when sprint starts.
func (r *Repository) MoveSprintTasksToNextColumn(ctx context.Context, sprintID, boardID string) error {
	// 1. Find the backlog column (first) and the 'To Do' column (second) by position
	rows, err := r.db.QueryContext(ctx, `SELECT id FROM columns WHERE board_id=$1 ORDER BY position ASC LIMIT 2`, boardID)
	if err != nil {
		return err
	}
	defer rows.Close()

	var firstCol, secondCol string
	if rows.Next() {
		rows.Scan(&firstCol)
	}
	if rows.Next() {
		rows.Scan(&secondCol)
	}

	if firstCol != "" && secondCol != "" {
		_, err := r.db.ExecContext(ctx,
			`UPDATE tasks SET column_id=$1 WHERE sprint_id=$2 AND column_id=$3`,
			secondCol, sprintID, firstCol)
		return err
	}
	return nil
}

// SetTaskSprint assigns or removes a sprint on a task.
func (r *Repository) SetTaskSprint(ctx context.Context, taskID string, sprintID *string) error {
	_, err := r.db.ExecContext(ctx,
		`UPDATE tasks SET sprint_id=$1 WHERE id=$2`, sprintID, taskID)
	
	if err == nil {
		if sprintID != nil {
			var status, boardID string
			if err := r.db.QueryRowContext(ctx, `SELECT status, board_id FROM sprints WHERE id=$1`, *sprintID).Scan(&status, &boardID); err == nil {
				if status == "active" {
					r.MoveSprintTasksToNextColumn(ctx, *sprintID, boardID)
				}
			}
		} else {
			var boardID string
			if err := r.db.QueryRowContext(ctx, `
				SELECT c.board_id FROM columns c
				JOIN tasks t ON t.column_id = c.id
				WHERE t.id=$1`, taskID).Scan(&boardID); err == nil {
				
				var firstCol string
				r.db.QueryRowContext(ctx, `SELECT id FROM columns WHERE board_id=$1 ORDER BY position ASC LIMIT 1`, boardID).Scan(&firstCol)
				if firstCol != "" {
					r.db.ExecContext(ctx, `UPDATE tasks SET column_id=$1 WHERE id=$2 AND completed=FALSE`, firstCol, taskID)
				}
			}
		}
	}
	
	return err
}

// Delete removes a sprint (only allowed in planning status).
func (r *Repository) Delete(ctx context.Context, id string) error {
	var status string
	if err := r.db.QueryRowContext(ctx, `SELECT status FROM sprints WHERE id=$1`, id).Scan(&status); err != nil {
		return err
	}
	if status != "planning" {
		return fmt.Errorf("cannot delete sprint with status %q", status)
	}
	_, err := r.db.ExecContext(ctx, `DELETE FROM sprints WHERE id=$1`, id)
	return err
}

// NextSprintNumber returns 1 + the count of sprints on the board, for auto-naming.
func (r *Repository) NextSprintNumber(ctx context.Context, boardID string) (int, error) {
	var n int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*)+1 FROM sprints WHERE board_id=$1`, boardID).Scan(&n)
	return n, err
}
