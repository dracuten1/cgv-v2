package authrepo

import (
	"context"
	"errors"
	"fmt"
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/auth"
	"github.com/dracuten1/cgv-v2/api/internal/database"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrTokenUsedOrExpired aliases the canonical auth-domain sentinel (same
// error object) so the atomic-burn loser surfaces the exact Vietnamese
// message the handler maps to 401.
var ErrTokenUsedOrExpired = auth.ErrTokenUsedOrExpired

// MagicLinkStore is the consumer-side port for the magic_link_tokens table.
type MagicLinkStore interface {
	// Insert stores the sha256 hash of the raw token (never the raw token)
	// with its expiry.
	Insert(ctx context.Context, tokenHash, email string, expiresAt time.Time) error
	// Consume atomically burns the token: a single UPDATE … RETURNING email
	// guarded by consumed_at IS NULL AND expires_at > NOW() (ADR-007).
	Consume(ctx context.Context, tokenHash string) (string, error)
}

// MagicLinkTokenRepository is the concrete pgx implementation of
// MagicLinkStore (pool mode joins ambient transactions; exec mode binds a
// fixed executor).
type MagicLinkTokenRepository struct {
	pool *pgxpool.Pool
	exec database.DBTX
}

var _ MagicLinkStore = (*MagicLinkTokenRepository)(nil)

// NewMagicLinkTokenRepository wires the store onto the shared pool.
func NewMagicLinkTokenRepository(pool *pgxpool.Pool) *MagicLinkTokenRepository {
	return &MagicLinkTokenRepository{pool: pool}
}

// NewMagicLinkTokenRepositoryOnExec binds the store to a fixed executor.
func NewMagicLinkTokenRepositoryOnExec(exec database.DBTX) *MagicLinkTokenRepository {
	return &MagicLinkTokenRepository{exec: exec}
}

// executor resolves per-call: ambient tx → pool, or the bound exec.
func (r *MagicLinkTokenRepository) executor(ctx context.Context) database.DBTX {
	if r.pool != nil {
		return database.GetExecutor(ctx, r.pool)
	}
	return r.exec
}

// Insert persists a prepared magic-link token row.
func (r *MagicLinkTokenRepository) Insert(ctx context.Context, tokenHash, email string, expiresAt time.Time) error {
	_, err := r.executor(ctx).Exec(ctx,
		`INSERT INTO magic_link_tokens (token_hash, email, expires_at) VALUES ($1, $2, $3)`,
		tokenHash, email, expiresAt)
	if err != nil {
		return fmt.Errorf("không thể lưu liên kết đăng nhập email: %w", err)
	}
	return nil
}

// Consume burns the token in exactly one statement — concurrent verifies of
// the same link race on the UPDATE, and exactly one caller gets the email
// back; every other caller gets ErrTokenUsedOrExpired.
func (r *MagicLinkTokenRepository) Consume(ctx context.Context, tokenHash string) (string, error) {
	var email string
	err := r.executor(ctx).QueryRow(ctx,
		`UPDATE magic_link_tokens SET consumed_at = NOW()
		 WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > NOW()
		 RETURNING email`,
		tokenHash).Scan(&email)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return "", ErrTokenUsedOrExpired
		}
		return "", fmt.Errorf("không thể xác minh liên kết đăng nhập email: %w", err)
	}
	return email, nil
}
