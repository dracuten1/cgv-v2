-- 001_create_users_and_identities.sql
-- Multi-provider auth & account linking (PROMPT.md §4 DDL).
-- Deviation from PROMPT.md: users.member_id gains its FK to members(id) only in
-- 002_create_genealogy_tables.sql, because members does not exist yet at this
-- point in lexicographic migration order.

-- Multi-provider Auth & Account Linking
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    display_name TEXT NOT NULL,
    is_demo BOOLEAN NOT NULL DEFAULT false,
    member_id UUID, -- Optional 1:1 link to a family tree member; FK added in 002 (members created there)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_identities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider TEXT NOT NULL CHECK (provider IN ('zalo', 'google', 'facebook', 'email', 'demo', 'mock')),
    -- ^ Deviation from PROMPT.md: 'mock' added to the CHECK list for the
    --   offline mock provider (MOCK_OAUTH_ENABLED, local dev + E2E Journey 3).
    provider_subject TEXT NOT NULL,
    linked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(provider, provider_subject)
);

CREATE TABLE contact_points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('email', 'phone')),
    value TEXT NOT NULL,
    verified BOOLEAN NOT NULL DEFAULT false,
    verified_via TEXT, -- e.g. 'zalo', 'google', 'magic_link'
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(kind, value)
);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    jti TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ
);

CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_user_identities_user_id ON user_identities(user_id);
