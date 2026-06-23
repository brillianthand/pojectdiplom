package sprints

import "time"

// Sprint represents a time-boxed iteration in Scrum.
type Sprint struct {
	ID        string  `json:"id"`
	BoardID   string  `json:"boardId"`
	Name      string  `json:"name"`
	Goal      string  `json:"goal"`
	Status    string  `json:"status"` // planning | active | completed
	StartDate *string `json:"startDate"`
	EndDate   *string `json:"endDate"`
	CreatedAt time.Time `json:"createdAt"`
	// Aggregates filled by repository
	TotalTasks     int `json:"totalTasks"`
	CompletedTasks int `json:"completedTasks"`
}

// BacklogTask is a minimal task representation for the backlog view.
type BacklogTask struct {
	ID        string   `json:"id"`
	ColumnID  string   `json:"columnId"`
	Title     string   `json:"title"`
	Priority  string   `json:"priority"`
	Type      string   `json:"type"`
	Completed bool     `json:"completed"`
	Assignees []string `json:"assignees"`
	SprintID  *string  `json:"sprintId"`
	DueDate   *string  `json:"dueDate"`
}

// BacklogResponse is the full payload for GET /api/boards/{id}/sprints
type BacklogResponse struct {
	Sprints      []Sprint      `json:"sprints"`
	BacklogTasks []BacklogTask `json:"backlogTasks"`
}
