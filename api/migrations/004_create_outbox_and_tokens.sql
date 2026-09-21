-- 004_create_outbox_and_tokens.sql
-- Transactional outbox (ADR-009, D10) + magic-link single-use tokens (ADR-009).
-- DDL verbatim from architecture-decision-record.md §ADR-009.

-- Transactional outbox (push fanout, magic-link email) — at-least-once,
-- drained by background worker.
CREATE TABLE outbox_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    topic TEXT NOT NULL,               -- 'feed.created' | 'magic_link.send'
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ
);

CREATE INDEX idx_outbox_unprocessed ON outbox_events(created_at) WHERE processed_at IS NULL;

-- Magic-link single-use tokens (hash stored, never the raw token).
CREATE TABLE magic_link_tokens (
    token_hash TEXT PRIMARY KEY,       -- sha256(crypto/rand token)
    email TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    consumed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_magic_link_tokens_email ON magic_link_tokens(email);
