package model

import (
	"encoding/json"
	"time"
)

// Outbox topic values for outbox_events.topic (ADR-009/D10).
const (
	TopicFeedCreated = "feed.created"
	TopicMagicLink   = "magic_link.send"
)

// OutboxEvent is one transactional-outbox row (outbox_events table). Rows are
// written inside the same tx as the business change, then drained at-least-once
// by the background worker — post-commit side effects never run inside a tx.
type OutboxEvent struct {
	ID          string          `json:"id"`
	Topic       string          `json:"topic"` // TopicFeedCreated | TopicMagicLink
	Payload     json.RawMessage `json:"payload"`
	CreatedAt   time.Time       `json:"created_at"`
	ProcessedAt *time.Time      `json:"processed_at,omitempty"`
}

// IsProcessed reports whether the drainer already handled the event.
func (e OutboxEvent) IsProcessed() bool {
	return e.ProcessedAt != nil
}
