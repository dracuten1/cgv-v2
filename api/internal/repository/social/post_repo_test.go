package socialrepo_test

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/database"
	"github.com/dracuten1/cgv-v2/api/internal/model"
	"github.com/dracuten1/cgv-v2/api/internal/repository/social"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgconn"
)

// NOTE: stdlib-only tests (go.sum frozen — see feed/push test files). The
// concrete pgx SQL is exercised through a fake database.DBTX, proving the
// query shapes (keyset branches, limit clamps) and error mapping without a
// live Postgres — same technique as internal/database's tx_test.go.

// fakeDBTX captures the executed SQL/args and replays canned rows.
type fakeDBTX struct {
	database.DBTX // embedded nil; overridden methods only

	gotSQL  string
	gotArgs []any
	rows    []model.Post // rows replayed by Query (list paths)
	errNo   error        // error returned by QueryRow scans (e.g. pgx.ErrNoRows)
	execTag pgconn.CommandTag
	rowFn   func(dest ...any) error // QueryRow reply; post-shaped when nil
}

func (f *fakeDBTX) Exec(ctx context.Context, q string, args ...any) (pgconn.CommandTag, error) {
	f.gotSQL = q
	f.gotArgs = args
	return f.execTag, nil
}

func (f *fakeDBTX) Query(ctx context.Context, q string, args ...any) (pgx.Rows, error) {
	f.gotSQL = q
	f.gotArgs = args
	return &fakeRows{rows: f.rows}, nil
}

func (f *fakeDBTX) QueryRow(ctx context.Context, q string, args ...any) pgx.Row {
	f.gotSQL = q
	f.gotArgs = args
	if f.errNo != nil {
		return errRow{err: f.errNo}
	}
	if f.rowFn != nil {
		return fnRow{fn: f.rowFn}
	}
	return postRow{post: f.rows[0]}
}

// postRowFn renders a model.Post into the 6-destination scan shape used by
// GetByID.
func postRowFn(p model.Post) func(dest ...any) error {
	return func(dest ...any) error {
		images, err := model.ImagesToJSON(p.Images)
		if err != nil {
			return err
		}
		*(dest[0].(*string)) = p.ID
		*(dest[1].(*string)) = p.FamilyID
		*(dest[2].(**string)) = p.AuthorMemberID
		*(dest[3].(*string)) = p.Content
		*(dest[4].(*[]byte)) = images
		*(dest[5].(*time.Time)) = p.CreatedAt
		return nil
	}
}

type fnRow struct{ fn func(dest ...any) error }

func (r fnRow) Scan(dest ...any) error { return r.fn(dest...) }

// fakeRows replays []model.Post through the pgx.Rows surface.
type fakeRows struct {
	pgx.Rows
	rows []model.Post
	i    int
}

func (r *fakeRows) Next() bool {
	r.i++
	return r.i <= len(r.rows)
}

func (r *fakeRows) Scan(dest ...any) error {
	p := r.rows[r.i-1]
	images, err := model.ImagesToJSON(p.Images)
	if err != nil {
		return err
	}
	*(dest[0].(*string)) = p.ID
	*(dest[1].(*string)) = p.FamilyID
	*(dest[2].(**string)) = p.AuthorMemberID
	*(dest[3].(*string)) = p.Content
	*(dest[4].(*[]byte)) = images
	*(dest[5].(*time.Time)) = p.CreatedAt
	return nil
}

func (r *fakeRows) Close()     {}
func (r *fakeRows) Err() error { return nil }

type postRow struct{ post model.Post }

func (r postRow) Scan(dest ...any) error {
	p := r.post
	images, err := model.ImagesToJSON(p.Images)
	if err != nil {
		return err
	}
	*(dest[0].(*string)) = p.ID
	*(dest[1].(*string)) = p.FamilyID
	*(dest[2].(**string)) = p.AuthorMemberID
	*(dest[3].(*string)) = p.Content
	*(dest[4].(*[]byte)) = images
	*(dest[5].(*time.Time)) = p.CreatedAt
	return nil
}

type errRow struct{ err error }

func (r errRow) Scan(dest ...any) error { return r.err }

