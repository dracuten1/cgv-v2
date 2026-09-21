package auth_test

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"github.com/dracuten1/cgv-v2/api/internal/auth"
	"github.com/dracuten1/cgv-v2/api/internal/model"
)

// newDiscardWriter is an httptest.ResponseRecorder for cookie assertions.
func newDiscardWriter() *httptest.ResponseRecorder {
	return httptest.NewRecorder()
}

// newRequestWithCookies is an empty callback-shaped request.
func newRequestWithCookies() *http.Request {
	return httptest.NewRequest(http.MethodGet, "/api/v1/auth/mock/callback", nil)
}

// TestStateCookie_BurnOnRead drives the full state-cookie lifecycle through
// the mock provider: mint → callback validates → replay fails closed.
func TestStateCookie_BurnOnRead(t *testing.T) {
	svc, core, _, _ := newHarness(false)

	// 1) Mint: LoginURL sets the signed state cookie.
	w1 := httptest.NewRecorder()
	r1 := httptest.NewRequest(http.MethodGet, "/api/v1/auth/mock/login", nil)
	stateURL, err := svc.LoginURL(w1, r1, model.ProviderMock)
	if err != nil {
		t.Fatalf("LoginURL failed: %v", err)
	}
	stateParam := stateURL[strings.Index(stateURL, "state=")+len("state="):]

	cookies := w1.Result().Cookies()
	if len(cookies) != 1 {
		t.Fatalf("expected exactly 1 state cookie, got %d", len(cookies))
	}
	c := cookies[0]
	if c.Name != "cgp_oauth_state" {
		t.Fatalf("unexpected cookie name %q", c.Name)
	}
	if !c.HttpOnly || !c.Secure || c.SameSite != http.SameSiteLaxMode {
		t.Fatalf("cookie flags wrong: httpOnly=%v secure=%v sameSite=%v", c.HttpOnly, c.Secure, c.SameSite)
	}
	if c.MaxAge <= 0 || c.MaxAge > 300 {
		t.Fatalf("expected 5-min TTL, got %d", c.MaxAge)
	}

	// 2) Callback with the state cookie present → success path.
	w2 := httptest.NewRecorder()
	r2 := httptest.NewRequest(http.MethodGet, "/api/v1/auth/mock/callback?state="+stateParam+"&code=verified_email:burn@test.vn", nil)
	r2.AddCookie(c)
	res, err := svc.HandleCallback(r2.Context(), w2, r2, model.ProviderMock, "verified_email:burn@test.vn", stateParam)
	if err != nil {
		t.Fatalf("HandleCallback failed: %v", err)
	}
	if res == nil || res.Token == "" {
		t.Fatal("expected a JWT from the mock callback")
	}
	// Burn: the response must carry the deletion cookie (MaxAge -1).
	burnCookies := w2.Result().Cookies()
	burned := false
	for _, bc := range burnCookies {
		if bc.Name == "cgp_oauth_state" && bc.MaxAge < 0 {
			burned = true
		}
	}
	if !burned {
		t.Fatal("state cookie must be deleted (burn-on-read) on consumption")
	}

	// 3) REPLAY: same cookie + state → rejected (cookie already burned).
	w3 := httptest.NewRecorder()
	r3 := httptest.NewRequest(http.MethodGet, "/api/v1/auth/mock/callback?state="+stateParam+"&code=x", nil)
	r3.AddCookie(c)
	if _, err := svc.HandleCallback(r3.Context(), w3, r3, model.ProviderMock, "x", stateParam); err == nil ||
		!strings.Contains(err.Error(), "Phiên đăng nhập không hợp lệ") {
		t.Fatalf("expected ErrInvalidState on replay, got %v", err)
	}

	// 4) Tampered state (foreign signature) → rejected even with fresh cookie.
	w4 := httptest.NewRecorder()
	r4 := httptest.NewRequest(http.MethodGet, "/api/v1/auth/mock/callback", nil)
	r4.AddCookie(&http.Cookie{Name: "cgp_oauth_state", Value: "forgednonce.deadbeef"})
	if _, err := svc.HandleCallback(r4.Context(), w4, r4, model.ProviderMock, "x", "forgednonce.deadbeef"); err == nil {
		t.Fatal("expected rejection of forged state")
	}
	if locks := core.locksTaken(); len(locks) > 1 {
		t.Fatalf("at most one lock in the happy path, got %v", locks)
	}
}

// TestMockProvider_ClaimPrefixes exercises the offline claim fabrication used
// by dev/CI/E2E journeys.
func TestMockProvider_ClaimPrefixes(t *testing.T) {
	cases := []struct {
		code         string
		wantSubject  string
		wantEmail    string
		wantEmailVer bool
		wantPhone    string
		wantPhoneVer bool
	}{
		{code: "plain", wantSubject: "mock:plain"},
		{code: "verified_email:a@b.vn", wantSubject: "mock:verified_email:a@b.vn", wantEmail: "a@b.vn", wantEmailVer: true},
		{code: "unverified_email:c@d.vn", wantSubject: "mock:unverified_email:c@d.vn", wantEmail: "c@d.vn", wantEmailVer: false},
		{code: "verified_phone:0912345678", wantSubject: "mock:verified_phone:0912345678", wantPhone: "0912345678", wantPhoneVer: true},
	}
	for _, tc := range cases {
		p := auth.NewMockProvider(newTestConfig(false))
		claims, err := p.Exchange(nil, tc.code, "")
		if err != nil {
			t.Fatalf("Exchange(%q) failed: %v", tc.code, err)
		}
		if claims.Provider != model.ProviderMock || claims.Subject != tc.wantSubject {
			t.Fatalf("Exchange(%q) = %s/%s, want %s", tc.code, claims.Provider, claims.Subject, tc.wantSubject)
		}
		if tc.wantEmail == "" {
			if claims.Email != nil {
				t.Fatalf("Exchange(%q): unexpected email claim %+v", tc.code, claims.Email)
			}
		} else if claims.Email == nil || claims.Email.Value != tc.wantEmail || claims.Email.Verified != tc.wantEmailVer {
			t.Fatalf("Exchange(%q): email claim = %+v, want %q verified=%v", tc.code, claims.Email, tc.wantEmail, tc.wantEmailVer)
		}
		if tc.wantPhone == "" {
			if claims.Phone != nil {
				t.Fatalf("Exchange(%q): unexpected phone claim %+v", tc.code, claims.Phone)
			}
		} else if claims.Phone == nil || claims.Phone.Value != tc.wantPhone || claims.Phone.Verified != tc.wantPhoneVer {
			t.Fatalf("Exchange(%q): phone claim = %+v, want %q verified=%v", tc.code, claims.Phone, tc.wantPhone, tc.wantPhoneVer)
		}
	}

	// Disabled mock → ErrProviderDisabled.
	p := auth.NewMockProvider(newTestConfig(false))
	p.Enabled = false
	if _, err := p.Exchange(nil, "x", ""); err == nil || !strings.Contains(err.Error(), "chưa được cấu hình") {
		t.Fatalf("expected ErrProviderDisabled, got %v", err)
	}
}
