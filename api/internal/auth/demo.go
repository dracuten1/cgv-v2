package auth

import (
	"context"
	"fmt"

	"github.com/dracuten1/cgv-v2/api/internal/model"
)

// Demo session constants (INV-04 / ADR-011).
const (
	// demoDisplayName is the fixed display name of the seeded demo account.
	demoDisplayName = "Người dùng dùng thử"
	// demoProviderSubject is the deterministic subject for the demo
	// identity: UNIQUE(provider='demo', provider_subject='demo-user').
	demoProviderSubject = "demo-user"
)

// StartDemoSession gets-or-creates the deterministic demo user (idempotent:
// same DB state ⇒ same user row), binds the demo identity
// (provider='demo', subject='demo-user') and issues a cgp-demo-issuer JWT
// bound to the cgp_demo_session cookie. Demo accounts are NEVER linkable —
// the resolver's demo guard enforces INV-04 on every path.
func (s *Service) StartDemoSession(ctx context.Context) (*AuthResult, error) {
	var result *AuthResult
	err := s.tx.WithTx(ctx, func(txCtx context.Context) error {
		// Idempotent: look up the demo identity first.
		identity, err := s.identities.FindByProviderSubject(txCtx, model.ProviderDemo, demoProviderSubject)
		if err != nil && !isNotFoundErr(err) {
			return fmt.Errorf("không thể tra cứu định danh dùng thử: %w", err)
		}

		var user *modelUser
		if identity != nil {
			user, err = s.users.GetByID(txCtx, identity.UserID)
			if err != nil {
				return fmt.Errorf("không thể truy vấn tài khoản dùng thử: %w", err)
			}
			// INV-04 hard guard: an existing demo identity MUST point at a
			// demo user; anything else is corruption → abort.
			if !user.IsDemo {
				return ErrDemoIsolation
			}
			if err := s.identities.TouchLastLogin(txCtx, identity.ID); err != nil {
				return fmt.Errorf("không thể cập nhật thời gian đăng nhập dùng thử: %w", err)
			}
		} else {
			user, err = s.users.Create(txCtx, demoDisplayName, true)
			if err != nil {
				return fmt.Errorf("không thể tạo tài khoản dùng thử: %w", err)
			}
			if _, err := s.identities.Insert(txCtx, user.ID, model.ProviderDemo, demoProviderSubject); err != nil {
				return fmt.Errorf("không thể tạo định danh dùng thử: %w", err)
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
			IsNew:      identity == nil,
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return result, nil
}
