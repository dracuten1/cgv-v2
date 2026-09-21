// Package feed implements the family feed domain service (PROMPT.md §6 F6).
// Post creation is transactional by construction (ADR-010/D10): the
// feed_posts INSERT and the `feed.created` outbox INSERT run in ONE
// database.TxManager.WithTx closure — push fanout happens post-commit via the
// outbox drainer, never from a goroutine holding the transaction.
package feed

import (
	"context"

	"github.com/dracuten1/cgv-v2/api/internal/model"
)

// TxRunner is the transaction boundary this package depends on. Satisfied by
// *database.TxManager; fakes in tests invoke fn directly against an in-memory
// context, letting us assert both-or-neither atomicity without Postgres.
type TxRunner interface {
	WithTx(ctx context.Context, fn func(ctx context.Context) error) error
}

// PostStore is the feed_posts persistence port (implemented by
// socialrepo.PostRepository with an ambient database.DBTX executor).
type PostStore interface {
	Create(ctx context.Context, post *model.Post) (*model.Post, error)
	GetByID(ctx context.Context, postID string) (*model.Post, error)
	ListByFamily(ctx context.Context, familyID string, limit int, cursor Cursor) ([]model.Post, error)
	ListByAuthor(ctx context.Context, memberID string, limit int) ([]model.Post, error)
}

// OutboxEnqueuer is the outbox write port (implemented by
// socialrepo.OutboxRepository inside the same tx as PostStore.Create).
type OutboxEnqueuer interface {
	EnqueueFeedCreated(ctx context.Context, payload []byte) (*model.OutboxEvent, error)
}

// Cursor is the keyset pagination cursor (re-exported from the repository
// contract so transport code never imports the concrete repo package).
type Cursor struct {
	CreatedAt string // RFC3339 timestamp of the previous page's last post
	ID        string // UUID of the previous page's last post
}

// Valid reports whether both halves of the cursor are present.
func (c Cursor) Valid() bool { return c.CreatedAt != "" && c.ID != "" }
