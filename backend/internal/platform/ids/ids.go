package ids

import (
	"crypto/rand"
	"fmt"
)

func New() string {
	b := make([]byte, 8)
	rand.Read(b)
	return fmt.Sprintf("%x", b)
}
