package database

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
	"github.com/jackc/pgx/v5/pgxpool"
)

// fakeTx is a hand-rolled pgx.Tx. Embedding the nil interface satisfies the
// full method set; the paths WithTx actually exercises are overridden.
type fakeTx struct {
	pgx.Tx

	committed   bool
	rolledBack  bool
	beginNested int
	commitErr   error
	execCalls   []string
}

func (f *fakeTx) Begin(ctx context.Context) (pgx.Tx, error) {
	f.beginNested++
	return f, nil
}

func (f *fakeTx) Commit(ctx context.Context) error {
	if f.commitErr != nil {
		return f.commitErr
	}
	f.committed = true
	return nil
}

func (f *fakeTx) Rollback(ctx context.Context) error {
	f.rolledBack = true
	return nil
}

func (f *fakeTx) Exec(ctx context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	f.execCalls = append(f.execCalls, sql)
	return pgconn.CommandTag{}, nil
}

func (f *fakeTx) Query(ctx context.Context, sql string, args ...any) (pgx.Rows, error) {
	return nil, errors.New("fakeTx: Query not supported in tests")
}

func (f *fakeTx) QueryRow(ctx context.Context, sql string, args ...any) pgx.Row {
	return nil
}

// DBTX contract check: a pgx.Tx-typed fake also satisfies the repository surface.
var _ DBTX = (*fakeTx)(nil)

// fakeBeginner hands out a controlled fakeTx per WithTx call.
type fakeBeginner struct {
	tx         *fakeTx
	beginErr   error
	beginCalls int
}

func (b *fakeBeginner) BeginTx(ctx context.Context, opts pgx.TxOptions) (pgx.Tx, error) {
	b.beginCalls++
	if b.beginErr != nil {
		return nil, b.beginErr
	}
	if b.tx == nil {
		b.tx = &fakeTx{}
	}
	return b.tx, nil
}

func TestTxManager_CommitOnNilError(t *testing.T) {
	b := &fakeBeginner{}
	txm := NewTxManager(b)

	sawTx := false
	err := txm.WithTx(context.Background(), func(ctx context.Context) error {
		_, ok := ctx.Value(txKey{}).(pgx.Tx)
		sawTx = ok
		return nil
	})
	if err != nil {
		t.Fatalf("WithTx() unexpected error: %v", err)
	}
	if !sawTx {
		t.Fatalf("WithTx() did not inject the tx into the context under the private key")
	}
	if b.tx.committed {
		// commit path exercised
	} else {
		t.Fatalf("WithTx() did not commit on nil error")
	}
	if b.tx.rolledBack {
		t.Fatalf("WithTx() rolled back although fn returned nil")
	}
}

func TestTxManager_RollbackOnError(t *testing.T) {
	b := &fakeBeginner{}
	txm := NewTxManager(b)

	wantErr := errors.New("ràng buộc nghiệp vụ bị vi phạm")
	got := txm.WithTx(context.Background(), func(ctx context.Context) error {
		return wantErr
	})
	if !errors.Is(got, wantErr) {
		t.Fatalf("WithTx() error = %v, want %v", got, wantErr)
	}
	if !b.tx.rolledBack {
		t.Fatalf("WithTx() did not roll back on fn error")
	}
	if b.tx.committed {
		t.Fatalf("WithTx() committed although fn returned an error")
	}
}

func TestTxManager_PanicRecovery(t *testing.T) {
	b := &fakeBeginner{}
	txm := NewTxManager(b)

	got := txm.WithTx(context.Background(), func(ctx context.Context) error {
		panic("boom nội bộ")
	})
	if got == nil {
		t.Fatalf("WithTx() returned nil after a panic; want a converted error")
	}
	if !strings.Contains(got.Error(), "panic") {
		t.Fatalf("WithTx() error = %q, want it to mention the recovered panic", got.Error())
	}
	if !b.tx.rolledBack {
		t.Fatalf("WithTx() did not roll back after recovering from a panic")
	}
	if b.tx.committed {
		t.Fatalf("WithTx() committed after a panic")
	}
}

func TestTxManager_NestedCallFails(t *testing.T) {
	b := &fakeBeginner{}
	txm := NewTxManager(b)

	outerErr := txm.WithTx(context.Background(), func(ctx context.Context) error {
		return txm.WithTx(ctx, func(ctx context.Context) error {
			t.Fatalf("inner WithTx body must never run when nesting is rejected")
			return nil
		})
	})
	if !errors.Is(outerErr, ErrNestedTransaction) {
		t.Fatalf("nested WithTx error = %v, want ErrNestedTransaction", outerErr)
	}
	// The outer tx must still roll back cleanly after the nested rejection.
	if !b.tx.rolledBack {
		t.Fatalf("outer tx was not rolled back after nested WithTx rejection")
	}
	if b.tx.committed {
		t.Fatalf("outer tx was committed although its body failed")
	}
	if b.beginCalls != 1 {
		t.Fatalf("BeginTx calls = %d, want 1 (inner call rejected before BeginTx)", b.beginCalls)
	}
}

func TestTxManager_BeginErrorPropagates(t *testing.T) {
	b := &fakeBeginner{beginErr: errors.New("pool đóng")}
	txm := NewTxManager(b)

	err := txm.WithTx(context.Background(), func(ctx context.Context) error { return nil })
	if err == nil || !strings.Contains(err.Error(), "bắt đầu giao dịch") {
		t.Fatalf("WithTx() error = %v, want a wrapped begin failure", err)
	}
}

func TestGetExecutor_AmbientTxAbsent(t *testing.T) {
	pool := &pgxpool.Pool{} // zero value is safe: GetExecutor only returns it verbatim
	got := GetExecutor(context.Background(), pool)
	if got != DBTX(pool) {
		t.Fatalf("GetExecutor() without ambient tx must return the pool")
	}
}

func TestGetExecutor_AmbientTxPresent(t *testing.T) {
	pool := &pgxpool.Pool{}
	fake := &fakeTx{}
	ctx := context.WithValue(context.Background(), txKey{}, pgx.Tx(fake))

	got := GetExecutor(ctx, pool)
	if got != DBTX(fake) {
		t.Fatalf("GetExecutor() with ambient tx must return the tx, not the pool")
	}
}

func TestGetExecutor_NilTxInContextFallsBackToPool(t *testing.T) {
	pool := &pgxpool.Pool{}
	ctx := context.WithValue(context.Background(), txKey{}, pgx.Tx(nil))

	got := GetExecutor(ctx, pool)
	if got != DBTX(pool) {
		t.Fatalf("GetExecutor() with nil ambient tx must fall back to the pool")
	}
}
