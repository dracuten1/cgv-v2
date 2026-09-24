package authrepo

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/database"
	"github.com/dracuten1/cgv-v2/api/internal/model"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// IdentityStore is the consumer-side port for the user_identities table.
type IdentityStore interface {
	FindByProviderSubject(ctx context.Context, provider, subject string) (*model.Identity, error)
	// Insert returns ErrDuplicateIdentity on a (provider, provider_subject)
	// collision (pgx 23505).
	Insert(ctx context.Context, userID, provider, subject string) (*model.Identity, error)
	// TouchLastLogin refreshes last_login_at on a returning identity.
	TouchLastLogin(ctx context.Context, identityID string) error
	// CountByUser feeds the unlink-last-identity guard (ADR-007).
	CountByUser(ctx context.Context, userID string) (int, error)
	Delete(ctx context.Context, identityID, userID string) error
}

// IdentityRepository is the concrete pgx implementation of IdentityStore
// (pool mode joins ambient transactions; exec mode binds a fixed executor).
type IdentityRepository struct {
	pool *pgxpool.Pool
	exec database.DBTX
}

var _ IdentityStore = (*IdentityRepository)(nil)

// NewIdentityRepository wires an IdentityRepository onto the shared pool.
func NewIdentityRepository(pool *pgxpool.Pool) *IdentityRepository {
	return &IdentityRepository{pool: pool}
}

// NewIdentityRepositoryOnExec binds the repository to a fixed executor.
func NewIdentityRepositoryOnExec(exec database.DBTX) *IdentityRepository {
	return &IdentityRepository{exec: exec}
}

// executor resolves per-call: ambient tx → pool, or the bound exec.
func (r *IdentityRepository) executor(ctx context.Context) database.DBTX {
	if r.pool != nil {
		return database.GetExecutor(ctx, r.pool)
	}
	return r.exec
}

// identityColumns is the shared user_identities projection.
const identityColumns = `id, user_id, provider, provider_subject, linked_at, last_login_at`

// scanIdentity scans one user_identities row.
func scanIdentity(row pgx.Row) (model.Identity, error) {
	var i model.Identity
	if err := row.Scan(&i.ID, &i.UserID, &i.Provider, &i.ProviderSubject, &i.LinkedAt, &i.LastLoginAt); err != nil {
		return model.Identity{}, err
	}
	return i, nil
}

// FindByProviderSubject resolves the identity-resolution step 1 lookup
// (UNIQUE(provider, provider_subject)).
func (r *IdentityRepository) FindByProviderSubject(ctx context.Context, provider, subject string) (*model.Identity, error) {
	i, err := scanIdentity(r.executor(ctx).QueryRow(ctx,
		`SELECT `+identityColumns+` FROM user_identities
		 WHERE provider = $1 AND provider_subject = $2`, provider, subject))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("không thể tra cứu định danh %s: %w", provider, err)
	}
	return &i, nil
}

// Insert binds a new provider identity to a user. A (provider,
// provider_subject) collision — the lost side of a concurrent first login or
// an already-linked provider — maps to ErrDuplicateIdentity.
func (r *IdentityRepository) Insert(ctx context.Context, userID, provider, subject string) (*model.Identity, error) {
	i, err := scanIdentity(r.executor(ctx).QueryRow(ctx,
		`INSERT INTO user_identities (user_id, provider, provider_subject)
		 VALUES ($1, $2, $3)
		 RETURNING `+identityColumns,
		userID, provider, subject))
	if err != nil {
		if isPgUniqueViolation(err) {
			return nil, fmt.Errorf("%w: %s/%s", ErrDuplicateIdentity, provider, subject)
		}
		return nil, fmt.Errorf("không thể tạo định danh %s cho người dùng %s: %w", provider, userID, err)
	}
	return &i, nil
}

// TouchLastLogin refreshes last_login_at on every returning login.
func (r *IdentityRepository) TouchLastLogin(ctx context.Context, identityID string) error {
	_, err := r.executor(ctx).Exec(ctx,
		`UPDATE user_identities SET last_login_at = $2 WHERE id = $1`, identityID, time.Now())
	if err != nil {
		return fmt.Errorf("không thể cập nhật thời gian đăng nhập của định danh %s: %w", identityID, err)
	}
	return nil
}

// CountByUser counts the identities bound to a user (unlink guard input).
func (r *IdentityRepository) CountByUser(ctx context.Context, userID string) (int, error) {
	var n int
	if err := r.executor(ctx).QueryRow(ctx,
		`SELECT COUNT(*) FROM user_identities WHERE user_id = $1`, userID).Scan(&n); err != nil {
		return 0, fmt.Errorf("không thể đếm định danh của người dùng %s: %w", userID, err)
	}
	return n, nil
}

// Delete removes exactly one identity owned by userID; the owning-user
// predicate keeps the delete tenant-safe. Zero rows affected → ErrNotFound.
func (r *IdentityRepository) Delete(ctx context.Context, identityID, userID string) error {
	tag, err := r.executor(ctx).Exec(ctx,
		`DELETE FROM user_identities WHERE id = $1 AND user_id = $2`, identityID, userID)
	if err != nil {
		return fmt.Errorf("không thể hủy liên kết định danh %s: %w", identityID, err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ListByUser returns every identity bound to a user (oldest link first).
func (r *IdentityRepository) ListByUser(ctx context.Context, userID string) ([]model.Identity, error) {
	return listIdentitiesByUser(ctx, r.executor(ctx), userID)
}

// listIdentitiesByUser is the shared projection helper (also used by the
// users composite reader).
func listIdentitiesByUser(ctx context.Context, exec database.DBTX, userID string) ([]model.Identity, error) {
	rows, err := exec.Query(ctx,
		`SELECT `+identityColumns+` FROM user_identities WHERE user_id = $1 ORDER BY linked_at ASC, id ASC`,
		userID)
	if err != nil {
		return nil, fmt.Errorf("không thể liệt kê định danh của người dùng %s: %w", userID, err)
	}
	defer rows.Close()
	out := []model.Identity{}
	for rows.Next() {
		i, err := scanIdentityRow(rows)
		if err != nil {
			return nil, fmt.Errorf("không thể đọc định danh của người dùng %s: %w", userID, err)
		}
		out = append(out, i)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("lỗi trong quá trình đọc định danh: %w", err)
	}
	return out, nil
}

// scanIdentityRow scans from an arbitrary row source.
func scanIdentityRow(row interface{ Scan(dest ...any) error }) (model.Identity, error) {
	var i model.Identity
	if err := row.Scan(&i.ID, &i.UserID, &i.Provider, &i.ProviderSubject, &i.LinkedAt, &i.LastLoginAt); err != nil {
		return model.Identity{}, err
	}
	return i, nil
}

// isPgForeignKeyViolation reports whether err carries the pgx 23503
// foreign_key_violation code (directly or wrapped).
func isPgForeignKeyViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23503"
	}
	return false
}

// isPgUniqueViolation reports whether err carries the pgx 23505
// unique_violation code (directly or wrapped).
func isPgUniqueViolation(err error) bool {
	var pgErr *pgconn.PgError
	if errors.As(err, &pgErr) {
		return pgErr.Code == "23505"
	}
	return false
}
