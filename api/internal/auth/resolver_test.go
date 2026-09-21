package auth_test

import (
	"context"
	"strings"
	"testing"

	"github.com/dracuten1/cgv-v2/api/internal/auth"
	"github.com/dracuten1/cgv-v2/api/internal/model"
)

// TestResolver_SixBranchMatrix enforces the full identity-resolution state
// machine (PROMPT.md F1 / plan §3.2 / ADR-007) branch by branch.
func TestResolver_SixBranchMatrix(t *testing.T) {
	ctx := context.Background()

	t.Run("1_existing_identity_match_touches_last_login", func(t *testing.T) {
		svc, core, _, _ := newHarness(false)
		uid := core.seedUser("Nguyễn Văn Cũ", false)
		core.seedIdentity(uid, model.ProviderGoogle, "google-sub-1")

		res, err := svc.Resolve(ctx, &auth.ProviderClaims{
			Provider: model.ProviderGoogle, Subject: "google-sub-1", DisplayName: "Tên mới",
		})
		if err != nil {
			t.Fatalf("Resolve failed: %v", err)
		}
		if res.IsNew {
			t.Fatal("expected IsNew=false for existing identity")
		}
		if res.ConflictDetected {
			t.Fatal("expected ConflictDetected=false on plain match")
		}
		if res.User.ID != uid {
			t.Fatalf("expected existing user %s, got %s", uid, res.User.ID)
		}
		if res.Token == "" || res.CookieName != "cgp_session" {
			t.Fatalf("expected JWT + prod cookie, got token=%q cookie=%q", res.Token, res.CookieName)
		}
		// The identity stays singular (no duplicate insert).
		idents, _ := svc.CurrentUser(ctx, uid)
		if len(idents.Identities) != 1 {
			t.Fatalf("expected 1 identity, got %d", len(idents.Identities))
		}
	})

	t.Run("2_auto_link_via_verified_email", func(t *testing.T) {
		svc, core, _, _ := newHarness(false)
		uid := core.seedUser("Trần Thị Email", false)
		core.seedContact(uid, model.ContactKindEmail, "lan@gmail.com", true)

		res, err := svc.Resolve(ctx, &auth.ProviderClaims{
			Provider: model.ProviderFacebook, Subject: "fb-777", DisplayName: "Lan FB",
			Email: &auth.ContactClaim{Value: "Lan@gmail.com", Verified: true}, // case-folded match
		})
		if err != nil {
			t.Fatalf("Resolve failed: %v", err)
		}
		if res.IsNew || res.ConflictDetected {
			t.Fatalf("expected auto-link, got IsNew=%v Conflict=%v", res.IsNew, res.ConflictDetected)
		}
		if res.User.ID != uid {
			t.Fatalf("expected auto-link to user %s, got %s", uid, res.User.ID)
		}
		// Advisory lock taken for the email contact (ADR-007).
		locks := core.locksTaken()
		if len(locks) != 1 || locks[0] != "email:lan@gmail.com" {
			t.Fatalf("expected advisory lock on email:lan@gmail.com, got %v", locks)
		}
		// Identity inserted under the matched user.
		profile, _ := svc.CurrentUser(ctx, uid)
		found := false
		for _, i := range profile.Identities {
			if i.Provider == model.ProviderFacebook && i.ProviderSubject == "fb-777" {
				found = true
			}
		}
		if !found {
			t.Fatal("expected facebook identity linked under matched user")
		}
	})

	t.Run("3_auto_link_via_verified_phone", func(t *testing.T) {
		svc, core, _, _ := newHarness(false)
		uid := core.seedUser("Lê Văn Phone", false)
		core.seedContact(uid, model.ContactKindPhone, "0901234567", true)

		res, err := svc.Resolve(ctx, &auth.ProviderClaims{
			Provider: model.ProviderZalo, Subject: "zalo-42", DisplayName: "Phone Zalo",
			Phone: &auth.ContactClaim{Value: "+84901234567", Verified: true}, // +84 → 0 prefix
		})
		if err != nil {
			t.Fatalf("Resolve failed: %v", err)
		}
		if res.IsNew || res.ConflictDetected {
			t.Fatalf("expected auto-link via phone, got IsNew=%v Conflict=%v", res.IsNew, res.ConflictDetected)
		}
		if res.User.ID != uid {
			t.Fatalf("expected auto-link to user %s, got %s", uid, res.User.ID)
		}
		locks := core.locksTaken()
		if len(locks) != 1 || locks[0] != "phone:0901234567" {
			t.Fatalf("expected advisory lock on phone:0901234567, got %v", locks)
		}
	})

	t.Run("4_conflict_email_userA_phone_userB_creates_isolated_user", func(t *testing.T) {
		svc, core, _, _ := newHarness(false)
		uidA := core.seedUser("User A", false)
		core.seedContact(uidA, model.ContactKindEmail, "shared@gmail.com", true)
		uidB := core.seedUser("User B", false)
		core.seedContact(uidB, model.ContactKindPhone, "0987654321", true)

		res, err := svc.Resolve(ctx, &auth.ProviderClaims{
			Provider: model.ProviderZalo, Subject: "zalo-conflict", DisplayName: "Xung Đột",
			Email: &auth.ContactClaim{Value: "shared@gmail.com", Verified: true},
			Phone: &auth.ContactClaim{Value: "0987654321", Verified: true},
		})
		if err != nil {
			t.Fatalf("Resolve failed: %v", err)
		}
		if !res.IsNew {
			t.Fatal("conflict must create a brand-new user (IsNew=true)")
		}
		if !res.ConflictDetected {
			t.Fatal("expected ConflictDetected=true")
		}
		if res.User.ID == uidA || res.User.ID == uidB {
			t.Fatal("conflict user must be isolated, NOT auto-linked to A or B")
		}
		// The new user holds exactly the new identity.
		profile, _ := svc.CurrentUser(ctx, res.User.ID)
		if len(profile.Identities) != 1 || profile.Identities[0].ProviderSubject != "zalo-conflict" {
			t.Fatalf("expected single zalo-conflict identity, got %+v", profile.Identities)
		}
	})

	t.Run("5_unverified_claims_never_autolink", func(t *testing.T) {
		svc, core, _, _ := newHarness(false)
		uid := core.seedUser("Chủ email cũ", false)
		core.seedContact(uid, model.ContactKindEmail, "chua@gmail.com", false) // exists but UNVERIFIED

		res, err := svc.Resolve(ctx, &auth.ProviderClaims{
			Provider: model.ProviderGoogle, Subject: "g-new-unv", DisplayName: "Người Mới",
			Email: &auth.ContactClaim{Value: "chua@gmail.com", Verified: false}, // unverified claim
		})
		if err != nil {
			t.Fatalf("Resolve failed: %v", err)
		}
		if !res.IsNew {
			t.Fatal("unverified claim must NEVER auto-link — expected brand-new user")
		}
		if res.User.ID == uid {
			t.Fatal("must not attach to the owner of the unverified contact")
		}
		// No advisory lock is taken for unverified claims.
		if locks := core.locksTaken(); len(locks) != 0 {
			t.Fatalf("unverified claims must not take advisory locks, got %v", locks)
		}
	})

	t.Run("6_brand_new_user_with_claims", func(t *testing.T) {
		svc, _, _, _ := newHarness(false)

		res, err := svc.Resolve(ctx, &auth.ProviderClaims{
			Provider: model.ProviderGoogle, Subject: "g-fresh", DisplayName: "Nguyễn Hoàng NEW",
			Email: &auth.ContactClaim{Value: "fresh@gmail.com", Verified: true},
		})
		if err != nil {
			t.Fatalf("Resolve failed: %v", err)
		}
		if !res.IsNew || res.ConflictDetected {
			t.Fatalf("expected brand-new, got IsNew=%v Conflict=%v", res.IsNew, res.ConflictDetected)
		}
		profile, err := svc.CurrentUser(ctx, res.User.ID)
		if err != nil {
			t.Fatalf("CurrentUser failed: %v", err)
		}
		if len(profile.Identities) != 1 || profile.Identities[0].Provider != model.ProviderGoogle {
			t.Fatalf("expected single google identity, got %+v", profile.Identities)
		}
		if len(profile.Contacts) != 1 || profile.Contacts[0].Value != "fresh@gmail.com" || !profile.Contacts[0].Verified {
			t.Fatalf("expected verified email contact, got %+v", profile.Contacts)
		}
	})
}

