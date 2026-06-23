package workspace

import "time"

type ProjectStat struct {
	ID            string     `json:"id"`
	Name          string     `json:"name"`
	Color         string     `json:"color"`
	Icon          string     `json:"icon"`
	OwnerID       string     `json:"ownerId"`
	ActiveBoardID string     `json:"activeBoardId"`
	MembersCount  int        `json:"membersCount"`
	BoardsCount   int        `json:"boardsCount"`
	TasksTotal    int        `json:"tasksTotal"`
	TasksDone     int        `json:"tasksDone"`
	LastActivity  *time.Time `json:"lastActivity"`
	Status        string     `json:"status"`
}

type Person struct {
	ID            string `json:"id"`
	Email         string `json:"email"`
	Name          string `json:"name"`
	Color         string `json:"color"`
	AvatarURL     string `json:"avatarUrl"`
	Initials      string `json:"initials"`
	ProjectsCount int    `json:"projectsCount"`
	IsYou         bool   `json:"isYou"`
}

type PendingInvite struct {
	Email         string `json:"email"`
	ProjectsCount int    `json:"projectsCount"`
}

type Totals struct {
	ProjectsCount int `json:"projectsCount"`
	PeopleCount   int `json:"peopleCount"`
	TasksOpen     int `json:"tasksOpen"`
}

type Workspace struct {
	Projects       []ProjectStat   `json:"projects"`
	People         []Person        `json:"people"`
	PendingInvites []PendingInvite `json:"pendingInvites"`
	Totals         Totals          `json:"totals"`
}
