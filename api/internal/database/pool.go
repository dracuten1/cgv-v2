// Package database provides PostgreSQL connectivity (pgxpool), the transaction
// manager (ADR-006) and the embedded-migrations runner.
package database

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

// Pool tuning constants (architecture decision D3 — deviation from the
// blueprint's 25/5 is intentional: headroom under Postgres max_connections=100).
const (
	// MaxConns caps the pool at 20 connections.
	MaxConns = 20
	// MinConns keeps 2 warm connections to avoid startup storms.
	MinConns = 2
	// StatementTimeout is the server-side per-statement budget (5s).
	StatementTimeout = 5 * time.Second
	// AcquireTimeout bounds how long a caller waits for a pool connection (2s).
	//
	// Note: pgx v5.7.1's pgxpool.Config has no AcquireTimeout knob; the bound is
	// enforced by applying this deadline to the context handed to Acquire (see
	// Acquire below). When the project later bumps pgx to >= v5.7.2+ with a
	// native option, this helper remains the single integration point.
	AcquireTimeout = 2 * time.Second
	// MaxConnLifetime is the maximum age of a pooled connection (1h).
	MaxConnLifetime = time.Hour
	// MaxConnIdleTime is how long an idle connection survives before closing (15m).
	MaxConnIdleTime = 15 * time.Minute
	// PingRetryAttempts is the number of bounded boot-ping attempts.
	PingRetryAttempts = 5
	// PingRetryBaseDelay is the exponential backoff base for boot pings.
	PingRetryBaseDelay = 250 * time.Millisecond
)

// Pinger is the minimal surface needed for the bounded boot ping. Satisfied by
// *pgxpool.Pool; declared as an interface so the retry loop is unit-testable.
type Pinger interface {
	Ping(ctx context.Context) error
}

// NewPool builds a tuned pgxpool (D3) and blocks until the database answers a
// ping (bounded exponential retry) or the context is cancelled.
func NewPool(ctx context.Context, dsn string) (*pgxpool.Pool, error) {
	cfg, err := pgxpool.ParseConfig(dsn)
	if err != nil {
		return nil, fmt.Errorf("không thể phân tích DSN cơ sở dữ liệu: %w", err)
	}

	cfg.MaxConns = MaxConns
	cfg.MinConns = MinConns
	cfg.MaxConnLifetime = MaxConnLifetime
	cfg.MaxConnIdleTime = MaxConnIdleTime
	// Server-side runtime parameter: every statement in the pool obeys 5s.
	cfg.ConnConfig.RuntimeParams["statement_timeout"] = fmt.Sprintf("%d", StatementTimeout.Milliseconds())
	cfg.ConnConfig.RuntimeParams["application_name"] = "cgp-api"

	pool, err := pgxpool.NewWithConfig(ctx, cfg)
	if err != nil {
		return nil, fmt.Errorf("không thể tạo connection pool: %w", err)
	}

	if err := pingWithRetry(ctx, pool, PingRetryAttempts, PingRetryBaseDelay); err != nil {
		pool.Close()
		return nil, err
	}
	return pool, nil
}

// pingWithRetry pings p with bounded exponential backoff: attempts × base·2ⁿ.
// Returns the last error if all attempts are exhausted.
func pingWithRetry(ctx context.Context, p Pinger, attempts int, base time.Duration) error {
	var lastErr error
	for i := 0; i < attempts; i++ {
		if err := p.Ping(ctx); err == nil {
			return nil
		} else {
			lastErr = err
			delay := base << i // 250ms, 500ms, 1s, 2s, 4s…
			slog.Warn("Ping cơ sở dữ liệu thất bại, thử lại",
				slog.Int("lan_thu", i+1),
				slog.Int("tong_lan", attempts),
				slog.Duration("cho_tiep", delay),
				slog.String("loi", err.Error()),
			)
			select {
			case <-ctx.Done():
				return fmt.Errorf("hủy bỏ trong khi chờ cơ sở dữ liệu: %w", errors.Join(ctx.Err(), lastErr))
			case <-time.After(delay):
			}
		}
	}
	return fmt.Errorf("cơ sở dữ liệu không phản hồi sau %d lần thử: %w", attempts, lastErr)
}

// Acquire obtains a connection from the pool under the 2s acquire timeout (D3).
// Use this helper instead of pool.Acquire so the budget is uniform.
func Acquire(ctx context.Context, pool *pgxpool.Pool) (*pgxpool.Conn, error) {
	acqCtx, cancel := context.WithTimeout(ctx, AcquireTimeout)
	defer cancel()
	return pool.Acquire(acqCtx)
}
