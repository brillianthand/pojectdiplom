package workspace

import "context"

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) Get(ctx context.Context, userID string) (Workspace, error) {
	projects, err := s.repo.ProjectStats(ctx, userID)
	if err != nil {
		return Workspace{}, err
	}
	people, err := s.repo.People(ctx, userID)
	if err != nil {
		return Workspace{}, err
	}
	invites, err := s.repo.PendingInvites(ctx, userID)
	if err != nil {
		return Workspace{}, err
	}

	myOpen, err := s.repo.MyOpenTasksCount(ctx, userID)
	if err != nil {
		return Workspace{}, err
	}

	return Workspace{
		Projects:       projects,
		People:         people,
		PendingInvites: invites,
		Totals: Totals{
			ProjectsCount: len(projects),
			PeopleCount:   len(people),
			TasksOpen:     myOpen,
		},
	}, nil
}
