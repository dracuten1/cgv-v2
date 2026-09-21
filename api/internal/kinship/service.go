package kinship

import (
	"context"
	"fmt"

	"github.com/dracuten1/cgv-v2/api/internal/model"
)

// Service coordinates kinship requests.
type Service struct {
	engine *Engine
}

// NewService creates a new kinship Service.
func NewService(loader KinshipGraphLoader) *Service {
	return &Service{
		engine: NewEngine(loader),
	}
}

// Engine returns the underlying Engine instance.
func (s *Service) Engine() *Engine {
	return s.engine
}

// Calculate resolves the kinship relationship between fromID and toID in the specified family.
func (s *Service) Calculate(ctx context.Context, familyID, fromID, toID string, dialect string) (model.KinshipResult, error) {
	dialect = NormalizeDialect(dialect)

	// In production, loader.LoadGraph will supply version or engine.GetGraph will fetch it.
	// Since GetGraph requires a version or loads on miss, we load with version 0 (or latest).
	g, err := s.engine.GetGraph(ctx, familyID, 0)
	if err != nil {
		return model.KinshipResult{}, fmt.Errorf("không thể chuẩn bị đồ thị dòng họ: %w", err)
	}

	return s.engine.Calculate(g, fromID, toID, dialect)
}
