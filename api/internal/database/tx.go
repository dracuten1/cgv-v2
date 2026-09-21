package database

import (
	"context"
	"errors"
	"fmt"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// DBTX is the narrow sqlc-style executor surface (D2): satisfied by both
// *pgxpool.Pool and pgx.Tx alike, so repositories stay driver-agnostic.
type DBTX interface {
	Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error)
	Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error)
	QueryRow(ctx context.Context, sql string, args ...any) pgx.Row
}

// Compile-time proof that both concrete executors satisfy DBTX.
var (
	_ DBTX = (*pgxpool.Pool)(nil)
	_ DBTX = (pgx.Tx)(nil)
)

// txKey is the private context key under which the ambient pgx.Tx travels.
type txKey struct{}

// TxBeginner is the minimal surface TxManager needs to open a transaction.
// *pgxpool.Pool satisfies it; fakes satisfy it in tests.
type TxBeginner interface {
	BeginTx(ctx context.Context, opts pgx.TxOptions) (pgx.Tx, error)
}

// ErrNestedTransaction is returned by WithTx when a transaction is already
// active in the context (ADR-006: fail-fast; savepoints deferred until a real
// flow needs them).
var ErrNestedTransaction = errors.New("giao dịch lồng nhau không được hỗ trợ: WithTx đã được gọi trong một giao dịch đang mở")

// TxManager propagates transactions through closures with an ambient context
// executor (ADR-006).
type TxManager struct {
	beginner TxBeginner
}

// NewTxManager wires a TxManager onto any TxBeginner (normally *pgxpool.Pool).
func NewTxManager(b TxBeginner) *TxManager {
	return &TxManager{beginner: b}
}

// WithTx runs fn inside a fresh transaction:
//   - begins a tx and injects it into a private context key,
//   - defers rollback + panic recovery,
//   - commits on nil error, rolls back on any error,
//   - re-panics after rolling back if fn panics,
//   - returns ErrNestedTransaction if a tx is already ambient.
func (m *TxManager) WithTx(ctx context.Context, fn func(ctx context.Context) error) (err error) {
	if ctx.Value(txKey{}) != nil {
		return ErrNestedTransaction
	}

	tx, err := m.beginner.BeginTx(ctx, pgx.TxOptions{})
	if err != nil {
		return fmt.Errorf("không thể bắt đầu giao dịch: %w", err)
	}

	defer func() {
		if p := recover(); p != nil {
			_ = tx.Rollback(ctx)
			err = fmt.Errorf("panic trong giao dịch: %v", p)
		}
	}()

	if err := fn(withTx(ctx, tx)); err != nil {
		_ = tx.Rollback(ctx)
		return err
	}

	if err := tx.Commit(ctx); err != nil {
		return fmt.Errorf("không thể commit giao dịch: %w", err)
	}
	return nil
}

// GetExecutor returns the ambient pgx.Tx if one is present in ctx, otherwise
// the pool. Repositories call this to transparently join an open transaction.
func GetExecutor(ctx context.Context, pool *pgxpool.Pool) DBTX {
	if tx, ok := ctx.Value(txKey{}).(pgx.Tx); ok && tx != nil {
		return tx
	}
	return pool
}

// withTx returns a child context carrying tx under the private key.
func withTx(ctx context.Context, tx pgx.Tx) context.Context {
	return context.WithValue(ctx, txKey{}, tx)
}
