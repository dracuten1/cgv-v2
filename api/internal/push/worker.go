package push

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/config"
	"github.com/dracuten1/cgv-v2/api/internal/model"
)

// Drain tuning constants (ADR-010/D10 transactional outbox).
const (
	// DefaultDrainInterval is the outbox polling tick in production.
	DefaultDrainInterval = 5 * time.Second
	// DrainBatchSize bounds events per tick.
	DrainBatchSize = 20
	// MaxEventAttempts is the total attempts per event (first + 2 retries).
	MaxEventAttempts = 3
	// EventRetryBackoff is the wait between attempts (short-circuited in
	// tests via the injectable sleeper).
	EventRetryBackoff = 10 * time.Second
)

// MagicLinkPayload is the JSON shape of the `magic_link.send` outbox event,
// produced by the auth domain (repository/auth outbox INSERT) and consumed
// here by the SMTP mailer. Cross-coder contract — do not rename fields.
type MagicLinkPayload struct {
	Email string `json:"email"` // recipient address
	Link  string `json:"link"`  // full verification URL (one-time token)
}

// PushPayload is the JSON delivered to browsers' service workers for a
// `feed.created` event (the service worker shows it via showNotification).
type PushPayload struct {
	Title    string `json:"title"`
	Body     string `json:"body"`
	FamilyID string `json:"family_id"`
	PostID   string `json:"post_id"`
}

// Worker drains outbox_events and performs post-commit side effects:
// Web Push fanout for `feed.created`, magic-link email for `magic_link.send`
// (ADR-010/D10 — NEVER a goroutine holding or inside a transaction).
type Worker struct {
	outbox   OutboxStore
	pushRepo PushStore
	sender   Sender
	mailer   Mailer
	logger   *slog.Logger
	interval time.Duration
	backoff  time.Duration
	sleep    func(ctx context.Context, d time.Duration) // injectable for tests
}

// NewWorker builds the outbox drainer. Optional opts override the drain
// interval and retry backoff (tests inject a no-op sleeper the same way).
func NewWorker(cfg *config.Config, outbox OutboxStore, pushRepo PushStore, sender Sender, mailer Mailer, logger *slog.Logger, opts ...WorkerOption) *Worker {
	if logger == nil {
		logger = slog.Default()
	}
	w := &Worker{
		outbox:   outbox,
		pushRepo: pushRepo,
		sender:   sender,
		mailer:   mailer,
		logger:   logger,
		interval: DefaultDrainInterval,
		backoff:  EventRetryBackoff,
		sleep:    sleepCtx,
	}
	_ = cfg // reserved for delivery feature flags; senders read config themselves
	for _, opt := range opts {
		opt(w)
	}
	return w
}

// WorkerOption customizes Worker construction.
type WorkerOption func(*Worker)

// WithInterval overrides the polling interval.
func WithInterval(d time.Duration) WorkerOption {
	return func(w *Worker) { w.interval = d }
}

// WithBackoff overrides the per-event retry backoff.
func WithBackoff(d time.Duration) WorkerOption {
	return func(w *Worker) { w.backoff = d }
}

// WithSleeper replaces the backoff sleep (tests pass a no-op to short-circuit).
func WithSleeper(s func(ctx context.Context, d time.Duration)) WorkerOption {
	return func(w *Worker) { w.sleep = s }
}

// Run blocks until ctx is cancelled, draining outbox_events every interval.
// Semantics:
//   - FetchPending(DrainBatchSize) oldest-first, no FOR UPDATE (single replica
//     deployment, ADR-011) — at-least-once delivery.
//   - Per event: up to MaxEventAttempts attempts with backoff between them.
//   - Success → MarkProcessed. Exhausted → event stays unprocessed (redelivered
//     on a later tick); the batch continues with the remaining events.
//   - Unknown topic → logged and marked processed (poison-pill guard).
//   - Every side effect runs under the sender/mailer's own per-send timeout,
//     so one tick never blocks longer than batch × timeout.
func (w *Worker) Run(ctx context.Context) error {
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	w.logger.Info("Trình xử lý outbox đã khởi động",
		slog.Duration("chu_ky", w.interval),
		slog.Int("lo_rut", DrainBatchSize),
	)

	// Drain immediately on start so boot-time events are not delayed a tick.
	w.DrainOnce(ctx)

	for {
		select {
		case <-ctx.Done():
			w.logger.Info("Trình xử lý outbox đã dừng")
			return ctx.Err()
		case <-ticker.C:
			w.DrainOnce(ctx)
		}
	}
}

// DrainOnce performs one FetchPending batch synchronously. Exported so tests
// (and a future shutdown hook) can drain deterministically without waiting
// for a tick.
func (w *Worker) DrainOnce(ctx context.Context) {
	if ctx.Err() != nil {
		return
	}
	events, err := w.outbox.FetchPending(ctx, DrainBatchSize)
	if err != nil {
		w.logger.Error("Không thể đọc sự kiện chờ xử lý", slog.String("loi", err.Error()))
		return
	}
	for _, ev := range events {
		if err := w.handleEvent(ctx, ev); err != nil {
			w.logger.Error("Xử lý sự kiện outbox thất bại, sự kiện sẽ được thử lại",
				slog.String("event_id", ev.ID),
				slog.String("topic", ev.Topic),
				slog.String("loi", err.Error()),
			)
			continue
		}
		if err := w.outbox.MarkProcessed(ctx, []string{ev.ID}); err != nil {
			w.logger.Error("Không thể đánh dấu sự kiện đã xử lý",
				slog.String("event_id", ev.ID),
				slog.String("loi", err.Error()),
			)
		}
	}
}

