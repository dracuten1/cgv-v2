package excel

import (
	"context"
	"fmt"

	"github.com/dracuten1/cgv-v2/api/internal/database"
	"github.com/dracuten1/cgv-v2/api/internal/model"
)

// ExcelGraphLoader matches the Loader interface for exporting a family's graph.
type ExcelGraphLoader interface {
	LoadGraph(ctx context.Context, familyID string) (
		members []model.Member,
		pc []model.ParentChild,
		sp []model.Spouse,
		version int64,
		err error,
	)
}

// ExcelImportRepo matches the operations needed to import staged data into a family.
type ExcelImportRepo interface {
	ImportStaged(
		ctx context.Context,
		dbtx database.DBTX,
		familyID string,
		members []model.Member,
		pc []model.ParentChild,
		spouses []model.Spouse,
	) error
	BumpVersion(ctx context.Context, dbtx database.DBTX, familyID string) (int64, error)
}

// TxRunner encapsulates transaction execution.
type TxRunner interface {
	WithTx(ctx context.Context, fn func(ctx context.Context) error) error
}

// GraphCacheInvalidator clears cached derived graphs (e.g. the kinship
// engine's per-(family, version) graph cache) after a member mutation
// commits — MUST-FIX M3/K1: the Excel import path is a member-mutation path
// and must invalidate like tree CRUD. May be nil in tests.
type GraphCacheInvalidator interface {
	Invalidate(familyID string)
}

// ImportSummary describes the outcome of an Excel import operation.
type ImportSummary struct {
	Created           int      `json:"created"`
	SkippedDuplicates int      `json:"skipped_duplicates"`
	Errors            []string `json:"errors"`
}

// Service manages Excel import and export operations.
type Service struct {
	graphLoader ExcelGraphLoader
	importRepo  ExcelImportRepo
	txManager   TxRunner
	// invalidate drops cached derived graphs after a committed import (M3).
	invalidate GraphCacheInvalidator
}

// NewService creates a new excel Service. invalidate may be nil.
func NewService(graphLoader ExcelGraphLoader, importRepo ExcelImportRepo, txManager TxRunner, invalidate GraphCacheInvalidator) *Service {
	return &Service{
		graphLoader: graphLoader,
		importRepo:  importRepo,
		txManager:   txManager,
		invalidate:  invalidate,
	}
}

// ExportFamily retrieves the family graph and produces an Excel spreadsheet.
func (s *Service) ExportFamily(ctx context.Context, familyID string) ([]byte, error) {
	members, pc, sp, _, err := s.graphLoader.LoadGraph(ctx, familyID)
	if err != nil {
		return nil, fmt.Errorf("không thể lấy thông tin phả hệ dòng họ: %w", err)
	}

	data, err := Export(members, pc, sp)
	if err != nil {
		return nil, fmt.Errorf("không thể xuất file Excel: %w", err)
	}

	return data, nil
}

// ImportFamily parses the provided Excel data in-memory, validates it,
// and commits the staged records within a single transaction with version increment.
func (s *Service) ImportFamily(ctx context.Context, familyID string, data []byte) (ImportSummary, error) {
	// Parse and validate FULLY in memory BEFORE touching the database
	staged, err := Parse(data)
	if err != nil {
		return ImportSummary{Errors: []string{err.Error()}}, err
	}

	if len(staged.Errors) > 0 {
		return ImportSummary{
			Created:           0,
			SkippedDuplicates: staged.SkippedDuplicates,
			Errors:            staged.Errors,
		}, nil
	}

	if len(staged.Members) == 0 {
		return ImportSummary{
			Created:           0,
			SkippedDuplicates: staged.SkippedDuplicates,
			Errors:            []string{"không có thành viên hợp lệ để nhập"},
		}, nil
	}

	// Execute database transaction
	if s.txManager != nil && s.importRepo != nil {
		err := s.txManager.WithTx(ctx, func(txCtx context.Context) error {
			// In pgx, ambient tx is resolved inside repo via GetExecutor or dbtx passed
			// Helper: We can raise timeout or execute statements if needed
			// Let's call importRepo
			if err := s.importRepo.ImportStaged(txCtx, nil, familyID, staged.Members, staged.ParentChildEdges, staged.SpousesEdges); err != nil {
				return err
			}
			if _, err := s.importRepo.BumpVersion(txCtx, nil, familyID); err != nil {
				return err
			}
			return nil
		})
		if err != nil {
			return ImportSummary{Errors: []string{err.Error()}}, fmt.Errorf("không thể lưu dữ liệu nhập phả hệ: %w", err)
		}

		// M3/K1: the import committed member mutations → drop cached kinship
		// graphs so label/kinship reads reload the fresh roster.
		if s.invalidate != nil {
			s.invalidate.Invalidate(familyID)
		}
	}

	return ImportSummary{
		Created:           len(staged.Members),
		SkippedDuplicates: staged.SkippedDuplicates,
		Errors:            nil,
	}, nil
}
