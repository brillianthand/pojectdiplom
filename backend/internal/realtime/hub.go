package realtime

import (
	"encoding/json"
	"sync"
)

// Event is sent to all clients subscribed to a board.
type Event struct {
	Type     string `json:"type"`
	BoardID  string `json:"boardId"`
	ClientID string `json:"clientId"`
}

// Hub manages WebSocket clients subscribed to boards.
type Hub struct {
	mu     sync.RWMutex
	boards map[string]map[*Client]bool
}

func NewHub() *Hub {
	return &Hub{boards: make(map[string]map[*Client]bool)}
}

func (h *Hub) subscribe(boardID string, c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if h.boards[boardID] == nil {
		h.boards[boardID] = make(map[*Client]bool)
	}
	h.boards[boardID][c] = true
}

func (h *Hub) unsubscribe(boardID string, c *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if clients, ok := h.boards[boardID]; ok {
		delete(clients, c)
		if len(clients) == 0 {
			delete(h.boards, boardID)
		}
	}
}

func (h *Hub) broadcast(boardID string, msg []byte) {
	h.mu.RLock()
	clients := h.boards[boardID]
	h.mu.RUnlock()
	for c := range clients {
		select {
		case c.send <- msg:
		default:
		}
	}
}

// OnlineUserIDs returns deduplicated IDs of all currently connected users.
func (h *Hub) OnlineUserIDs() []string {
	h.mu.RLock()
	defer h.mu.RUnlock()
	seen := make(map[string]bool)
	for _, clients := range h.boards {
		for c := range clients {
			if c.userID != "" {
				seen[c.userID] = true
			}
		}
	}
	ids := make([]string, 0, len(seen))
	for id := range seen {
		ids = append(ids, id)
	}
	return ids
}

// Publish serialises an Event and broadcasts it to all subscribers of boardID.
func (h *Hub) Publish(boardID, eventType, clientID string) {
	msg, err := json.Marshal(Event{Type: eventType, BoardID: boardID, ClientID: clientID})
	if err != nil {
		return
	}
	h.broadcast(boardID, msg)
}
