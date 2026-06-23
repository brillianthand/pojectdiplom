package tasks

import (
	"context"
	"database/sql"
	"encoding/json"
	"strconv"
	"strings"
	"time"

	"github.com/lib/pq"

	"kanban/internal/platform/ids"
	"kanban/internal/platform/timeago"
	"kanban/internal/users"
)

type Repository struct {
	db *sql.DB
}

func NewRepository(db *sql.DB) *Repository {
	return &Repository{db: db}
}

func (r *Repository) ListByColumns(ctx context.Context, colIDs []string) (map[string][]Task, error) {
	tasksByCol := make(map[string][]Task, len(colIDs))

	taskRows, err := r.db.QueryContext(ctx, `
		SELECT id, column_id, title, description, priority, type, completed,
		       TO_CHAR(start_date, 'YYYY-MM-DD'),
		       TO_CHAR(due_date,   'YYYY-MM-DD'),
		       created_at, completed_at
		FROM tasks
		WHERE column_id = ANY($1) AND archived_at IS NULL
		ORDER BY column_id, position`, pq.Array(colIDs))
	if err != nil {
		return nil, err
	}
	defer taskRows.Close()

	allTasks := []Task{}
	for taskRows.Next() {
		var t Task
		var startDate, dueDate sql.NullString
		var completedAt sql.NullTime
		if err := taskRows.Scan(
			&t.ID, &t.ColumnID, &t.Title, &t.Description,
			&t.Priority, &t.Type, &t.Completed,
			&startDate, &dueDate, &t.CreatedAt, &completedAt,
		); err != nil {
			return nil, err
		}
		if startDate.Valid {
			t.StartDate = &startDate.String
		}
		if dueDate.Valid {
			t.DueDate = &dueDate.String
		}
		if completedAt.Valid {
			ct := completedAt.Time
			t.CompletedAt = &ct
		}
		t.Tags = []string{}
		t.Assignees = []string{}
		t.Comments = []Comment{}
		t.Subtasks = []Subtask{}
		allTasks = append(allTasks, t)
	}
	if err := taskRows.Err(); err != nil {
		return nil, err
	}
	if len(allTasks) == 0 {
		return tasksByCol, nil
	}

	taskByID := make(map[string]*Task, len(allTasks))
	taskIDs := make([]string, len(allTasks))
	for i := range allTasks {
		taskByID[allTasks[i].ID] = &allTasks[i]
		taskIDs[i] = allTasks[i].ID
	}

	tagRows, err := r.db.QueryContext(ctx,
		`SELECT task_id, tag FROM task_tags WHERE task_id = ANY($1)`, pq.Array(taskIDs))
	if err == nil {
		defer tagRows.Close()
		for tagRows.Next() {
			var tid, tag string
			tagRows.Scan(&tid, &tag)
			if t, ok := taskByID[tid]; ok {
				t.Tags = append(t.Tags, tag)
			}
		}
	}

	assignRows, err := r.db.QueryContext(ctx,
		`SELECT task_id, member_id FROM task_assignees WHERE task_id = ANY($1)`, pq.Array(taskIDs))
	if err == nil {
		defer assignRows.Close()
		for assignRows.Next() {
			var tid, mid string
			assignRows.Scan(&tid, &mid)
			if t, ok := taskByID[tid]; ok {
				t.Assignees = append(t.Assignees, mid)
			}
		}
	}

	commentRows, err := r.db.QueryContext(ctx, `
		SELECT c.id, c.task_id, COALESCE(c.user_id,''), COALESCE(u.name, c.author),
		       COALESCE(u.color,''), c.text, c.created_at
		FROM comments c
		LEFT JOIN users u ON u.id = c.user_id
		WHERE c.task_id = ANY($1) ORDER BY c.created_at`, pq.Array(taskIDs))
	if err == nil {
		defer commentRows.Close()
		var allComments []Comment
		var commentTaskIDs []string
		for commentRows.Next() {
			var c Comment
			var tid string
			commentRows.Scan(&c.ID, &tid, &c.UserID, &c.Author, &c.AuthorColor, &c.Text, &c.CreatedAt)
			c.AuthorInitials = users.InitialsFor(c.Author)
			c.Time = timeago.Relative(c.CreatedAt)
			c.Attachments = []Attachment{}
			allComments = append(allComments, c)
			commentTaskIDs = append(commentTaskIDs, tid)
		}
		if len(allComments) > 0 {
			cids := make([]string, len(allComments))
			cIdx := make(map[string]int, len(allComments))
			for i, c := range allComments {
				cids[i] = c.ID
				cIdx[c.ID] = i
			}
			attRows, _ := r.db.QueryContext(ctx, `
				SELECT id, comment_id, filename, content_type, size_bytes
				FROM comment_attachments WHERE comment_id = ANY($1) ORDER BY created_at`, pq.Array(cids))
			if attRows != nil {
				defer attRows.Close()
				for attRows.Next() {
					var a Attachment
					var cid string
					if attRows.Scan(&a.ID, &cid, &a.Filename, &a.ContentType, &a.SizeBytes) == nil {
						if i, ok := cIdx[cid]; ok {
							allComments[i].Attachments = append(allComments[i].Attachments, a)
						}
					}
				}
			}
			for i, c := range allComments {
				if t, ok := taskByID[commentTaskIDs[i]]; ok {
					t.Comments = append(t.Comments, c)
				}
			}
		}
	}

	subtaskRows, err := r.db.QueryContext(ctx,
		`SELECT id, task_id, title, completed, position FROM subtasks
		 WHERE task_id = ANY($1) ORDER BY position`, pq.Array(taskIDs))
	if err == nil {
		defer subtaskRows.Close()
		for subtaskRows.Next() {
			var s Subtask
			subtaskRows.Scan(&s.ID, &s.TaskID, &s.Title, &s.Completed, &s.Position)
			if t, ok := taskByID[s.TaskID]; ok {
				t.Subtasks = append(t.Subtasks, s)
			}
		}
	}

	for i := range allTasks {
		t := &allTasks[i]
		tasksByCol[t.ColumnID] = append(tasksByCol[t.ColumnID], *t)
	}
	return tasksByCol, nil
}

