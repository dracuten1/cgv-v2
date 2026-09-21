package auth_test

import (
	"strings"
	"testing"
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/auth"
	"github.com/dracuten1/cgv-v2/api/internal/config"
	"github.com/dracuten1/cgv-v2/api/internal/model"
	"github.com/golang-jwt/jwt/v5"
)

func newTestConfig(demo bool) *config.Config {
	issuer := config.ProdJWTIssuer
	cookie := config.ProdCookieName
	appEnv := config.EnvProd
	if demo {
		issuer = config.DemoJWTIssuer
		cookie = config.DemoCookieName
		appEnv = config.EnvDemo
	}
	return &config.Config{
		AppEnv:           appEnv,
		JWTSecret:        "test-jwt-secret-with-adequate-entropy-32b",
		JWTIssuer:        issuer,
		CookieName:       cookie,
		DemoMode:         demo,
		MockOAuthEnabled: true,
	}
}

func newTestService(cfg *config.Config, core *memCore, outbox *fakeOutbox) *auth.Service {
	return auth.NewService(cfg, &fakeTx{}, auth.ServiceDeps{
		Users:      &memUsers{core: core},
		Identities: &memIdentities{core: core},
		Contacts:   &memContacts{core: core},
		Tokens:     &memTokens{core: core},
		Sessions:   &memSessions{core: core},
		Locker:     &memLocker{core: core},
		Outbox:     outbox,
	})
}

func TestJWT_DualIssuer_Roundtrip(t *testing.T) {
	cases := []struct {
		name     string
		demo     bool
		user     model.User
		wantIss  string
		wantDemo bool
	}{
		{
			name:     "production real user",
			demo:     false,
			user:     model.User{ID: "user-real-001", DisplayName: "Nguyễn Văn Real", IsDemo: false},
			wantIss:  config.ProdJWTIssuer,
			wantDemo: false,
		},
		{
			name:     "mode A demo user",
			demo:     true,
			user:     model.User{ID: "user-demo-001", DisplayName: "Người dùng dùng thử", IsDemo: true},
			wantIss:  config.DemoJWTIssuer,
			wantDemo: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			cfg := newTestConfig(tc.demo)
			svc := newTestService(cfg, newMemCore(), &fakeOutbox{})

			tokenStr, err := svc.IssueToken(tc.user)
			if err != nil {
				t.Fatalf("IssueToken failed: %v", err)
			}
			if tokenStr == "" {
				t.Fatal("expected non-empty token string")
			}

			claims, err := svc.VerifyToken(tokenStr)
			if err != nil {
				t.Fatalf("VerifyToken failed: %v", err)
			}
			if claims.UserID != tc.user.ID {
				t.Fatalf("UserID mismatch: got %q, want %q", claims.UserID, tc.user.ID)
			}
			if claims.Issuer != tc.wantIss {
				t.Fatalf("Issuer mismatch: got %q, want %q", claims.Issuer, tc.wantIss)
			}
			if claims.Audience != tc.wantIss {
				t.Fatalf("Audience mismatch: got %q, want %q", claims.Audience, tc.wantIss)
			}
			if claims.IsDemo != tc.wantDemo {
				t.Fatalf("IsDemo mismatch: got %v, want %v", claims.IsDemo, tc.wantDemo)
			}
			if claims.ID == "" {
				t.Fatal("expected non-empty jti in RegisteredClaims.ID")
			}
			if claims.ExpiresAt == nil || claims.ExpiresAt.Time.Before(time.Now().Add(23*time.Hour)) {
				t.Fatalf("expected ~24h expiry, got %v", claims.ExpiresAt)
			}
		})
	}
}

