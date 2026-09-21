package auth

import (
	"context"
	"fmt"
	"strings"

	"github.com/dracuten1/cgv-v2/api/internal/config"
	"github.com/dracuten1/cgv-v2/api/internal/model"
)

// MockProvider is the offline provider for dev/CI/E2E (Journey 3): zero
// external HTTP, deterministic subjects. Enabled only when
// config.MockOAuthEnabled is true and config.AppEnv == EnvDev — every method returns
// ErrProviderDisabled otherwise.
//
// Exchange accepts ANY code; subject = "mock:<code>". A `verified_email:`
// / `verified_phone:` prefix in the code lets E2E journeys exercise the
// auto-link and conflict branches without real providers.
type MockProvider struct {
	Enabled bool
	AppEnv  config.AppEnv

	oauthFlows
}

// NewMockProvider builds the mock adapter from configuration.
func NewMockProvider(cfg *config.Config) *MockProvider {
	enabled := cfg.MockOAuthEnabled && cfg.AppEnv == config.EnvDev
	return &MockProvider{Enabled: enabled, AppEnv: cfg.AppEnv, oauthFlows: oauthFlows{secret: []byte(cfg.JWTSecret)}}
}

// AuthURL returns the local callback URL carrying the state so the E2E
// journey can round-trip the flow without external HTTP.
func (m *MockProvider) AuthURL(state, _ string) (string, error) {
	if !m.Enabled {
		return "", ErrProviderDisabled
	}
	return fmt.Sprintf("/api/v1/auth/mock/callback?state=%s", state), nil
}

// Exchange fabricates claims from the code:
//
//	"verified_email:a@b.vn" → verified email claim
//	"verified_phone:09…"    → verified phone claim
//	anything else           → bare identity (subject mock:<code>)
//
// The `unverified:` prefix produces a Verified=false claim for the
// unverified-branch tests.
func (m *MockProvider) Exchange(_ context.Context, code, _ string) (*ProviderClaims, error) {
	if !m.Enabled || m.AppEnv != config.EnvDev {
		return nil, ErrProviderDisabled
	}
	claims := &ProviderClaims{
		Provider: model.ProviderMock,
		Subject:  "mock:" + code,
	}
	switch {
	case strings.HasPrefix(code, "verified_email:"):
		email := strings.TrimPrefix(code, "verified_email:")
		claims.DisplayName = mockDisplayName(email)
		claims.Email = &ContactClaim{Value: NormalizeContact(model.ContactKindEmail, email), Verified: true}
	case strings.HasPrefix(code, "unverified_email:"):
		email := strings.TrimPrefix(code, "unverified_email:")
		claims.Email = &ContactClaim{Value: NormalizeContact(model.ContactKindEmail, email), Verified: false}
	case strings.HasPrefix(code, "verified_phone:"):
		phone := strings.TrimPrefix(code, "verified_phone:")
		claims.DisplayName = mockDisplayName(phone)
		claims.Phone = &ContactClaim{Value: NormalizePhone(phone), Verified: true}
	case strings.HasPrefix(code, "verified_email_phone:"):
		rest := strings.TrimPrefix(code, "verified_email_phone:")
		parts := strings.SplitN(rest, ":", 2)
		email, phone := parts[0], ""
		if len(parts) == 2 {
			phone = parts[1]
		}
		claims.DisplayName = mockDisplayName(email)
		claims.Email = &ContactClaim{Value: NormalizeContact(model.ContactKindEmail, email), Verified: true}
		if phone != "" {
			claims.Phone = &ContactClaim{Value: NormalizePhone(phone), Verified: true}
		}
	}
	return claims, nil
}

// mockDisplayName derives a friendly placeholder from the mock code.
func mockDisplayName(seed string) string {
	if at := strings.IndexByte(seed, '@'); at > 0 {
		return "Người dùng " + seed[:at]
	}
	return "Người dùng mock"
}
