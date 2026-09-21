// Package model defines the CGP v2 domain structs, enums and API DTOs.
// Models are driver-free (D2): no pgx imports — IDs are plain strings so any
// layer (or a future transport) can carry them.
package model

import "time"

// OAuth provider identifiers stored in user_identities.provider.
// The CHECK constraint (migration 001) mirrors this exact list.
const (
	ProviderZalo     = "zalo"
	ProviderGoogle   = "google"
	ProviderFacebook = "facebook"
	ProviderEmail    = "email"
	ProviderDemo     = "demo"
	ProviderMock     = "mock" // offline mock provider (dev + E2E); deviation from PROMPT.md DDL, documented in 001
)

// Contact point kinds (contact_points.kind CHECK constraint).
const (
	ContactKindEmail = "email"
	ContactKindPhone = "phone"
)

// User is a row of the users table — an account that can hold multiple
// provider identities and contact points.
type User struct {
	ID          string    `json:"id"`
	DisplayName string    `json:"display_name"`
	IsDemo      bool      `json:"is_demo"`
	MemberID    *string   `json:"member_id,omitempty"` // optional 1:1 link to a family tree member
	CreatedAt   time.Time `json:"created_at"`
}

// Identity is one external login provider bound to a User
// (user_identities table). UNIQUE(provider, provider_subject).
type Identity struct {
	ID              string    `json:"id"`
	UserID          string    `json:"user_id"`
	Provider        string    `json:"provider"` // one of the Provider* constants
	ProviderSubject string    `json:"provider_subject"`
	LinkedAt        time.Time `json:"linked_at"`
	LastLoginAt     time.Time `json:"last_login_at"`
}

// ContactPoint is a verified-or-pending email/phone attached to a User
// (contact_points table). UNIQUE(kind, value).
type ContactPoint struct {
	ID          string    `json:"id"`
	UserID      string    `json:"user_id"`
	Kind        string    `json:"kind"` // ContactKindEmail | ContactKindPhone
	Value       string    `json:"value"`
	Verified    bool      `json:"verified"`
	VerifiedVia *string   `json:"verified_via,omitempty"` // 'zalo' | 'google' | 'magic_link' | …
	CreatedAt   time.Time `json:"created_at"`
}

// Session is one issued JWT session (sessions table), revocable by jti.
type Session struct {
	ID        string     `json:"id"`
	UserID    string     `json:"user_id"`
	JTI       string     `json:"jti"`
	CreatedAt time.Time  `json:"created_at"`
	ExpiresAt time.Time  `json:"expires_at"`
	RevokedAt *time.Time `json:"revoked_at,omitempty"`
}
