package model

import "time"

// MagicLinkToken is one single-use email login token (magic_link_tokens table,
// ADR-009). Only the sha256 hash of the raw token is ever stored; the row is
// consumed atomically:
//
//	UPDATE magic_link_tokens SET consumed_at = NOW()
//	WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > NOW()
//	RETURNING email
type MagicLinkToken struct {
	TokenHash  string     `json:"token_hash"` // sha256(crypto/rand token) — never the raw token
	Email      string     `json:"email"`
	ExpiresAt  time.Time  `json:"expires_at"`
	ConsumedAt *time.Time `json:"consumed_at,omitempty"`
	CreatedAt  time.Time  `json:"created_at"`
}

// IsConsumed reports whether the token has already been used.
func (t MagicLinkToken) IsConsumed() bool {
	return t.ConsumedAt != nil
}

// IsExpiredAt reports whether the token is expired at the given instant.
func (t MagicLinkToken) IsExpiredAt(now time.Time) bool {
	return !now.Before(t.ExpiresAt)
}
