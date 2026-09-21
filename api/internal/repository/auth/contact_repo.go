package authrepo

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/auth"
	"github.com/dracuten1/cgv-v2/api/internal/database"
	"github.com/dracuten1/cgv-v2/api/internal/model"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ContactStore is the consumer-side port for the contact_points table.
type ContactStore interface {
	FindByKindValue(ctx context.Context, kind, value string) (*model.ContactPoint, error)
	// Insert returns ErrNotFound if the owning user does not exist (pgx
	// 23503 FK violation — a business error, never retried per ADR-006).
	Insert(ctx context.Context, userID, kind, value string, verified bool, verifiedVia string) (*model.ContactPoint, error)
	// MarkVerified flips verified=true and stamps verified_via.
	MarkVerified(ctx context.Context, contactID, via string) error
	GetByID(ctx context.Context, contactID string) (*model.ContactPoint, error)
}

// ContactRepository is the concrete pgx implementation of ContactStore
// (pool mode joins ambient transactions; exec mode binds a fixed executor).
type ContactRepository struct {
	pool *pgxpool.Pool
	exec database.DBTX
}

var _ ContactStore = (*ContactRepository)(nil)

// NewContactRepository wires a ContactRepository onto the shared pool.
func NewContactRepository(pool *pgxpool.Pool) *ContactRepository {
	return &ContactRepository{pool: pool}
}

// NewContactRepositoryOnExec binds the repository to a fixed executor.
func NewContactRepositoryOnExec(exec database.DBTX) *ContactRepository {
	return &ContactRepository{exec: exec}
}

// executor resolves per-call: ambient tx → pool, or the bound exec.
func (r *ContactRepository) executor(ctx context.Context) database.DBTX {
	if r.pool != nil {
		return database.GetExecutor(ctx, r.pool)
	}
	return r.exec
}

// NormalizeContact delegates to the canonical domain normalizer so repo
// reads/writes see exactly one spelling per contact value.
func NormalizeContact(kind, value string) string {
	return auth.NormalizeContact(kind, value)
}

// FindByKindValue is the resolver's step-2 lookup behind the advisory lock.
func (r *ContactRepository) FindByKindValue(ctx context.Context, kind, value string) (*model.ContactPoint, error) {
	c, err := scanContact(r.executor(ctx).QueryRow(ctx,
		`SELECT id, user_id, kind, value, verified, verified_via, created_at
		 FROM contact_points WHERE kind = $1 AND value = $2`,
		kind, NormalizeContact(kind, value)))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("không thể tra cứu điểm liên hệ %s: %w", kind, err)
	}
	return &c, nil
}

// Insert stores a contact point. verifiedVia may be empty for unverified rows.
func (r *ContactRepository) Insert(ctx context.Context, userID, kind, value string, verified bool, verifiedVia string) (*model.ContactPoint, error) {
	var via *string
	if verifiedVia != "" {
		via = &verifiedVia
	}
	c, err := scanContact(r.executor(ctx).QueryRow(ctx,
		`INSERT INTO contact_points (user_id, kind, value, verified, verified_via)
		 VALUES ($1, $2, $3, $4, $5)
		 RETURNING id, user_id, kind, value, verified, verified_via, created_at`,
		userID, kind, NormalizeContact(kind, value), verified, via))
	if err != nil {
		return nil, fmt.Errorf("không thể tạo điểm liên hệ %s cho người dùng %s: %w", kind, userID, err)
	}
	return &c, nil
}

// MarkVerified confirms a contact point (auto-link confirmation or magic-link
// verification); via records the channel, e.g. 'magic_link'.
func (r *ContactRepository) MarkVerified(ctx context.Context, contactID, via string) error {
	tag, err := r.executor(ctx).Exec(ctx,
		`UPDATE contact_points SET verified = true, verified_via = $2 WHERE id = $1`,
		contactID, via)
	if err != nil {
		return fmt.Errorf("không thể xác thực điểm liên hệ %s: %w", contactID, err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// GetByID returns one contact point by primary key.
func (r *ContactRepository) GetByID(ctx context.Context, contactID string) (*model.ContactPoint, error) {
	c, err := scanContact(r.executor(ctx).QueryRow(ctx,
		`SELECT id, user_id, kind, value, verified, verified_via, created_at
		 FROM contact_points WHERE id = $1`, contactID))
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("không thể truy vấn điểm liên hệ %s: %w", contactID, err)
	}
	return &c, nil
}

// ListByUser returns every contact point of a user (creation order).
func (r *ContactRepository) ListByUser(ctx context.Context, userID string) ([]model.ContactPoint, error) {
	return listContactsByUser(ctx, r.executor(ctx), userID)
}

// listContactsByUser is the shared projection helper (also used by the users
// composite reader).
func listContactsByUser(ctx context.Context, exec database.DBTX, userID string) ([]model.ContactPoint, error) {
	rows, err := exec.Query(ctx,
		`SELECT id, user_id, kind, value, verified, verified_via, created_at
		 FROM contact_points WHERE user_id = $1 ORDER BY created_at ASC, id ASC`,
		userID)
	if err != nil {
		return nil, fmt.Errorf("không thể liệt kê điểm liên hệ của người dùng %s: %w", userID, err)
	}
	defer rows.Close()
	out := []model.ContactPoint{}
	for rows.Next() {
		c, err := scanContactRow(rows)
		if err != nil {
			return nil, fmt.Errorf("không thể đọc điểm liên hệ của người dùng %s: %w", userID, err)
		}
		out = append(out, c)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("lỗi trong quá trình đọc điểm liên hệ: %w", err)
	}
	return out, nil
}

// scanContactRow scans from an arbitrary row source.
func scanContactRow(row interface{ Scan(dest ...any) error }) (model.ContactPoint, error) {
	var c model.ContactPoint
	if err := row.Scan(&c.ID, &c.UserID, &c.Kind, &c.Value, &c.Verified, &c.VerifiedVia, &c.CreatedAt); err != nil {
		return model.ContactPoint{}, err
	}
	return c, nil
}

// scanContact scans one contact_points row.
func scanContact(row pgx.Row) (model.ContactPoint, error) {
	var (
		c   model.ContactPoint
		now time.Time
	)
	if err := row.Scan(&c.ID, &c.UserID, &c.Kind, &c.Value, &c.Verified, &c.VerifiedVia, &now); err != nil {
		return model.ContactPoint{}, err
	}
	c.CreatedAt = now
	return c, nil
}
