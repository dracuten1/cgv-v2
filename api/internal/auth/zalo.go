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
	"golang.org/x/text/unicode/norm"
)

// normNFC composes to NFC form (single rune sequence for Vietnamese text).
func normNFC(s string) string { return norm.NFC.String(s) }

// Zalo endpoints (direct provider HTTP per INV-01 — no SDK, no paid SaaS).
const (
	zaloAuthURL    = "https://oauth.zaloapp.com/v4/permission"
	zaloTokenURL   = "https://oauth.zaloapp.com/v4/access_token"
	zaloProfileURL = "https://graph.zalo.me/v2.0/me"
)

// zaloProfile is the graph.zalo.me v2.0/me response shape (subset).
type zaloProfile struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Birthday  string    `json:"birthday"`
	Phone     string    `json:"phone"`
	IsPhoneNb flexValue `json:"is_phone_number_verified"`
	Picture   struct {
		Data struct {
			URL string `json:"url"`
		} `json:"data"`
	} `json:"picture"`
}

// flexValue absorbs provider fields that show up as bool, number or string
// ("1", "true", true, 1) across API versions.
type flexValue bool

// UnmarshalJSON implements flexible boolean decoding.
func (v *flexValue) UnmarshalJSON(data []byte) error {
	s := strings.TrimSpace(string(data))
	unq := strings.Trim(s, `"`)
	*v = unq == "1" || unq == "true"
	return nil
}

// ZaloProvider implements OAuth 2.0 + PKCE against Zalo v4 endpoints.
type ZaloProvider struct {
	// ClientID/ClientSecret come from config; empty ClientID ⇒
	// ErrProviderDisabled.
	ClientID     string
	ClientSecret string
	BaseURL      string

	// AuthEndpoint/TokenEndpoint/ProfileEndpoint are fields (not consts) so
	// tests point them at an httptest server; production wires the defaults.
	AuthEndpoint    string
	TokenEndpoint   string
	ProfileEndpoint string

	// HTTP is the outbound client; tests substitute a stub transport.
	HTTP *http.Client

	oauthFlows
}

// NewZaloProvider builds the Zalo adapter from configuration.
func NewZaloProvider(cfg *config.Config) *ZaloProvider {
	return &ZaloProvider{
		ClientID:        cfg.ZaloClientID,
		ClientSecret:    cfg.ZaloClientSecret,
		BaseURL:         cfg.PublicBaseURL,
		AuthEndpoint:    zaloAuthURL,
		TokenEndpoint:   zaloTokenURL,
		ProfileEndpoint: zaloProfileURL,
		HTTP:            oauthHTTPClient,
		oauthFlows:      oauthFlows{secret: []byte(cfg.JWTSecret)},
	}
}

// AuthURL returns the Zalo authorize URL carrying state and the S256
// PKCE challenge (spec F1: Zalo = OAuth2 PKCE).
func (z *ZaloProvider) AuthURL(state, challenge string) (string, error) {
	if err := enforceConfigured(z.ClientID, true); err != nil {
		return "", err
	}
	return buildAuthURL(z.AuthEndpoint, url.Values{
		"app_id":                {z.ClientID},
		"redirect_uri":          {z.redirectURI()},
		"state":                 {state},
		"code_challenge":        {challenge},
		"code_challenge_method": {"S256"},
	}), nil
}

// Exchange trades the callback code (+ PKCE verifier) for claims. STRICT
// phone gate (pending-leader decision #9): the phone counts as a VERIFIED
// contact ONLY when the provider explicitly reports the phone number as
// verified — otherwise the claim is dropped entirely (unverified claims must
// never auto-link, so carrying them would be misleading).
func (z *ZaloProvider) Exchange(ctx context.Context, code, verifier string) (*ProviderClaims, error) {
	if err := enforceConfigured(z.ClientID, true); err != nil {
		return nil, err
	}
	ctx, cancel := providerContext(ctx)
	defer cancel()

	form := url.Values{
		"app_id":        {z.ClientID},
		"app_secret":    {z.ClientSecret},
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"code_verifier": {verifier},
		"redirect_uri":  {z.redirectURI()},
	}
	raw, err := httpFormPOST(ctx, z.HTTP, z.TokenEndpoint, form)
	if err != nil {
		return nil, err
	}
	token, err := decodeTokenResponse(raw)
	if err != nil {
		return nil, err
	}

	profRaw, err := httpGetAuthorized(ctx, z.HTTP, z.profileURL(token.AccessToken), token.AccessToken)
	if err != nil {
		return nil, err
	}
	var zp zaloProfile
	if err := json.Unmarshal(profRaw, &zp); err != nil {
		return nil, fmt.Errorf("%w: hồ sơ Zalo không hợp lệ", ErrProviderExchange)
	}

	claims := &ProviderClaims{
		Provider:    model.ProviderZalo,
		Subject:     zp.ID,
		DisplayName: zp.Name,
	}
	// STRICT verified-phone gate: only an explicitly verified phone becomes
	// a claim; pending/unverified phones are omitted.
	if zp.Phone != "" && bool(zp.IsPhoneNb) {
		claims.Phone = &ContactClaim{Value: NormalizePhone(zp.Phone), Verified: true}
	}
	return claims, nil
}

// profileURL appends the v4 required fields parameter.
func (z *ZaloProvider) profileURL(accessToken string) string {
	sep := "?"
	if strings.Contains(z.ProfileEndpoint, "?") {
		sep = "&"
	}
	return z.ProfileEndpoint + sep + url.Values{
		"access_token": {accessToken},
		"fields":       {"id,name,birthday,is_phone_number_verified,phone,picture"},
	}.Encode()
}

// redirectURI is the handler-bound callback (cycle-3 mounts it on
// /api/v1/auth/zalo/callback).
func (z *ZaloProvider) redirectURI() string {
	base := strings.TrimRight(z.BaseURL, "/")
	if base == "" {
		base = "http://localhost:3456"
	}
	return base + "/api/v1/auth/zalo/callback"
}
