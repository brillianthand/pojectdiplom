package notifications

import "context"

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context, userID, before string) ([]Notification, bool, error) {
	return s.repo.List(ctx, userID, before)
}

func (s *Service) UnreadCount(ctx context.Context, userID string) (int, error) {
	return s.repo.UnreadCount(ctx, userID)
}

// Create inserts a simple notification (no project/task link).
func (s *Service) Create(ctx context.Context, userID, notifType, title string) error {
	return s.repo.Create(ctx, CreateInput{
		UserID: userID,
		Type:   notifType,
		Title:  title,
	})
}

// CreateAssigned inserts a task-assignment notification with a deep link
// (taskID + boardID) so the frontend can navigate to the task on click.
func (s *Service) CreateAssigned(ctx context.Context, userID, title, taskID, boardID string) error {
	return s.repo.Create(ctx, CreateInput{
		UserID:  userID,
		Type:    TypeAssigned,
		Title:   title,
		TaskID:  taskID,
		BoardID: boardID,
	})
}

// CreateCommented notifies a user that someone commented on a task they're assigned to.
func (s *Service) CreateCommented(ctx context.Context, userID, actorID, taskID, boardID, taskTitle string) error {
	return s.repo.Create(ctx, CreateInput{
		UserID:  userID,
		Type:    TypeCommented,
		Title:   taskTitle,
		TaskID:  taskID,
		BoardID: boardID,
		ActorID: actorID,
	})
}

// CreateMentioned notifies a user that they were @mentioned in a comment.
func (s *Service) CreateMentioned(ctx context.Context, userID, actorID, taskID, boardID, taskTitle string) error {
	return s.repo.Create(ctx, CreateInput{
		UserID:  userID,
		Type:    TypeMentioned,
		Title:   taskTitle,
		TaskID:  taskID,
		BoardID: boardID,
		ActorID: actorID,
	})
}

// CreateRoleChanged notifies a user that their role in a project has changed.
// Carries projectID (deep link target) and actorID (who made the change).
func (s *Service) CreateRoleChanged(ctx context.Context, userID, actorID, projectID, title string) error {
	return s.repo.Create(ctx, CreateInput{
		UserID:    userID,
		Type:      TypeRoleChanged,
		Title:     title,
		ProjectID: projectID,
		ActorID:   actorID,
	})
}

// CreateInvite inserts an invitation notification with project context.
func (s *Service) CreateInvite(ctx context.Context, userID, invitedBy, projectID, title string) error {
	return s.repo.Create(ctx, CreateInput{
		UserID:    userID,
		Type:      TypeInvite,
		Title:     title,
		ProjectID: projectID,
		InvitedBy: invitedBy,
	})
}

func (s *Service) MarkAllRead(ctx context.Context, userID string) error {
	return s.repo.MarkAllRead(ctx, userID)
}

func (s *Service) MarkOneRead(ctx context.Context, userID, notifID string) error {
	return s.repo.MarkOneRead(ctx, userID, notifID)
}

func (s *Service) MarkInviteRead(ctx context.Context, userID, projectID string) error {
	return s.repo.MarkInviteRead(ctx, userID, projectID)
}
