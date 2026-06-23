package users

import "time"

// User is the public representation (no password hash).
type User struct {
	ID        string    `json:"id"`
	Email     string    `json:"email"`
	Name      string    `json:"name"`
	Color     string    `json:"color"`
	AvatarURL string    `json:"avatarUrl"`
	Initials  string    `json:"initials"`
	IsAdmin   bool      `json:"isAdmin"`
	IsBlocked bool      `json:"isBlocked"`
	CreatedAt time.Time `json:"createdAt"`
}

// avatarColors cycles for users without explicit color.
var avatarColors = []string{
	"#3b82f6", "#10b981", "#f59e0b", "#ef4444",
	"#8b5cf6", "#ec4899", "#14b8a6", "#f97316",
}

func ColorForID(id string) string {
	if len(id) == 0 {
		return avatarColors[0]
	}
	var sum int
	for _, c := range id {
		sum += int(c)
	}
	return avatarColors[sum%len(avatarColors)]
}

func InitialsFor(name string) string {
	words := []rune{}
	inWord := false
	for _, c := range name {
		if c == ' ' {
			inWord = false
		} else if !inWord {
			words = append(words, c)
			inWord = true
		}
		if len(words) == 2 {
			break
		}
	}
	if len(words) == 0 {
		return "?"
	}
	result := string(words[0])
	if len(words) > 1 {
		result += string(words[1])
	}
	// uppercase
	upper := []rune{}
	for _, r := range result {
		if r >= 'a' && r <= 'z' {
			upper = append(upper, r-32)
		} else {
			upper = append(upper, r)
		}
	}
	return string(upper)
}
