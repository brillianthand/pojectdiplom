package auth

import (
	"context"
	"database/sql"
	"errors"
	"net/http"
	"os"
	"regexp"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"golang.org/x/crypto/bcrypt"

	"kanban/internal/platform/httpx"
	"kanban/internal/users"
)

type contextKey struct{}

var UserContextKey = contextKey{}

func jwtSecret() []byte {
	s := os.Getenv("JWT_SECRET")
	if s == "" {
		s = "dev-secret-change-in-production"
	}
	return []byte(s)
}

func GenerateToken(userID string) (string, error) {
	claims := jwt.RegisteredClaims{
		Subject:   userID,
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(30 * 24 * time.Hour)),
		IssuedAt:  jwt.NewNumericDate(time.Now()),
	}
	return jwt.NewWithClaims(jwt.SigningMethodHS256, claims).SignedString(jwtSecret())
}

func ParseToken(tokenStr string) (string, error) {
	t, err := jwt.ParseWithClaims(tokenStr, &jwt.RegisteredClaims{}, func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, errors.New("unexpected signing method")
		}
		return jwtSecret(), nil
	})
	if err != nil {
		return "", err
	}
	claims, ok := t.Claims.(*jwt.RegisteredClaims)
	if !ok || !t.Valid {
		return "", errors.New("invalid token")
	}
	return claims.Subject, nil
}

// RequireAuth middleware extracts JWT from Authorization header and puts user into context.
func RequireAuth(usersRepo *users.Repository) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			header := r.Header.Get("Authorization")
			if !strings.HasPrefix(header, "Bearer ") {
				httpx.ErrJSON(w, 401, "unauthorized")
				return
			}
			userID, err := ParseToken(strings.TrimPrefix(header, "Bearer "))
			if err != nil {
				httpx.ErrJSON(w, 401, "invalid token")
				return
			}
			u, err := usersRepo.FindByID(r.Context(), userID)
			if err != nil {
				httpx.ErrJSON(w, 401, "user not found")
				return
			}
			if u.IsBlocked {
				httpx.ErrJSON(w, 403, "account is blocked")
				return
			}
			ctx := context.WithValue(r.Context(), UserContextKey, u)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// UserFromCtx retrieves the authenticated user from context.
func UserFromCtx(ctx context.Context) (users.User, bool) {
	u, ok := ctx.Value(UserContextKey).(users.User)
	return u, ok
}

type Handler struct {
	usersRepo *users.Repository
}

func NewHandler(usersRepo *users.Repository) *Handler {
	return &Handler{usersRepo: usersRepo}
}

// Register registers public auth routes. RegisterProtected must be called on the protected mux.
func (h *Handler) Register(mux *http.ServeMux) {
	mux.HandleFunc("POST /api/auth/register", h.register)
	mux.HandleFunc("POST /api/auth/login", h.login)
}

// RegisterProtected registers routes that require an authenticated user in context.
func (h *Handler) RegisterProtected(mux *http.ServeMux) {
	mux.HandleFunc("GET /api/auth/me", h.me)
	mux.HandleFunc("PUT /api/auth/profile", h.updateProfile)
	mux.HandleFunc("POST /api/auth/change-password", h.changePassword)
}

type authResponse struct {
	Token string      `json:"token"`
	User  users.User  `json:"user"`
}

