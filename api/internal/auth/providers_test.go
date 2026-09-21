package auth_test

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/dracuten1/cgv-v2/api/internal/auth"
	"github.com/dracuten1/cgv-v2/api/internal/config"
	"github.com/dracuten1/cgv-v2/api/internal/model"
)

// stubEndpoints spins an httptest server answering /token and /profile and
// re-points the provider's injectable endpoint fields at it (no real network).
func stubEndpoints(t *testing.T, tokenHandler, profileHandler http.HandlerFunc) (tokenURL, profileURL string) {
	t.Helper()
	mux := http.NewServeMux()
	mux.HandleFunc("/token", tokenHandler)
	mux.HandleFunc("/profile", profileHandler)
	srv := httptest.NewServer(mux)
	t.Cleanup(srv.Close)
	return srv.URL + "/token", srv.URL + "/profile"
}

// stubConfig is a fully-configured (client IDs set) prod-mode config.
func stubConfig() *config.Config {
	return &config.Config{
		JWTSecret:            "test-jwt-secret-with-adequate-entropy-32b",
		JWTIssuer:            config.ProdJWTIssuer,
		CookieName:           config.ProdCookieName,
		ZaloClientID:         "zalo-app-id",
		ZaloClientSecret:     "zalo-app-secret",
		GoogleClientID:       "google-app-id",
		GoogleClientSecret:   "google-app-secret",
		FacebookClientID:     "fb-app-id",
		FacebookClientSecret: "fb-app-secret",
		MockOAuthEnabled:     true,
	}
}

// TestZaloProvider_StrictPhoneGate — pending-leader decision #9: the phone
// counts as a VERIFIED contact claim ONLY when the provider explicitly
// reports the phone as verified.
func TestZaloProvider_StrictPhoneGate(t *testing.T) {
	cases := []struct {
		name         string
		profileJSON  string
		wantPhone    string
		wantPhoneVer bool
		wantNilPhone bool
	}{
		{
			name: "verified phone string-1 form",
			profileJSON: `{"id":"zl-1","name":"Zalo User",
				"phone":"84901112233","is_phone_number_verified":"1"}`,
			wantPhone: "0901112233", wantPhoneVer: true,
		},
		{
			name: "verified phone bool form",
			profileJSON: `{"id":"zl-2","name":"Zalo Two",
				"phone":"0909998887","is_phone_number_verified":true}`,
			wantPhone: "0909998887", wantPhoneVer: true,
		},
		{
			name: "unverified phone is dropped entirely (strict)",
			profileJSON: `{"id":"zl-3","name":"Zalo Three",
				"phone":"0904445556","is_phone_number_verified":false}`,
			wantNilPhone: true,
		},
		{
			name: "pending phone string-0 is dropped entirely (strict)",
			profileJSON: `{"id":"zl-4","name":"Zalo Four",
				"phone":"0902223334","is_phone_number_verified":"0"}`,
			wantNilPhone: true,
		},
		{
			name:         "no phone at all",
			profileJSON:  `{"id":"zl-5","name":"Zalo Five"}`,
			wantNilPhone: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			tokenURL, profileURL := stubEndpoints(t,
				jsonTokenHandler("zalo-access-token"),
				jsonBodyHandler(tc.profileJSON))
			p := auth.NewZaloProvider(stubConfig())
			p.TokenEndpoint = tokenURL
			p.ProfileEndpoint = profileURL

			claims, err := p.Exchange(context.Background(), "zalo-code", "pkce-verifier")
			if err != nil {
				t.Fatalf("Exchange failed: %v", err)
			}
			if claims.Provider != model.ProviderZalo || claims.Subject == "" {
				t.Fatalf("unexpected claims %+v", claims)
			}
			if tc.wantNilPhone {
				if claims.Phone != nil {
					t.Fatalf("strict gate violated: unverified phone leaked %+v", claims.Phone)
				}
				return
			}
			if claims.Phone == nil || claims.Phone.Value != tc.wantPhone || claims.Phone.Verified != tc.wantPhoneVer {
				t.Fatalf("phone claim = %+v, want %q verified=%v", claims.Phone, tc.wantPhone, tc.wantPhoneVer)
			}
		})
	}
}

// TestZaloProvider_TokenEndpointError ensures provider failures map to
// ErrProviderExchange (never a raw transport error leaking upward).
func TestZaloProvider_TokenEndpointError(t *testing.T) {
	tokenURL, _ := stubEndpoints(t,
		func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(http.StatusBadRequest) },
		func(w http.ResponseWriter, r *http.Request) {})
	p := auth.NewZaloProvider(stubConfig())
	p.TokenEndpoint = tokenURL

	_, err := p.Exchange(context.Background(), "bad-code", "verifier")
	if err == nil || !strings.Contains(err.Error(), "xác thực với nhà cung cấp") {
		t.Fatalf("expected ErrProviderExchange, got %v", err)
	}
}

