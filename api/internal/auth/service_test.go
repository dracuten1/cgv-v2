package auth_test

import (
	"context"
	"strings"
	"testing"

	"github.com/dracuten1/cgv-v2/api/internal/config"
	"github.com/dracuten1/cgv-v2/api/internal/model"
)

// TestUnlinkIdentity_LastIdentity409_vs_OK enforces the ADR-007 single-tx
// unlink guard: count > 1 deletes; count == 1 → ErrLastIdentity (409).
func TestUnlinkIdentity_LastIdentity409_vs_OK(t *testing.T) {
	ctx := context.Background()

	t.Run("unlink_ok_with_two_identities", func(t *testing.T) {
		svc, core, _, _ := newHarness(false)
		uid := core.seedUser("Hai Định Danh", false)
		idGoogle := core.seedIdentity(uid, model.ProviderGoogle, "g-two")
		idZalo := core.seedIdentity(uid, model.ProviderZalo, "z-two")

		if err := svc.UnlinkIdentity(ctx, uid, idGoogle); err != nil {
			t.Fatalf("expected unlink success, got %v", err)
		}
		profile, _ := svc.CurrentUser(ctx, uid)
		if len(profile.Identities) != 1 || profile.Identities[0].ID != idZalo {
			t.Fatalf("expected only zalo identity to remain, got %+v", profile.Identities)
		}
	})

	t.Run("unlink_last_identity_returns_409_sentinel", func(t *testing.T) {
		svc, core, _, _ := newHarness(false)
		uid := core.seedUser("Một Định Danh", false)
		idOnly := core.seedIdentity(uid, model.ProviderGoogle, "g-only")

		err := svc.UnlinkIdentity(ctx, uid, idOnly)
		if err == nil {
			t.Fatal("expected ErrLastIdentity on unlinking the sole identity")
		}
		// The handler maps this to 409 LAST_IDENTITY_CANNOT_BE_REMOVED; the
		// sentinel must carry the exact Vietnamese message from the spec.
		if !strings.Contains(err.Error(), "Không thể hủy liên kết phương thức đăng nhập duy nhất") {
			t.Fatalf("expected spec Vietnamese message, got %v", err)
		}
		// The identity must NOT have been deleted.
		profile, _ := svc.CurrentUser(ctx, uid)
		if len(profile.Identities) != 1 {
			t.Fatalf("sole identity must survive, got %d", len(profile.Identities))
		}
	})

	t.Run("unlink_foreign_identity_rejected", func(t *testing.T) {
		svc, core, _, _ := newHarness(false)
		uidA := core.seedUser("A", false)
		core.seedIdentity(uidA, model.ProviderGoogle, "g-a")
		uidB := core.seedUser("B", false)
		core.seedIdentity(uidB, model.ProviderZalo, "z-b")
		idB := core.seedIdentity(uidB, model.ProviderFacebook, "f-b")

		if err := svc.UnlinkIdentity(ctx, uidA, idB); err == nil {
			t.Fatal("expected error unlinking another user's identity")
		}
	})
}

// TestStartDemoSession covers the idempotent demo flow (INV-04 / ADR-011).
func TestStartDemoSession(t *testing.T) {
	ctx := context.Background()
	svc, core, _, _ := newHarness(true)

	first, err := svc.StartDemoSession(ctx)
	if err != nil {
		t.Fatalf("StartDemoSession failed: %v", err)
	}
	if !first.User.IsDemo {
		t.Fatal("demo session user must be is_demo=true")
	}
	if first.User.DisplayName != "Người dùng dùng thử" {
		t.Fatalf("unexpected demo display name %q", first.User.DisplayName)
	}
	if first.CookieName != config.DemoCookieName {
		t.Fatalf("expected %s cookie, got %s", config.DemoCookieName, first.CookieName)
	}
	if !first.IsNew {
		t.Fatal("first call must create the demo user (IsNew=true)")
	}

	second, err := svc.StartDemoSession(ctx)
	if err != nil {
		t.Fatalf("second StartDemoSession failed: %v", err)
	}
	if second.IsNew {
		t.Fatal("second call must reuse the demo user (idempotent get-or-create)")
	}
	if second.User.ID != first.User.ID {
		t.Fatalf("expected same demo user %s, got %s", first.User.ID, second.User.ID)
	}
	// Exactly ONE demo identity exists (provider=demo, subject=demo-user).
	idents, _ := svc.CurrentUser(ctx, first.User.ID)
	if len(idents.Identities) != 1 ||
		idents.Identities[0].Provider != model.ProviderDemo ||
		idents.Identities[0].ProviderSubject != "demo-user" {
		t.Fatalf("expected single demo identity, got %+v", idents.Identities)
	}
	if len(core.locksTaken()) != 0 {
		t.Fatal("demo session must not take contact advisory locks")
	}
}

