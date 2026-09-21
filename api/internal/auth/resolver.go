package auth

import (
	"context"
	"crypto/rand"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/model"
)

// modelUser alias to shorten signatures inside internal/auth.
type modelUser = model.User

// Resolve executes the identity-resolution state machine (PROMPT.md F1,
// plan §3.2, ADR-007) under the ADR-006 retry contract:
// 3 attempts, 50ms·2ⁿ ± jitter on retryable concurrency failures
// (SQLSTATE 40001 serialization_failure, 40P01 deadlock_detected, and the
// lost-race 23505 unique_violation which re-resolves as an auto-link).
// Business errors (23503 FK, demo isolation, 409s) are fatal — no retry.
//
// Resolution branches (single attempt, resolveOnce):
//
//	Step 1: FindByProviderSubject(claims.Provider, claims.Subject)
//	        Hit  → TouchLastLogin, issue JWT, return (IsNew=false, Conflict=false).
//
//	Step 2: Miss → examine verified contact claims (verified claims ONLY;
//	        unverified claims NEVER auto-link).
//	        - AcquireContactAdvisoryLock(kind, value) for each verified claim.
//	        - Lookup contact_points by (kind, value).
//	        - If email matches User A and phone matches User B:
//	          → CONFLICT: create brand-new isolated user + identity,
//	            ConflictDetected=true, NO auto-link.
//	        - If exactly one existing user is matched (or both claims match
//	          the SAME user):
//	          → AUTO-LINK: insert identity under that user, confirm/mark
//	            contact verified, insert newly-seen verified contacts, JWT.
//	        - If no verified match (or only unverified claims):
//	          → BRAND-NEW: create user, contact points, identity (IsNew=true).
//
//	Step 3: Invariant guards:
//	        - Demo isolation (INV-04): demo identities bind only to demo
//	          users; any demo/real mix aborts with ErrDemoIsolation.
//	        - Generic demo identities cannot self-create (use
//	          StartDemoSession) → ErrDemoIsolation on miss.
func (s *Service) Resolve(ctx context.Context, claims *ProviderClaims) (*AuthResult, error) {
	if claims == nil || claims.Provider == "" || claims.Subject == "" {
		return nil, fmt.Errorf("%w: thiếu thông tin định danh nhà cung cấp", ErrProviderExchange)
	}
	const maxAttempts = 3
	var lastErr error
	for attempt := 0; attempt < maxAttempts; attempt++ {
		res, err := s.resolveOnce(ctx, claims)
		if err == nil {
			return res, nil
		}
		lastErr = err
		if !isRetryableAuthError(err) {
			return nil, err
		}
		if attempt == maxAttempts-1 {
			break
		}
		// 50ms · 2^attempt ± jitter (ADR-006).
		base := 50 * (1 << attempt)
		delay := time.Duration(base+randJitter(25)) * time.Millisecond
		select {
		case <-ctx.Done():
			return nil, ctx.Err()
		case <-time.After(delay):
		}
	}
	return nil, fmt.Errorf("quá số lần thử lại giải quyết định danh (%d lần): %w", maxAttempts, lastErr)
}