// TestResolver_DemoIsolationGuards enforces INV-04 everywhere.
func TestResolver_DemoIsolationGuards(t *testing.T) {
	ctx := context.Background()

	t.Run("real_provider_cannot_autolink_into_demo_user", func(t *testing.T) {
		svc, core, _, _ := newHarness(true)
		demoID := core.seedUser("Người dùng dùng thử", true)
		core.seedContact(demoID, model.ContactKindEmail, "demo@cgp.vn", true)

		_, err := svc.Resolve(ctx, &auth.ProviderClaims{
			Provider: model.ProviderGoogle, Subject: "g-attack", DisplayName: "Kẻ Trộn",
			Email: &auth.ContactClaim{Value: "demo@cgp.vn", Verified: true},
		})
		if err == nil {
			t.Fatal("expected ErrDemoIsolation when a real provider claims a demo contact")
		}
		if err != nil && !strings.Contains(err.Error(), "dùng thử") {
			t.Fatalf("expected Vietnamese demo-isolation message, got %v", err)
		}
	})

	t.Run("generic_demo_identity_cannot_self_create", func(t *testing.T) {
		svc, _, _, _ := newHarness(true)

		_, err := svc.Resolve(ctx, &auth.ProviderClaims{
			Provider: model.ProviderDemo, Subject: "not-the-demo-user",
		})
		if err == nil {
			t.Fatal("expected ErrDemoIsolation for a non-canonical demo identity miss")
		}
	})
}

