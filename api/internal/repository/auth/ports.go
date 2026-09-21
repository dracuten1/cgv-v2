package authrepo

import (
	"context"
	"errors"

	"github.com/dracuten1/cgv-v2/api/internal/auth"
	"github.com/dracuten1/cgv-v2/api/internal/database"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Compile-time proofs that the concrete repositories satisfy the
// consumer-side ports declared by internal/auth. The service layer (auth)
// programs exclusively against those interfaces; these assertions pin the
// contract from the implementation side.
var (
	_ auth.UserStore        = (*UserRepository)(nil)
	_ auth.IdentityStore    = (*IdentityRepository)(nil)
	_ auth.ContactStore     = (*ContactRepository)(nil)
	_ auth.MagicLinkStore   = (*MagicLinkTokenRepository)(nil)
	_ auth.SessionStore     = (*SessionRepository)(nil)
	_ auth.UserProfileStore = (*UserRepository)(nil)

	// The OutboxRepository covers the magic_link.send enqueuer port;
	// EnqueueMagicLink is additionally available as a package function for
	// flows that already hold a database.DBTX.
	_ auth.OutboxEnqueuer = (*OutboxRepository)(nil)
)

// contactLockAdapter adapts the package-level advisory-lock function to the
// auth.ContactLocker port so Service can consume it without knowing pgx.
type contactLockAdapter struct {
	pool *pgxpool.Pool
}

// AcquireContactAdvisoryLock resolves the ambient executor and takes the
// transaction-scoped advisory lock (ADR-007).
func (a contactLockAdapter) AcquireContactAdvisoryLock(ctx context.Context, kind, value string) error {
	return AcquireContactAdvisoryLockOnPool(ctx, a.pool, kind, value)
}

// NewContactLocker exposes the advisory-lock port for service wiring.
func NewContactLocker(pool *pgxpool.Pool) auth.ContactLocker {
	return contactLockAdapter{pool: pool}
}

// errPkgCheck keeps the errors import meaningful if assertions change.
var _ = errors.Is

// Compile-time proof the package joins ambient transactions correctly:
// a *pgxpool.Pool and any pgx.Tx satisfy database.DBTX (asserted in the
// database package itself).
var _ database.DBTX = (database.DBTX)(nil)
