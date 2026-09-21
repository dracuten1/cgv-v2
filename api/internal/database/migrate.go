package database

import (
	"context"
	"fmt"
	"io/fs"
	"log/slog"
	"sort"
	"strings"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/dracuten1/cgv-v2/api/migrations"
)

// advisoryLockSQL serializes concurrent API boots during migration (ADR-007
// style advisory locking; the lock is xact-scoped so it releases on commit).
const advisoryLockSQL = `SELECT pg_advisory_xact_lock(hashtext('cgp_migrations'))`

// schemaMigrationsDDL creates the bookkeeping table for applied migrations.
const schemaMigrationsDDL = `
CREATE TABLE IF NOT EXISTS schema_migrations (
    version    TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
)`

// migration pairs a lexicographically-sorted filename with its SQL body.
type migration struct {
	name string
	sql  string
}

// Migrate brings the database schema up to date with the embedded migrations.
//
// Guarantees:
//   - concurrent boots serialize on pg_advisory_xact_lock(hashtext('cgp_migrations'));
//   - pending files apply in lexicographic order, one transaction per file;
//   - each applied file is recorded in schema_migrations and skipped afterwards.
func Migrate(ctx context.Context, pool *pgxpool.Pool) error {
	files, err := CollectMigrations(migrations.FS)
	if err != nil {
		return err
	}

	txm := NewTxManager(pool)

	if err := txm.WithTx(ctx, func(ctx context.Context) error {
		exec := GetExecutor(ctx, pool)
		if _, err := exec.Exec(ctx, advisoryLockSQL); err != nil {
			return fmt.Errorf("không thể chặn advisory lock: %w", err)
		}
		if _, err := exec.Exec(ctx, schemaMigrationsDDL); err != nil {
			return fmt.Errorf("không thể tạo bảng schema_migrations: %w", err)
		}
		return nil
	}); err != nil {
		return err
	}

	for _, m := range files {
		if err := applyMigration(ctx, txm, pool, m); err != nil {
			return err
		}
	}
	return nil
}

// applyMigration runs one migration file inside its own transaction, guarded
// by the advisory lock so concurrent instances wait instead of racing.
func applyMigration(ctx context.Context, txm *TxManager, pool *pgxpool.Pool, m migration) error {
	return txm.WithTx(ctx, func(ctx context.Context) error {
		exec := GetExecutor(ctx, pool)

		if _, err := exec.Exec(ctx, advisoryLockSQL); err != nil {
			return fmt.Errorf("không thể chặn advisory lock: %w", err)
		}

		var already bool
		if err := exec.QueryRow(ctx,
			`SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE version = $1)`, m.name,
		).Scan(&already); err != nil {
			return fmt.Errorf("không thể kiểm tra trạng thái migration %s: %w", m.name, err)
		}
		if already {
			return nil
		}

		if _, err := exec.Exec(ctx, m.sql); err != nil {
			return fmt.Errorf("migration %s thất bại: %w", m.name, err)
		}
		if _, err := exec.Exec(ctx,
			`INSERT INTO schema_migrations (version) VALUES ($1)`, m.name,
		); err != nil {
			return fmt.Errorf("không thể ghi nhận migration %s: %w", m.name, err)
		}

		slog.Info("Đã áp dụng migration", slog.String("file", m.name))
		return nil
	})
}

// CollectMigrations reads *.sql entries from fsys in lexicographic order.
// Pure (no database) so the ordering contract is unit-testable with fstest.
func CollectMigrations(fsys fs.FS) ([]migration, error) {
	entries, err := fs.ReadDir(fsys, ".")
	if err != nil {
		return nil, fmt.Errorf("không thể đọc thư mục migrations: %w", err)
	}

	var out []migration
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".sql") {
			continue
		}
		body, err := fs.ReadFile(fsys, e.Name())
		if err != nil {
			return nil, fmt.Errorf("không thể đọc migration %s: %w", e.Name(), err)
		}
		out = append(out, migration{name: e.Name(), sql: string(body)})
	}

	sort.Slice(out, func(i, j int) bool { return out[i].name < out[j].name })
	return out, nil
}
