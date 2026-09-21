package handler

import (
	"fmt"
	"net/http"
	"strings"

	"github.com/dracuten1/cgv-v2/api/internal/auth"
	"github.com/dracuten1/cgv-v2/api/internal/config"
	"github.com/dracuten1/cgv-v2/api/internal/model"
	"github.com/gin-gonic/gin"
)

// AuthHandler handles authentication and user identity routes.
type AuthHandler struct {
	cfg      *config.Config
	authSvc  AuthService
	contacts ContactStore
}

// NewAuthHandler creates a new AuthHandler.
func NewAuthHandler(cfg *config.Config, authSvc AuthService, contacts ContactStore) *AuthHandler {
	return &AuthHandler{
		cfg:      cfg,
		authSvc:  authSvc,
		contacts: contacts,
	}
}

// ProviderInfo describes an enabled login provider.
type ProviderInfo struct {
	ID   string `json:"id"`
	Name string `json:"name"`
}

// GetProviders handles GET /api/v1/auth/providers
func (h *AuthHandler) GetProviders(c *gin.Context) {
	providers := []ProviderInfo{}

	if h.cfg.ZaloClientID != "" {
		providers = append(providers, ProviderInfo{ID: model.ProviderZalo, Name: "Zalo"})
	}
	if h.cfg.GoogleClientID != "" {
		providers = append(providers, ProviderInfo{ID: model.ProviderGoogle, Name: "Google"})
	}
	if h.cfg.FacebookClientID != "" {
		providers = append(providers, ProviderInfo{ID: model.ProviderFacebook, Name: "Facebook"})
	}

	// Email magic link and Demo are always available
	providers = append(providers, ProviderInfo{ID: model.ProviderEmail, Name: "Email Magic Link"})
	providers = append(providers, ProviderInfo{ID: model.ProviderDemo, Name: "Dùng thử"})

	if h.cfg.MockOAuthEnabled {
		providers = append(providers, ProviderInfo{ID: model.ProviderMock, Name: "Mock Provider (Thử nghiệm)"})
	}

	c.JSON(http.StatusOK, gin.H{"providers": providers})
}

// Login handles GET /api/v1/auth/:provider/login
func (h *AuthHandler) Login(c *gin.Context) {
	provider := c.Param("provider")
	url, err := h.authSvc.LoginURL(c.Writer, c.Request, provider)
	if err != nil {
		respondError(c, err)
		return
	}
	c.Redirect(http.StatusFound, url)
}

// Callback handles GET /api/v1/auth/:provider/callback
func (h *AuthHandler) Callback(c *gin.Context) {
	defer func() {
		if r := recover(); r != nil {
			respondError(c, fmt.Errorf("lỗi hệ thống: %v", r))
		}
	}()

	provider := c.Param("provider")
	code := c.Query("code")
	stateParam := c.Query("state")

	if code == "" || stateParam == "" {
		respondError(c, auth.ErrInvalidState)
		return
	}

	res, err := h.authSvc.HandleCallback(c.Request.Context(), c.Writer, c.Request, provider, code, stateParam)
	if err != nil {
		respondError(c, err)
		return
	}

	// Set session cookie
	setAuthCookie(c, h.cfg, res.CookieName, res.Token)

	if res.IsLinked {
		c.JSON(http.StatusOK, gin.H{
			"message":    "Liên kết phương thức đăng nhập thành công",
			"identities": res.Identities,
			"user":       res.User,
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"user":              res.User,
		"is_new":            res.IsNew,
		"conflict_detected": res.ConflictDetected,
	})
}

// MagicLinkRequest is the body for sending a magic link.
type MagicLinkRequest struct {
	Email string `json:"email" binding:"required"`
}

// SendMagicLink handles POST /api/v1/auth/email/magic-link
func (h *AuthHandler) SendMagicLink(c *gin.Context) {
	var req MagicLinkRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorEnvelope(model.CodeValidationError, "Địa chỉ email không được để trống"))
		return
	}

	verifyBaseURL := getPublicBaseURL(h.cfg, c) + "/auth/email/verify"
	if err := h.authSvc.SendMagicLink(c.Request.Context(), req.Email, verifyBaseURL); err != nil {
		respondError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Liên kết đăng nhập đã được gửi đến hộp thư của bạn",
	})
}

