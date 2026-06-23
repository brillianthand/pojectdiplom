package members

import "kanban/internal/users"

type Member struct {
	users.User
	Role   string `json:"role"`
	Status string `json:"status"`
}

const (
	RoleAdmin    = "admin"
	RoleManager  = "manager"
	RoleExecutor = "executor"
	RoleObserver = "observer"

	StatusPending  = "pending"
	StatusAccepted = "accepted"
)

// roleRank gives each role a numeric weight so callers can compare "is at least X".
// Higher rank = more privileges. Unknown strings get -1 and never satisfy any check.
func roleRank(r string) int {
	switch r {
	case RoleAdmin:
		return 3
	case RoleManager:
		return 2
	case RoleExecutor:
		return 1
	case RoleObserver:
		return 0
	default:
		return -1
	}
}

// IsValidRole covers all roles that can exist in project_members.role.
func IsValidRole(r string) bool {
	return roleRank(r) >= 0
}

// AtLeast reports whether actual has at least the privileges of required.
func AtLeast(actual, required string) bool {
	return roleRank(actual) >= roleRank(required)
}
