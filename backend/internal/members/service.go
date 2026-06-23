package members

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

// Notifier is satisfied by notifications.Service.
type Notifier interface {
	CreateInvite(ctx context.Context, userID, invitedBy, projectID, title string) error
	MarkInviteRead(ctx context.Context, userID, projectID string) error
}

// ProjectInfo returns the project name; satisfied by projects.Repository through a thin adapter.
type ProjectInfo interface {
	Name(ctx context.Context, projectID string) (string, error)
}

type Service struct {
	repo    *Repository
	notif   Notifier
	project ProjectInfo
}

func NewService(repo *Repository, notif Notifier, project ProjectInfo) *Service {
	return &Service{repo: repo, notif: notif, project: project}
}

var (
	ErrUserNotFound  = errors.New("user not found")
	ErrAlreadyMember = errors.New("user already in project")
	ErrInvalidRole   = errors.New("invalid role")
)

func (s *Service) List(ctx context.Context, projectID string) ([]Member, error) {
	return s.repo.List(ctx, projectID)
}

// Invite creates a pending membership and sends an invite notification.
// If the user already exists in project_members (any status), returns ErrAlreadyMember.
func (s *Service) Invite(ctx context.Context, projectID, email, role, invitedBy string) (Member, error) {
	if !IsValidRole(role) {
		return Member{}, ErrInvalidRole
	}

	u, err := s.repo.FindUserByEmail(ctx, email)
	if errors.Is(err, sql.ErrNoRows) {
		return Member{}, ErrUserNotFound
	}
	if err != nil {
		return Member{}, err
	}

	existing, err := s.repo.Find(ctx, projectID, u.ID)
	if err == nil {
		_ = existing
		return Member{}, ErrAlreadyMember
	}
	if !errors.Is(err, sql.ErrNoRows) {
		return Member{}, err
	}

	m, err := s.repo.Add(ctx, projectID, u.ID, role, StatusPending)
	if err != nil {
		return Member{}, err
	}

	projectName, _ := s.project.Name(ctx, projectID)
	if projectName == "" {
		projectName = "проект"
	}
	title := fmt.Sprintf("Приглашение в «%s»", projectName)
	_ = s.notif.CreateInvite(ctx, u.ID, invitedBy, projectID, title)

	return m, nil
}

func (s *Service) Remove(ctx context.Context, projectID, userID string) error {
	return s.repo.Remove(ctx, projectID, userID)
}

func (s *Service) UpdateRole(ctx context.Context, projectID, userID, role string) error {
	if !IsValidRole(role) {
		return ErrInvalidRole
	}
	return s.repo.UpdateRole(ctx, projectID, userID, role)
}

func (s *Service) Accept(ctx context.Context, projectID, userID string) (Member, error) {
	if err := s.repo.Accept(ctx, projectID, userID); err != nil {
		return Member{}, err
	}
	_ = s.notif.MarkInviteRead(ctx, userID, projectID)
	return s.repo.Find(ctx, projectID, userID)
}

// ProjectName resolves the project's display name via the wired ProjectInfo,
// falling back to "проект" when the lookup fails so notification copy never breaks.
func (s *Service) ProjectName(ctx context.Context, projectID string) string {
	name, _ := s.project.Name(ctx, projectID)
	if name == "" {
		name = "проект"
	}
	return name
}

func (s *Service) Decline(ctx context.Context, projectID, userID string) error {
	if err := s.repo.Remove(ctx, projectID, userID); err != nil {
		return err
	}
	_ = s.notif.MarkInviteRead(ctx, userID, projectID)
	return nil
}
