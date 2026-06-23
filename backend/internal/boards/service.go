package boards

import (
	"context"
	"database/sql"

	"kanban/internal/platform/db"
	"kanban/internal/platform/ids"
)

type Service struct {
	db   *sql.DB
	repo *Repository
}

func NewService(d *sql.DB, repo *Repository) *Service {
	return &Service{db: d, repo: repo}
}

// CreateFromTemplateTx creates a board with columns from the given template
// inside an existing transaction. An empty templateID falls back to "kanban".
// When templateID == "scrum", scrumEnabled is automatically set to true.
func (s *Service) CreateFromTemplateTx(ctx context.Context, tx *sql.Tx, projectID, name, templateID string) (string, error) {
	boardID, err := s.repo.InsertBoard(ctx, tx, projectID, name)
	if err != nil {
		return "", err
	}
	if err := s.repo.InsertTemplateColumns(ctx, tx, boardID, templateID); err != nil {
		return "", err
	}
	// Automatically enable Scrum mode when the scrum template is selected.
	if templateID == "scrum" {
		settings := DefaultSettings()
		settings.ScrumEnabled = true
		if err := s.repo.SetSettingsTx(ctx, tx, boardID, settings); err != nil {
			return "", err
		}
	}
	return boardID, nil
}

// CreateFromColumnsTx creates a board with custom column titles inside an existing transaction.
func (s *Service) CreateFromColumnsTx(ctx context.Context, tx *sql.Tx, projectID, name string, columnTitles []string) (string, error) {
	boardID, err := s.repo.InsertBoard(ctx, tx, projectID, name)
	if err != nil {
		return "", err
	}
	for i, title := range columnTitles {
		c := Column{
			ID:        ids.New(),
			BoardID:   boardID,
			Title:     title,
			Color:     "#f8fafc",
			TextColor: "#475569",
			Position:  i,
		}
		if err := s.repo.InsertColumn(ctx, tx, c); err != nil {
			return "", err
		}
	}
	return boardID, nil
}

func (s *Service) CreateForProject(ctx context.Context, projectID, name, templateID string) (Board, error) {
	if templateID == "" {
		templateID = "empty"
	}
	var boardID string
	err := db.WithTx(ctx, s.db, func(tx *sql.Tx) error {
		var err error
		boardID, err = s.CreateFromTemplateTx(ctx, tx, projectID, name, templateID)
		if err != nil {
			return err
		}
		_, err = tx.ExecContext(ctx,
			`UPDATE projects SET active_board_id = $1 WHERE id = $2`, boardID, projectID)
		return err
	})
	if err != nil {
		return Board{}, err
	}
	return Board{ID: boardID, ProjectID: projectID, Name: name}, nil
}

func (s *Service) Delete(ctx context.Context, id string) error {
	return s.repo.DeleteBoard(ctx, id)
}

func (s *Service) Rename(ctx context.Context, id, name string) error {
	return s.repo.UpdateBoard(ctx, id, name)
}

func (s *Service) GetDetail(ctx context.Context, id string) (*Detail, error) {
	return s.repo.GetBoardDetail(ctx, id)
}

func (s *Service) ReorderColumns(ctx context.Context, boardID string, orderedIDs []string) error {
	return db.WithTx(ctx, s.db, func(tx *sql.Tx) error {
		return s.repo.ReorderColumnsTx(ctx, tx, boardID, orderedIDs)
	})
}

func (s *Service) CreateColumn(ctx context.Context, boardID, title, color, textColor string) (Column, error) {
	if color == "" {
		color = "#f8fafc"
	}
	if textColor == "" {
		textColor = "#475569"
	}
	pos, err := s.repo.NextColumnPosition(ctx, boardID)
	if err != nil {
		return Column{}, err
	}
	c := Column{
		ID: ids.New(), BoardID: boardID,
		Title: title, Color: color, TextColor: textColor, Position: pos,
	}
	if err := s.repo.InsertColumn(ctx, s.db, c); err != nil {
		return Column{}, err
	}
	return c, nil
}

func (s *Service) UpdateColumn(ctx context.Context, id string, title, color, textColor *string) error {
	return s.repo.UpdateColumnFields(ctx, s.db, id, title, color, textColor)
}

func (s *Service) DeleteColumn(ctx context.Context, id string) error {
	return s.repo.DeleteColumn(ctx, id)
}

func (s *Service) EnsureShareToken(ctx context.Context, boardID string) (string, error) {
	existing, err := s.repo.GetShareToken(ctx, boardID)
	if err != nil {
		return "", err
	}
	if existing != "" {
		return existing, nil
	}
	token := ids.New() + ids.New()
	if err := s.repo.SetShareToken(ctx, boardID, token); err != nil {
		return "", err
	}
	return token, nil
}

func (s *Service) GetDetailByToken(ctx context.Context, token string) (*Detail, error) {
	return s.repo.GetDetailByToken(ctx, token)
}

// UpdateSettings persists the board's settings. The caller is responsible for
// permission checks; this just writes whatever payload it gets.
func (s *Service) UpdateSettings(ctx context.Context, boardID string, settings BoardSettings) error {
	if settings.AutoArchiveDays <= 0 {
		settings.AutoArchiveDays = 7
	}
	return s.repo.SetSettings(ctx, boardID, settings)
}

func (s *Service) BoardIDForColumn(ctx context.Context, columnID string) string {
	var id string
	s.db.QueryRowContext(ctx, `SELECT board_id FROM columns WHERE id = $1`, columnID).Scan(&id)
	return id
}
