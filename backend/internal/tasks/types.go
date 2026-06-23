package tasks

import (
	"encoding/json"
	"time"
)

type Subtask struct {
	ID        string `json:"id"`
	TaskID    string `json:"taskId"`
	Title     string `json:"title"`
	Completed bool   `json:"completed"`
	Position  int    `json:"position"`
}

type Task struct {
	ID          string    `json:"id"`
	ColumnID    string    `json:"columnId"`
	Title       string    `json:"title"`
	Description string    `json:"description"`
	Priority    string    `json:"priority"`
	Type        string    `json:"type"`
	Completed   bool      `json:"completed"`
	Tags        []string  `json:"tags"`
	Assignees   []string  `json:"assignees"`
	StartDate   *string   `json:"startDate"`
	DueDate     *string   `json:"dueDate"`
	CreatedAt   time.Time  `json:"createdAt"`
	CompletedAt *time.Time `json:"completedAt"`
	Comments    []Comment  `json:"comments"`
	Subtasks    []Subtask `json:"subtasks"`
	ColumnTitle string    `json:"columnTitle,omitempty"`
}

type Attachment struct {
	ID          string `json:"id"`
	Filename    string `json:"filename"`
	ContentType string `json:"contentType"`
	SizeBytes   int    `json:"sizeBytes"`
}

// NewAttachment carries raw bytes for one file being saved to comment_attachments.
type NewAttachment struct {
	Filename    string
	ContentType string
	Data        []byte
}

type Comment struct {
	ID             string       `json:"id"`
	UserID         string       `json:"userId"`
	Author         string       `json:"author"`
	AuthorColor    string       `json:"authorColor"`
	AuthorInitials string       `json:"authorInitials"`
	Text           string       `json:"text"`
	CreatedAt      time.Time    `json:"createdAt"`
	Time           string       `json:"time"`
	Attachments    []Attachment `json:"attachments"`
}

// Event types for task_events.type.
const (
	EvCreated         = "created"
	EvTitle           = "title_changed"
	EvDescription     = "description_changed"
	EvPriority        = "priority_changed"
	EvType            = "type_changed"
	EvStartDate       = "start_date_changed"
	EvDueDate         = "due_date_changed"
	EvCompleted       = "completed_changed"
	EvMoved           = "moved"
	EvAssigneeAdded   = "assignee_added"
	EvAssigneeRemoved = "assignee_removed"
	EvTagAdded        = "tag_added"
	EvTagRemoved      = "tag_removed"
	EvArchived        = "archived"
	EvRestored        = "restored"
)

type TaskEvent struct {
	ID           string          `json:"id"`
	TaskID       string          `json:"taskId"`
	UserID       string          `json:"userId"`
	UserName     string          `json:"userName"`
	UserColor    string          `json:"userColor"`
	UserInitials string          `json:"userInitials"`
	Type         string          `json:"type"`
	Payload      json.RawMessage `json:"payload"`
	CreatedAt    time.Time       `json:"createdAt"`
	Time         string          `json:"time"`
}

// FeedItem is a TaskEvent enriched with task / board / project context so
// the workspace feed can render "Аня закрыла X" without N+1 lookups on the client.
type FeedItem struct {
	ID            string          `json:"id"`
	TaskID        string          `json:"taskId"`
	TaskTitle     string          `json:"taskTitle"`
	BoardID       string          `json:"boardId"`
	BoardName     string          `json:"boardName"`
	ProjectID     string          `json:"projectId"`
	ProjectName   string          `json:"projectName"`
	UserID       string          `json:"userId"`
	UserName     string          `json:"userName"`
	UserColor    string          `json:"userColor"`
	UserInitials string          `json:"userInitials"`
	Type          string          `json:"type"`
	Payload       json.RawMessage `json:"payload"`
	CreatedAt     time.Time       `json:"createdAt"`
	Time          string          `json:"time"`
}
