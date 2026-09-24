-- 005_unique_users_member_id.sql (MUST-FIX M1 / R-08)
-- Enforce the global 1:1 user↔member binding contract (Decision 3B / D3):
-- a family-tree member may be claimed by AT MOST one user account.
-- Partial unique index: rows with member_id IS NULL (unlinked accounts)
-- never participate, so multiple NULLs remain legal.
--
-- Consumers: auth.Service.LinkMember pre-checks (409) and maps the
-- PostgreSQL SQLSTATE 23505 raised by this index to HTTP 409 Conflict
-- when two concurrent claims race.

CREATE UNIQUE INDEX idx_users_member_id_unique
    ON users (member_id)
    WHERE member_id IS NOT NULL;
