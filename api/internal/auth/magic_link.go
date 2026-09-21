package auth

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/model"
)

// Magic link parameters (ADR-009/spec F1).
const (
	// magicLinkTokenBytes — 32 random bytes ⇒ 43-char URL-safe base64 token.
	magicLinkTokenBytes = 32
	// magicLinkTTL is the single-use token lifetime (15 minutes).
	magicLinkTTL = 15 * time.Minute
)

// hashMagicToken computes sha256(rawToken) as lowercase hex — ONLY this
// hash is ever persisted to magic_link_tokens (ADR-009).
func hashMagicToken(rawToken string) string {
	sum := sha256.Sum256([]byte(rawToken))
	return hex.EncodeToString(sum[:])
}

// SendMagicLink issues a single-use token, persists its sha256 hash with a
// 15-minute expiry, and writes a magic_link.send transactional outbox row
// inside the same transaction (ADR-009). The external SMTP send NEVER runs
// inside this transaction — the social-domain worker drains the outbox row
// post-commit (D10).
func (s *Service) SendMagicLink(ctx context.Context, email, verifyBaseURL string) error {
	cleanEmail := NormalizeContact(model.ContactKindEmail, email)
	if cleanEmail == "" || !strings.Contains(cleanEmail, "@") {
		return fmt.Errorf("%w: địa chỉ email không hợp lệ", ErrInvalidToken)
	}

	rawToken, err := randomToken(magicLinkTokenBytes)
	if err != nil {
		return err
	}
	tokenHash := hashMagicToken(rawToken)
	expiresAt := time.Now().Add(magicLinkTTL)

	// Build the full verify URL carrying the raw token.
	verifyURL := buildVerifyURL(verifyBaseURL, rawToken)

	// Transactional outbox pattern: persist the token hash and enqueue the
	// outbox event in ONE atomic transaction so we never send emails for
	// uncommitted tokens (ADR-009/D10).
	return s.tx.WithTx(ctx, func(txCtx context.Context) error {
		if err := s.tokens.Insert(txCtx, tokenHash, cleanEmail, expiresAt); err != nil {
			return fmt.Errorf("không thể lưu mã liên kết đăng nhập: %w", err)
		}
		if err := s.outbox.EnqueueMagicLink(txCtx, cleanEmail, verifyURL); err != nil {
			return fmt.Errorf("không thể ghi sự kiện gửi liên kết đăng nhập: %w", err)
		}
		return nil
	})
}

// VerifyMagicLink burns the token atomically and runs the identity-resolution
// state machine under provider="email" and subject=cleanEmail. If two
// requests race with the same token, exactly one burns it; the loser gets
// ErrTokenUsedOrExpired (→ 401 "Liên kết đã được sử dụng hoặc hết hạn").
func (s *Service) VerifyMagicLink(ctx context.Context, rawToken string) (*AuthResult, error) {
	rawToken = strings.TrimSpace(rawToken)
	if rawToken == "" {
		return nil, ErrTokenUsedOrExpired
	}
	tokenHash := hashMagicToken(rawToken)

	// Atomic burn: UPDATE magic_link_tokens SET consumed_at = NOW() WHERE
	// token_hash = $1 AND consumed_at IS NULL AND expires_at > NOW()
	// RETURNING email (ADR-007).
	email, err := s.tokens.Consume(ctx, tokenHash)
	if err != nil {
		if errors.Is(err, ErrTokenUsedOrExpired) {
			return nil, ErrTokenUsedOrExpired
		}
		return nil, fmt.Errorf("không thể tiêu thụ mã đăng nhập: %w", err)
	}

	claims := &ProviderClaims{
		Provider:    model.ProviderEmail,
		Subject:     email,
		DisplayName: mockDisplayName(email),
		Email: &ContactClaim{
			Value:    email,
			Verified: true, // magic link is self-verifying for its email
		},
	}
	return s.Resolve(ctx, claims)
}

// buildVerifyURL constructs the destination route:
// `<base>?token=<rawToken>`. When verifyBaseURL is empty, defaults to the
// standard frontend route.
func buildVerifyURL(base, rawToken string) string {
	b := strings.TrimSpace(base)
	if b == "" {
		b = "/auth/verify"
	}
	sep := "?"
	if strings.Contains(b, "?") {
		sep = "&"
	}
	return b + sep + url.Values{"token": {rawToken}}.Encode()
}
