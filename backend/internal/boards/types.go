package boards

import "kanban/internal/tasks"

type Board struct {
	ID        string        `json:"id"`
	ProjectID string        `json:"projectId,omitempty"`
	Name      string        `json:"name"`
	Settings  BoardSettings `json:"settings"`
}

// BoardSettings holds per-board automation flags. JSON field names mirror the
// JSONB shape stored in boards.settings. Defaults are applied in defaultSettings()
// so that boards created before this column was added still behave predictably.
type BoardSettings struct {
	AutoMoveOnComplete bool   `json:"autoMoveOnComplete"`
	AutoMoveColumnID   string `json:"autoMoveColumnId"`
	AutoArchiveEnabled bool   `json:"autoArchiveEnabled"`
	AutoArchiveDays    int    `json:"autoArchiveDays"`
	ScrumEnabled       bool   `json:"scrumEnabled"`
}

// DefaultSettings preserves the legacy behavior: completing a task moves it to
// the last column, and auto-archive is off.
func DefaultSettings() BoardSettings {
	return BoardSettings{
		AutoMoveOnComplete: true,
		AutoMoveColumnID:   "",
		AutoArchiveEnabled: false,
		AutoArchiveDays:    7,
	}
}

type Column struct {
	ID        string `json:"id"`
	BoardID   string `json:"boardId,omitempty"`
	Title     string `json:"title"`
	Color     string `json:"color"`
	TextColor string `json:"textColor"`
	Position  int    `json:"position"`
}

type Detail struct {
	ID       string                  `json:"id"`
	Name     string                  `json:"name"`
	Settings BoardSettings           `json:"settings"`
	Columns  []Column                `json:"columns"`
	Tasks    map[string][]tasks.Task `json:"tasks"`
}

// ColumnTemplate describes a board template — a named list of starter columns.
type ColumnTemplate struct {
	ID      string
	Label   string
	Columns []Column
}

var Templates = map[string]ColumnTemplate{
	"empty": {
		ID:    "empty",
		Label: "Empty",
		Columns: []Column{
			// Синий — нейтральный старт
			{Title: "Новые задачи", Color: "#bae6fd", TextColor: "#0c4a6e"},
		},
	},
	"kanban": {
		ID:    "kanban",
		Label: "Kanban",
		Columns: []Column{
			// Синий — ещё не начато
			{Title: "К выполнению", Color: "#bfdbfe", TextColor: "#1e3a8a"},
			// Жёлтый — в процессе
			{Title: "В работе", Color: "#fde68a", TextColor: "#78350f"},
			// Оранжевый — на проверке
			{Title: "На проверке", Color: "#fed7aa", TextColor: "#9a3412"},
			// Зелёный — готово
			{Title: "Готово", Color: "#bbf7d0", TextColor: "#14532d"},
		},
	},
	"scrum": {
		ID:    "scrum",
		Label: "Scrum",
		Columns: []Column{
			// Фиолетовый — бэклог (идеи, не запланировано)
			{Title: "Бэклог", Color: "#e9d5ff", TextColor: "#581c87"},
			// Синий — запланировано к выполнению
			{Title: "К выполнению", Color: "#bfdbfe", TextColor: "#1e3a8a"},
			// Жёлтый — в работе
			{Title: "В работе", Color: "#fde68a", TextColor: "#78350f"},
			// Оранжевый — на проверке
			{Title: "На проверке", Color: "#fed7aa", TextColor: "#9a3412"},
			// Зелёный — выполнено
			{Title: "Готово", Color: "#bbf7d0", TextColor: "#14532d"},
		},
	},
}

// TemplateOrDefault returns the template for the given id, or the kanban
// template when id is empty / unknown.
func TemplateOrDefault(id string) ColumnTemplate {
	if t, ok := Templates[id]; ok {
		return t
	}
	return Templates["empty"]
}