// handleEvent dispatches one outbox event by topic with bounded retries.
// A nil error means the event is done (or deliberately poisoned-pill marked).
func (w *Worker) handleEvent(ctx context.Context, ev model.OutboxEvent) error {
	var lastErr error
	for attempt := 1; attempt <= MaxEventAttempts; attempt++ {
		switch ev.Topic {
		case model.TopicFeedCreated:
			lastErr = w.handleFeedCreated(ctx, ev)
		case model.TopicMagicLink:
			lastErr = w.handleMagicLink(ctx, ev)
		default:
			// Poison-pill guard: never let a malformed topic wedge the queue.
			w.logger.Warn("Bỏ qua chủ đề outbox không rõ (đánh dấu đã xử lý)",
				slog.String("event_id", ev.ID),
				slog.String("topic", ev.Topic),
			)
			return nil
		}

		if lastErr == nil {
			return nil
		}

		if attempt < MaxEventAttempts {
			w.logger.Warn("Xử lý sự kiện thất bại, thử lại sau backoff",
				slog.String("event_id", ev.ID),
				slog.Int("lan_thu", attempt),
				slog.Int("tong_lan", MaxEventAttempts),
				slog.Duration("cho", w.backoff),
				slog.String("loi", lastErr.Error()),
			)
			w.sleep(ctx, w.backoff)
			if ctx.Err() != nil {
				return ctx.Err()
			}
		}
	}
	return lastErr
}

// handleFeedCreated fans a feed event out to every push subscription of the
// event's family. Dead endpoints (404/410) are pruned inline; other
// subscribers still receive their notifications.
func (w *Worker) handleFeedCreated(ctx context.Context, ev model.OutboxEvent) error {
	var feed feedPayload
	if err := json.Unmarshal(ev.Payload, &feed); err != nil {
		return fmt.Errorf("payload feed.created không hợp lệ: %w", err)
	}
	if feed.FamilyID == "" {
		return fmt.Errorf("payload feed.created thiếu family_id")
	}

	subs, err := w.pushRepo.ListForFamily(ctx, feed.FamilyID)
	if err != nil {
		return fmt.Errorf("không thể lấy danh sách đăng ký của gia đình: %w", err)
	}

	notification, err := json.Marshal(PushPayload{
		Title:    "Bài viết mới trong gia đình",
		Body:     fmt.Sprintf("%s: %s", feed.Author, feed.Preview),
		FamilyID: feed.FamilyID,
		PostID:   feed.PostID,
	})
	if err != nil {
		return fmt.Errorf("không thể tạo nội dung thông báo: %w", err)
	}

	var failures int
	for _, sub := range subs {
		if err := w.sender.Send(ctx, sub, notification); err != nil {
			if IsGone(err) {
				// Browser revoked the endpoint — prune it and keep going.
				if delErr := w.pushRepo.DeleteByEndpoint(ctx, sub.Endpoint); delErr != nil {
					w.logger.Warn("Không thể xóa đăng ký đã hết hạn",
						slog.String("endpoint", sub.Endpoint),
						slog.String("loi", delErr.Error()),
					)
				}
				continue
			}
			failures++
			w.logger.Warn("Gửi thông báo đẩy thất bại cho một đăng ký",
				slog.String("endpoint", sub.Endpoint),
				slog.String("loi", err.Error()),
			)
		}
	}
	if failures == len(subs) && len(subs) > 0 {
		// Every subscriber failed with a non-terminal error → retryable.
		return fmt.Errorf("gửi thông báo thất bại cho cả %d đăng ký", failures)
	}
	return nil
}

// feedPayload mirrors feed.FeedCreatedPayload (kept structurally identical;
// duplicated to respect the package boundary — feed must not import push and
// vice versa, and the JSON contract is documented in both places).
type feedPayload struct {
	FamilyID string `json:"family_id"`
	PostID   string `json:"post_id"`
	Author   string `json:"author"`
	Preview  string `json:"preview"`
}

// handleMagicLink emails the magic link produced by the auth domain.
func (w *Worker) handleMagicLink(ctx context.Context, ev model.OutboxEvent) error {
	var ml MagicLinkPayload
	if err := json.Unmarshal(ev.Payload, &ml); err != nil {
		return fmt.Errorf("payload magic_link.send không hợp lệ: %w", err)
	}
	if ml.Email == "" || ml.Link == "" {
		return fmt.Errorf("payload magic_link.send thiếu email hoặc link")
	}

	body := "Xin chào,\n\n" +
		"Bạn vừa yêu cầu đăng nhập vào Cây Gia Phả của gia đình mình.\n" +
		"Nhấp vào liên kết bên dưới để xác nhận địa chỉ email và đăng nhập:\n\n" +
		ml.Link + "\n\n" +
		"Liên kết này chỉ sử dụng được một lần.\n" +
		"Nếu bạn không yêu cầu liên kết này, hãy bỏ qua email này.\n\n" +
		"Trân trọng,\n" +
		"Đội ngũ Cây Gia Phả"

	return w.mailer.SendMail(ctx, ml.Email, MagicLinkSubject, body)
}

// sleepCtx sleeps d but wakes early on cancellation.
func sleepCtx(ctx context.Context, d time.Duration) {
	select {
	case <-ctx.Done():
	case <-time.After(d):
	}
}
