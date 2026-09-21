// Package auth implements the CGP v2 multi-provider authentication domain:
// JWT issuing/verification, OAuth state+PKCE machinery, provider adapters
// (Zalo, Google, Facebook, offline mock), email magic links, isolated demo
// sessions, and the identity-resolution state machine (PROMPT.md F1).
//
// Transport-free by design (D2/depguard): no gin and no pgx imports here.
// The handler layer (later cycle) wraps Service in Gin middleware; the
// concrete repositories (internal/repository/auth) satisfy the ports
// declared in ports.go. Per INV-01 every provider call is direct provider
// HTTP (no paid SaaS); per INV-02 all user-facing errors carry Vietnamese
// messages.
package auth

import (
	"github.com/dracuten1/cgv-v2/api/internal/model"
)

// ProviderClaims is the normalized identity claim a provider adapter returns
// after a successful code exchange. It is transport-shaped data only — the
// resolver decides what it becomes in the database.
type ProviderClaims struct {
	Provider    string // one of model.Provider* constants
	Subject     string // stable provider-side identifier (sub / id / mock:<code>)
	DisplayName string // best-effort profile name; may be empty
	Email       *ContactClaim
	Phone       *ContactClaim
}

// ContactClaim is one contact point asserted by a provider. Verified mirrors
// what the provider actually proved (e.g. Zalo phone_verified, Google
// email_verified) — the resolver NEVER auto-links on Verified=false.
type ContactClaim struct {
	Value    string
	Verified bool
}

// AuthResult is the outcome of one callback resolution, handed to the
// handler to set the cookie and shape the response.
type AuthResult struct {
	User       model.User
	Token      string // signed JWT; handler sets it as the session cookie
	CookieName string // config.CookieName (cgp_session | cgp_demo_session)
	IsNew      bool   // true when a brand-new users row was created
	// ConflictDetected is true when verified email→user A but verified
	// phone→user B (plan §3.2): a fresh isolated account was created and the
	// UI must prompt a manual merge; NO auto-link happened.
	ConflictDetected bool
	IsLinked         bool             // true when callback completed account linking
	Identities       []model.Identity // identities of user after linking
}

// UserProfile is the GET /api/v1/me payload: the account plus every linked
// identity and contact point.
type UserProfile struct {
	User       model.User
	Identities []model.Identity
	Contacts   []model.ContactPoint
}
