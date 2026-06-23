package personaltasks

import (
	"context"
	"errors"
	"strings"
)

type Service struct {
	repo *Repository
}

func NewService(repo *Repository) *Service {
	return &Service{repo: repo}
}

func (s *Service) List(ctx context.Context, userID string) ([]PersonalTask, error) {
	return s.repo.List(ctx, userID)
}

func (s *Service) Create(ctx context.Context, userID string, in CreateInput) (PersonalTask, error) {
	in.Title = strings.TrimSpace(in.Title)
	if in.Title == "" {
		return PersonalTask{}, errors.New("title is required")
	}
	if in.DueDate != nil && *in.DueDate == "" {
		in.DueDate = nil
	}
	return s.repo.Create(ctx, userID, in)
}

func (s *Service) Update(ctx context.Context, userID, id string, in UpdateInput) (PersonalTask, error) {
	if in.Title != nil {
		t := strings.TrimSpace(*in.Title)
		if t == "" {
			return PersonalTask{}, errors.New("title cannot be empty")
		}
		in.Title = &t
	}
	return s.repo.Update(ctx, userID, id, in)
}

func (s *Service) Delete(ctx context.Context, userID, id string) error {
	return s.repo.Delete(ctx, userID, id)
}
