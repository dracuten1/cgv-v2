package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"

	"github.com/dracuten1/cgv-v2/api/internal/config"
	"github.com/dracuten1/cgv-v2/api/internal/model"
)

// Google endpoints (standard OAuth2/OIDC; the OIDC userinfo endpoint
// (googleProfileURL) is used for verified-email extraction per spec — no
// extra client library (INV-01), no tokeninfo call).
const (
	googleAuthURL    = "https://accounts.google.com/o/oauth2/v2/auth"
	googleTokenURL   = "https://oauth2.googleapis.com/token"
	googleProfileURL = "https://openidconnect.googleapis.com/v1/userinfo"
)

// googleProfile is the OIDC userinfo shape (subset).
type googleProfile struct {
	Sub           string `json:"sub"`
	Name          string `json:"name"`
	Email         string `json:"email"`
	EmailVerified bool   `json:"email_verified"`
}

// GoogleProvider implements Google OAuth 2.0 / OIDC: code → token → userinfo
// extracting the verified email and display name.
type GoogleProvider struct {
	ClientID     string
	ClientSecret string
	BaseURL      string

	AuthEndpoint    string
	TokenEndpoint   string
	ProfileEndpoint string

	HTTP *http.Client

	oauthFlows
}

// NewGoogleProvider builds the Google adapter from configuration.
func NewGoogleProvider(cfg *config.Config) *GoogleProvider {
	return &GoogleProvider{
		ClientID:        cfg.GoogleClientID,
		ClientSecret:    cfg.GoogleClientSecret,
		BaseURL:         cfg.PublicBaseURL,
		AuthEndpoint:    googleAuthURL,
		TokenEndpoint:   googleTokenURL,
		ProfileEndpoint: googleProfileURL,
		HTTP:            oauthHTTPClient,
		oauthFlows:      oauthFlows{secret: []byte(cfg.JWTSecret)},
	}
}

// AuthURL returns the Google authorize URL with state + S256 PKCE.
func (g *GoogleProvider) AuthURL(state, challenge string) (string, error) {
	if err := enforceConfigured(g.ClientID, true); err != nil {
		return "", err
	}
	return buildAuthURL(g.AuthEndpoint, url.Values{
		"client_id":             {g.ClientID},
		"redirect_uri":          {g.redirectURI()},
		"response_type":         {"code"},
		"scope":                 {"openid email profile"},
		"state":                 {state},
		"code_challenge":        {challenge},
		"code_challenge_method": {"S256"},
		"access_type":           {"online"},
	}), nil
}

// Exchange trades the callback code (+ verifier) for claims. The email is a
// VERIFIED contact claim only when Google reports email_verified=true; an
// unverified email is carried as Verified=false (never auto-links) and an
// absent email is dropped.
func (g *GoogleProvider) Exchange(ctx context.Context, code, verifier string) (*ProviderClaims, error) {
	if err := enforceConfigured(g.ClientID, true); err != nil {
		return nil, err
	}
	ctx, cancel := providerContext(ctx)
	defer cancel()

	form := url.Values{
		"client_id":     {g.ClientID},
		"client_secret": {g.ClientSecret},
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"code_verifier": {verifier},
		"redirect_uri":  {g.redirectURI()},
	}
	raw, err := httpFormPOST(ctx, g.HTTP, g.TokenEndpoint, form)
	if err != nil {
		return nil, err
	}
	token, err := decodeTokenResponse(raw)
	if err != nil {
		return nil, err
	}

	profRaw, err := httpGetAuthorized(ctx, g.HTTP, g.ProfileEndpoint, token.AccessToken)
	if err != nil {
		return nil, err
	}
	var gp googleProfile
	if err := json.Unmarshal(profRaw, &gp); err != nil {
		return nil, fmt.Errorf("%w: hồ sơ Google không hợp lệ", ErrProviderExchange)
	}

	claims := &ProviderClaims{
		Provider:    model.ProviderGoogle,
		Subject:     gp.Sub,
		DisplayName: gp.Name,
	}
	if gp.Email != "" {
		claims.Email = &ContactClaim{
			Value:    NormalizeContact(model.ContactKindEmail, gp.Email),
			Verified: gp.EmailVerified,
		}
	}
	return claims, nil
}

// redirectURI is the handler-bound callback path.
func (g *GoogleProvider) redirectURI() string {
	base := strings.TrimRight(g.BaseURL, "/")
	if base == "" {
		base = "http://localhost:3456"
	}
	return base + "/api/v1/auth/google/callback"
}