// TestMagicLink_ConsumeOnce enforces the atomic burn-on-read semantics.
func TestMagicLink_ConsumeOnce(t *testing.T) {
	ctx := context.Background()
	svc, core, outbox, _ := newHarness(false)

	if err := svc.SendMagicLink(ctx, "Thư@gmail.com ", "https://cgp.vn/auth/verify"); err != nil {
		t.Fatalf("SendMagicLink failed: %v", err)
	}
	events := outbox.snapshot()
	if len(events) != 1 {
		t.Fatalf("expected exactly one outbox event, got %d", len(events))
	}
	if events[0].Email != "thư@gmail.com" {
		t.Fatalf("expected normalized email in payload, got %q", events[0].Email)
	}
	if !strings.Contains(events[0].Link, "token=") {
		t.Fatalf("expected verify URL with raw token, got %q", events[0].Link)
	}

	// Recover the raw token from the outbox link (the only place it exists).
	link := events[0].Link
	idx := strings.Index(link, "token=")
	rawToken := link[idx+len("token="):]

	first, err := svc.VerifyMagicLink(ctx, rawToken)
	if err != nil {
		t.Fatalf("first Verify must win: %v", err)
	}
	if !first.IsNew {
		t.Fatal("first verify of a fresh email creates a brand-new user")
	}
	if first.User.DisplayName == "" {
		t.Fatal("expected a derived display name for the email user")
	}
	// The email contact is stored verified with via=email.
	profile, _ := svc.CurrentUser(ctx, first.User.ID)
	if len(profile.Contacts) != 1 || !profile.Contacts[0].Verified {
		t.Fatalf("magic-link email must be verified, got %+v", profile.Contacts)
	}

	// The token row in the store must now be consumed.
	core.mu.Lock()
	consumedRows := 0
	for _, row := range core.tokens {
		if row.consumedAt != nil {
			consumedRows++
		}
	}
	core.mu.Unlock()
	if consumedRows != 1 {
		t.Fatalf("expected 1 consumed token row, got %d", consumedRows)
	}

	// Second verify of the same link → ErrTokenUsedOrExpired.
	_, err = svc.VerifyMagicLink(ctx, rawToken)
	if err == nil {
		t.Fatal("second Verify must lose the race")
	}
	if !strings.Contains(err.Error(), "đã được sử dụng hoặc hết hạn") {
		t.Fatalf("expected consume-once Vietnamese error, got %v", err)
	}
}

// TestMagicLink_TokenHashedNotStored guards the ADR-009 invariant: only the
// sha256 hash is persisted, never the raw token.
func TestMagicLink_TokenHashedNotStored(t *testing.T) {
	svc, core, outbox, _ := newHarness(false)
	if err := svc.SendMagicLink(context.Background(), "hash@cgp.vn", ""); err != nil {
		t.Fatalf("SendMagicLink failed: %v", err)
	}
	raw := outbox.snapshot()[0].Link
	idx := strings.Index(raw, "token=")
	rawToken := raw[idx+len("token="):]

	core.mu.Lock()
	defer core.mu.Unlock()
	for hash := range core.tokens {
		if hash == rawToken {
			t.Fatal("raw token must NEVER be persisted — only its sha256 hash")
		}
		if len(hash) != 64 { // sha256 hex length
			t.Fatalf("stored token hash must be sha256 hex (64 chars), got %d", len(hash))
		}
	}
}

// TestService_LoginURL_ProviderDisabled covers ErrProviderDisabled.
func TestService_LoginURL_ProviderDisabled(t *testing.T) {
	svc, core, _, _ := newHarness(false)

	if _, err := svc.LoginURL(newDiscardWriter(), newRequestWithCookies(), model.ProviderGoogle); err == nil ||
		!strings.Contains(err.Error(), "chưa được cấu hình") {
		t.Fatalf("expected ErrProviderDisabled for unconfigured google, got %v", err)
	}
	if _, err := svc.LoginURL(newDiscardWriter(), newRequestWithCookies(), "myspace"); err == nil ||
		!strings.Contains(err.Error(), "không được hỗ trợ") {
		t.Fatalf("expected ErrUnknownProvider for myspace, got %v", err)
	}
	// Mock provider is enabled in test config → URL works.
	url, err := svc.LoginURL(newDiscardWriter(), newRequestWithCookies(), model.ProviderMock)
	if err != nil {
		t.Fatalf("mock LoginURL failed: %v", err)
	}
	if !strings.HasPrefix(url, "/api/v1/auth/mock/callback?state=") {
		t.Fatalf("unexpected mock auth URL %q", url)
	}
	if len(core.locksTaken()) != 0 {
		t.Fatal("LoginURL must not touch the DB lock surface")
	}
}
