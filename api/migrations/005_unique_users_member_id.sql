-- 005_unique_users_member_id.sql (MUST-FIX M1 / R-08)
-- Enforce the global 1:1 user↔member binding contract (Decision 3B / D3):
-- a family-tree member may be claimed by AT MOST one user account.
-- Partial unique index: rows with member_id IS NULL (unlinked accounts)
-- never participate, so multiple NULLs remain legal.
--
-- Consumers: auth.Service.LinkMember pre-checks (409) and maps the
-- PostgreSQL SQLSTATE 23505 raised by this index to HTTP 409 Conflict
-- when two concurrent claims race.
--
-- Pre-flight diagnostic guard (M-B): if legacy data contains duplicate non-null
-- member_id values, surface a helpful diagnostic notice with offending row
-- details and remediation hint rather than an opaque index creation failure.

DO $$
DECLARE
    dup_details TEXT;
BEGIN
    SELECT string_agg(format('member_id=%s (user_ids: %s)', member_id, users), E'\n')
    INTO dup_details
    FROM (
        SELECT member_id, string_agg(id::text, ', ' ORDER BY id) AS users
        FROM users
        WHERE member_id IS NOT NULL
        GROUP BY member_id
        HAVING count(*) > 1
    ) sub;

    IF dup_details IS NOT NULL THEN
        RAISE EXCEPTION 'migration 005 pre-flight duplicate check failed: duplicate non-null member_id values exist in users table:
%
', dup_details
        USING HINT = 'deduplicate users.member_id before re-running migration';
    END IF;

    CREATE UNIQUE INDEX idx_users_member_id_unique
        ON users (member_id)
        WHERE member_id IS NOT NULL;
END $$;
