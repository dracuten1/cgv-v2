package seed

// Optional integration check: proves the fixture's kinship-journey property
// against a REAL seeded database and the REAL kinship engine —
// Nguyễn Văn Bình (GrandsonID) → Nguyễn Văn An (RootID) must compute to
// "Ông nội / Chi nội / Cách 2 đời" (PROMPT.md §6 F8 + §7 Journey 2).
//
// Gated on CGP_TEST_DSN: without it the test skips, so the default
// `go test ./internal/seed/...` run stays fully DB-free.

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/dracuten1/cgv-v2/api/internal/database"
	"github.com/dracuten1/cgv-v2/api/internal/kinship"
	genrepo "github.com/dracuten1/cgv-v2/api/internal/repository/genealogy"
)

func TestIntegration_KinshipJourneyOnSeededDB(t *testing.T) {
	dsn := os.Getenv("CGP_TEST_DSN")
	if dsn == "" {
		t.Skip("CGP_TEST_DSN chưa đặt — bỏ qua kiểm thử tích hợp (không cần Postgres)")
	}

	ctx := context.Background()
	pool, err := database.NewPool(ctx, dsn)
	if err != nil {
		t.Fatalf("không thể kết nối: %v", err)
	}
	defer pool.Close()

	if _, err := Run(ctx, pool); err != nil && !errors.Is(err, ErrAlreadySeeded) {
		t.Fatalf("seed thất bại: %v", err)
	}

	memberRepo := genrepo.NewMemberRepository(pool)
	engine := kinship.NewEngine(memberRepo) // LoadGraph satisfies KinshipGraphLoader

	// LoadGraph returns the current families.version; GetGraph caches on it.
	_, _, _, version, err := memberRepo.LoadGraph(ctx, Family1ID)
	if err != nil {
		t.Fatalf("không thể nạp phiên bản dòng họ 1: %v", err)
	}
	g, err := engine.GetGraph(ctx, Family1ID, version)
	if err != nil {
		t.Fatalf("không thể tải đồ thị dòng họ 1: %v", err)
	}

	res, err := engine.Calculate(g, GrandsonID, RootID, "bac")
	if err != nil {
		t.Fatalf("Calculate(cháu nội → thủy tổ) thất bại: %v", err)
	}
	if res.Term != "Ông nội" {
		t.Errorf("Term = %q, muốn \"Ông nội\"", res.Term)
	}
	if res.Line != "Chi nội" {
		t.Errorf("Line = %q, muốn \"Chi nội\"", res.Line)
	}
	if res.GenerationDistance != 2 {
		t.Errorf("GenerationDistance = %d, muốn 2", res.GenerationDistance)
	}
	if res.DistanceLabel != "Cách 2 đời" {
		t.Errorf("DistanceLabel = %q, muốn \"Cách 2 đời\"", res.DistanceLabel)
	}
	if !res.IsBlood {
		t.Errorf("IsBlood = false, muốn true")
	}
}
