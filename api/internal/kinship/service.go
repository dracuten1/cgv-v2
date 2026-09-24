package kinship

import (
	"context"
	"errors"
	"fmt"

	"github.com/dracuten1/cgv-v2/api/internal/model"
)

// ErrMemberNotFound — the requested reference member is not part of the
// family graph (→ 404 model.CodeNotFound at the handler seam).
var ErrMemberNotFound = errors.New("Không tìm thấy thành viên trong đồ thị dòng họ")

// FamilyVersionSource supplies the CURRENT families.version for a family so
// graph lookups never pin a stale snapshot (MUST-FIX M3/K1: the historical
// `GetGraph(ctx, familyID, 0)` lookup cached version 0 forever and served
// stale relations until process restart).
type FamilyVersionSource interface {
	GetVersion(ctx context.Context, familyID string) (int64, error)
}

// Service coordinates kinship requests.
type Service struct {
	engine   *Engine
	families FamilyVersionSource // may be nil (tests without a families repo)
}

// NewService creates a new kinship Service. families may be nil; when nil the
// version is unknown and graph loads fall back to the loader-supplied version.
func NewService(loader KinshipGraphLoader, families FamilyVersionSource) *Service {
	return &Service{
		engine:   NewEngine(loader),
		families: families,
	}
}

// Engine returns the underlying Engine instance.
func (s *Service) Engine() *Engine {
	return s.engine
}

// currentVersion resolves the family's current version. Without a
// FamilyVersionSource the loader's freshly loaded version is authoritative
// (GetGraph loads and caches under the version the loader reports).
func (s *Service) currentVersion(ctx context.Context, familyID string) (int64, error) {
	if s.families == nil {
		return 0, nil
	}
	version, err := s.families.GetVersion(ctx, familyID)
	if err != nil {
		return 0, fmt.Errorf("không thể truy vấn phiên bản dòng họ %s: %w", familyID, err)
	}
	return version, nil
}

// Calculate resolves the kinship relationship between fromID and toID in the specified family.
func (s *Service) Calculate(ctx context.Context, familyID, fromID, toID string, dialect string) (model.KinshipResult, error) {
	dialect = NormalizeDialect(dialect)

	version, err := s.currentVersion(ctx, familyID)
	if err != nil {
		return model.KinshipResult{}, err
	}

	g, err := s.engine.GetGraph(ctx, familyID, version)
	if err != nil {
		return model.KinshipResult{}, fmt.Errorf("không thể chuẩn bị đồ thị dòng họ: %w", err)
	}

	return s.engine.Calculate(g, fromID, toID, dialect)
}

// GetLabels computes kinship terms from one reference member to every member
// of the family in a single batched pass (Decision 2C, GET
// /families/:id/kinship-labels). The family graph is fetched at the family's
// CURRENT version (M3/K1) — never a pinned version 0.
func (s *Service) GetLabels(ctx context.Context, familyID, fromID, dialect string) (map[string]string, error) {
	version, err := s.currentVersion(ctx, familyID)
	if err != nil {
		return nil, err
	}

	g, err := s.engine.GetGraph(ctx, familyID, version)
	if err != nil {
		return nil, fmt.Errorf("không thể chuẩn bị đồ thị dòng họ: %w", err)
	}

	return s.engine.CalculateAllFrom(g, fromID, dialect)
}
