package socialrepo

import (
	"context"
	"fmt"
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/database"
	"github.com/dracuten1/cgv-v2/api/internal/model"
)

// OutboxRepository handles the transactional outbox (outbox_events, ADR-009).
// ADR-010/D10: business writers enqueue INSIDE their tx via EnqueueFeedCreated
// (dbtx = ambient tx executor); the background drainer (internal/push worker)
// consumes via FetchPending/MarkProcessed on the pool.
type OutboxRepository struct{}

// NewOutboxRepository creates a new OutboxRepository.
func NewOutboxRepository() *OutboxRepository {
	return &OutboxRepository{}
}

// EnqueueFeedCreated inserts a `feed.created` event with the given JSONB
// payload. MUST run inside the same tx as the feed_posts INSERT it belongs to
// (ADR-010 all-or-nothing) — pass the ambient database.DBTX from within WithTx.
// Payload shape (producer = internal/feed.Service, consumer = push.Worker):
//
//	{"family_id":"<uuid>","post_id":"<uuid>","author":"<display or member name>","preview":"<=120 runes>"}
func (r *OutboxRepository) EnqueueFeedCreated(ctx context.Context, dbtx database.DBTX, payload []byte) (*model.OutboxEvent, error) {
	ev := model.OutboxEvent{Topic: model.TopicFeedCreated, Payload: payload}
	err := dbtx.QueryRow(ctx, `INSERT INTO outbox_events (topic, payload) VALUES ($1, $2)
RETURNING id, created_at`, model.TopicFeedCreated, []byte(payload)).Scan(&ev.ID, &ev.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("không thể ghi sự kiện bảng tin vào outbox: %w", err)
	}
	return &ev, nil
}

// FetchPending returns up to limit unprocessed events, oldest first.
//
// Concurrency choice: rows are fetched WITHOUT `FOR UPDATE SKIP LOCKED` and
// WITHOUT a holding tx. Justification: this deployment runs exactly one worker
// replica (single-node docker-compose, ADR-011), so there is no second drainer
// to contend with; a plain read keeps the drain loop lock-free. At-least-once
// semantics are preserved regardless: a crash between a successful side effect
// and MarkProcessed merely re-sends on the next tick (push re-delivery and
// magic-link mail are idempotent enough for a family app). If a second replica
// is ever added, switch this to `FOR UPDATE SKIP LOCKED` inside a tx.
func (r *OutboxRepository) FetchPending(ctx context.Context, dbtx database.DBTX, limit int) ([]model.OutboxEvent, error) {
	if limit <= 0 {
		limit = 20
	}
	rows, err := dbtx.Query(ctx, `SELECT id, topic, payload, created_at, processed_at
FROM outbox_events WHERE processed_at IS NULL ORDER BY created_at ASC LIMIT $1`, limit)
	if err != nil {
		return nil, fmt.Errorf("không thể truy vấn sự kiện chờ xử lý: %w", err)
	}
	defer rows.Close()

	events := []model.OutboxEvent{}
	for rows.Next() {
		var (
			ev        model.OutboxEvent
			processed *interface{ Scan(any) error }
			_         = processed // placeholder never used; kept out of the scan below
		)
		_ = ev
		var pAt *interface{}
		_ = pAt
		var processedAt *time.Time
		var payload []byte
		if err := rows.Scan(&ev.ID, &ev.Topic, &payload, &ev.CreatedAt, &processedAt); err != nil {
			return nil, fmt.Errorf("không thể đọc sự kiện chờ xử lý: %w", err)
		}
		ev.Payload = payload
		ev.ProcessedAt = processedAt
		events = append(events, ev)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("lỗi trong quá trình đọc sự kiện chờ xử lý: %w", err)
	}
	return events, nil
}

// MarkProcessed stamps processed_at = NOW() on the given event ids. Unknown
// ids are ignored (at-least-once: a concurrent drain may have raced us).
func (r *OutboxRepository) MarkProcessed(ctx context.Context, dbtx database.DBTX, ids []string) error {
	if len(ids) == 0 {
		return nil
	}
	_, err := dbtx.Exec(ctx, `UPDATE outbox_events SET processed_at = NOW() WHERE id = ANY($1)`, ids)
	if err != nil {
		return fmt.Errorf("không thể đánh dấu sự kiện đã xử lý: %w", err)
	}
	return nil
}

// CountPending returns the number of unprocessed events (health/metrics).
func (r *OutboxRepository) CountPending(ctx context.Context, dbtx database.DBTX) (int64, error) {
	var n int64
	err := dbtx.QueryRow(ctx, `SELECT COUNT(*) FROM outbox_events WHERE processed_at IS NULL`).Scan(&n)
	if err != nil {
		return 0, fmt.Errorf("không thể đếm sự kiện chờ xử lý: %w", err)
	}
	return n, nil
}
