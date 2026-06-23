package notifications

import "time"

type Notification struct {
	ID        string    `json:"id"`
	Type      string    `json:"type"`
	Title     string    `json:"title"`
	Read      bool      `json:"read"`
	CreatedAt time.Time `json:"createdAt"`
	ProjectID string    `json:"projectId,omitempty"`
	InvitedBy string    `json:"invitedBy,omitempty"`
	TaskID    string    `json:"taskId,omitempty"`
	BoardID   string    `json:"boardId,omitempty"`
	ActorID   string    `json:"actorId,omitempty"`
}

const (
	TypeInvite      = "invite"
	TypeAssigned    = "assigned"
	TypeCommented   = "commented"
	TypeMentioned   = "mentioned"
	TypeRoleChanged = "role_changed"
)
