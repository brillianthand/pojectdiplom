package timeago

import (
	"fmt"
	"time"
)

func Relative(t time.Time) string {
	d := time.Since(t)
	switch {
	case d < time.Minute:
		return "Только что"
	case d < time.Hour:
		return fmt.Sprintf("%d мин назад", int(d.Minutes()))
	case d < 24*time.Hour:
		return fmt.Sprintf("%d ч назад", int(d.Hours()))
	default:
		return fmt.Sprintf("%d д назад", int(d.Hours()/24))
	}
}