func TestJWT_EnforceDualIssuerMismatches(t *testing.T) {
	secret := []byte("test-jwt-secret-with-adequate-entropy-32b")

	mintCustom := func(sub, iss, aud string, isDemo bool, exp time.Duration, key []byte) string {
		now := time.Now()
		c := &auth.Claims{
			UserID:   sub,
			IsDemo:   isDemo,
			Issuer:   iss,
			Audience: aud,
			RegisteredClaims: jwt.RegisteredClaims{
				ID:        "test-jti-01",
				IssuedAt:  jwt.NewNumericDate(now),
				ExpiresAt: jwt.NewNumericDate(now.Add(exp)),
			},
		}
		tok := jwt.NewWithClaims(jwt.SigningMethodHS256, c)
		s, _ := tok.SignedString(key)
		return s
	}

	cases := []struct {
		name    string
		token   string
		service *auth.Service
		wantErr string
	}{
		{
			name:    "prod issuer but is_demo=true (mismatch rejected)",
			token:   mintCustom("u-1", config.ProdJWTIssuer, config.ProdJWTIssuer, true, time.Hour, secret),
			service: newTestService(newTestConfig(false), newMemCore(), &fakeOutbox{}),
			wantErr: "Mã xác thực không hợp lệ",
		},
		{
			name:    "demo issuer but is_demo=false (mismatch rejected)",
			token:   mintCustom("u-1", config.DemoJWTIssuer, config.DemoJWTIssuer, false, time.Hour, secret),
			service: newTestService(newTestConfig(true), newMemCore(), &fakeOutbox{}),
			wantErr: "Mã xác thực không hợp lệ",
		},
		{
			name:    "foreign issuer rejected",
			token:   mintCustom("u-1", "foreign-corp", "foreign-corp", false, time.Hour, secret),
			service: newTestService(newTestConfig(false), newMemCore(), &fakeOutbox{}),
			wantErr: "Mã xác thực không hợp lệ",
		},
		{
			name:    "issuer != audience rejected",
			token:   mintCustom("u-1", config.ProdJWTIssuer, "different-aud", false, time.Hour, secret),
			service: newTestService(newTestConfig(false), newMemCore(), &fakeOutbox{}),
			wantErr: "Mã xác thực không hợp lệ",
		},
		{
			name:    "expired token rejected",
			token:   mintCustom("u-1", config.ProdJWTIssuer, config.ProdJWTIssuer, false, -time.Hour, secret),
			service: newTestService(newTestConfig(false), newMemCore(), &fakeOutbox{}),
			wantErr: "Mã xác thực không hợp lệ hoặc đã hết hạn",
		},
		{
			name:    "wrong secret rejected",
			token:   mintCustom("u-1", config.ProdJWTIssuer, config.ProdJWTIssuer, false, time.Hour, []byte("wrong-secret-key-32b-length-here")),
			service: newTestService(newTestConfig(false), newMemCore(), &fakeOutbox{}),
			wantErr: "Mã xác thực không hợp lệ",
		},
		{
			name:    "prod token rejected on demo config",
			token:   mintCustom("u-1", config.ProdJWTIssuer, config.ProdJWTIssuer, false, time.Hour, secret),
			service: newTestService(newTestConfig(true), newMemCore(), &fakeOutbox{}),
			wantErr: "Mã xác thực không hợp lệ",
		},
		{
			name:    "demo token rejected on prod config",
			token:   mintCustom("u-1", config.DemoJWTIssuer, config.DemoJWTIssuer, true, time.Hour, secret),
			service: newTestService(newTestConfig(false), newMemCore(), &fakeOutbox{}),
			wantErr: "Mã xác thực không hợp lệ",
		},
		{
			name:    "malformed gibberish token rejected",
			token:   "not.a.valid.jwt.payload",
			service: newTestService(newTestConfig(false), newMemCore(), &fakeOutbox{}),
			wantErr: "Mã xác thực không hợp lệ",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, err := tc.service.VerifyToken(tc.token)
			if err == nil {
				t.Fatalf("expected error containing %q, got nil", tc.wantErr)
			}
			if !strings.Contains(err.Error(), tc.wantErr) {
				t.Fatalf("expected error containing %q, got %q", tc.wantErr, err.Error())
			}
		})
	}
}

func TestLinkState_PurposeClaimValidation(t *testing.T) {
	svc := newTestService(newTestConfig(false), newMemCore(), &fakeOutbox{})

	// 1. Valid token issued with purpose: "oauth_link" passes VerifyLinkState
	tokenStr, err := svc.IssueLinkState("user-1", model.ProviderGoogle, "nonce-123")
	if err != nil {
		t.Fatalf("IssueLinkState failed: %v", err)
	}

	claims, err := svc.VerifyLinkState(tokenStr)
	if err != nil {
		t.Fatalf("VerifyLinkState failed on valid token: %v", err)
	}
	if claims.Purpose != auth.LinkStatePurpose {
		t.Fatalf("expected purpose %q, got %q", auth.LinkStatePurpose, claims.Purpose)
	}
	if claims.UserID != "user-1" || claims.Provider != model.ProviderGoogle || claims.Nonce != "nonce-123" {
		t.Fatalf("claims mismatch: %+v", claims)
	}

	// 2. Token with wrong purpose is rejected
	wrongPurposeClaims := &auth.LinkStateClaims{
		UserID:   "user-1",
		Provider: model.ProviderGoogle,
		Nonce:    "nonce-123",
		Purpose:  "login_instead",
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    config.ProdJWTIssuer,
			Audience:  jwt.ClaimStrings{"link"},
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(10 * time.Minute)),
		},
	}
	wrongTok := jwt.NewWithClaims(jwt.SigningMethodHS256, wrongPurposeClaims)
	wrongStr, _ := wrongTok.SignedString([]byte("test-jwt-secret-with-adequate-entropy-32b"))

	if _, err := svc.VerifyLinkState(wrongStr); err == nil {
		t.Fatal("expected VerifyLinkState to reject token with wrong purpose")
	}

	// 3. Token with empty purpose is rejected
	emptyPurposeClaims := &auth.LinkStateClaims{
		UserID:   "user-1",
		Provider: model.ProviderGoogle,
		Nonce:    "nonce-123",
		Purpose:  "",
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    config.ProdJWTIssuer,
			Audience:  jwt.ClaimStrings{"link"},
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(10 * time.Minute)),
		},
	}
	emptyTok := jwt.NewWithClaims(jwt.SigningMethodHS256, emptyPurposeClaims)
	emptyStr, _ := emptyTok.SignedString([]byte("test-jwt-secret-with-adequate-entropy-32b"))

	if _, err := svc.VerifyLinkState(emptyStr); err == nil {
		t.Fatal("expected VerifyLinkState to reject token with empty purpose")
	}
}
