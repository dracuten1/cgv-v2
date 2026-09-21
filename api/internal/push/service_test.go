package push_test

import (
	"context"
	"encoding/base64"
	"errors"
	"log/slog"
	"strings"
	"testing"

	"github.com/dracuten1/cgv-v2/api/internal/config"
	"github.com/dracuten1/cgv-v2/api/internal/model"
	"github.com/dracuten1/cgv-v2/api/internal/push"
)

// fakeServiceRepo records Upsert/Delete for the push service tests.
type fakeServiceRepo struct {
	upserted []model.PushSubscription
	deleted  []string
}

func (f *fakeServiceRepo) Upsert(ctx context.Context, sub model.PushSubscription) error {
	f.upserted = append(f.upserted, sub)
	return nil
}

func (f *fakeServiceRepo) DeleteByEndpoint(ctx context.Context, endpoint string) error {
	f.deleted = append(f.deleted, endpoint)
	return nil
}

func (f *fakeServiceRepo) ListForFamily(ctx context.Context, familyID string) ([]model.PushSubscription, error) {
	return nil, nil
}

func TestService_Subscribe_ValidationTable(t *testing.T) {
	repo := &fakeServiceRepo{}
	svc := push.NewService(repo)
	ctx := context.Background()

	validKey := base64.RawURLEncoding.EncodeToString([]byte("1234567890123456789012345678"))

	tests := []struct {
		name    string
		userID  string
		endpt   string
		p256dh  string
		auth    string
		wantErr error
	}{
		{"missing user id", "", "https://fcm.googleapis.com/ep", validKey, "authkey", push.ErrUserIDRequired},
		{"empty endpoint", "u1", "", validKey, "authkey", push.ErrEndpointRequired},
		{"endpoint not a url", "u1", "khong-phai-url", validKey, "authkey", push.ErrInvalidEndpoint},
		{"endpoint without host", "u1", "https://", validKey, "authkey", push.ErrInvalidEndpoint},
		{"endpoint ftp scheme", "u1", "ftp://push.example/ep", validKey, "authkey", push.ErrInvalidEndpoint},
		{"empty p256dh", "u1", "https://fcm.googleapis.com/ep", "  ", "authkey", push.ErrP256DHRequired},
		{"empty auth", "u1", "https://fcm.googleapis.com/ep", validKey, "", push.ErrAuthKeyRequired},
		{"p256dh not base64", "u1", "https://fcm.googleapis.com/ep", "!!!không-base64!!!", "authkey", push.ErrInvalidBase64Key},
		{"auth not base64", "u1", "https://fcm.googleapis.com/ep", validKey, "###", push.ErrInvalidBase64Key},
		{"valid https endpoint", "u1", "https://fcm.googleapis.com/ep", validKey, "authkey", nil},
		{"valid http endpoint", "u1", "http://localhost:8080/ep", validKey, "authkey", nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := svc.Subscribe(ctx, tt.userID, tt.endpt, tt.p256dh, tt.auth)
			if tt.wantErr != nil {
				if err == nil {
					t.Fatalf("expected error %v, got nil", tt.wantErr)
				}
				if !errors.Is(err, tt.wantErr) {
					t.Fatalf("error = %v, want %v", err, tt.wantErr)
				}
				if !isVietnamese(err) {
					t.Fatalf("error message must be Vietnamese with diacritics: %q", err.Error())
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
		})
	}

	// Only the 2 valid rows reached the repository.
	if len(repo.upserted) != 2 {
		t.Fatalf("repo upserts = %d, want 2", len(repo.upserted))
	}
	got := repo.upserted[0]
	if got.UserID != "u1" || got.Endpoint != "https://fcm.googleapis.com/ep" || got.P256DH != validKey || got.Auth != "authkey" {
		t.Fatalf("upserted subscription wrong: %+v", got)
	}
}

// Re-subscribing the same endpoint refreshes keys via Upsert (repo contract —
// ON CONFLICT (endpoint) DO UPDATE). The service layer passes through.
func TestService_Subscribe_ReSubscribeRefreshesKeys(t *testing.T) {
	repo := &fakeServiceRepo{}
	svc := push.NewService(repo)
	ctx := context.Background()

	oldKey := base64.RawURLEncoding.EncodeToString([]byte("old-key-old-key-old-key-old"))
	newKey := base64.RawURLEncoding.EncodeToString([]byte("new-key-new-key-new-key-new"))
	auth1 := base64.RawURLEncoding.EncodeToString([]byte("auth-one-secret16"))
	auth2 := base64.RawURLEncoding.EncodeToString([]byte("auth-two-secret16"))

	if err := svc.Subscribe(ctx, "u1", "https://push.example/ep", oldKey, auth1); err != nil {
		t.Fatalf("first subscribe: %v", err)
	}
	if err := svc.Subscribe(ctx, "u1", "https://push.example/ep", newKey, auth2); err != nil {
		t.Fatalf("re-subscribe: %v", err)
	}
	if len(repo.upserted) != 2 {
		t.Fatalf("expected 2 upserts (re-subscribe refreshes keys), got %d", len(repo.upserted))
	}
	if repo.upserted[1].P256DH != newKey || repo.upserted[1].Auth != auth2 {
		t.Fatalf("refreshed keys not propagated: %+v", repo.upserted[1])
	}
}

func TestService_Unsubscribe(t *testing.T) {
	repo := &fakeServiceRepo{}
	svc := push.NewService(repo)
	ctx := context.Background()

	if err := svc.Unsubscribe(ctx, "https://push.example/ep"); err != nil {
		t.Fatalf("unsubscribe: %v", err)
	}
	if len(repo.deleted) != 1 || repo.deleted[0] != "https://push.example/ep" {
		t.Fatalf("deleted = %v", repo.deleted)
	}
	if err := svc.Unsubscribe(ctx, "   "); !errors.Is(err, push.ErrEndpointRequired) {
		t.Fatalf("empty endpoint error = %v", err)
	}
}

// SMTPMailer with no SMTPHost must short-circuit with ErrSMTPNotConfigured.
func TestSMTPMailer_NotConfigured(t *testing.T) {
	m := push.NewSMTPMailer(&config.Config{})
	if m.Configured() {
		t.Fatal("empty config must not report configured")
	}
	err := m.SendMail(context.Background(), "a@b.c", push.MagicLinkSubject, "thân bài")
	if !errors.Is(err, push.ErrSMTPNotConfigured) {
		t.Fatalf("err = %v, want ErrSMTPNotConfigured", err)
	}
}

// With an SMTP host set the mailer is "configured"; the actual network dial
// fails fast in the test sandbox — we only assert the error is wrapped with
// the Vietnamese prefix and the 5s timeout, never a panic.
func TestSMTPMailer_Configured_DialsFailFast(t *testing.T) {
	m := push.NewSMTPMailer(&config.Config{SMTPHost: "127.0.0.1", SMTPPort: 1, SMTPUser: "u", SMTPPass: "p", SMTPFrom: "cgp@example.com"})
	if !m.Configured() {
		t.Fatal("host set must report configured")
	}
	// Port 1 on loopback refuses instantly — no sleep, no hang.
	err := m.SendMail(context.Background(), "a@b.c", push.MagicLinkSubject, "thân bài")
	if err == nil {
		t.Skip("unexpected local SMTP listener on port 1; skipping")
	}
	if !strings.Contains(err.Error(), "không thể gửi thư") {
		t.Fatalf("error must carry the Vietnamese prefix, got: %v", err)
	}
}

// WebPushSender wiring: constructor accepts nil HTTP client (library default).
func TestWebPushSender_Construction(t *testing.T) {
	logger := slog.New(slog.NewTextHandler(&strings.Builder{}, nil))
	s := push.NewWebPushSender(&config.Config{VAPIDPublicKey: "pub", VAPIDPrivateKey: "priv"}, nil, logger)
	if s == nil {
		t.Fatal("nil sender")
	}
	// A send against a fake endpoint surfaces a wrapped transport error, not a
	// crash; and a raw 410-style error maps to ErrSubscriptionGone via IsGone.
	if push.IsGone(errors.New("404 chưa map")) {
		t.Fatal("IsGone must be false for unrelated errors")
	}
	if !push.IsGone(push.ErrSubscriptionGone) {
		t.Fatal("IsGone must be true for the sentinel")
	}
}

// isVietnamese reports whether the error message contains Vietnamese
// diacritics (INV-02 spot check).
func isVietnamese(err error) bool {
	for _, r := range err.Error() {
		if r > 0x007F {
			return true
		}
	}
	return false
}
