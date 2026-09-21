-- 002_create_genealogy_tables.sql
-- Core genealogy models (PROMPT.md §4 DDL) + ADR-009 schema delta
-- (families.version) + deferred FK from users.member_id (created in 001).

CREATE TABLE families (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    version BIGINT NOT NULL DEFAULT 1,
    -- ^ ADR-009: kinship cache invalidation version; bumped in EVERY mutating tx
    --   (member CRUD, edges, import, relink).
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    family_id UUID NOT NULL REFERENCES families(id) ON DELETE CASCADE,
    full_name TEXT NOT NULL,
    gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
    generation_index INT NOT NULL DEFAULT 1,
    birth_date DATE,
    death_date DATE,
    is_living BOOLEAN NOT NULL DEFAULT true,
    avatar_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE parent_child (
    parent_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    child_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    PRIMARY KEY (parent_id, child_id),
    CHECK (parent_id <> child_id)
);

CREATE TABLE spouses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    member_a UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    member_b UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
    marriage_date DATE,
    CHECK (member_a <> member_b),
    CHECK (member_a < member_b),
    -- ^ Deviation from PROMPT.md §4 DDL: canonical-order guard. UNIQUE (member_a,
    --   member_b) alone does NOT block the reversed duplicate (b, a) of an existing
    --   pair (a, b); storing pairs in canonical order (a < b) makes the UNIQUE
    --   constraint airtight against duplicates in both directions. The repository
    --   layer MUST insert (LEAST(a, b), GREATEST(a, b)).
    UNIQUE (member_a, member_b)
);

CREATE INDEX idx_members_family_id ON members(family_id);
CREATE INDEX idx_parent_child_child_id ON parent_child(child_id);

-- Deferred from 001: members now exists, so users.member_id can reference it.
ALTER TABLE users
    ADD CONSTRAINT fk_users_member
    FOREIGN KEY (member_id) REFERENCES members(id) ON DELETE SET NULL;