func TestListByFamily_CursorBranches(t *testing.T) {
	repo := socialrepo.NewPostRepository()
	ctx := context.Background()
	t0 := time.Date(2026, 9, 21, 9, 0, 0, 0, time.UTC)

	t.Run("first page has no cursor predicate", func(t *testing.T) {
		db := &fakeDBTX{}
		if _, err := repo.ListByFamily(ctx, db, "fam-1", 10, socialrepo.Cursor{}); err != nil {
			t.Fatalf("ListByFamily: %v", err)
		}
		if len(db.gotArgs) != 2 {
			t.Fatalf("first page must bind family_id + limit only, got %d args", len(db.gotArgs))
		}
		for _, frag := range []string{"ORDER BY created_at DESC, id DESC", "LIMIT $2", "WHERE family_id = $1"} {
			if !strings.Contains(db.gotSQL, frag) {
				t.Fatalf("SQL missing %q:\n%s", frag, db.gotSQL)
			}
		}
	})

	t.Run("cursor page adds keyset predicate with timestamp+id", func(t *testing.T) {
		db := &fakeDBTX{}
		cur := socialrepo.Cursor{CreatedAt: t0.Format(time.RFC3339), ID: "00000000-0000-0000-0000-000000000009"}
		if _, err := repo.ListByFamily(ctx, db, "fam-1", 10, cur); err != nil {
			t.Fatalf("ListByFamily: %v", err)
		}
		if !strings.Contains(db.gotSQL, "(created_at, id) < ($2::timestamptz, $3::uuid)") {
			t.Fatalf("SQL missing keyset predicate:\n%s", db.gotSQL)
		}
		if len(db.gotArgs) != 4 {
			t.Fatalf("cursor page must bind 4 args, got %d", len(db.gotArgs))
		}
		if db.gotArgs[1] != cur.CreatedAt || db.gotArgs[2] != cur.ID {
			t.Fatalf("cursor args wrong: %+v", db.gotArgs)
		}
	})

	t.Run("limit clamped to [1,100]", func(t *testing.T) {
		for _, tc := range []struct{ in, want int }{{0, 20}, {-5, 20}, {250, 100}, {7, 7}} {
			db := &fakeDBTX{}
			if _, err := repo.ListByFamily(ctx, db, "fam-1", tc.in, socialrepo.Cursor{}); err != nil {
				t.Fatalf("ListByFamily(limit=%d): %v", tc.in, err)
			}
			if db.gotArgs[1] != tc.want {
				t.Fatalf("limit %d clamped to %v, want %d", tc.in, db.gotArgs[1], tc.want)
			}
		}
	})

	t.Run("images JSONB decoded into []string", func(t *testing.T) {
		db := &fakeDBTX{rows: []model.Post{{
			ID: "p1", FamilyID: "fam-1", Content: "nội dung",
			Images: []string{"https://a.com/1.jpg"}, CreatedAt: t0,
		}}}
		posts, err := repo.ListByFamily(ctx, db, "fam-1", 10, socialrepo.Cursor{})
		if err != nil {
			t.Fatalf("ListByFamily: %v", err)
		}
		if len(posts) != 1 || len(posts[0].Images) != 1 || posts[0].Images[0] != "https://a.com/1.jpg" {
			t.Fatalf("images not decoded: %+v", posts)
		}
	})
}

func TestListByAuthor_NewestFirstShape(t *testing.T) {
	repo := socialrepo.NewPostRepository()
	db := &fakeDBTX{}
	if _, err := repo.ListByAuthor(context.Background(), db, "member-1", 5); err != nil {
		t.Fatalf("ListByAuthor: %v", err)
	}
	if !strings.Contains(db.gotSQL, "WHERE author_member_id = $1") || !strings.Contains(db.gotSQL, "ORDER BY created_at DESC, id DESC") {
		t.Fatalf("ListByAuthor SQL wrong:\n%s", db.gotSQL)
	}
}

func TestGetByID_NotFoundMapping(t *testing.T) {
	repo := socialrepo.NewPostRepository()

	t.Run("found", func(t *testing.T) {
		db := &fakeDBTX{rowFn: postRowFn(model.Post{ID: "p1", FamilyID: "fam-1", Content: "x"})}
		p, err := repo.GetByID(context.Background(), db, "p1")
		if err != nil || p == nil {
			t.Fatalf("GetByID: %v", err)
		}
		if p.Content != "x" {
			t.Fatalf("content = %q", p.Content)
		}
	})

	t.Run("pgx.ErrNoRows maps to socialrepo.ErrNotFound", func(t *testing.T) {
		db := &fakeDBTX{errNo: pgx.ErrNoRows}
		_, err := repo.GetByID(context.Background(), db, "missing")
		if !errors.Is(err, socialrepo.ErrNotFound) {
			t.Fatalf("err = %v, want socialrepo.ErrNotFound", err)
		}
	})
}

