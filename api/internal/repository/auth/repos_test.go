package authrepo_test

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/auth"
	"github.com/dracuten1/cgv-v2/api/internal/database"
	"github.com/dracuten1/cgv-v2/api/internal/model"
	authrepo "github.com/dracuten1/cgv-v2/api/internal/repository/auth"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// ---------------------------------------------------------------------------
// Capturing fake executor — records SQL + args, returns scripted results.
// ---------------------------------------------------------------------------

type fakeExec struct {
	lastSQL        string
	lastArgs       []any
	scriptedRow    rowFunc
	scriptedErr    error
	scriptedTag    pgconn.CommandTag
	scriptedRows   [][]any // for Query (list) paths
	scriptedRowsIx int
}

type rowFunc func(args []any) ([]any, error)

// compile-time: fakeExec satisfies the narrow DBTX surface.
var _ database.DBTX = (*fakeExec)(nil)

func newFakeExec() *fakeExec { return &fakeExec{} }

func (f *fakeExec) Exec(_ context.Context, sql string, args ...any) (pgconn.CommandTag, error) {
	f.lastSQL = sql
	f.lastArgs = args
	if f.scriptedErr != nil {
		return pgconn.CommandTag{}, f.scriptedErr
	}
	return f.scriptedTag, nil
}

func (f *fakeExec) Query(_ context.Context, sql string, args ...any) (pgx.Rows, error) {
	f.lastSQL = sql
	f.lastArgs = args
	if f.scriptedErr != nil {
		return nil, f.scriptedErr
	}
	return &fakeRows{rows: f.scriptedRows}, nil
}

func (f *fakeExec) QueryRow(_ context.Context, sql string, args ...any) pgx.Row {
	f.lastSQL = sql
	f.lastArgs = args
	return &fakeRow{fn: f.scriptedRow, args: args, err: f.scriptedErr}
}

// fakeRow scripts a single-row result or an error (pgx.ErrNoRows etc.).
type fakeRow struct {
	fn   rowFunc
	args []any
	err  error
}

func (r *fakeRow) Scan(dest ...any) error {
	if r.err != nil {
		return r.err
	}
	vals, err := r.fn(r.args)
	if err != nil {
		return err
	}
	for i, d := range dest {
		if i >= len(vals) {
			break
		}
		if b, ok := d.(*any); ok {
			*b = vals[i]
			continue
		}
		if scanner, ok := d.(interface{ Scan(any) error }); ok {
			_ = scanner
		}
		switch out := d.(type) {
		case *string:
			*out = vals[i].(string)
		case *bool:
			*out = vals[i].(bool)
		case *int:
			*out = vals[i].(int)
		case **string:
			*out = vals[i].(*string)
		case **time.Time:
			*out = vals[i].(*time.Time)
		case *time.Time:
			*out = vals[i].(time.Time)
		default:
			return fmt.Errorf("fakeRow: unsupported dest %T", d)
		}
	}
	return nil
}

// fakeRows walks scripted row tuples.
type fakeRows struct {
	pgx.Rows // embed nil interface for the unexercised surface

	rows   [][]any
	ix     int
	closed bool
}

func (r *fakeRows) Next() bool {
	r.ix++
	return r.ix <= len(r.rows)
}

func (r *fakeRows) Scan(dest ...any) error {
	vals := r.rows[r.ix-1]
	for i, d := range dest {
		if i >= len(vals) {
			break
		}
		switch out := d.(type) {
		case *string:
			*out = vals[i].(string)
		case *bool:
			*out = vals[i].(bool)
		default:
			return fmt.Errorf("fakeRows: unsupported dest %T", d)
		}
	}
	return nil
}

func (r *fakeRows) Err() error { return nil }
func (r *fakeRows) Close()     { r.closed = true }