// TestGoogleProvider_EmailVerifiedClaim checks code→token→userinfo with the
// email_verified flag mapped onto the contact claim.
func TestGoogleProvider_EmailVerifiedClaim(t *testing.T) {
	cases := []struct {
		name         string
		profileJSON  string
		wantEmail    string
		wantVerified bool
	}{
		{
			name:        "verified email",
			profileJSON: `{"sub":"g-1","name":"Google User","email":"gg@gmail.com","email_verified":true}`,
			wantEmail:   "gg@gmail.com", wantVerified: true,
		},
		{
			name:        "unverified email carried as unverified (never auto-links)",
			profileJSON: `{"sub":"g-2","name":"Google Two","email":"x@gmail.com","email_verified":false}`,
			wantEmail:   "x@gmail.com", wantVerified: false,
		},
		{
			name:        "no email scope granted",
			profileJSON: `{"sub":"g-3","name":"Google Three"}`,
		},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			tokenURL, profileURL := stubEndpoints(t,
				jsonTokenHandler("google-token"),
				jsonBodyHandler(tc.profileJSON))
			p := auth.NewGoogleProvider(stubConfig())
			p.TokenEndpoint = tokenURL
			p.ProfileEndpoint = profileURL

			claims, err := p.Exchange(context.Background(), "g-code", "verifier")
			if err != nil {
				t.Fatalf("Exchange failed: %v", err)
			}
			if claims.Provider != model.ProviderGoogle || claims.Subject == "" {
				t.Fatalf("unexpected claims %+v", claims)
			}
			if tc.wantEmail == "" {
				if claims.Email != nil {
					t.Fatalf("unexpected email claim %+v", claims.Email)
				}
				return
			}
			if claims.Email == nil || claims.Email.Value != tc.wantEmail || claims.Email.Verified != tc.wantVerified {
				t.Fatalf("email claim = %+v, want %q verified=%v", claims.Email, tc.wantEmail, tc.wantVerified)
			}
		})
	}
}

// TestFacebookProvider_EmailOnlyWhenPresent enforces F1: Graph omits email
// unless present AND verified; an absent field ⇒ NO email claim.
func TestFacebookProvider_EmailOnlyWhenPresent(t *testing.T) {
	cases := []struct {
		name        string
		profileJSON string
		wantEmail   string
	}{
		{name: "email present → verified claim", profileJSON: `{"id":"fb-1","name":"FB User","email":"fb@out.com"}`, wantEmail: "fb@out.com"},
		{name: "email omitted → no claim", profileJSON: `{"id":"fb-2","name":"FB NoEmail"}`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			tokenURL, profileURL := stubEndpoints(t,
				jsonTokenHandler("fb-token"),
				jsonBodyHandler(tc.profileJSON))
			p := auth.NewFacebookProvider(stubConfig())
			p.TokenEndpoint = tokenURL
			p.ProfileEndpoint = profileURL

			claims, err := p.Exchange(context.Background(), "fb-code", "verifier")
			if err != nil {
				t.Fatalf("Exchange failed: %v", err)
			}
			if tc.wantEmail == "" {
				if claims.Email != nil {
					t.Fatalf("email must be absent, got %+v", claims.Email)
				}
				return
			}
			if claims.Email == nil || claims.Email.Value != tc.wantEmail || !claims.Email.Verified {
				t.Fatalf("email claim = %+v, want verified %q", claims.Email, tc.wantEmail)
			}
		})
	}
}

// TestProvider_AuthURLDisabled covers ErrProviderDisabled for unset secrets.
func TestProvider_AuthURLDisabled(t *testing.T) {
	cfg := newTestConfig(false) // no client IDs
	z := auth.NewZaloProvider(cfg)
	if _, err := z.AuthURL("state", "challenge"); err == nil ||
		!strings.Contains(err.Error(), "chưa được cấu hình") {
		t.Fatalf("expected ErrProviderDisabled, got %v", err)
	}
	g := auth.NewGoogleProvider(cfg)
	if _, err := g.AuthURL("state", "challenge"); err == nil {
		t.Fatal("expected ErrProviderDisabled for google")
	}
}

// TestProvider_AuthURL_PKCEChallengePresent verifies S256 challenge wiring.
func TestProvider_AuthURL_PKCEChallengePresent(t *testing.T) {
	cfg := newTestConfig(false)
	cfg.GoogleClientID = "gid"
	g := auth.NewGoogleProvider(cfg)
	raw, err := g.AuthURL("state-nonce", "s256-challenge")
	if err != nil {
		t.Fatalf("AuthURL failed: %v", err)
	}
	u, err := url.Parse(raw)
	if err != nil {
		t.Fatalf("auth URL malformed: %v", err)
	}
	q := u.Query()
	if q.Get("state") != "state-nonce" {
		t.Fatalf("state not carried: %q", q.Get("state"))
	}
	if q.Get("code_challenge") != "s256-challenge" || q.Get("code_challenge_method") != "S256" {
		t.Fatalf("PKCE S256 challenge missing: %v", q)
	}
}

// --- helpers ---------------------------------------------------------------

func jsonTokenHandler(token string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(map[string]any{"access_token": token, "token_type": "Bearer"})
	}
}

func jsonBodyHandler(body string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(body))
	}
}
