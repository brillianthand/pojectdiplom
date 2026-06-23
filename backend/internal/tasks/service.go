package tasks

import (
	"context"
	"database/sql"
	"encoding/json"

	"kanban/internal/platform/db"
)

type Service struct {
	db   *sql.DB
	repo *Repository
}

func NewService(d *sql.DB, repo *Repository) *Service {
	return &Service{db: d, repo: repo}
}

func (s *Service) Create(ctx context.Context, columnID, title string) (Task, error) {
	var task Task
	err := db.WithTx(ctx, s.db, func(tx *sql.Tx) error {
		var err error
		task, err = s.repo.CreateTx(ctx, tx, columnID, title)
		return err
	})
	return task, err
}

func (s *Service) Update(ctx context.Context, id string, raw map[string]json.RawMessage) error {
	return s.repo.UpdateFields(ctx, id, raw)
}

func (s *Service) Move(ctx context.Context, taskID, toColumnID string, fromIDs, toIDs []string) error {
	return db.WithTx(ctx, s.db, func(tx *sql.Tx) error {
		return s.repo.MoveTx(ctx, tx, taskID, toColumnID, fromIDs, toIDs)
	})
}

func (s *Service) Delete(ctx context.Context, id string) error {
	return s.repo.Delete(ctx, id)
}

func (s *Service) Archive(ctx context.Context, id string) error {
	return s.repo.Archive(ctx, id)
}

func (s *Service) Restore(ctx context.Context, id string) error {
	return s.repo.Restore(ctx, id)
}

func (s *Service) ListArchived(ctx context.Context, boardID string) ([]Task, error) {
	return s.repo.ListArchived(ctx, boardID)
}

func (s *Service) AddComment(ctx context.Context, taskID, userID, author, color, initials, text string, attachments []NewAttachment) (Comment, error) {
	return s.repo.AddComment(ctx, taskID, userID, author, color, initials, text, attachments)
}

func (s *Service) GetAttachment(ctx context.Context, id string) (filename, contentType string, data []byte, err error) {
	return s.repo.GetAttachment(ctx, id)
}

func (s *Service) UpdateComment(ctx context.Context, id, userID, text string) error {
	return s.repo.UpdateComment(ctx, id, userID, text)
}

func (s *Service) DeleteComment(ctx context.Context, id string) error {
	return s.repo.DeleteComment(ctx, id)
}

func (s *Service) BoardIDForColumn(ctx context.Context, columnID string) string {
	return s.repo.BoardIDForColumn(ctx, columnID)
}

func (s *Service) BoardIDForTask(ctx context.Context, taskID string) string {
	return s.repo.BoardIDForTask(ctx, taskID)
}

func (s *Service) GetAssignees(ctx context.Context, taskID string) []string {
	return s.repo.GetAssignees(ctx, taskID)
}

func (s *Service) GetTitle(ctx context.Context, taskID string) string {
	return s.repo.GetTitle(ctx, taskID)
}

func (s *Service) AddSubtask(ctx context.Context, taskID, title string) (Subtask, error) {
	return s.repo.AddSubtask(ctx, taskID, title)
}

func (s *Service) UpdateSubtask(ctx context.Context, id string, title *string, completed *bool) error {
	return s.repo.UpdateSubtask(ctx, id, title, completed)
}

func (s *Service) DeleteSubtask(ctx context.Context, id string) error {
	return s.repo.DeleteSubtask(ctx, id)
}

func (s *Service) BoardIDForSubtask(ctx context.Context, subtaskID string) string {
	return s.repo.BoardIDForSubtask(ctx, subtaskID)
}

func (s *Service) TaskIDForSubtask(ctx context.Context, subtaskID string) string {
	return s.repo.TaskIDForSubtask(ctx, subtaskID)
}

func (s *Service) Search(ctx context.Context, userID, query string, limit int) ([]SearchResult, error) {
	return s.repo.Search(ctx, userID, query, limit)
}

func (s *Service) GetByID(ctx context.Context, taskID string) (Task, error) {
	return s.repo.GetByID(ctx, taskID)
}

func (s *Service) LogEvent(ctx context.Context, taskID, userID, evType string, payload any) error {
	return s.repo.LogEvent(ctx, taskID, userID, evType, payload)
}

func (s *Service) ListEvents(ctx context.Context, taskID string) ([]TaskEvent, error) {
	return s.repo.ListEvents(ctx, taskID)
}

func (s *Service) ColumnTitle(ctx context.Context, colID string) string {
	return s.repo.ColumnTitle(ctx, colID)
}

func (s *Service) Star(ctx context.Context, userID, taskID string) error {
	return s.repo.Star(ctx, userID, taskID)
}

func (s *Service) Unstar(ctx context.Context, userID, taskID string) error {
	return s.repo.Unstar(ctx, userID, taskID)
}

func (s *Service) ListStarredIDs(ctx context.Context, userID string) ([]string, error) {
	return s.repo.ListStarredIDs(ctx, userID)
}

func (s *Service) FeedForUser(ctx context.Context, userID string, limit int) ([]FeedItem, error) {
	return s.repo.FeedForUser(ctx, userID, limit)
}

func (s *Service) Duplicate(ctx context.Context, taskID string) (Task, error) {
	var task Task
	err := db.WithTx(ctx, s.db, func(tx *sql.Tx) error {
		var err error
		task, err = s.repo.DuplicateTx(ctx, tx, taskID)
		return err
	})
	return task, err
}