func (h *Handler) register(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
		Name     string `json:"name"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.ErrJSON(w, 400, "invalid json")
		return
	}
	body.Name = strings.TrimSpace(body.Name)
	body.Email = strings.TrimSpace(strings.ToLower(body.Email))
	if body.Email == "" || body.Password == "" || body.Name == "" {
		httpx.ErrJSON(w, 400, "email, password and name are required")
		return
	}
	if !regexp.MustCompile(`^[^@\s]+@[^@\s]+\.[^@\s]+$`).MatchString(body.Email) {
		httpx.ErrJSON(w, 400, "invalid email format")
		return
	}
	if len(body.Password) < 8 {
		httpx.ErrJSON(w, 400, "password must be at least 8 characters")
		return
	}

	u, err := h.usersRepo.Create(r.Context(), body.Email, body.Name, body.Password)
	if err != nil {
		if strings.Contains(err.Error(), "unique") || strings.Contains(err.Error(), "duplicate") {
			httpx.ErrJSON(w, 409, "email already registered")
			return
		}
		httpx.ErrJSON(w, 500, err.Error())
		return
	}

	// Если в системе нет ни одного админа — первый зарегистрированный получает права.
	if hasAdmin, err := h.usersRepo.HasAdmin(r.Context()); err == nil && !hasAdmin {
		if err := h.usersRepo.PromoteToAdmin(r.Context(), u.ID); err == nil {
			u.IsAdmin = true
		}
	}

	token, err := GenerateToken(u.ID)
	if err != nil {
		httpx.ErrJSON(w, 500, "token generation failed")
		return
	}
	httpx.WriteJSON(w, 201, authResponse{Token: token, User: u})
}

func (h *Handler) login(w http.ResponseWriter, r *http.Request) {
	var body struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.ErrJSON(w, 400, "invalid json")
		return
	}

	u, hash, err := h.usersRepo.FindByEmail(r.Context(), body.Email)
	if errors.Is(err, sql.ErrNoRows) {
		httpx.ErrJSON(w, 401, "неверный email или пароль")
		return
	}
	if err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}

	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(body.Password)); err != nil {
		httpx.ErrJSON(w, 401, "неверный email или пароль")
		return
	}
	if u.IsBlocked {
		httpx.ErrJSON(w, 403, "учётная запись заблокирована")
		return
	}

	token, err := GenerateToken(u.ID)
	if err != nil {
		httpx.ErrJSON(w, 500, "token generation failed")
		return
	}
	httpx.WriteJSON(w, 200, authResponse{Token: token, User: u})
}

func (h *Handler) me(w http.ResponseWriter, r *http.Request) {
	u, ok := UserFromCtx(r.Context())
	if !ok {
		httpx.ErrJSON(w, 401, "unauthorized")
		return
	}
	httpx.WriteJSON(w, 200, u)
}

// Принимаем data URL (data:image/...;base64,...) либо пустую строку для удаления аватара.
// Ограничение размера в декодированном виде — 512 КБ (с запасом на base64-оверхед).
const maxAvatarBytes = 512 * 1024

var avatarDataURLRe = regexp.MustCompile(`^data:image/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$`)

func (h *Handler) updateProfile(w http.ResponseWriter, r *http.Request) {
	u, ok := UserFromCtx(r.Context())
	if !ok {
		httpx.ErrJSON(w, 401, "unauthorized")
		return
	}
	var body struct {
		Name      string `json:"name"`
		AvatarURL string `json:"avatarUrl"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.ErrJSON(w, 400, "invalid json")
		return
	}
	body.Name = strings.TrimSpace(body.Name)
	body.AvatarURL = strings.TrimSpace(body.AvatarURL)
	if body.Name == "" {
		httpx.ErrJSON(w, 400, "имя обязательно")
		return
	}
	if len([]rune(body.Name)) > 64 {
		httpx.ErrJSON(w, 400, "имя слишком длинное (макс. 64 символа)")
		return
	}
	if body.AvatarURL != "" {
		if len(body.AvatarURL) > maxAvatarBytes {
			httpx.ErrJSON(w, 400, "изображение слишком большое (макс. 512 КБ)")
			return
		}
		if !avatarDataURLRe.MatchString(body.AvatarURL) {
			httpx.ErrJSON(w, 400, "неподдерживаемый формат изображения")
			return
		}
	}
	updated, err := h.usersRepo.UpdateProfile(r.Context(), u.ID, body.Name, body.AvatarURL)
	if err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	httpx.WriteJSON(w, 200, updated)
}

func (h *Handler) changePassword(w http.ResponseWriter, r *http.Request) {
	u, ok := UserFromCtx(r.Context())
	if !ok {
		httpx.ErrJSON(w, 401, "unauthorized")
		return
	}
	var body struct {
		OldPassword string `json:"oldPassword"`
		NewPassword string `json:"newPassword"`
	}
	if err := httpx.Decode(r, &body); err != nil {
		httpx.ErrJSON(w, 400, "invalid json")
		return
	}
	if len(body.NewPassword) < 8 {
		httpx.ErrJSON(w, 400, "новый пароль должен быть не короче 8 символов")
		return
	}
	hash, err := h.usersRepo.GetPasswordHash(r.Context(), u.ID)
	if err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	if err := bcrypt.CompareHashAndPassword([]byte(hash), []byte(body.OldPassword)); err != nil {
		httpx.ErrJSON(w, 401, "неверный текущий пароль")
		return
	}
	if err := h.usersRepo.UpdatePassword(r.Context(), u.ID, body.NewPassword); err != nil {
		httpx.ErrJSON(w, 500, err.Error())
		return
	}
	httpx.WriteJSON(w, 200, map[string]string{"status": "ok"})
}
