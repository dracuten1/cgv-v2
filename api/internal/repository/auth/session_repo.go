package authrepo

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/database"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// SessionStore is the consumer-side port for the revocable sessions table.
type SessionStore interface {
	// Insert records one issued JWT session keyed by its jti claim.
	Insert(ctx context.Context, jti, userID string, expiresAt time.Time) error
	// RevokeByJti stamps revoked_at; revoking an unknown/already-revoked jti
	// is a no-op (Logout is best-effort).
	RevokeByJti(ctx context.Context, jti string) error
	// GetByJti returns the session row so callers can enforce revocation.
	GetByJti(ctx context.Context, jti string) (modelSession, error)
}

// modelSession is the session projection (struct literal of model.Session
// fields kept local so the port stays narrow and fake-able without importing
// extra constructors).
type modelSession = struct {
	ID        string
	UserID    string
	JTI       string
	CreatedAt time.Time
	ExpiresAt time.Time
	RevokedAt *time.Time
}

// SessionRepository is the concrete pgx implementation of SessionStore
// (pool mode joins ambient transactions; exec mode binds a fixed executor).
type SessionRepository struct {
	pool *pgxpool.Pool
	exec database.DBTX
}

var _ SessionStore = (*SessionRepository)(nil)

// NewSessionRepository wires a SessionRepository onto the shared pool.
func NewSessionRepository(pool *pgxpool.Pool) *SessionRepository {
	return &SessionRepository{pool: pool}
}

// NewSessionRepositoryOnExec binds the repository to a fixed executor.
func NewSessionRepositoryOnExec(exec database.DBTX) *SessionRepository {
	return &SessionRepository{exec: exec}
}

// executor resolves per-call: ambient tx → pool, or the bound exec.
func (r *SessionRepository) executor(ctx context.Context) database.DBTX {
	if r.pool != nil {
		return database.GetExecutor(ctx, r.pool)
	}
	return r.exec
}

// Insert records a freshly issued session.
func (r *SessionRepository) Insert(ctx context.Context, jti, userID string, expiresAt time.Time) error {
	_, err := r.executor(ctx).Exec(ctx,
		`INSERT INTO sessions (user_id, jti, expires_at) VALUES ($1, $2, $3)`,
		userID, jti, expiresAt)
	if err != nil {
		return fmt.Errorf("không thể ghi phiên đăng nhập: %w", err)
	}
	return nil
}

// RevokeByJti marks the session revoked (logout). Idempotent by design.
func (r *SessionRepository) RevokeByJti(ctx context.Context, jti string) error {
	_, err := r.executor(ctx).Exec(ctx,
		`UPDATE sessions SET revoked_at = NOW() WHERE jti = $1 AND revoked_at IS NULL`, jti)
	if err != nil {
		return fmt.Errorf("không thể thu hồi phiên đăng nhập: %w", err)
	}
	return nil
}

// GetByJti returns the session for revocation checks; unknown jti →
// ErrNotFound.
func (r *SessionRepository) GetByJti(ctx context.Context, jti string) (modelSession, error) {
	var s modelSession
	err := r.executor(ctx).QueryRow(ctx,
		`SELECT id, user_id, jti, created_at, expires_at, revoked_at FROM sessions WHERE jti = $1`,
		jti).Scan(&s.ID, &s.UserID, &s.JTI, &s.CreatedAt, &s.ExpiresAt, &s.RevokedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return s, ErrNotFound
		}
		return s, fmt.Errorf("không thể truy vấn phiên đăng nhập: %w", err)
	}
	return s, nil
}