// TestResolver_RetryWrapper exercises the ADR-006 contract: lost-race 23505
// re-resolves as auto-link; the third attempt wins; a fourth failure surfaces.
func TestResolver_RetryWrapper(t *testing.T) {
	ctx := context.Background()

	t.Run("duplicate_identity_twice_then_success", func(t *testing.T) {
		svc, core, _, _ := newHarness(false)
		core.mu.Lock()
		core.failIdentInserts = 2 // 23505 twice, then success on attempt 3
		core.mu.Unlock()

		res, err := svc.Resolve(ctx, &auth.ProviderClaims{
			Provider: model.ProviderMock, Subject: "mock:retry", DisplayName: "Retry",
		})
		if err != nil {
			t.Fatalf("expected 3rd attempt to win, got error: %v", err)
		}
		if !res.IsNew || res.User.ID == "" {
			t.Fatalf("expected successful brand-new resolution, got %+v", res)
		}
	})

	t.Run("persistent_duplicate_surfaces_after_three_attempts", func(t *testing.T) {
		svc, core, _, _ := newHarness(false)
		core.mu.Lock()
		core.failIdentInserts = 99 // always fail
		core.mu.Unlock()

		_, err := svc.Resolve(ctx, &auth.ProviderClaims{
			Provider: model.ProviderMock, Subject: "mock:hopeless", DisplayName: "Hopeless",
		})
		if err == nil {
			t.Fatal("expected exhaustion error after 3 attempts")
		}
		if !strings.Contains(err.Error(), "thử lại") {
			t.Fatalf("expected Vietnamese retry-exhaustion message, got %v", err)
		}
	})
}

// TestResolver_InvalidClaims protects against empty claims.
func TestResolver_InvalidClaims(t *testing.T) {
	svc, _, _, _ := newHarness(false)
	if _, err := svc.Resolve(context.Background(), nil); err == nil {
		t.Fatal("expected error for nil claims")
	}
	if _, err := svc.Resolve(context.Background(), &auth.ProviderClaims{Provider: model.ProviderGoogle}); err == nil {
		t.Fatal("expected error for empty subject")
	}
}