// VerifyMagicLink handles POST /api/v1/auth/email/verify with JSON body {token}
func (h *AuthHandler) VerifyMagicLink(c *gin.Context) {
	var req struct {
		Token string `json:"token"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorEnvelope(model.CodeValidationError, "Dữ liệu yêu cầu không hợp lệ"))
		return
	}

	if req.Token == "" {
		respondError(c, auth.ErrTokenUsedOrExpired)
		return
	}

	res, err := h.authSvc.VerifyMagicLink(c.Request.Context(), req.Token)
	if err != nil {
		respondError(c, err)
		return
	}

	setAuthCookie(c, h.cfg, res.CookieName, res.Token)

	c.JSON(http.StatusOK, gin.H{
		"user":              res.User,
		"is_new":            res.IsNew,
		"conflict_detected": res.ConflictDetected,
	})
}

// StartDemo handles POST /api/v1/auth/demo
func (h *AuthHandler) StartDemo(c *gin.Context) {
	res, err := h.authSvc.StartDemoSession(c.Request.Context())
	if err != nil {
		respondError(c, err)
		return
	}

	setAuthCookie(c, h.cfg, res.CookieName, res.Token)

	c.JSON(http.StatusOK, gin.H{
		"user":              res.User,
		"is_new":            res.IsNew,
		"conflict_detected": res.ConflictDetected,
	})
}

// Logout handles POST /api/v1/auth/logout
func (h *AuthHandler) Logout(c *gin.Context) {
	cookieName := getCookieName(h.cfg)

	// Best effort session revocation if token is present
	if tokenStr, err := c.Cookie(cookieName); err == nil && tokenStr != "" {
		if claims, err := h.authSvc.VerifyToken(tokenStr); err == nil && claims != nil {
			_ = h.authSvc.Logout(c.Request.Context(), claims.ID)
		}
	}

	// Clear cookie
	clearAuthCookie(c, h.cfg, cookieName)

	c.JSON(http.StatusOK, gin.H{
		"message": "Đăng xuất thành công",
	})
}

// GetMe handles GET /api/v1/me
func (h *AuthHandler) GetMe(c *gin.Context) {
	userID := GetUserID(c)
	if userID == "" {
		c.JSON(http.StatusUnauthorized, model.NewErrorEnvelope(model.CodeUnauthorized, "Chưa đăng nhập"))
		return
	}

	profile, err := h.authSvc.CurrentUser(c.Request.Context(), userID)
	if err != nil {
		respondError(c, err)
		return
	}

	c.JSON(http.StatusOK, profile)
}

// StartLinkProvider handles POST /api/v1/me/link/:provider/start and GET /api/v1/me/link/:provider/start
func (h *AuthHandler) StartLinkProvider(c *gin.Context) {
	userID := GetUserID(c)
	provider := c.Param("provider")

	url, err := h.authSvc.StartLinkProvider(c.Writer, c.Request, userID, provider)
	if err != nil {
		respondError(c, err)
		return
	}

	if c.Request.Method == http.MethodPost {
		c.JSON(http.StatusOK, gin.H{"url": url})
		return
	}
	c.Redirect(http.StatusFound, url)
}

// LinkCallback handles GET /api/v1/me/link/:provider/callback (public callback alias).
func (h *AuthHandler) LinkCallback(c *gin.Context) {
	h.Callback(c)
}

// UnlinkIdentity handles DELETE /api/v1/me/identities/:id
func (h *AuthHandler) UnlinkIdentity(c *gin.Context) {
	userID := GetUserID(c)
	identityID := c.Param("id")

	if err := h.authSvc.UnlinkIdentity(c.Request.Context(), userID, identityID); err != nil {
		respondError(c, err)
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Hủy liên kết định danh thành công",
	})
}

// AddContactRequest is the body for adding an unverified contact point.
type AddContactRequest struct {
	Kind  string `json:"kind" binding:"required"`
	Value string `json:"value" binding:"required"`
}

// AddContact handles POST /api/v1/me/contacts
func (h *AuthHandler) AddContact(c *gin.Context) {
	userID := GetUserID(c)
	var req AddContactRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorEnvelope(model.CodeValidationError, "Thông tin liên hệ không hợp lệ"))
		return
	}

	kind := strings.ToLower(strings.TrimSpace(req.Kind))
	if kind != model.ContactKindEmail && kind != model.ContactKindPhone {
		c.JSON(http.StatusBadRequest, model.NewErrorEnvelope(model.CodeValidationError, "Loại liên hệ chỉ chấp nhận 'email' hoặc 'phone'"))
		return
	}

	val := strings.TrimSpace(req.Value)
	if val == "" {
		c.JSON(http.StatusBadRequest, model.NewErrorEnvelope(model.CodeValidationError, "Giá trị liên hệ không được để trống"))
		return
	}

	cleanVal := auth.NormalizeContact(kind, val)
	contact, err := h.contacts.Insert(c.Request.Context(), userID, kind, cleanVal, false, "")
	if err != nil {
		c.JSON(http.StatusConflict, model.NewErrorEnvelope(model.CodeConflict, "Điểm liên hệ này đã được đăng ký trên hệ thống"))
		return
	}

	c.JSON(http.StatusCreated, contact)
}

// VerifyContact handles POST /api/v1/me/contacts/:id/verify
func (h *AuthHandler) VerifyContact(c *gin.Context) {
	contactID := c.Param("id")
	userID := GetUserID(c)

	contact, err := h.contacts.GetByID(c.Request.Context(), contactID)
	if err != nil || contact == nil || (userID != "" && contact.UserID != userID) {
		c.JSON(http.StatusNotFound, model.NewErrorEnvelope(model.CodeNotFound, "Không tìm thấy thông tin liên hệ"))
		return
	}

	if contact.Verified {
		c.JSON(http.StatusOK, gin.H{"message": "Điểm liên hệ này đã được xác thực trước đó"})
		return
	}

	switch contact.Kind {
	case model.ContactKindEmail:
		verifyBaseURL := getPublicBaseURL(h.cfg, c) + "/auth/email/verify"
		if err := h.authSvc.SendMagicLink(c.Request.Context(), contact.Value, verifyBaseURL); err != nil {
			respondError(c, err)
			return
		}
		c.JSON(http.StatusOK, gin.H{
			"message": "Đã gửi liên kết xác thực đến email của bạn",
		})
		return
	case model.ContactKindPhone:
		c.JSON(http.StatusNotImplemented, model.NewErrorEnvelope("NOT_IMPLEMENTED", "Số điện thoại sẽ được hỗ trợ xác thực qua Zalo"))
		return
	default:
		c.JSON(http.StatusBadRequest, model.NewErrorEnvelope(model.CodeValidationError, "Loại liên hệ không hỗ trợ"))
	}
}

// helper to get canonical cookie name from config
func getCookieName(cfg *config.Config) string {
	if cfg.CookieName != "" {
		return cfg.CookieName
	}
	if cfg.DemoMode {
		return config.DemoCookieName
	}
	return config.ProdCookieName
}

// setAuthCookie writes the session JWT into an httpOnly, SameSite=Lax cookie.
func setAuthCookie(c *gin.Context, cfg *config.Config, cookieName, token string) {
	if cookieName == "" {
		cookieName = getCookieName(cfg)
	}

	// 24 hours max-age
	maxAge := int(auth.TokenTTL.Seconds())
	secure := cfg.AppEnv != config.EnvDev

	// http.SetCookie via Gin helper
	// SameSite Lax
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(cookieName, token, maxAge, "/", "", secure, true)
}

// clearAuthCookie expires the session cookie.
func clearAuthCookie(c *gin.Context, cfg *config.Config, cookieName string) {
	if cookieName == "" {
		cookieName = getCookieName(cfg)
	}
	secure := cfg.AppEnv != config.EnvDev
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(cookieName, "", -1, "/", "", secure, true)
}

// getPublicBaseURL determines the base URL from config or request origin.
func getPublicBaseURL(cfg *config.Config, c *gin.Context) string {
	if cfg.PublicBaseURL != "" {
		return strings.TrimRight(cfg.PublicBaseURL, "/")
	}
	return getRequestOrigin(c)
}

// getRequestOrigin determines the scheme + host of the incoming request.
func getRequestOrigin(c *gin.Context) string {
	proto := c.Request.Header.Get("X-Forwarded-Proto")
	if proto == "" {
		if c.Request.TLS != nil {
			proto = "https"
		} else {
			proto = "http"
		}
	}
	host := c.Request.Header.Get("X-Forwarded-Host")
	if host == "" {
		host = c.Request.Host
	}
	return fmt.Sprintf("%s://%s", proto, host)
}
