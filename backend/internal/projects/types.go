package projects

type BoardSummary struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

type Project struct {
	ID            string         `json:"id"`
	Name          string         `json:"name"`
	Color         string         `json:"color"`
	Icon          string         `json:"icon"`
	Status        string         `json:"status"`
	OwnerID       string         `json:"ownerId"`
	ActiveBoardID string         `json:"activeBoardId"`
	Boards        []BoardSummary `json:"boards"`
}