func (r *Repository) AddSubtask(ctx context.Context, taskID, title string) (Subtask, error) {
	id := ids.New()
	var pos int
	r.db.QueryRowContext(ctx, `SELECT COALESCE(MAX(position)+1,0) FROM subtasks WHERE task_id=$1`, taskID).Scan(&pos)
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO subtasks (id, task_id, title, position) VALUES ($1,$2,$3,$4)`,
		id, taskID, title, pos)
	if err != nil {
		return Subtask{}, err
	}
	return Subtask{ID: id, TaskID: taskID, Title: title, Completed: false, Position: pos}, nil
}

func (r *Repository) UpdateSubtask(ctx context.Context, id string, title *string, completed *bool) error {
	if title != nil {
		if _, err := r.db.ExecContext(ctx, `UPDATE subtasks SET title=$1 WHERE id=$2`, *title, id); err != nil {
			return err
		}
	}
	if completed != nil {
		if _, err := r.db.ExecContext(ctx, `UPDATE subtasks SET completed=$1 WHERE id=$2`, *completed, id); err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) DeleteSubtask(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM subtasks WHERE id=$1`, id)
	return err
}

func (r *Repository) BoardIDForSubtask(ctx context.Context, subtaskID string) string {
	var id string
	r.db.QueryRowContext(ctx,
		`SELECT c.board_id FROM subtasks s
		 JOIN tasks t ON t.id = s.task_id
		 JOIN columns c ON c.id = t.column_id
		 WHERE s.id = $1`, subtaskID).Scan(&id)
	return id
}

func (r *Repository) TaskIDForSubtask(ctx context.Context, subtaskID string) string {
	var id string
	r.db.QueryRowContext(ctx, `SELECT task_id FROM subtasks WHERE id=$1`, subtaskID).Scan(&id)
	return id
}

