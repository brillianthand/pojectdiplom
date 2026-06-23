package sprints

import (
	"context"
	"fmt"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) GetBacklog(ctx context.Context, boardID string) (BacklogResponse, error) {
	sprints, err := s.repo.ListByBoard(ctx, boardID)
	if err != nil {
		return BacklogResponse{}, err
	}
	backlog, err := s.repo.ListBacklogTasks(ctx, boardID)
	if err != nil {
		return BacklogResponse{}, err
	}
	return BacklogResponse{Sprints: sprints, BacklogTasks: backlog}, nil
}

func (s *Service) Create(ctx context.Context, boardID, name, goal string, startDate, endDate *string) (Sprint, error) {
	if name == "" {
		n, err := s.repo.NextSprintNumber(ctx, boardID)
		if err != nil {
			return Sprint{}, err
		}
		name = fmt.Sprintf("Спринт %d", n)
	}
	return s.repo.Insert(ctx, boardID, name, goal, startDate, endDate)
}

func (s *Service) Update(ctx context.Context, id, name, goal string, startDate, endDate *string) (Sprint, error) {
	if err := s.repo.Update(ctx, id, name, goal, startDate, endDate); err != nil {
		return Sprint{}, err
	}
	return s.repo.GetByID(ctx, id)
}

// Start transitions a sprint from planning → active.
// Returns error if another sprint is already active on the same board.
func (s *Service) Start(ctx context.Context, sprintID string) (Sprint, error) {
	sp, err := s.repo.GetByID(ctx, sprintID)
	if err != nil {
		return Sprint{}, err
	}
	if sp.Status != "planning" {
		return Sprint{}, fmt.Errorf("sprint is not in planning status")
	}
	existing, err := s.repo.ActiveSprintForBoard(ctx, sp.BoardID)
	if err != nil {
		return Sprint{}, err
	}
	if existing != "" && existing != sprintID {
		return Sprint{}, fmt.Errorf("board already has an active sprint")
	}
	if err := s.repo.SetStatus(ctx, sprintID, "active"); err != nil {
		return Sprint{}, err
	}
	// Automatically move tasks from Backlog column to To Do column
	if err := s.repo.MoveSprintTasksToNextColumn(ctx, sprintID, sp.BoardID); err != nil {
		return Sprint{}, err
	}
	return s.repo.GetByID(ctx, sprintID)
}

// Complete transitions active → completed.
// Returns the count of tasks returned to backlog.
func (s *Service) Complete(ctx context.Context, sprintID string) (Sprint, int, error) {
	sp, err := s.repo.GetByID(ctx, sprintID)
	if err != nil {
		return Sprint{}, 0, err
	}
	if sp.Status != "active" {
		return Sprint{}, 0, fmt.Errorf("sprint is not active")
	}
	returned, err := s.repo.ReturnIncompleteToBacklog(ctx, sprintID)
	if err != nil {
		return Sprint{}, 0, err
	}
	if err := s.repo.SetStatus(ctx, sprintID, "completed"); err != nil {
		return Sprint{}, 0, err
	}
	sp, err = s.repo.GetByID(ctx, sprintID)
	return sp, returned, err
}

func (s *Service) Delete(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}

func (s *Service) SetTaskSprint(ctx context.Context, taskID string, sprintID *string) error {
	return s.repo.SetTaskSprint(ctx, taskID, sprintID)
}
