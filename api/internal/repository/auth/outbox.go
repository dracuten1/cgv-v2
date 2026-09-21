package authrepo

import (
	"context"
	"encoding/json"
	"fmt"

	"github.com/dracuten1/cgv-v2/api/internal/database"
	"github.com/dracuten1/cgv-v2/api/internal/model"
	"github.com/jackc/pgx/v5/pgxpool"
)

// MagicLinkPayload is the JSON shape written into
// outbox_events.payload for topic magic_link.send. The social-domain drainer
// parses EXACTLY these keys — treat the contract as frozen.
type MagicLinkPayload struct {
	Email string `json:"email"` // recipient address
	Link  string `json:"link"`  // full verify URL (frontend route + raw token)
}

// EnqueueMagicLink writes the magic_link.send outbox row on the given
// executor — normally the ambient pgx.Tx inside the same transaction that
// stored the token, so the email is never sent for a token that never
// committed (transactional outbox, ADR-009/D10). Passing a plain *pgxpool.Pool
// (no ambient tx) is allowed for token flows that need no other writes.
func EnqueueMagicLink(ctx context.Context, exec database.DBTX, email, linkURL string) error {
	payload, err := json.Marshal(MagicLinkPayload{Email: email, Link: linkURL})
	if err != nil {
		return fmt.Errorf("không thể dựng nội dung thư liên kết đăng nhập: %w", err)
	}
	if _, err := exec.Exec(ctx,
		`INSERT INTO outbox_events (topic, payload) VALUES ($1, $2)`,
		model.TopicMagicLink, payload); err != nil {
		return fmt.Errorf("không thể ghi sự kiện gửi liên kết đăng nhập: %w", err)
	}
	return nil
}

// OutboxRepository groups outbox helpers behind the shared pool for handlers
// that need an executor-free entry point (exec mode binds a fixed executor).
type OutboxRepository struct {
	pool *pgxpool.Pool
	exec database.DBTX
}

// NewOutboxRepository wires an OutboxRepository onto the shared pool.
func NewOutboxRepository(pool *pgxpool.Pool) *OutboxRepository {
	return &OutboxRepository{pool: pool}
}

// NewOutboxRepositoryOnExec binds the repository to a fixed executor.
func NewOutboxRepositoryOnExec(exec database.DBTX) *OutboxRepository {
	return &OutboxRepository{exec: exec}
}

// executor resolves per-call: ambient tx → pool, or the bound exec.
func (r *OutboxRepository) executor(ctx context.Context) database.DBTX {
	if r.pool != nil {
		return database.GetExecutor(ctx, r.pool)
	}
	return r.exec
}

// EnqueueMagicLink enqueues on the ambient executor (tx when present).
func (r *OutboxRepository) EnqueueMagicLink(ctx context.Context, email, linkURL string) error {
	return EnqueueMagicLink(ctx, r.executor(ctx), email, linkURL)
}