// CreateTx inserts task at position 0, shifting existing tasks down. Runs inside tx.
func (r *Repository) CreateTx(ctx context.Context, tx *sql.Tx, columnID, title string) (Task, error) {
	if _, err := tx.ExecContext(ctx,
		`UPDATE tasks SET position = position + 1 WHERE column_id = $1`, columnID); err != nil {
		return Task{}, err
	}
	id := ids.New()
	var createdAt time.Time
	if err := tx.QueryRowContext(ctx,
		`INSERT INTO tasks (id, column_id, title, priority, position) VALUES ($1, $2, $3, '', 0) RETURNING created_at`,
		id, columnID, title).Scan(&createdAt); err != nil {
		return Task{}, err
	}
	return Task{
		ID: id, ColumnID: columnID, Title: title,
		Description: "", Priority: "", Type: "task",
		Tags: []string{}, Assignees: []string{}, Comments: []Comment{}, Subtasks: []Subtask{},
		CreatedAt: createdAt,
	}, nil
}

// UpdateFields accepts a raw JSON map so callers can send only what changed.
func (r *Repository) UpdateFields(ctx context.Context, id string, raw map[string]json.RawMessage) error {
	strField := func(key, col string) error {
		v, ok := raw[key]
		if !ok {
			return nil
		}
		var s string
		json.Unmarshal(v, &s)
		_, err := r.db.ExecContext(ctx, `UPDATE tasks SET `+col+` = $1 WHERE id = $2`, s, id)
		return err
	}
	nullableStr := func(key, col string) error {
		v, ok := raw[key]
		if !ok {
			return nil
		}
		var s *string
		json.Unmarshal(v, &s)
		if s == nil || *s == "" {
			_, err := r.db.ExecContext(ctx, `UPDATE tasks SET `+col+` = NULL WHERE id = $1`, id)
			return err
		}
		_, err := r.db.ExecContext(ctx, `UPDATE tasks SET `+col+` = $1 WHERE id = $2`, *s, id)
		return err
	}

	for _, fn := range []func() error{
		func() error { return strField("title", "title") },
		func() error { return strField("description", "description") },
		func() error { return strField("priority", "priority") },
		func() error { return strField("type", "type") },
		func() error {
			v, ok := raw["completed"]
			if !ok {
				return nil
			}
			var b bool
			json.Unmarshal(v, &b)
			_, err := r.db.ExecContext(ctx,
				`UPDATE tasks
				   SET completed = $1,
				       completed_at = CASE
				         WHEN $1 = TRUE  AND completed_at IS NULL THEN NOW()
				         WHEN $1 = FALSE                          THEN NULL
				         ELSE completed_at
				       END
				 WHERE id = $2`, b, id)
			return err
		},
		func() error { return nullableStr("startDate", "start_date") },
		func() error { return nullableStr("dueDate", "due_date") },
		func() error {
			v, ok := raw["tags"]
			if !ok {
				return nil
			}
			var tags []string
			json.Unmarshal(v, &tags)
			if tags == nil {
				tags = []string{}
			}
			if _, err := r.db.ExecContext(ctx, `DELETE FROM task_tags WHERE task_id = $1`, id); err != nil {
				return err
			}
			for _, tag := range tags {
				r.db.ExecContext(ctx,
					`INSERT INTO task_tags (task_id, tag) VALUES ($1, $2) ON CONFLICT DO NOTHING`, id, tag)
			}
			return nil
		},
		func() error {
			v, ok := raw["assignees"]
			if !ok {
				return nil
			}
			var assignees []string
			json.Unmarshal(v, &assignees)
			if assignees == nil {
				assignees = []string{}
			}
			if _, err := r.db.ExecContext(ctx, `DELETE FROM task_assignees WHERE task_id = $1`, id); err != nil {
				return err
			}
			for _, mid := range assignees {
				r.db.ExecContext(ctx,
					`INSERT INTO task_assignees (task_id, member_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
					id, mid)
			}
			return nil
		},
	} {
		if err := fn(); err != nil {
			return err
		}
	}
	return nil
}

// MoveTx moves a task to another column at a given position and updates all positions atomically.
func (r *Repository) MoveTx(ctx context.Context, tx *sql.Tx, taskID, toColumnID string, fromIDs, toIDs []string) error {
	if _, err := tx.ExecContext(ctx,
		`UPDATE tasks SET column_id = $1 WHERE id = $2`, toColumnID, taskID); err != nil {
		return err
	}
	for i, id := range fromIDs {
		if _, err := tx.ExecContext(ctx,
			`UPDATE tasks SET position = $1 WHERE id = $2`, i, id); err != nil {
			return err
		}
	}
	for i, id := range toIDs {
		if _, err := tx.ExecContext(ctx,
			`UPDATE tasks SET position = $1 WHERE id = $2`, i, id); err != nil {
			return err
		}
	}
	return nil
}

func (r *Repository) Delete(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM tasks WHERE id = $1`, id)
	return err
}

func (r *Repository) Archive(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE tasks SET archived_at = NOW() WHERE id = $1`, id)
	return err
}

func (r *Repository) Restore(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE tasks SET archived_at = NULL WHERE id = $1`, id)
	return err
}

func (r *Repository) ListArchived(ctx context.Context, boardID string) ([]Task, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT t.id, t.column_id, t.title, t.description, t.priority, t.type, t.completed,
		       TO_CHAR(t.start_date, 'YYYY-MM-DD'),
		       TO_CHAR(t.due_date,   'YYYY-MM-DD'),
		       t.created_at, t.completed_at, c.title
		FROM tasks t
		JOIN columns c ON c.id = t.column_id
		WHERE c.board_id = $1 AND t.archived_at IS NOT NULL
		ORDER BY t.archived_at DESC`, boardID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []Task
	for rows.Next() {
		var t Task
		var startDate, dueDate sql.NullString
		var completedAt sql.NullTime
		if err := rows.Scan(
			&t.ID, &t.ColumnID, &t.Title, &t.Description,
			&t.Priority, &t.Type, &t.Completed,
			&startDate, &dueDate, &t.CreatedAt, &completedAt, &t.ColumnTitle,
		); err != nil {
			return nil, err
		}
		if startDate.Valid { t.StartDate = &startDate.String }
		if dueDate.Valid   { t.DueDate = &dueDate.String }
		if completedAt.Valid { ct := completedAt.Time; t.CompletedAt = &ct }
		t.Tags = []string{}; t.Assignees = []string{}; t.Comments = []Comment{}; t.Subtasks = []Subtask{}
		out = append(out, t)
	}
	if out == nil { out = []Task{} }
	return out, nil
}

func (r *Repository) AddComment(ctx context.Context, taskID, userID, author, color, initials, text string, attachments []NewAttachment) (Comment, error) {
	id := ids.New()
	var c Comment
	err := r.db.QueryRowContext(ctx,
		`INSERT INTO comments (id,task_id,user_id,author,text) VALUES ($1,$2,$3,$4,$5)
		 RETURNING id, COALESCE(user_id,''), author, text, created_at`,
		id, taskID, userID, author, text,
	).Scan(&c.ID, &c.UserID, &c.Author, &c.Text, &c.CreatedAt)
	if err != nil {
		return Comment{}, err
	}
	c.AuthorColor = color
	c.AuthorInitials = initials
	c.Time = timeago.Relative(c.CreatedAt)
	c.Attachments = []Attachment{}
	for _, a := range attachments {
		aid := ids.New()
		if _, aerr := r.db.ExecContext(ctx,
			`INSERT INTO comment_attachments (id, comment_id, filename, content_type, data, size_bytes)
			 VALUES ($1,$2,$3,$4,$5,$6)`,
			aid, c.ID, a.Filename, a.ContentType, a.Data, len(a.Data),
		); aerr == nil {
			c.Attachments = append(c.Attachments, Attachment{
				ID: aid, Filename: a.Filename, ContentType: a.ContentType, SizeBytes: len(a.Data),
			})
		}
	}
	return c, nil
}

func (r *Repository) GetAttachment(ctx context.Context, id string) (filename, contentType string, data []byte, err error) {
	err = r.db.QueryRowContext(ctx,
		`SELECT filename, content_type, data FROM comment_attachments WHERE id = $1`, id,
	).Scan(&filename, &contentType, &data)
	return
}

func (r *Repository) UpdateComment(ctx context.Context, id, userID, text string) error {
	res, err := r.db.ExecContext(ctx,
		`UPDATE comments SET text = $1 WHERE id = $2 AND user_id = $3`, text, id, userID)
	if err != nil {
		return err
	}
	n, _ := res.RowsAffected()
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

func (r *Repository) DeleteComment(ctx context.Context, id string) error {
	_, err := r.db.ExecContext(ctx, `DELETE FROM comments WHERE id = $1`, id)
	return err
}

func (r *Repository) GetAssignees(ctx context.Context, taskID string) []string {
	rows, err := r.db.QueryContext(ctx,
		`SELECT member_id FROM task_assignees WHERE task_id = $1`, taskID)
	if err != nil {
		return nil
	}
	defer rows.Close()
	var out []string
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil {
			out = append(out, id)
		}
	}
	return out
}

func (r *Repository) GetTitle(ctx context.Context, taskID string) string {
	var title string
	r.db.QueryRowContext(ctx, `SELECT title FROM tasks WHERE id = $1`, taskID).Scan(&title)
	return title
}

func (r *Repository) BoardIDForColumn(ctx context.Context, columnID string) string {
	var id string
	r.db.QueryRowContext(ctx, `SELECT board_id FROM columns WHERE id = $1`, columnID).Scan(&id)
	return id
}

func (r *Repository) BoardIDForTask(ctx context.Context, taskID string) string {
	var id string
	r.db.QueryRowContext(ctx,
		`SELECT c.board_id FROM tasks t JOIN columns c ON c.id = t.column_id WHERE t.id = $1`, taskID,
	).Scan(&id)
	return id
}

type SearchResult struct {
	TaskID      string `json:"taskId"`
	Title       string `json:"title"`
	BoardID     string `json:"boardId"`
	BoardName   string `json:"boardName"`
	ProjectID   string `json:"projectId"`
	ColumnTitle string `json:"columnTitle"`
}

func (r *Repository) Search(ctx context.Context, userID, query string, limit int) ([]SearchResult, error) {
	if limit <= 0 {
		limit = 10
	}
	rows, err := r.db.QueryContext(ctx, `
		SELECT t.id, t.title, b.id, b.name, b.project_id, c.title
		FROM tasks t
		JOIN columns c ON c.id = t.column_id
		JOIN boards b ON b.id = c.board_id
		JOIN project_members pm ON pm.project_id = b.project_id
		WHERE pm.user_id = $1
		  AND pm.status = 'accepted'
		  AND t.archived_at IS NULL
		  AND (t.title ILIKE $2 OR t.description ILIKE $2)
		ORDER BY t.created_at DESC
		LIMIT $3`, userID, "%"+query+"%", limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var out []SearchResult
	for rows.Next() {
		var r SearchResult
		if rows.Scan(&r.TaskID, &r.Title, &r.BoardID, &r.BoardName, &r.ProjectID, &r.ColumnTitle) == nil {
			out = append(out, r)
		}
	}
	if out == nil {
		out = []SearchResult{}
	}
	return out, nil
}

// Star upserts a (user, task) favorite. Idempotent.
func (r *Repository) Star(ctx context.Context, userID, taskID string) error {
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO task_stars (user_id, task_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
		userID, taskID)
	return err
}

func (r *Repository) Unstar(ctx context.Context, userID, taskID string) error {
	_, err := r.db.ExecContext(ctx,
		`DELETE FROM task_stars WHERE user_id = $1 AND task_id = $2`, userID, taskID)
	return err
}

// ListStarredIDs returns starred non-archived task IDs the user still has access to,
// newest-first. Filters by project membership so stars from projects the user left
// (or was removed from) don't leak.
func (r *Repository) ListStarredIDs(ctx context.Context, userID string) ([]string, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT s.task_id
		FROM task_stars s
		JOIN tasks t              ON t.id = s.task_id
		JOIN columns c            ON c.id = t.column_id
		JOIN boards b             ON b.id = c.board_id
		JOIN project_members pm   ON pm.project_id = b.project_id AND pm.user_id = s.user_id
		WHERE s.user_id = $1 AND pm.status = 'accepted' AND t.archived_at IS NULL
		ORDER BY s.created_at DESC`, userID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	ids := []string{}
	for rows.Next() {
		var id string
		if rows.Scan(&id) == nil {
			ids = append(ids, id)
		}
	}
	return ids, nil
}

func (r *Repository) ColumnTitle(ctx context.Context, colID string) string {
	var t string
	r.db.QueryRowContext(ctx, `SELECT title FROM columns WHERE id=$1`, colID).Scan(&t)
	return t
}

func (r *Repository) LogEvent(ctx context.Context, taskID, userID, evType string, payload any) error {
	id := ids.New()
	var payloadJSON string
	if payload == nil {
		payloadJSON = "{}"
	} else {
		b, err := json.Marshal(payload)
		if err != nil {
			return err
		}
		payloadJSON = string(b)
	}
	var userIDArg any
	if userID != "" {
		userIDArg = userID
	}
	_, err := r.db.ExecContext(ctx,
		`INSERT INTO task_events (id, task_id, user_id, type, payload) VALUES ($1,$2,$3,$4,$5::jsonb)`,
		id, taskID, userIDArg, evType, payloadJSON)
	return err
}

func (r *Repository) ListEvents(ctx context.Context, taskID string) ([]TaskEvent, error) {
	rows, err := r.db.QueryContext(ctx, `
		SELECT e.id, e.task_id, COALESCE(e.user_id, ''),
		       COALESCE(u.name, ''), COALESCE(u.color, ''),
		       e.type, e.payload::text, e.created_at
		FROM task_events e
		LEFT JOIN users u ON u.id = e.user_id
		WHERE e.task_id = $1
		ORDER BY e.created_at DESC, e.id DESC`, taskID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	out := []TaskEvent{}
	for rows.Next() {
		var e TaskEvent
		var payload string
		if err := rows.Scan(&e.ID, &e.TaskID, &e.UserID, &e.UserName, &e.UserColor, &e.Type, &payload, &e.CreatedAt); err != nil {
			return nil, err
		}
		e.UserInitials = users.InitialsFor(e.UserName)
		e.Payload = json.RawMessage(payload)
		e.Time = timeago.Relative(e.CreatedAt)
		out = append(out, e)
	}
	return out, nil
}

// FeedForUser returns recent task events across all projects the user is an
// accepted member of, newest-first, capped at limit. Archived tasks are excluded.
func (r *Repository) FeedForUser(ctx context.Context, userID string, limit int) ([]FeedItem, error) {
	if limit <= 0 || limit > 100 {
		limit = 20
	}
	rows, err := r.db.QueryContext(ctx, `
		SELECT e.id, e.task_id, t.title,
		       b.id, b.name,
		       p.id, p.name,
		       COALESCE(e.user_id, ''), COALESCE(u.name, ''), COALESCE(u.color, ''),
		       e.type, e.payload::text, e.created_at
		FROM task_events e
		JOIN tasks t              ON t.id = e.task_id
		JOIN columns c            ON c.id = t.column_id
		JOIN boards b             ON b.id = c.board_id
		JOIN projects p           ON p.id = b.project_id
		JOIN project_members pm   ON pm.project_id = b.project_id
		                           AND pm.user_id  = $1
		                           AND pm.status   = 'accepted'
		LEFT JOIN users u         ON u.id = e.user_id
		WHERE t.archived_at IS NULL
		ORDER BY e.created_at DESC, e.id DESC
		LIMIT $2`, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	out := []FeedItem{}
	for rows.Next() {
		var f FeedItem
		var payload string
		if err := rows.Scan(
			&f.ID, &f.TaskID, &f.TaskTitle,
			&f.BoardID, &f.BoardName,
			&f.ProjectID, &f.ProjectName,
			&f.UserID, &f.UserName, &f.UserColor,
			&f.Type, &payload, &f.CreatedAt,
		); err != nil {
			return nil, err
		}
		f.UserInitials = users.InitialsFor(f.UserName)
		f.Payload = json.RawMessage(payload)
		f.Time = timeago.Relative(f.CreatedAt)
		out = append(out, f)
	}
	return out, rows.Err()
}

func (r *Repository) GetByID(ctx context.Context, taskID string) (Task, error) {
	var t Task
	var startDate, dueDate sql.NullString
	var completedAt sql.NullTime
	err := r.db.QueryRowContext(ctx, `
		SELECT id, column_id, title, description, priority, type, completed,
		       TO_CHAR(start_date, 'YYYY-MM-DD'),
		       TO_CHAR(due_date,   'YYYY-MM-DD'),
		       created_at, completed_at
		FROM tasks WHERE id = $1`, taskID).Scan(
		&t.ID, &t.ColumnID, &t.Title, &t.Description,
		&t.Priority, &t.Type, &t.Completed,
		&startDate, &dueDate, &t.CreatedAt, &completedAt,
	)
	if err != nil {
		return Task{}, err
	}
	if startDate.Valid {
		t.StartDate = &startDate.String
	}
	if dueDate.Valid {
		t.DueDate = &dueDate.String
	}
	if completedAt.Valid {
		ct := completedAt.Time
		t.CompletedAt = &ct
	}
	t.Tags = []string{}
	t.Assignees = []string{}
	t.Comments = []Comment{}
	t.Subtasks = []Subtask{}

	tagRows, _ := r.db.QueryContext(ctx, `SELECT tag FROM task_tags WHERE task_id = $1`, taskID)
	if tagRows != nil {
		defer tagRows.Close()
		for tagRows.Next() {
			var tag string
			if tagRows.Scan(&tag) == nil {
				t.Tags = append(t.Tags, tag)
			}
		}
	}

	assignRows, _ := r.db.QueryContext(ctx, `SELECT member_id FROM task_assignees WHERE task_id = $1`, taskID)
	if assignRows != nil {
		defer assignRows.Close()
		for assignRows.Next() {
			var mid string
			if assignRows.Scan(&mid) == nil {
				t.Assignees = append(t.Assignees, mid)
			}
		}
	}

	commentRows, _ := r.db.QueryContext(ctx, `
		SELECT c.id, COALESCE(c.user_id,''), COALESCE(u.name, c.author),
		       COALESCE(u.color,''), c.text, c.created_at
		FROM comments c
		LEFT JOIN users u ON u.id = c.user_id
		WHERE c.task_id = $1 ORDER BY c.created_at`, taskID)
	if commentRows != nil {
		defer commentRows.Close()
		for commentRows.Next() {
			var c Comment
			if commentRows.Scan(&c.ID, &c.UserID, &c.Author, &c.AuthorColor, &c.Text, &c.CreatedAt) == nil {
				c.AuthorInitials = users.InitialsFor(c.Author)
				c.Time = timeago.Relative(c.CreatedAt)
				c.Attachments = []Attachment{}
				t.Comments = append(t.Comments, c)
			}
		}
	}
	if len(t.Comments) > 0 {
		cids := make([]string, len(t.Comments))
		cIdx := make(map[string]int, len(t.Comments))
		for i, c := range t.Comments {
			cids[i] = c.ID
			cIdx[c.ID] = i
		}
		attRows, _ := r.db.QueryContext(ctx, `
			SELECT id, comment_id, filename, content_type, size_bytes
			FROM comment_attachments WHERE comment_id = ANY($1) ORDER BY created_at`, pq.Array(cids))
		if attRows != nil {
			defer attRows.Close()
			for attRows.Next() {
				var a Attachment
				var cid string
				if attRows.Scan(&a.ID, &cid, &a.Filename, &a.ContentType, &a.SizeBytes) == nil {
					if i, ok := cIdx[cid]; ok {
						t.Comments[i].Attachments = append(t.Comments[i].Attachments, a)
					}
				}
			}
		}
	}

	subtaskRows, _ := r.db.QueryContext(ctx, `
		SELECT id, task_id, title, completed, position FROM subtasks
		WHERE task_id = $1 ORDER BY position`, taskID)
	if subtaskRows != nil {
		defer subtaskRows.Close()
		for subtaskRows.Next() {
			var s Subtask
			if subtaskRows.Scan(&s.ID, &s.TaskID, &s.Title, &s.Completed, &s.Position) == nil {
				t.Subtasks = append(t.Subtasks, s)
			}
		}
	}

	return t, nil
}

func nextDuplicateTitle(title string) string {
	if idx := strings.LastIndex(title, " ("); idx != -1 {
		suffix := title[idx:]
		if len(suffix) > 3 && suffix[len(suffix)-1] == ')' {
			if n, err := strconv.Atoi(suffix[2 : len(suffix)-1]); err == nil {
				return title[:idx] + " (" + strconv.Itoa(n+1) + ")"
			}
		}
	}
	return title + " (2)"
}

func (r *Repository) DuplicateTx(ctx context.Context, tx *sql.Tx, taskID string) (Task, error) {
	var src Task
	var startDate, dueDate sql.NullString
	err := tx.QueryRowContext(ctx, `
		SELECT column_id, title, description, priority, type,
		       TO_CHAR(start_date, 'YYYY-MM-DD'),
		       TO_CHAR(due_date,   'YYYY-MM-DD')
		FROM tasks WHERE id = $1`, taskID).Scan(
		&src.ColumnID, &src.Title, &src.Description, &src.Priority, &src.Type,
		&startDate, &dueDate,
	)
	if err != nil {
		return Task{}, err
	}
	if startDate.Valid {
		src.StartDate = &startDate.String
	}
	if dueDate.Valid {
		src.DueDate = &dueDate.String
	}

	// Insert at end of column
	var maxPos int
	tx.QueryRowContext(ctx, `SELECT COALESCE(MAX(position)+1,0) FROM tasks WHERE column_id=$1`, src.ColumnID).Scan(&maxPos)

	newID := ids.New()
	var createdAt time.Time
	if err := tx.QueryRowContext(ctx, `
		INSERT INTO tasks (id, column_id, title, description, priority, type, start_date, due_date, position)
		VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING created_at`,
		newID, src.ColumnID, nextDuplicateTitle(src.Title), src.Description, src.Priority, src.Type,
		src.StartDate, src.DueDate, maxPos,
	).Scan(&createdAt); err != nil {
		return Task{}, err
	}

	// Copy tags — collect first, then insert (pq can't Exec while Rows is open)
	tags := []string{}
	{
		rows, err := tx.QueryContext(ctx, `SELECT tag FROM task_tags WHERE task_id=$1`, taskID)
		if err != nil {
			return Task{}, err
		}
		for rows.Next() {
			var tag string
			if err := rows.Scan(&tag); err != nil {
				rows.Close()
				return Task{}, err
			}
			tags = append(tags, tag)
		}
		rows.Close()
		for _, tag := range tags {
			if _, err := tx.ExecContext(ctx, `INSERT INTO task_tags (task_id, tag) VALUES ($1,$2)`, newID, tag); err != nil {
				return Task{}, err
			}
		}
	}

	// Copy assignees — same pattern
	assignees := []string{}
	{
		rows, err := tx.QueryContext(ctx, `SELECT member_id FROM task_assignees WHERE task_id=$1`, taskID)
		if err != nil {
			return Task{}, err
		}
		for rows.Next() {
			var mid string
			if err := rows.Scan(&mid); err != nil {
				rows.Close()
				return Task{}, err
			}
			assignees = append(assignees, mid)
		}
		rows.Close()
		for _, mid := range assignees {
			if _, err := tx.ExecContext(ctx, `INSERT INTO task_assignees (task_id, member_id) VALUES ($1,$2)`, newID, mid); err != nil {
				return Task{}, err
			}
		}
	}

	return Task{
		ID: newID, ColumnID: src.ColumnID, Title: nextDuplicateTitle(src.Title),
		Description: src.Description, Priority: src.Priority, Type: src.Type,
		StartDate: src.StartDate, DueDate: src.DueDate,
		Tags: tags, Assignees: assignees, Comments: []Comment{}, Subtasks: []Subtask{},
		CreatedAt: createdAt,
	}, nil
}