func TestPushRepo_DeleteByEndpoint(t *testing.T) {
	repo := socialrepo.NewPushRepository()
	ctx := context.Background()

	t.Run("rows affected → nil error", func(t *testing.T) {
		db := &fakeDBTX{execTag: pgconn.NewCommandTag("DELETE 1")}
		if err := repo.DeleteByEndpoint(ctx, db, "https://push.example/ep"); err != nil {
			t.Fatalf("DeleteByEndpoint: %v", err)
		}
		if !strings.Contains(db.gotSQL, "DELETE FROM push_subscriptions WHERE endpoint = $1") {
			t.Fatalf("SQL wrong: %s", db.gotSQL)
		}
	})

	t.Run("zero rows → socialrepo.ErrNotFound", func(t *testing.T) {
		db := &fakeDBTX{execTag: pgconn.NewCommandTag("DELETE 0")}
		if err := repo.DeleteByEndpoint(ctx, db, "https://push.example/gone"); !errors.Is(err, socialrepo.ErrNotFound) {
			t.Fatalf("err = %v, want socialrepo.ErrNotFound", err)
		}
	})
}

func TestOutboxRepo_QueryShapes(t *testing.T) {
	repo := socialrepo.NewOutboxRepository()
	ctx := context.Background()

	t.Run("MarkProcessed binds ids", func(t *testing.T) {
		db := &fakeDBTX{}
		if err := repo.MarkProcessed(ctx, db, []string{"a", "b"}); err != nil {
			t.Fatalf("MarkProcessed: %v", err)
		}
		if !strings.Contains(db.gotSQL, "SET processed_at = NOW() WHERE id = ANY($1)") {
			t.Fatalf("MarkProcessed SQL wrong:\n%s", db.gotSQL)
		}
	})
	t.Run("FetchPending filters unprocessed oldest-first", func(t *testing.T) {
		db := &fakeDBTX{}
		if _, err := repo.FetchPending(ctx, db, 20); err != nil {
			t.Fatalf("FetchPending: %v", err)
		}
		if !strings.Contains(db.gotSQL, "WHERE processed_at IS NULL") || !strings.Contains(db.gotSQL, "ORDER BY created_at ASC LIMIT $1") {
			t.Fatalf("FetchPending SQL wrong:\n%s", db.gotSQL)
		}
	})

	t.Run("EnqueueFeedCreated writes the feed.created topic", func(t *testing.T) {
		db := &fakeDBTX{rowFn: func(dest ...any) error {
			*(dest[0].(*string)) = "ev-uuid-1"
			*(dest[1].(*time.Time)) = time.Now()
			return nil
		}}
		ev, err := repo.EnqueueFeedCreated(ctx, db, []byte(`{"family_id":"f1"}`))
		if err != nil {
			t.Fatalf("EnqueueFeedCreated: %v", err)
		}
		if ev.ID != "ev-uuid-1" || ev.Topic != model.TopicFeedCreated {
			t.Fatalf("returned event wrong: %+v", ev)
		}
		if !strings.Contains(db.gotSQL, "INSERT INTO outbox_events (topic, payload)") {
			t.Fatalf("Enqueue SQL wrong:\n%s", db.gotSQL)
		}
		if db.gotArgs[0] != model.TopicFeedCreated {
			t.Fatalf("topic arg = %v, want %s", db.gotArgs[0], model.TopicFeedCreated)
		}
	})

	t.Run("CountPending counts unprocessed", func(t *testing.T) {
		db := &fakeDBTX{rowFn: func(dest ...any) error {
			*(dest[0].(*int64)) = 7
			return nil
		}}
		n, err := repo.CountPending(ctx, db)
		if err != nil {
			t.Fatalf("CountPending: %v", err)
		}
		if n != 7 {
			t.Fatalf("count = %d, want 7", n)
		}
		if !strings.Contains(db.gotSQL, "COUNT(*)") || !strings.Contains(db.gotSQL, "processed_at IS NULL") {
			t.Fatalf("CountPending SQL wrong:\n%s", db.gotSQL)
		}
	})
}
