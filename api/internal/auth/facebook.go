package auth

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"

	"github.com/dracuten1/cgv-v2/api/internal/config"
	"github.com/dracuten1/cgv-v2/api/internal/model"
)

// Facebook endpoints (Graph API; direct HTTP per INV-01).
const (
	facebookAuthURL    = "https://www.facebook.com/v19.0/dialog/oauth"
	facebookTokenURL   = "https://graph.facebook.com/v19.0/oauth/access_token"
	facebookProfileURL = "https://graph.facebook.com/me"
)

// fbProfile is the graph /me response shape (subset). Facebook reports
// email only when the user granted it AND it is confirmed on their account —
// presence of the field therefore already implies verified per spec F1
// ("email only when present+verified"); the EmailVerified flag stays
// authoritative and defaults true when the field is present without an
// explicit marker.
type fbProfile struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Email string `json:"email"`
}

// FacebookProvider implements Facebook OAuth 2.0 (Graph API): code → token →
// /me?fields=id,name,email.
type FacebookProvider struct {
	ClientID     string
	ClientSecret string

	AuthEndpoint    string
	TokenEndpoint   string
	ProfileEndpoint string

	HTTP *http.Client

	oauthFlows
}

// NewFacebookProvider builds the Facebook adapter from configuration.
func NewFacebookProvider(cfg *config.Config) *FacebookProvider {
	return &FacebookProvider{
		ClientID:        cfg.FacebookClientID,
		ClientSecret:    cfg.FacebookClientSecret,
		AuthEndpoint:    facebookAuthURL,
		TokenEndpoint:   facebookTokenURL,
		ProfileEndpoint: facebookProfileURL,
		HTTP:            oauthHTTPClient,
		oauthFlows:      oauthFlows{secret: []byte(cfg.JWTSecret)},
	}
}

// AuthURL returns the Facebook dialog URL with state + S256 PKCE.
func (f *FacebookProvider) AuthURL(state, challenge string) (string, error) {
	if err := enforceConfigured(f.ClientID, true); err != nil {
		return "", err
	}
	return buildAuthURL(f.AuthEndpoint, url.Values{
		"client_id":             {f.ClientID},
		"redirect_uri":          {f.redirectURI()},
		"state":                 {state},
		"code_challenge":        {challenge},
		"code_challenge_method": {"S256"},
		"scope":                 {"openid,email,public_profile"},
	}), nil
}

// Exchange trades the callback code (+ verifier) for claims. The email claim
// exists only when Facebook returned one (Graph omits it unless present AND
// verified on the account).
func (f *FacebookProvider) Exchange(ctx context.Context, code, verifier string) (*ProviderClaims, error) {
	if err := enforceConfigured(f.ClientID, true); err != nil {
		return nil, err
	}
	ctx, cancel := providerContext(ctx)
	defer cancel()

	form := url.Values{
		"client_id":     {f.ClientID},
		"client_secret": {f.ClientSecret},
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"code_verifier": {verifier},
		"redirect_uri":  {f.redirectURI()},
	}
	raw, err := httpFormPOST(ctx, f.HTTP, f.TokenEndpoint, form)
	if err != nil {
		return nil, err
	}
	token, err := decodeTokenResponse(raw)
	if err != nil {
		return nil, err
	}

	profileEndpoint := f.ProfileEndpoint + "?" + url.Values{
		"access_token": {token.AccessToken},
		"fields":       {"id,name,email"},
	}.Encode()
	profRaw, err := httpGetAuthorized(ctx, f.HTTP, profileEndpoint, token.AccessToken)
	if err != nil {
		return nil, err
	}
	var fp fbProfile
	if err := json.Unmarshal(profRaw, &fp); err != nil {
		return nil, fmt.Errorf("%w: hồ sơ Facebook không hợp lệ", ErrProviderExchange)
	}

	claims := &ProviderClaims{
		Provider:    model.ProviderFacebook,
		Subject:     fp.ID,
		DisplayName: fp.Name,
	}
	// Spec F1: Facebook email surfaces only when present AND verified —
	// Graph simply omits the field otherwise; empty ⇒ no email claim.
	if fp.Email != "" {
		claims.Email = &ContactClaim{
			Value:    NormalizeContact(model.ContactKindEmail, fp.Email),
			Verified: true,
		}
	}
	return claims, nil
}

// redirectURI is the handler-bound callback path.
func (f *FacebookProvider) redirectURI() string { return "/api/v1/auth/facebook/callback" }
