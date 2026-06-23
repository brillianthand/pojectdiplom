package personaltasks

import "time"

// PersonalTask is a private per-user item, not tied to any project/board/column.
type PersonalTask struct {
	ID          string     `json:"id"`
	Title       string     `json:"title"`
	Notes       string     `json:"notes"`
	Completed   bool       `json:"completed"`
	CompletedAt *time.Time `json:"completedAt"`
	DueDate     *string    `json:"dueDate"`
	CreatedAt   time.Time  `json:"createdAt"`
}
