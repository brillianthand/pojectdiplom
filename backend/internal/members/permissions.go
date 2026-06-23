package members

import (
	"context"
	"database/sql"
	"errors"
)

// Permission predicates — single source of truth for "who can do what".
// All predicates take the caller's role inside a project and return whether
// the action is allowed. An empty role string means "not a project member"
// and always returns false.
//
// Ownership (the right to delete the project / transfer ownership) is NOT
// represented here — it lives on projects.owner_id and must be checked with
// IsProjectOwner.

func CanManageProject(role string) bool { return role == RoleAdmin }
func CanManageMembers(role string) bool { return AtLeast(role, RoleManager) }
func CanAssignAdmin(role string) bool   { return role == RoleAdmin }
func CanManageBoards(role string) bool  { return AtLeast(role, RoleManager) }
func CanEditTasks(role string) bool     { return AtLeast(role, RoleExecutor) }
func CanComment(role string) bool       { return AtLeast(role, RoleExecutor) }
func CanBeAssignee(role string) bool    { return AtLeast(role, RoleExecutor) }
func CanView(role string) bool          { return roleRank(role) >= 0 }

// Role lookups. Each returns "" (with nil error) when the user is not an
// accepted member of the relevant project, which lets handlers treat
// "no membership" and "insufficient role" identically — both end as 403.

func (r *Repository) RoleByProject(ctx context.Context, projectID, userID string) (string, error) {
	return scanRole(r.db.QueryRowContext(ctx,
		`SELECT role FROM project_members
		 WHERE project_id = $1 AND user_id = $2 AND status = 'accepted'`,
		projectID, userID))
}

func (r *Repository) RoleByBoard(ctx context.Context, boardID, userID string) (string, error) {
	return scanRole(r.db.QueryRowContext(ctx,
		`SELECT pm.role
		 FROM boards b
		 JOIN project_members pm ON pm.project_id = b.project_id
		 WHERE b.id = $1 AND pm.user_id = $2 AND pm.status = 'accepted'`,
		boardID, userID))
}

func (r *Repository) RoleByColumn(ctx context.Context, columnID, userID string) (string, error) {
	return scanRole(r.db.QueryRowContext(ctx,
		`SELECT pm.role
		 FROM columns c
		 JOIN boards b           ON b.id = c.board_id
		 JOIN project_members pm ON pm.project_id = b.project_id
		 WHERE c.id = $1 AND pm.user_id = $2 AND pm.status = 'accepted'`,
		columnID, userID))
}

func (r *Repository) RoleByTask(ctx context.Context, taskID, userID string) (string, error) {
	return scanRole(r.db.QueryRowContext(ctx,
		`SELECT pm.role
		 FROM tasks t
		 JOIN columns c          ON c.id = t.column_id
		 JOIN boards b           ON b.id = c.board_id
		 JOIN project_members pm ON pm.project_id = b.project_id
		 WHERE t.id = $1 AND pm.user_id = $2 AND pm.status = 'accepted'`,
		taskID, userID))
}

func (r *Repository) RoleByComment(ctx context.Context, commentID, userID string) (string, error) {
	return scanRole(r.db.QueryRowContext(ctx,
		`SELECT pm.role
		 FROM comments cm
		 JOIN tasks t            ON t.id = cm.task_id
		 JOIN columns c          ON c.id = t.column_id
		 JOIN boards b           ON b.id = c.board_id
		 JOIN project_members pm ON pm.project_id = b.project_id
		 WHERE cm.id = $1 AND pm.user_id = $2 AND pm.status = 'accepted'`,
		commentID, userID))
}

func (r *Repository) RoleBySubtask(ctx context.Context, subtaskID, userID string) (string, error) {
	return scanRole(r.db.QueryRowContext(ctx,
		`SELECT pm.role
		 FROM subtasks s
		 JOIN tasks t            ON t.id = s.task_id
		 JOIN columns c          ON c.id = t.column_id
		 JOIN boards b           ON b.id = c.board_id
		 JOIN project_members pm ON pm.project_id = b.project_id
		 WHERE s.id = $1 AND pm.user_id = $2 AND pm.status = 'accepted'`,
		subtaskID, userID))
}

// IsProjectOwner reports whether userID matches projects.owner_id for the project.
func (r *Repository) IsProjectOwner(ctx context.Context, projectID, userID string) (bool, error) {
	var ownerID sql.NullString
	err := r.db.QueryRowContext(ctx,
		`SELECT owner_id FROM projects WHERE id = $1`, projectID,
	).Scan(&ownerID)
	if err != nil {
		return false, err
	}
	return ownerID.Valid && ownerID.String == userID, nil
}

// AdminCount returns how many accepted admins the project currently has.
// Used to prevent demoting the last admin.
func (r *Repository) AdminCount(ctx context.Context, projectID string) (int, error) {
	var n int
	err := r.db.QueryRowContext(ctx,
		`SELECT COUNT(*) FROM project_members
		 WHERE project_id = $1 AND role = 'admin' AND status = 'accepted'`,
		projectID,
	).Scan(&n)
	return n, err
}

func scanRole(row *sql.Row) (string, error) {
	var role string
	err := row.Scan(&role)
	if errors.Is(err, sql.ErrNoRows) {
		return "", nil
	}
	return role, err
}