// pgUniqueErr builds a real *pgconn.PgError carrying a SQLSTATE.
func pgUniqueErr() *pgconn.PgError {
	return &pgconn.PgError{Code: "23505", Message: "duplicate key value violates unique constraint"}
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

func TestIdentityRepo_Insert_Maps23505(t *testing.T) {
	fe := newFakeExec()
	fe.scriptedRow = func([]any) ([]any, error) { return nil, pgUniqueErr() }
	repo := authrepo.NewIdentityRepositoryOnExec(fe)

	_, err := repo.Insert(context.Background(), "u-1", "zalo", "z-sub")
	if err == nil {
		t.Fatal("expected error for 23505")
	}
	// Sentinel must match BOTH the repo export and the canonical auth export
	// (aliased same object) so service-layer errors.Is works both ways.
	if !errors.Is(err, authrepo.ErrDuplicateIdentity) {
		t.Fatalf("expected ErrDuplicateIdentity, got %v", err)
	}
	if !errors.Is(err, auth.ErrDuplicateIdentity) {
		t.Fatal("repo sentinel must alias auth.ErrDuplicateIdentity")
	}

	// Other pg errors must NOT collapse onto the sentinel.
	fe.scriptedRow = func([]any) ([]any, error) {
		return nil, &pgconn.PgError{Code: "23503", Message: "foreign key violation"}
	}
	_, err = repo.Insert(context.Background(), "u-missing", "zalo", "z2")
	if err == nil || errors.Is(err, authrepo.ErrDuplicateIdentity) {
		t.Fatalf("23503 must stay a wrapped business error, got %v", err)
	}
}

func TestUserRepo_GetByIDForUpdate_LocksParentRow(t *testing.T) {
	fe := newFakeExec()
	fe.scriptedRow = func(args []any) ([]any, error) {
		if len(args) != 1 {
			return nil, fmt.Errorf("expected 1 arg (user id), got %v", args)
		}
		return []any{"u-1", "Tên", false, (*string)(nil), time.Now()}, nil
	}
	repo := authrepo.NewUserRepositoryOnExec(fe)

	u, err := repo.GetByIDForUpdate(context.Background(), "u-1")
	if err != nil {
		t.Fatalf("GetByIDForUpdate failed: %v", err)
	}
	if u.ID != "u-1" {
		t.Fatalf("unexpected user %+v", u)
	}
	if !strings.Contains(fe.lastSQL, "FOR UPDATE") {
		t.Fatalf("ADR-007 guard requires SELECT … FOR UPDATE, got %q", fe.lastSQL)
	}
}

func TestTokenRepo_Consume_AtomicSQLContract(t *testing.T) {
	fe := newFakeExec()
	fe.scriptedRow = func([]any) ([]any, error) { return []any{"user@x.vn"}, nil }
	repo := authrepo.NewMagicLinkTokenRepositoryOnExec(fe)

	email, err := repo.Consume(context.Background(), "deadbeefhash")
	if err != nil || email != "user@x.vn" {
		t.Fatalf("Consume failed: %v %v", email, err)
	}

	sql := normalizeSQL(fe.lastSQL)
	for _, fragment := range []string{
		"update magic_link_tokens",
		"set consumed_at = now()",
		"where token_hash = $1",
		"and consumed_at is null",
		"and expires_at > now()",
		"returning email",
	} {
		if !strings.Contains(sql, fragment) {
			t.Fatalf("atomic consume SQL missing %q — got %q", fragment, sql)
		}
	}

	// Zero rows (already consumed/expired) → the shared sentinel.
	fe.scriptedRow = func([]any) ([]any, error) { return nil, pgx.ErrNoRows }
	_, err = repo.Consume(context.Background(), "deadbeefhash")
	if err == nil {
		t.Fatal("expected ErrTokenUsedOrExpired for zero rows")
	}
	if !errors.Is(err, authrepo.ErrTokenUsedOrExpired) || !errors.Is(err, auth.ErrTokenUsedOrExpired) {
		t.Fatalf("sentinel aliasing broken: %v", err)
	}
}

func TestEnqueueMagicLink_PayloadContractIsFrozen(t *testing.T) {
	fe := newFakeExec()
	repo := authrepo.NewOutboxRepositoryOnExec(fe)

	if err := repo.EnqueueMagicLink(context.Background(), "u@x.vn", "https://cgp.vn/verify?token=abc"); err != nil {
		t.Fatalf("EnqueueMagicLink failed: %v", err)
	}

	// Topic must be magic_link.send.
	if fe.lastArgs[0] != model.TopicMagicLink {
		t.Fatalf("expected topic %q, got %v", model.TopicMagicLink, fe.lastArgs[0])
	}

	// Payload JSON must carry EXACTLY {"email","link"} — the social coder's
	// drainer parses this shape blind.
	raw, ok := fe.lastArgs[1].([]byte)
	if !ok {
		t.Fatalf("payload must be marshalled bytes, got %T", fe.lastArgs[1])
	}
	var payload map[string]any
	if err := json.Unmarshal(raw, &payload); err != nil {
		t.Fatalf("payload must be valid JSON: %v", err)
	}
	if len(payload) != 2 || payload["email"] != "u@x.vn" || payload["link"] != "https://cgp.vn/verify?token=abc" {
		t.Fatalf("payload contract violated: %v", payload)
	}

	// The table must be outbox_events.
	if !strings.Contains(strings.ToLower(fe.lastSQL), "insert into outbox_events") {
		t.Fatalf("expected outbox_events insert, got %q", fe.lastSQL)
	}
}

func TestAcquireContactAdvisoryLock_SQLContract(t *testing.T) {
	fe := newFakeExec()
	if err := authrepo.AcquireContactAdvisoryLock(context.Background(), fe, "email", "a@b.vn"); err != nil {
		t.Fatalf("lock failed: %v", err)
	}
	sql := normalizeSQL(fe.lastSQL)
	if !strings.Contains(sql, "pg_advisory_xact_lock(hashtext($1 || ':' || $2))") {
		t.Fatalf("ADR-007 lock SQL violated: %q", fe.lastSQL)
	}
	if fe.lastArgs[0] != "email" || fe.lastArgs[1] != "a@b.vn" {
		t.Fatalf("lock args = %v", fe.lastArgs)
	}
}

func TestContactRepo_FindByKindValue_NormalizesEmailArg(t *testing.T) {
	fe := newFakeExec()
	fe.scriptedRow = func([]any) ([]any, error) {
		return []any{"c-1", "u-1", "email", "lan@gmail.com", true, (*string)(nil), time.Now()}, nil
	}
	repo := authrepo.NewContactRepositoryOnExec(fe)

	cp, err := repo.FindByKindValue(context.Background(), "email", "  Lan@Gmail.COM ")
	if err != nil {
		t.Fatalf("FindByKindValue failed: %v", err)
	}
	if cp.Value != "lan@gmail.com" {
		t.Fatalf("expected normalized stored value, got %q", cp.Value)
	}
	if fe.lastArgs[1] != "lan@gmail.com" {
		t.Fatalf("lookup arg must be normalized, got %v", fe.lastArgs[1])
	}
}

func TestSessionRepo_RevokeByJti_GuardsUnrevokedOnly(t *testing.T) {
	fe := newFakeExec()
	repo := authrepo.NewSessionRepositoryOnExec(fe)

	if err := repo.RevokeByJti(context.Background(), "jti-1"); err != nil {
		t.Fatalf("RevokeByJti failed: %v", err)
	}
	sql := normalizeSQL(fe.lastSQL)
	if !strings.Contains(sql, "revoked_at = now()") || !strings.Contains(sql, "revoked_at is null") {
		t.Fatalf("revoke must guard on revoked_at IS NULL: %q", fe.lastSQL)
	}
}

func TestIdentityRepo_ListByUser_ProjectionShape(t *testing.T) {
	fe := newFakeExec()
	fe.scriptedRows = [][]any{
		{"i-1", "u-1", "google", "g-sub"},
		{"i-2", "u-1", "zalo", "z-sub"},
	}
	repo := authrepo.NewIdentityRepositoryOnExec(fe)

	idents, err := repo.ListByUser(context.Background(), "u-1")
	if err != nil {
		t.Fatalf("ListByUser failed: %v", err)
	}
	if len(idents) != 2 || idents[0].Provider != "google" || idents[1].Provider != "zalo" {
		t.Fatalf("unexpected identities %+v", idents)
	}
}

// normalizeSQL folds whitespace/case so assertions focus on structure.
func normalizeSQL(sql string) string {
	return strings.Join(strings.Fields(strings.ToLower(sql)), " ")
}

// TestUserRepo_LinkMember_Maps23505 proves the concurrent double-claim race
// contract: a pgx SQLSTATE 23505 raised by idx_users_member_id_unique during
// LinkMember maps to ErrMemberAlreadyClaimed (→ 409 CodeConflict at the
// handler seam), while other SQLSTATEs stay wrapped business errors (M1).
func TestUserRepo_LinkMember_Maps23505(t *testing.T) {
	fe := newFakeExec()
	fe.scriptedTag = pgconn.NewCommandTag("UPDATE 1")
	fe.scriptedErr = &pgconn.PgError{Code: "23505", Message: "duplicate key value violates unique constraint \"idx_users_member_id_unique\""}
	repo := authrepo.NewUserRepositoryOnExec(fe)

	err := repo.LinkMember(context.Background(), "u-1", "m-1")
	if err == nil {
		t.Fatal("expected error for 23505 race")
	}
	if !errors.Is(err, authrepo.ErrMemberAlreadyClaimed) {
		t.Fatalf("expected ErrMemberAlreadyClaimed, got %v", err)
	}
	if !errors.Is(err, auth.ErrMemberAlreadyClaimed) {
		t.Fatal("repo sentinel must alias auth.ErrMemberAlreadyClaimed")
	}
	if !strings.Contains(normalizeSQL(fe.lastSQL), "update users set member_id") {
		t.Fatalf("expected LinkMember UPDATE, got %q", fe.lastSQL)
	}

	// M-A: A 23503 SQLSTATE (foreign key violation, member deleted in TOCTOU race)
	// must map to ErrMemberNotFound (→ 404 at the handler seam), NOT a claim conflict.
	fe.scriptedErr = &pgconn.PgError{Code: "23503", Message: "foreign key violation"}
	err = repo.LinkMember(context.Background(), "u-1", "m-missing")
	if err == nil {
		t.Fatal("expected error for 23503 FK race")
	}
	if errors.Is(err, authrepo.ErrMemberAlreadyClaimed) {
		t.Fatalf("23503 must NOT map to ErrMemberAlreadyClaimed, got %v", err)
	}
	if !errors.Is(err, authrepo.ErrMemberNotFound) {
		t.Fatalf("expected ErrMemberNotFound for 23503, got %v", err)
	}
	if !errors.Is(err, auth.ErrMemberNotFound) {
		t.Fatal("repo sentinel must alias auth.ErrMemberNotFound")
	}
}

// TestUserRepo_GetByMemberID_UnclaimedIsNilNil proves the M1 Rule 4
// pre-check seam: an unclaimed member resolves to (nil, nil), not an error.
func TestUserRepo_GetByMemberID_UnclaimedIsNilNil(t *testing.T) {
	fe := newFakeExec()
	fe.scriptedRow = func([]any) ([]any, error) { return nil, pgx.ErrNoRows }
	repo := authrepo.NewUserRepositoryOnExec(fe)

	u, err := repo.GetByMemberID(context.Background(), "m-unclaimed")
	if err != nil {
		t.Fatalf("unclaimed member must not error, got %v", err)
	}
	if u != nil {
		t.Fatalf("unclaimed member must resolve to nil user, got %+v", u)
	}

	// Claimed: row comes back.
	fe.scriptedRow = func(args []any) ([]any, error) {
		return []any{"u-2", "Người Hai", false, (*string)(nil), time.Now()}, nil
	}
	u, err = repo.GetByMemberID(context.Background(), "m-claimed")
	if err != nil || u == nil || u.ID != "u-2" {
		t.Fatalf("expected holder user u-2, got %+v (err=%v)", u, err)
	}
}