// resolveOnce runs one full resolution attempt inside a single transaction.
func (s *Service) resolveOnce(ctx context.Context, claims *ProviderClaims) (*AuthResult, error) {
	if claims == nil || claims.Provider == "" || claims.Subject == "" {
		return nil, fmt.Errorf("%w: thiếu thông tin định danh nhà cung cấp", ErrProviderExchange)
	}

	var result *AuthResult
	err := s.tx.WithTx(ctx, func(txCtx context.Context) error {
		// -------------------------------------------------------------
		// Step 1: Existing identity hit?
		// -------------------------------------------------------------
		existingIdentity, err := s.identities.FindByProviderSubject(txCtx, claims.Provider, claims.Subject)
		if err != nil && !isNotFoundErr(err) {
			return fmt.Errorf("không thể tra cứu định danh: %w", err)
		}

		if existingIdentity != nil {
			user, err := s.users.GetByID(txCtx, existingIdentity.UserID)
			if err != nil {
				return fmt.Errorf("không thể truy vấn tài khoản người dùng: %w", err)
			}
			// INV-04 guard: demo identities must point to demo users only.
			if (claims.Provider == model.ProviderDemo) != user.IsDemo {
				return ErrDemoIsolation
			}
			if err := s.identities.TouchLastLogin(txCtx, existingIdentity.ID); err != nil {
				return fmt.Errorf("không thể cập nhật thời gian đăng nhập: %w", err)
			}
			token, err := s.IssueToken(*user)
			if err != nil {
				return err
			}
			result = &AuthResult{
				User:       *user,
				Token:      token,
				CookieName: s.cfg.CookieName,
				IsNew:      false,
			}
			return nil
		}

		// Demo identity miss: demo accounts cannot be dynamically created
		// through the generic resolver (must use StartDemoSession).
		if claims.Provider == model.ProviderDemo {
			return ErrDemoIsolation
		}

		// -------------------------------------------------------------
		// Step 2: Miss — serialize on verified contact points and resolve.
		// -------------------------------------------------------------
		type claimSpec struct {
			claim *ContactClaim
			kind  string
		}
		// Only VERIFIED claims participate; unverified claims NEVER lock and
		// NEVER match (security rule, PROMPT.md F1 §3).
		candidateClaims := make([]claimSpec, 0, 2)
		if claims.Email != nil && claims.Email.Verified && claims.Email.Value != "" {
			candidateClaims = append(candidateClaims, claimSpec{claim: claims.Email, kind: model.ContactKindEmail})
		}
		if claims.Phone != nil && claims.Phone.Verified && claims.Phone.Value != "" {
			candidateClaims = append(candidateClaims, claimSpec{claim: claims.Phone, kind: model.ContactKindPhone})
		}

		type matchedContact struct {
			kind  string
			point *model.ContactPoint
		}
		var verifiedMatches []matchedContact

		for _, cc := range candidateClaims {
			cleanVal := NormalizeContact(cc.kind, cc.claim.Value)
			// ADR-007 first-login serialization: advisory xact lock on
			// hashtext(kind:value) before reading contact_points.
			if err := s.locker.AcquireContactAdvisoryLock(txCtx, cc.kind, cleanVal); err != nil {
				return fmt.Errorf("không thể khóa điểm liên hệ để xử lý: %w", err)
			}
			cp, err := s.contacts.FindByKindValue(txCtx, cc.kind, cleanVal)
			if err != nil && !isNotFoundErr(err) {
				return fmt.Errorf("không thể tra cứu điểm liên hệ: %w", err)
			}
			if cp != nil {
				verifiedMatches = append(verifiedMatches, matchedContact{kind: cc.kind, point: cp})
			}
		}

		// Case 2a: Two verified claims match DIFFERENT users → CONFLICT.
		if len(verifiedMatches) >= 2 && verifiedMatches[0].point.UserID != verifiedMatches[1].point.UserID {
			// Create an isolated new user + identity; flag ConflictDetected;
			// NO auto-link in either direction (plan §3.2).
			newUser, err := s.users.Create(txCtx, claims.DisplayName, false)
			if err != nil {
				return fmt.Errorf("không thể tạo tài khoản mới khi phát hiện xung đột: %w", err)
			}
			if _, err := s.identities.Insert(txCtx, newUser.ID, claims.Provider, claims.Subject); err != nil {
				return fmt.Errorf("không thể gắn định danh vào tài khoản mới: %w", err)
			}
			token, err := s.IssueToken(*newUser)
			if err != nil {
				return err
			}
			result = &AuthResult{
				User:             *newUser,
				Token:            token,
				CookieName:       s.cfg.CookieName,
				IsNew:            true,
				ConflictDetected: true,
			}
			return nil
		}

		// Case 2b: Exactly one matching user (one claim matched, or both
		// matched the SAME user) → AUTO-LINK.
		if len(verifiedMatches) > 0 {
			targetUserID := verifiedMatches[0].point.UserID
			user, err := s.users.GetByID(txCtx, targetUserID)
			if err != nil {
				return fmt.Errorf("không thể tìm thấy tài khoản cần liên kết: %w", err)
			}
			// INV-04 guard: real providers can NEVER auto-link into a demo user.
			if user.IsDemo {
				return ErrDemoIsolation
			}
			if _, err := s.identities.Insert(txCtx, user.ID, claims.Provider, claims.Subject); err != nil {
				return fmt.Errorf("không thể liên kết định danh: %w", err)
			}
			// Confirm verification of matched-but-unverified contacts.
			for _, m := range verifiedMatches {
				if !m.point.Verified {
					if err := s.contacts.MarkVerified(txCtx, m.point.ID, claims.Provider); err != nil {
						return fmt.Errorf("không thể cập nhật xác thực điểm liên hệ: %w", err)
					}
				}
			}
			// Persist newly-seen verified claims not yet in contact_points.
			for _, cc := range candidateClaims {
				alreadyPresent := false
				for _, m := range verifiedMatches {
					if m.kind == cc.kind {
						alreadyPresent = true
						break
					}
				}
				if !alreadyPresent {
					cleanVal := NormalizeContact(cc.kind, cc.claim.Value)
					if _, err := s.contacts.Insert(txCtx, user.ID, cc.kind, cleanVal, true, claims.Provider); err != nil {
						return fmt.Errorf("không thể thêm điểm liên hệ mới đã xác thực: %w", err)
					}
				}
			}
			token, err := s.IssueToken(*user)
			if err != nil {
				return err
			}
			result = &AuthResult{
				User:       *user,
				Token:      token,
				CookieName: s.cfg.CookieName,
				IsNew:      false,
			}
			return nil
		}

		// Case 2c: No verified match (or only unverified claims) → BRAND-NEW.
		newUser, err := s.users.Create(txCtx, claims.DisplayName, false)
		if err != nil {
			return fmt.Errorf("không thể tạo tài khoản người dùng: %w", err)
		}
		if _, err := s.identities.Insert(txCtx, newUser.ID, claims.Provider, claims.Subject); err != nil {
			return fmt.Errorf("không thể liên kết định danh cho tài khoản mới: %w", err)
		}
		// Record contact claims (verified and unverified alike).
		if claims.Email != nil && claims.Email.Value != "" {
			via := ""
			if claims.Email.Verified {
				via = claims.Provider
			}
			if _, err := s.contacts.Insert(txCtx, newUser.ID, model.ContactKindEmail, NormalizeContact(model.ContactKindEmail, claims.Email.Value), claims.Email.Verified, via); err != nil {
				return fmt.Errorf("không thể lưu email của người dùng: %w", err)
			}
		}
		if claims.Phone != nil && claims.Phone.Value != "" {
			via := ""
			if claims.Phone.Verified {
				via = claims.Provider
			}
			if _, err := s.contacts.Insert(txCtx, newUser.ID, model.ContactKindPhone, NormalizePhone(claims.Phone.Value), claims.Phone.Verified, via); err != nil {
				return fmt.Errorf("không thể lưu số điện thoại của người dùng: %w", err)
			}
		}

		token, err := s.IssueToken(*newUser)
		if err != nil {
			return err
		}
		result = &AuthResult{
			User:       *newUser,
			Token:      token,
			CookieName: s.cfg.CookieName,
			IsNew:      true,
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}

// isRetryableAuthError detects concurrency-level transient failures per
// ADR-006 without importing pgx: pgx wraps *pgconn.PgError whose message
// embeds the SQLSTATE; the repo sentinel message also carries 23505.
func isRetryableAuthError(err error) bool {
	if err == nil {
		return false
	}
	msg := err.Error()
	return strings.Contains(msg, "40001") || // serialization_failure
		strings.Contains(msg, "40P01") || // deadlock_detected
		strings.Contains(msg, "23505") || // unique_violation (lost race)
		errors.Is(err, ErrDuplicateIdentity)
}

// randJitter returns a random integer in [0, maxMs).
func randJitter(maxMs int) int {
	if maxMs <= 0 {
		return 0
	}
	n, err := rand.Int(rand.Reader, big.NewInt(int64(maxMs)))
	if err != nil {
		return 0
	}
	return int(n.Int64())
}

// isNotFoundErr tests for the canonical repository not-found sentinel
// (authrepo.ErrNotFound aliases auth.ErrRepoNotFound, so errors.Is works
// across the boundary without importing pgx or the repo package here).
func isNotFoundErr(err error) bool {
	return errors.Is(err, ErrRepoNotFound)
}
