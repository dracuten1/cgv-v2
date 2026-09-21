package genrepo

import (
	"context"
	"errors"
	"fmt"

	"github.com/dracuten1/cgv-v2/api/internal/database"
	"github.com/dracuten1/cgv-v2/api/internal/model"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"
)

// FamilyRepository handles database operations on the families table.
type FamilyRepository struct {
	pool *pgxpool.Pool
}

// NewFamilyRepository creates a new FamilyRepository.
func NewFamilyRepository(pool *pgxpool.Pool) *FamilyRepository {
	return &FamilyRepository{pool: pool}
}

// List returns all families ordered by created_at.
func (r *FamilyRepository) List(ctx context.Context) ([]model.Family, error) {
	exec := database.GetExecutor(ctx, r.pool)
	query := `SELECT id, name, version, created_at FROM families ORDER BY created_at ASC`
	rows, err := exec.Query(ctx, query)
	if err != nil {
		return nil, fmt.Errorf("không thể truy vấn danh sách dòng họ: %w", err)
	}
	defer rows.Close()

	var families []model.Family
	for rows.Next() {
		var f model.Family
		if err := rows.Scan(&f.ID, &f.Name, &f.Version, &f.CreatedAt); err != nil {
			return nil, fmt.Errorf("không thể đọc dữ liệu dòng họ: %w", err)
		}
		families = append(families, f)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("lỗi trong quá trình đọc danh sách dòng họ: %w", err)
	}
	return families, nil
}

// GetByID returns a family by its ID.
func (r *FamilyRepository) GetByID(ctx context.Context, familyID string) (*model.Family, error) {
	exec := database.GetExecutor(ctx, r.pool)
	query := `SELECT id, name, version, created_at FROM families WHERE id = $1`
	var f model.Family
	err := exec.QueryRow(ctx, query, familyID).Scan(&f.ID, &f.Name, &f.Version, &f.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("không thể truy vấn dòng họ %s: %w", familyID, err)
	}
	return &f, nil
}

// GetVersion returns the current version of the given family.
func (r *FamilyRepository) GetVersion(ctx context.Context, familyID string) (int64, error) {
	exec := database.GetExecutor(ctx, r.pool)
	query := `SELECT version FROM families WHERE id = $1`
	var version int64
	err := exec.QueryRow(ctx, query, familyID).Scan(&version)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, ErrNotFound
		}
		return 0, fmt.Errorf("không thể lấy phiên bản dòng họ %s: %w", familyID, err)
	}
	return version, nil
}

// BumpVersion increments families.version by 1 and returns the new version.
// Must be called in EVERY mutating tx per ADR-009.
func (r *FamilyRepository) BumpVersion(ctx context.Context, dbtx database.DBTX, familyID string) (int64, error) {
	query := `UPDATE families SET version = version + 1 WHERE id = $1 RETURNING version`
	var newVersion int64
	err := dbtx.QueryRow(ctx, query, familyID).Scan(&newVersion)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return 0, ErrNotFound
		}
		return 0, fmt.Errorf("không thể tăng phiên bản dòng họ %s: %w", familyID, err)
	}
	return newVersion, nil
}
