package handler

import (
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"net/url"
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

// Callback handles GET /api/v1/auth/:provider/callback (and, via LinkCallback,
// GET /api/v1/me/link/:provider/callback).
//
// Content negotiation (browser seam): when the request Accept header contains
// text/html the caller is an interactive browser navigation — errors and
// success are answered with a 302 to the SPA seam
// {PublicBaseURL}/auth/oauth/callback?oauth_error=<code>|oauth_linked=<provider>
// instead of a JSON body, so the user never dead-ends on raw JSON. Any other
// Accept (or none) keeps the historical JSON envelopes byte-for-byte.
func (h *AuthHandler) Callback(c *gin.Context) {
	provider := c.Param("provider")

	defer func() {
		if r := recover(); r != nil {
			respondCallbackError(c, h.cfg, fmt.Errorf("lỗi hệ thống: %v", r))
		}
	}()

	code := c.Query("code")
	stateParam := c.Query("state")

	if code == "" || stateParam == "" {
		respondCallbackError(c, h.cfg, auth.ErrInvalidState)
		return
	}

	res, err := h.authSvc.HandleCallback(c.Request.Context(), c.Writer, c.Request, provider, code, stateParam)
	if err != nil {
		respondCallbackError(c, h.cfg, err)
		return
	}

	// Set session cookie (must land on the same response as the browser 302).
	setAuthCookie(c, h.cfg, res.CookieName, res.Token)

	if isBrowserCallback(c) {
		redirectCallbackSuccess(c, h.cfg, provider)
		return
	}

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

	// 24 hours max-age. Secure follows cfg.SecureCookies() — the same rule
	// as the OAuth state cookie — so plain-HTTP non-localhost deployments
	// (dev over Tailscale/LAN) keep their cookies.
	maxAge := int(auth.TokenTTL.Seconds())
	secure := cfg.SecureCookies()

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
	secure := cfg.SecureCookies()
	c.SetSameSite(http.SameSiteLaxMode)
	c.SetCookie(cookieName, "", -1, "/", "", secure, true)
}

// ---------------------------------------------------------------------------
// OAuth callback browser/JSON content negotiation
// ---------------------------------------------------------------------------

// oauthBrowserAcceptToken marks a callback request as an interactive browser
// navigation when it appears (case-insensitively) in the Accept header.
const oauthBrowserAcceptToken = "text/html"

// Stable, non-sensitive error codes surfaced to the SPA through the
// ?oauth_error= redirect seam. Never include raw provider detail here.
const (
	oauthErrCodeInvalidState   = "invalid_state"
	oauthErrCodeAlreadyLinked  = "already_linked"
	oauthErrCodeProviderError  = "provider_error"
	oauthErrCodeDemoRestricted = "demo_restricted"
	oauthErrCodeServerError    = "server_error"
)

// isBrowserCallback reports whether this callback request came from an
// interactive browser navigation: the Accept header contains text/html
// (case-insensitive). XHR/API clients (e.g. Accept: application/json) and
// requests with no Accept header at all fall back to JSON mode, which keeps
// the historical envelopes and existing API clients working unchanged.
func isBrowserCallback(c *gin.Context) bool {
	return strings.Contains(strings.ToLower(c.GetHeader("Accept")), oauthBrowserAcceptToken)
}

// oauthErrorCode maps a callback-flow failure to its stable redirect code.
// The mapping mirrors respondError's severity ordering but carries no
// provider-identifying or raw error detail.
func oauthErrorCode(err error) string {
	switch {
	case errors.Is(err, auth.ErrInvalidState):
		return oauthErrCodeInvalidState
	case errors.Is(err, auth.ErrAlreadyLinked):
		return oauthErrCodeAlreadyLinked
	case errors.Is(err, auth.ErrDemoIsolation):
		return oauthErrCodeDemoRestricted
	case errors.Is(err, auth.ErrProviderExchange),
		errors.Is(err, auth.ErrProviderDisabled),
		errors.Is(err, auth.ErrUnknownProvider):
		return oauthErrCodeProviderError
	default:
		return oauthErrCodeServerError
	}
}

// oauthCallbackRedirectURL builds the SPA seam URL strictly from the
// configured PublicBaseURL — never from request Host/Origin/X-Forwarded-* —
// so a hostile Host header cannot turn the 302 into an open redirect.
// If PublicBaseURL is unset (possible only outside strict modes, which
// fail-closed on it), the Location degrades to a relative path; no
// request-derived data is ever used.
func oauthCallbackRedirectURL(cfg *config.Config, query string) string {
	base := strings.TrimRight(cfg.PublicBaseURL, "/")
	if base == "" {
		return "/auth/oauth/callback?" + query
	}
	return base + "/auth/oauth/callback?" + query
}

// respondCallbackError is the single error seam for both OAuth callback
// endpoints: browsers receive a 302 to the SPA with a stable ?oauth_error=
// code; every other client keeps the standard JSON envelope via respondError.
func respondCallbackError(c *gin.Context, cfg *config.Config, err error) {
	if c.Writer.Written() {
		// Headers already sent (panic mid-response): a second response would
		// be malformed; nothing safe left to send.
		return
	}
	if !isBrowserCallback(c) {
		respondError(c, err)
		return
	}

	code := oauthErrorCode(err)
	if code == oauthErrCodeServerError {
		// Keep respondError's observability parity: unclassified errors must
		// still reach the server log even though the browser gets a redirect.
		slog.Error("Lỗi hệ thống chưa được phân loại (oauth callback redirect)",
			slog.String("path", c.Request.URL.Path),
			slog.String("error", err.Error()),
		)
	}
	c.Redirect(http.StatusFound, oauthCallbackRedirectURL(cfg, "oauth_error="+url.QueryEscape(code)))
}

// redirectCallbackSuccess sends a browser from a successful OAuth callback to
// the SPA seam, carrying only the public provider name. The session cookie
// must be set BEFORE calling this so cookie + Location travel on the same 302.
func redirectCallbackSuccess(c *gin.Context, cfg *config.Config, provider string) {
	c.Redirect(http.StatusFound, oauthCallbackRedirectURL(cfg, "oauth_linked="+url.QueryEscape(provider)))
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
