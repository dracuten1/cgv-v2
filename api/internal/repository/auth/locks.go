package authrepo

import (
	"context"
	"errors"
	"fmt"

	"github.com/dracuten1/cgv-v2/api/internal/database"
	"github.com/jackc/pgx/v5/pgxpool"
)

// ErrNoExecutor is returned by the lock helper when the executor cannot be
// resolved (defensive; GetExecutor always returns the pool as fallback).
var ErrNoExecutor = errors.New("không thể xác định kết nối cơ sở dữ liệu")

// AcquireContactAdvisoryLock serializes concurrent first logins claiming the
// same contact point: SELECT pg_advisory_xact_lock(hashtext(kind || ':' ||
// value)) — released automatically when the ambient transaction ends
// (ADR-007). MUST run inside a transaction; at pool level the lock would leak
// until session end.
func AcquireContactAdvisoryLock(ctx context.Context, exec database.DBTX, kind, value string) error {
	if exec == nil {
		return ErrNoExecutor
	}
	if _, err := exec.Exec(ctx,
		`SELECT pg_advisory_xact_lock(hashtext($1 || ':' || $2))`, kind, value); err != nil {
		return fmt.Errorf("không thể khóa điểm liên hệ %s để xử lý an toàn: %w", kind, err)
	}
	return nil
}

// AcquireContactAdvisoryLockOnPool is the repository-form convenience wrapper
// that resolves the ambient executor from the pool first.
func AcquireContactAdvisoryLockOnPool(ctx context.Context, pool *pgxpool.Pool, kind, value string) error {
	return AcquireContactAdvisoryLock(ctx, database.GetExecutor(ctx, pool), kind, value)
}
