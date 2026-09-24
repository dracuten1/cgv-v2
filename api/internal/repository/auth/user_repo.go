// Package authrepo holds the concrete pgx-backed repositories for the auth
// subsystem (users, user_identities, contact_points, sessions,
// magic_link_tokens, outbox_events) plus the ADR-007 contact advisory lock.
//
// Every method resolves its executor through database.GetExecutor(ctx, pool),
// so callers transparently join the ambient transaction opened by
// database.TxManager.WithTx (ADR-006) — or fall back to the pool when no tx
// is active. The package also declares ports.go: the consumer-side interfaces
// that internal/auth programs against; each concrete repo asserts
// compile-time conformance to its port.
//
// Error contract: not-found → ErrNotFound; UNIQUE(provider, provider_subject)
// violation (23505) → ErrDuplicateIdentity; users.member_id unique-index
// violation (23505, idx_users_member_id_unique) → ErrMemberAlreadyClaimed.
// pgx errors are wrapped with a Vietnamese message; callers unwrap with
// errors.Is.
package authrepo

import (
	"context"
	"errors"
	"fmt"

	"github.com/dracuten1/cgv-v2/api/internal/auth"
	"github.com/dracuten1/cgv-v2/api/internal/database"
	"github.com/dracuten1/cgv-v2/api/internal/model"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// Sentinel errors — aliased to the canonical auth-domain values so
// errors.Is works across the service/repository boundary in BOTH directions
// while both packages keep their own exported names.
var (
	// ErrNotFound is returned when a requested record does not exist.
	ErrNotFound = auth.ErrRepoNotFound
	// ErrDuplicateIdentity is returned when inserting a user_identity whose
	// (provider, provider_subject) pair already exists (pgx 23505). The
	// resolver treats it as a lost first-login race and re-resolves (ADR-007);
	// StartLinkProvider maps it to model.CodeConflict.
	ErrDuplicateIdentity = auth.ErrDuplicateIdentity
	// ErrMemberAlreadyClaimed is returned when LinkMember violates
	// idx_users_member_id_unique (pgx 23505): another user already holds the
	// member link (M1 Rule 4 race path, → 409 CodeConflict).
	ErrMemberAlreadyClaimed = auth.ErrMemberAlreadyClaimed
)

// userColumns is the shared users projection.
const userColumns = `id, display_name, is_demo, member_id, created_at`

// scanUser scans one users row into model.User.
func scanUser(row pgx.Row) (model.User, error) {
	var u model.User
	if err := row.Scan(&u.ID, &u.DisplayName, &u.IsDemo, &u.MemberID, &u.CreatedAt); err != nil {
		return model.User{}, err
	}
	return u, nil
}

// UserStore is the consumer-side port for the users table.
type UserStore interface {
	GetByID(ctx context.Context, userID string) (*model.User, error)
	// GetByIDForUpdate locks the users row with SELECT … FOR UPDATE (ADR-007
	// unlink guard); MUST run inside a transaction.
	GetByIDForUpdate(ctx context.Context, userID string) (*model.User, error)
	Create(ctx context.Context, displayName string, isDemo bool) (*model.User, error)
	// GetByMemberID resolves the user currently holding the 1:1 member link
	// (nil, nil when the member is unclaimed).
	GetByMemberID(ctx context.Context, memberID string) (*model.User, error)
	// LinkMember binds the 1:1 family-tree member (users.member_id).
	// A violation of idx_users_member_id_unique (pgx 23505, concurrent
	// double-claim race) maps to auth.ErrMemberAlreadyClaimed.
	LinkMember(ctx context.Context, userID, memberID string) error
}

// UserRepository is the concrete pgx implementation of UserStore.
// pool mode (NewUserRepository) joins ambient transactions via
// database.GetExecutor; exec mode (NewUserRepositoryOnExec) binds a fixed
// executor — the test/DBTX seam (no ambient tx in that mode).
type UserRepository struct {
	pool *pgxpool.Pool
	exec database.DBTX
}

// Compile-time port conformance (repository satisfies the service port).
var _ UserStore = (*UserRepository)(nil)

// NewUserRepository wires a UserRepository onto the shared pool.
func NewUserRepository(pool *pgxpool.Pool) *UserRepository {
	return &UserRepository{pool: pool}
}

// NewUserRepositoryOnExec binds the repository to a fixed executor
// (database.DBTX — e.g. a pool, a tx, or a test fake).
func NewUserRepositoryOnExec(exec database.DBTX) *UserRepository {
	return &UserRepository{exec: exec}
}

// executor resolves per-call: ambient tx → pool, or the bound exec.
func (r *UserRepository) executor(ctx context.Context) database.DBTX {
	if r.pool != nil {
		return database.GetExecutor(ctx, r.pool)
	}
	return r.exec
}

// GetByID returns the user by primary key.
func (r *UserRepository) GetByID(ctx context.Context, userID string) (*model.User, error) {
	return r.getOne(ctx, r.executor(ctx),
		`SELECT `+userColumns+` FROM users WHERE id = $1`, userID)
}

// GetByIDForUpdate returns the user with the row exclusively locked until the
// ambient transaction ends (ADR-007 canonical unlink guard).
func (r *UserRepository) GetByIDForUpdate(ctx context.Context, userID string) (*model.User, error) {
	return r.getOne(ctx, r.executor(ctx),
		`SELECT `+userColumns+` FROM users WHERE id = $1 FOR UPDATE`, userID)
}

func (r *UserRepository) getOne(ctx context.Context, exec database.DBTX, query, userID string) (*model.User, error) {
	u, err := scanUser(exec.QueryRow(ctx, query, userID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("không thể truy vấn người dùng %s: %w", userID, err)
	}
	return &u, nil
}

// Create inserts a new user row. display_name may be empty for placeholder
// accounts (the resolver then overwrites it from the provider claim).
func (r *UserRepository) Create(ctx context.Context, displayName string, isDemo bool) (*model.User, error) {
	u, err := scanUser(r.executor(ctx).QueryRow(ctx,
		`INSERT INTO users (display_name, is_demo) VALUES ($1, $2)
		 RETURNING `+userColumns,
		displayName, isDemo))
	if err != nil {
		return nil, fmt.Errorf("không thể tạo người dùng: %w", err)
	}
	return &u, nil
}

// GetByMemberID returns the user currently linked to a family-tree member,
// or (nil, nil) when no user claims it (M1 Rule 4 conflict pre-check).
func (r *UserRepository) GetByMemberID(ctx context.Context, memberID string) (*model.User, error) {
	u, err := scanUser(r.executor(ctx).QueryRow(ctx,
		`SELECT `+userColumns+` FROM users WHERE member_id = $1 LIMIT 1`, memberID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, nil
		}
		return nil, fmt.Errorf("không thể truy vấn liên kết thành viên %s: %w", memberID, err)
	}
	return &u, nil
}

// LinkMember binds users.member_id to a family-tree member (1:1).
// A concurrent double-claim violating idx_users_member_id_unique
// (pgx 23505) maps to auth.ErrMemberAlreadyClaimed (→ 409 Conflict).
func (r *UserRepository) LinkMember(ctx context.Context, userID, memberID string) error {
	tag, err := r.executor(ctx).Exec(ctx,
		`UPDATE users SET member_id = $2 WHERE id = $1`, userID, memberID)
	if err != nil {
		if isPgUniqueViolation(err) {
			return ErrMemberAlreadyClaimed
		}
		return fmt.Errorf("không thể liên kết thành viên gia phả %s vào người dùng %s: %w", memberID, userID, err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ListIdentities returns every provider identity bound to a user (oldest
// link first) — the GET /api/v1/me identity cards.
func (r *UserRepository) ListIdentities(ctx context.Context, userID string) ([]model.Identity, error) {
	return listIdentitiesByUser(ctx, r.executor(ctx), userID)
}

// ListContacts returns every contact point of a user (creation order).
func (r *UserRepository) ListContacts(ctx context.Context, userID string) ([]model.ContactPoint, error) {
	return listContactsByUser(ctx, r.executor(ctx), userID)
}
