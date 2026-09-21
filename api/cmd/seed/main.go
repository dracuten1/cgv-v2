// Command seed loads the deterministic demo fixture (PROMPT.md §6 F8) into
// the CGP v2 database:
//
//	go run ./cmd/seed                  # seeds once; no-op if data exists
//	go run ./cmd/seed -force           # wipes genealogy tables and re-seeds
//	go run ./cmd/seed -dsn postgres://user:pass@localhost:5432/cgp
//
// Exit codes: 0 on success AND on the idempotent already-seeded no-op,
// 1 on any real failure.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	"github.com/dracuten1/cgv-v2/api/internal/database"
	"github.com/dracuten1/cgv-v2/api/internal/seed"
)

// resolveDSN prefers -dsn, then DATABASE_URL, then CGP_DB_DSN.
func resolveDSN(flagValue string) string {
	if flagValue != "" {
		return flagValue
	}
	if v := os.Getenv("DATABASE_URL"); v != "" {
		return v
	}
	return os.Getenv("CGP_DB_DSN")
}

func main() {
	dsnFlag := flag.String("dsn", "", "Chuỗi kết nối PostgreSQL (mặc định: biến môi trường DATABASE_URL hoặc CGP_DB_DSN)")
	force := flag.Bool("force", false, "Xóa dữ liệu gia phả cũ và seed lại từ đầu")
	flag.Parse()

	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	dsn := resolveDSN(*dsnFlag)
	if dsn == "" {
		fmt.Fprintln(os.Stderr, "Thiếu chuỗi kết nối cơ sở dữ liệu: hãy truyền cờ -dsn hoặc đặt biến môi trường DATABASE_URL (hoặc CGP_DB_DSN).")
		os.Exit(1)
	}

	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	pool, err := database.NewPool(ctx, dsn)
	if err != nil {
		logger.Error("Không thể kết nối cơ sở dữ liệu", slog.Any("error", err))
		os.Exit(1)
	}
	defer pool.Close()

	var (
		sum seed.Summary
	)
	if *force {
		sum, err = seed.Force(ctx, pool)
	} else {
		sum, err = seed.Run(ctx, pool)
	}
	if err != nil {
		if errors.Is(err, seed.ErrAlreadySeeded) {
			logger.Info("Cơ sở dữ liệu đã có dữ liệu mẫu — bỏ qua seed (dùng -force để seed lại từ đầu).")
			os.Exit(0)
		}
		logger.Error("Gieo dữ liệu mẫu thất bại", slog.Any("error", err))
		os.Exit(1)
	}

	logger.Info("Gieo dữ liệu mẫu thành công",
		slog.Int("families", sum.Families),
		slog.Int("members", sum.Members),
		slog.Int("parent_child_edges", sum.ParentChildEdges),
		slog.Int("spouse_edges", sum.SpouseEdges),
		slog.Int("feed_posts", sum.FeedPosts),
	)
	fmt.Printf("Hoàn tất gieo dữ liệu mẫu: %d dòng họ, %d thành viên, %d quan hệ cha mẹ - con, %d cặp vợ chồng, %d bài viết bảng tin.\n",
		sum.Families, sum.Members, sum.ParentChildEdges, sum.SpouseEdges, sum.FeedPosts)
	os.Exit(0)
}
