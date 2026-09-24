package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/auth"
	"github.com/dracuten1/cgv-v2/api/internal/config"
	"github.com/dracuten1/cgv-v2/api/internal/database"
	"github.com/dracuten1/cgv-v2/api/internal/excel"
	"github.com/dracuten1/cgv-v2/api/internal/feed"
	"github.com/dracuten1/cgv-v2/api/internal/handler"
	"github.com/dracuten1/cgv-v2/api/internal/kinship"
	"github.com/dracuten1/cgv-v2/api/internal/model"
	"github.com/dracuten1/cgv-v2/api/internal/push"
	authrepo "github.com/dracuten1/cgv-v2/api/internal/repository/auth"
	genrepo "github.com/dracuten1/cgv-v2/api/internal/repository/genealogy"
	"github.com/dracuten1/cgv-v2/api/internal/repository/social"
	"github.com/dracuten1/cgv-v2/api/internal/seed"
)

func main() {
	// 1. Structured JSON logger (slog)
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	// 2. Load configuration
	cfg, err := config.Load()
	if err != nil {
		logger.Error("KHỞI ĐỘNG THẤT BẠI: không thể nạp cấu hình hệ thống", slog.Any("error", err))
		os.Exit(1)
	}

	// 3. INV-04: Fail-fast pre-listen validation BEFORE any listener or database connection
	cfg.ValidateOrDie()

	// 4. Signal-aware root context
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// 5. Connect to PostgreSQL via pgxpool (D3)
	logger.Info("Đang kết nối cơ sở dữ liệu PostgreSQL...")
	pool, err := database.NewPool(ctx, cfg.DatabaseURL)
	if err != nil {
		logger.Error("KHỞI ĐỘNG THẤT BẠI: không thể tạo kết nối PostgreSQL", slog.Any("error", err))
		os.Exit(1)
	}
	defer pool.Close()

	// 6. Run database migrations (idempotent, advisory-locked)
	logger.Info("Đang kiểm tra và thực thi migration cơ sở dữ liệu...")
	if err := database.Migrate(ctx, pool); err != nil {
		logger.Error("KHỞI ĐỘNG THẤT BẠI: thực thi migration thất bại", slog.Any("error", err))
		os.Exit(1)
	}
	logger.Info("Migration cơ sở dữ liệu thành công")

	// 7. Auto-seed if configured
	if cfg.AutoSeed {
		logger.Info("Kiểm tra tự động nạp dữ liệu mẫu (AutoSeed)...")
		txMgr := database.NewTxManager(pool)
		err := txMgr.WithTx(ctx, func(txCtx context.Context) error {
			exec := database.GetExecutor(txCtx, pool)
			// Advisory lock for auto-seed to serialize parallel boots
			if _, err := exec.Exec(txCtx, `SELECT pg_advisory_xact_lock(hashtext('cgp_autoseed'))`); err != nil {
				return fmt.Errorf("không thể khóa cgp_autoseed: %w", err)
			}

			var familyCount int64
			if err := exec.QueryRow(txCtx, `SELECT COUNT(*) FROM families`).Scan(&familyCount); err != nil {
				return fmt.Errorf("không thể kiểm tra số lượng dòng họ: %w", err)
			}

			if familyCount == 0 {
				logger.Info("Cơ sở dữ liệu trống, tiến hành nạp dữ liệu mẫu ban đầu...")
				summary, err := seed.RunWithExecutor(txCtx, exec)
				if err != nil {
					if errors.Is(err, seed.ErrAlreadySeeded) {
						logger.Info("Dữ liệu đã tồn tại, bỏ qua bước nạp mẫu")
						return nil
					}
					return fmt.Errorf("lỗi nạp dữ liệu mẫu: %w", err)
				}
				logger.Info("Nạp dữ liệu mẫu thành công",
					slog.Int("so_dong_ho", summary.Families),
					slog.Int("so_thanh_vien", summary.Members),
					slog.Int("quan_he_cha_con", summary.ParentChildEdges),
					slog.Int("quan_he_vo_chong", summary.SpouseEdges),
					slog.Int("bai_viet_bang_tin", summary.FeedPosts),
				)
			} else {
				logger.Info("Đã có dữ liệu dòng họ, bỏ qua tự động nạp mẫu", slog.Int64("so_luong", familyCount))
			}
			return nil
		})
		if err != nil {
			if cfg.AppEnv == config.EnvDemo || cfg.DemoMode {
				logger.Error("KHỞI ĐỘNG THẤT BẠI: AutoSeed thất bại trong môi trường Demo", slog.Any("error", err))
				os.Exit(1)
			}
			logger.Warn("Cảnh báo trong quá trình AutoSeed", slog.Any("error", err))
		}
	}

	// 8. Construct repositories & adapters
	txManager := database.NewTxManager(pool)

	userRepo := authrepo.NewUserRepository(pool)
	identityRepo := authrepo.NewIdentityRepository(pool)
	contactRepo := authrepo.NewContactRepository(pool)
	tokenRepo := authrepo.NewMagicLinkTokenRepository(pool)
	sessionRepo := authrepo.NewSessionRepository(pool)
	locker := authrepo.NewContactLocker(pool)
	authOutbox := authrepo.NewOutboxRepository(pool)

	familyRepo := genrepo.NewFamilyRepository(pool)
	memberRepo := genrepo.NewMemberRepository(pool)
	relationRepo := genrepo.NewRelationshipRepository(pool)
	importRepo := genrepo.NewImportRepository(pool)

	socialPostRepo := socialrepo.NewPostRepository()
	socialOutboxRepo := socialrepo.NewOutboxRepository()
	socialPushRepo := socialrepo.NewPushRepository()

	// 9. Construct domain services
	authSvc := auth.NewService(cfg, txManager, auth.ServiceDeps{
		Users:      userRepo,
		Identities: identityRepo,
		Contacts:   contactRepo,
		Tokens:     tokenRepo,
		Sessions:   sessionRepo,
		Locker:     locker,
		Outbox:     authOutbox,
		Members:    memberLookupAdapter{repo: memberRepo},
	})

	kinshipSvc := kinship.NewService(memberRepo, familyRepo)

	excelImportAdapter := &handler.ExcelImportAdapter{
		ImportRepo: importRepo,
		FamilyRepo: familyRepo,
	}
	excelSvc := excel.NewService(memberRepo, excelImportAdapter, txManager, kinshipSvc.Engine())

	feedPostAdapter := &handler.FeedPostAdapter{
		Repo: socialPostRepo,
		Pool: pool,
	}
	feedOutboxAdapter := &handler.FeedOutboxAdapter{
		Repo: socialOutboxRepo,
		Pool: pool,
	}
	authorNamer := &handler.AuthorNamerAdapter{
		Users:   userRepo,
		Members: memberRepo,
	}
	feedSvc := feed.NewService(txManager, feedPostAdapter, feedOutboxAdapter, authorNamer)

	pushStoreAdapter := &handler.PushStoreAdapter{
		Repo: socialPushRepo,
		Pool: pool,
	}
	pushSvc := push.NewService(pushStoreAdapter)

	// 10. Background push & mail outbox worker
	outboxStoreAdapter := &handler.OutboxStoreAdapter{
		Repo: socialOutboxRepo,
		Pool: pool,
	}
	webPushSender := push.NewWebPushSender(cfg, nil, logger)
	smtpMailer := push.NewSMTPMailer(cfg)

	if cfg.VAPIDPublicKey == "" || cfg.VAPIDPrivateKey == "" {
		logger.Warn("VAPID chưa được cấu hình đầy đủ (VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY) - thông báo đẩy Web Push sẽ bị bỏ qua")
	}
	if !smtpMailer.Configured() {
		logger.Warn("Máy chủ gửi thư SMTP chưa được cấu hình (SMTP_HOST) - liên kết đăng nhập email sẽ không thể gửi")
	}

	pushWorker := push.NewWorker(cfg, outboxStoreAdapter, pushStoreAdapter, webPushSender, smtpMailer, logger)

	// Start worker in background
	workerCtx, cancelWorker := context.WithCancel(context.Background())
	defer cancelWorker()

	go func() {
		logger.Info("Khởi chạy luồng xử lý nền (Outbox Worker)...")
		_ = pushWorker.Run(workerCtx)
	}()

	// 11. Construct HTTP router
	r := handler.NewRouter(handler.Deps{
		Cfg:            cfg,
		Logger:         logger,
		Pinger:         pool,
		TxManager:      txManager,
		AuthService:    authSvc,
		UserStore:      userRepo,
		ContactStore:   contactRepo,
		FamilyRepo:     familyRepo,
		MemberRepo:     memberRepo,
		RelationRepo:   relationRepo,
		KinshipSvc:     kinshipSvc,
		KinshipInv:     kinshipSvc.Engine(),
		ExcelSvc:       excelSvc,
		FeedSvc:        feedSvc,
		FeedNamer:      authorNamer,
		SocialPostRepo: socialPostRepo,
		PushSvc:        pushSvc,
	})

	// 12. HTTP Server with explicit timeout budget
	addr := fmt.Sprintf(":%d", cfg.Port)
	srv := &http.Server{
		Addr:              addr,
		Handler:           r,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      30 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	// Server goroutine
	serverErrChan := make(chan error, 1)
	go func() {
		logger.Info("Máy chủ CGP v2 API đang lắng nghe",
			slog.String("dia_chi", addr),
			slog.String("moi_truong", string(cfg.AppEnv)),
			slog.Bool("demo_mode", cfg.DemoMode),
		)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			serverErrChan <- err
		}
	}()

	// 13. Graceful shutdown on interrupt/termination signal
	select {
	case <-ctx.Done():
		logger.Info("Nhận tín hiệu dừng máy chủ (SIGINT/SIGTERM), đang dọn dẹp tài nguyên...")
	case err := <-serverErrChan:
		logger.Error("Lỗi máy chủ HTTP", slog.Any("error", err))
	}

	// Stop background worker
	cancelWorker()

	// Shutdown HTTP listener with 10s budget
	shutdownCtx, cancelShutdown := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancelShutdown()

	if err := srv.Shutdown(shutdownCtx); err != nil {
		logger.Error("Lỗi đóng máy chủ HTTP", slog.Any("error", err))
	} else {
		logger.Info("Đã đóng kết nối máy chủ HTTP an toàn")
	}

	logger.Info("Hệ thống CGP v2 API đã dừng hoàn tất. Tạm biệt!")
}

// memberLookupAdapter adapts genrepo.MemberRepository to the auth.MemberLookup
// port: the concrete repo returns the MemberWithFamily projection, the auth
// domain programs against the bare model.Member (consumer-side port, M1
// Rule 2 member existence check for POST /me/member).
type memberLookupAdapter struct {
	repo *genrepo.MemberRepository
}

// GetByID satisfies auth.MemberLookup.
func (a memberLookupAdapter) GetByID(ctx context.Context, memberID string) (*model.Member, error) {
	mwf, err := a.repo.GetByID(ctx, memberID)
	if err != nil {
		return nil, err
	}
	return &mwf.Member, nil
}
