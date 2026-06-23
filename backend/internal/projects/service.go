package projects

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"strings"

	"kanban/internal/members"
	"kanban/internal/platform/db"
)

// BoardCreator is satisfied by boards.Service — injected to avoid circular import.
type BoardCreator interface {
	CreateFromTemplateTx(ctx context.Context, tx *sql.Tx, projectID, name, templateID string) (string, error)
	CreateFromColumnsTx(ctx context.Context, tx *sql.Tx, projectID, name string, columns []string) (string, error)
}

// MemberRepo is satisfied by members.Repository — injected to keep modules decoupled.
type MemberRepo interface {
	AddPendingTx(ctx context.Context, tx *sql.Tx, projectID, userID, role string) error
	FindUserIDByEmail(ctx context.Context, email string) (string, error)
}

// EmailInvite is an email-based invite with an explicit role.
type EmailInvite struct {
	Email string
	Role  string
}

// Notifier is satisfied by notifications.Service.
type Notifier interface {
	CreateInvite(ctx context.Context, userID, invitedBy, projectID, title string) error
}

type Service struct {
	db      *sql.DB
	repo    *Repository
	boards  BoardCreator
	members MemberRepo
	notif   Notifier
}

func NewService(d *sql.DB, repo *Repository, boards BoardCreator, members MemberRepo, notif Notifier) *Service {
	return &Service{db: d, repo: repo, boards: boards, members: members, notif: notif}
}

func (s *Service) List(ctx context.Context, userID string) ([]Project, error) {
	return s.repo.List(ctx, userID)
}

// CreateInput captures all fields accepted on project creation.
type CreateInput struct {
	Name          string
	Color         string
	Icon          string
	Template      string
	OwnerID       string
	MemberIDs     []string
	MemberRoles   map[string]string // optional per-member role; defaults to "executor"
	CustomColumns []string          // used when Template == "custom"
	InviteEmails  []EmailInvite     // invite by email with explicit role
}

func (s *Service) Create(ctx context.Context, in CreateInput) (Project, error) {
	if strings.TrimSpace(in.Name) == "" {
		return Project{}, errors.New("name required")
	}
	if in.Color == "" {
		in.Color = "#3b82f6"
	}
	if in.Icon == "" {
		in.Icon = "📋"
	}
	if in.Template == "" {
		in.Template = "kanban"
	}

	// Resolve email invites to user IDs before the transaction (read-only lookup).
	type resolvedInvite struct {
		userID string
		role   string
	}
	var emailInvites []resolvedInvite
	for _, inv := range in.InviteEmails {
		if inv.Email == "" {
			continue
		}
		role := inv.Role
		if !members.IsValidRole(role) {
			role = "executor"
		}
		uid, err := s.members.FindUserIDByEmail(ctx, inv.Email)
		if errors.Is(err, sql.ErrNoRows) {
			continue // not registered yet — skip silently
		}
		if err != nil {
			return Project{}, fmt.Errorf("lookup %s: %w", inv.Email, err)
		}
		if uid != in.OwnerID {
			emailInvites = append(emailInvites, resolvedInvite{userID: uid, role: role})
		}
	}

	var projectID, boardID string
	invited := []string{}

	err := db.WithTx(ctx, s.db, func(tx *sql.Tx) error {
		var err error
		projectID, err = s.repo.InsertTx(ctx, tx, in.Name, in.Color, in.Icon, in.OwnerID, nil)
		if err != nil {
			return err
		}
		seen := map[string]bool{in.OwnerID: true}
		for _, uid := range in.MemberIDs {
			if uid == "" || seen[uid] {
				continue
			}
			seen[uid] = true
			role := "executor"
			if in.MemberRoles != nil {
				if r, ok := in.MemberRoles[uid]; ok && members.IsValidRole(r) {
					role = r
				}
			}
			if err := s.members.AddPendingTx(ctx, tx, projectID, uid, role); err != nil {
				return err
			}
			invited = append(invited, uid)
		}
		for _, inv := range emailInvites {
			if seen[inv.userID] {
				continue
			}
			seen[inv.userID] = true
			if err := s.members.AddPendingTx(ctx, tx, projectID, inv.userID, inv.role); err != nil {
				return err
			}
			invited = append(invited, inv.userID)
		}

		if in.Template == "custom" && len(in.CustomColumns) > 0 {
			boardID, err = s.boards.CreateFromColumnsTx(ctx, tx, projectID, "Main Board", in.CustomColumns)
		} else {
			boardID, err = s.boards.CreateFromTemplateTx(ctx, tx, projectID, "Main Board", in.Template)
		}
		if err != nil {
			return err
		}
		return s.repo.SetActiveBoardTx(ctx, tx, projectID, boardID)
	})
	if err != nil {
		return Project{}, err
	}

	if s.notif != nil {
		title := fmt.Sprintf("Приглашение в «%s»", in.Name)
		for _, uid := range invited {
			_ = s.notif.CreateInvite(ctx, uid, in.OwnerID, projectID, title)
		}
	}

	return Project{
		ID: projectID, Name: in.Name, Color: in.Color, Icon: in.Icon,
		ActiveBoardID: boardID,
		Boards:        []BoardSummary{{ID: boardID, Name: "Main Board"}},
	}, nil
}

func (s *Service) Update(ctx context.Context, id string, name, color, icon, activeBoardID, status *string) error {
	return s.repo.Update(ctx, id, name, color, icon, activeBoardID, status)
}

func (s *Service) Delete(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}

// TransferOwnership atomically sets projects.owner_id to newOwnerID and ensures
// the new owner has an accepted project_members row with role='admin'. The
// previous owner stays in the project as an admin so the operation is non-destructive.
func (s *Service) TransferOwnership(ctx context.Context, projectID, newOwnerID string) error {
	return db.WithTx(ctx, s.db, func(tx *sql.Tx) error {
		return s.repo.TransferOwnershipTx(ctx, tx, projectID, newOwnerID)
	})
}

func (s *Service) Name(ctx context.Context, id string) (string, error) {
	return s.repo.Name(ctx, id)
}
