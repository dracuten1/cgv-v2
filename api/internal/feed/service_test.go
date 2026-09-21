package feed_test

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/feed"
	"github.com/dracuten1/cgv-v2/api/internal/model"
)

// NOTE: tests in this module use the stdlib testing package only — go.mod and
// go.sum are frozen and testify's transitive module hashes (go-spew,
// go-difflib) are absent from go.sum, so testify cannot compile here. This
// mirrors the foundation layer's existing test style (database, config, model).

// fakeTxRunner invokes fn directly against the given context.
type fakeTxRunner struct {
	calls int
}

func (f *fakeTxRunner) WithTx(ctx context.Context, fn func(ctx context.Context) error) error {
	f.calls++
	return fn(ctx)
}

// fakePostStore records created posts in memory.
type fakePostStore struct {
	createErr   error
	created     []*model.Post
	postByID    map[string]*model.Post
	familyPosts map[string][]model.Post // family → newest-first
}

func newFakePostStore() *fakePostStore {
	return &fakePostStore{
		postByID:    make(map[string]*model.Post),
		familyPosts: make(map[string][]model.Post),
	}
}

func (f *fakePostStore) Create(ctx context.Context, post *model.Post) (*model.Post, error) {
	if f.createErr != nil {
		return nil, f.createErr
	}
	stored := *post
	stored.ID = "post-uuid-1"
	stored.CreatedAt = time.Date(2026, 9, 21, 10, 0, 0, 0, time.UTC)
	f.created = append(f.created, &stored)
	f.postByID[stored.ID] = &stored
	f.familyPosts[stored.FamilyID] = append([]model.Post{stored}, f.familyPosts[stored.FamilyID]...)
	return &stored, nil
}

func (f *fakePostStore) GetByID(ctx context.Context, postID string) (*model.Post, error) {
	p, ok := f.postByID[postID]
	if !ok {
		return nil, errors.New("not found")
	}
	return p, nil
}

func (f *fakePostStore) ListByFamily(ctx context.Context, familyID string, limit int, cursor feed.Cursor) ([]model.Post, error) {
	var res []model.Post
	for _, p := range f.familyPosts[familyID] {
		if cursor.Valid() && !isBeforeCursor(p, cursor) {
			continue
		}
		res = append(res, p)
		if len(res) >= limit {
			break
		}
	}
	return res, nil
}

func (f *fakePostStore) ListByAuthor(ctx context.Context, memberID string, limit int) ([]model.Post, error) {
	return nil, nil
}

// isBeforeCursor mirrors the SQL keyset predicate (created_at, id) < cursor.
func isBeforeCursor(p model.Post, c feed.Cursor) bool {
	cTime, err := time.Parse(time.RFC3339, c.CreatedAt)
	if err != nil {
		return false
	}
	return p.CreatedAt.Before(cTime) || (p.CreatedAt.Equal(cTime) && p.ID < c.ID)
}

// fakeOutboxEnqueuer records enqueued payloads.
type fakeOutboxEnqueuer struct {
	enqueueErr error
	events     [][]byte
}

func (f *fakeOutboxEnqueuer) EnqueueFeedCreated(ctx context.Context, payload []byte) (*model.OutboxEvent, error) {
	if f.enqueueErr != nil {
		return nil, f.enqueueErr
	}
	f.events = append(f.events, payload)
	return &model.OutboxEvent{
		ID:      "outbox-uuid-1",
		Topic:   model.TopicFeedCreated,
		Payload: payload,
	}, nil
}

// staticNamer resolves every author to a fixed display name.
type staticNamer struct {
	name string
}

func (s *staticNamer) AuthorDisplayName(ctx context.Context, userID string, memberID *string) (string, error) {
	return s.name, nil
}

func mustCreate(t *testing.T, svc *feed.Service, content string, images []string) *model.Post {
	t.Helper()
	p, err := svc.Create(context.Background(), "family-1", "user-1", nil, content, images)
	if err != nil {
		t.Fatalf("Create(%q) unexpected error: %v", content, err)
	}
	return p
}

// TestCreate_Atomicity is the core ADR-010 guarantee: the post INSERT and the
// outbox `feed.created` INSERT happen together or not at all.
func TestCreate_Atomicity(t *testing.T) {
	t.Run("success writes post and exactly one outbox row with correct topic+payload", func(t *testing.T) {
		tx := &fakeTxRunner{}
		posts := newFakePostStore()
		outbox := &fakeOutboxEnqueuer{}
		svc := feed.NewService(tx, posts, outbox, &staticNamer{name: "Nguyễn Văn A"})

		authorMember := "member-1"
		post, err := svc.Create(context.Background(), "family-1", "user-1", &authorMember,
			"Họp mặt dòng họ ngày 25/09", []string{"https://example.com/img1.jpg"})
		if err != nil {
			t.Fatalf("Create failed: %v", err)
		}
		if post == nil {
			t.Fatal("expected created post")
		}
		if tx.calls != 1 {
			t.Fatalf("expected exactly 1 tx, got %d", tx.calls)
		}
		if len(posts.created) != 1 {
			t.Fatalf("expected 1 created post, got %d", len(posts.created))
		}
		if len(outbox.events) != 1 {
			t.Fatalf("expected exactly 1 outbox row, got %d", len(outbox.events))
		}

		var payload feed.FeedCreatedPayload
		if err := json.Unmarshal(outbox.events[0], &payload); err != nil {
			t.Fatalf("payload is not valid JSON: %v", err)
		}
		if payload.FamilyID != "family-1" || payload.PostID != post.ID {
			t.Fatalf("payload ids mismatch: %+v", payload)
		}
		if payload.Author != "Nguyễn Văn A" {
			t.Fatalf("author = %q, want Nguyễn Văn A", payload.Author)
		}
		if payload.Preview != "Họp mặt dòng họ ngày 25/09" {
			t.Fatalf("preview = %q", payload.Preview)
		}
	})

	t.Run("post insert failure → no outbox row", func(t *testing.T) {
		posts := newFakePostStore()
		posts.createErr = errors.New("db disk full")
		outbox := &fakeOutboxEnqueuer{}
		svc := feed.NewService(&fakeTxRunner{}, posts, outbox, nil)

		post, err := svc.Create(context.Background(), "family-1", "user-1", nil, "xin chào", nil)
		if err == nil {
			t.Fatal("expected error when post insert fails")
		}
		if post != nil {
			t.Fatal("expected nil post on failure")
		}
		if len(outbox.events) != 0 {
			t.Fatalf("outbox must stay empty when the post insert fails, got %d rows", len(outbox.events))
		}
	})

	t.Run("outbox enqueue failure → error surfaces, no post returned", func(t *testing.T) {
		posts := newFakePostStore()
		outbox := &fakeOutboxEnqueuer{enqueueErr: errors.New("outbox insert failed")}
		svc := feed.NewService(&fakeTxRunner{}, posts, outbox, nil)

		post, err := svc.Create(context.Background(), "family-1", "user-1", nil, "xin chào", nil)
		if err == nil {
			t.Fatal("expected error when outbox enqueue fails")
		}
		if post != nil {
			t.Fatal("expected nil post when the tx aborts")
		}
	})
}

func TestCreate_ValidationTable(t *testing.T) {
	tx := &fakeTxRunner{}
	posts := newFakePostStore()
	outbox := &fakeOutboxEnqueuer{}
	svc := feed.NewService(tx, posts, outbox, nil)

	tests := []struct {
		name     string
		famID    string
		authorID string
		content  string
		images   []string
		wantErr  error
	}{
		{"empty family_id", "", "u1", "chào cả nhà", nil, feed.ErrFamilyIDRequired},
		{"empty author_id", "f1", "", "chào cả nhà", nil, feed.ErrAuthorIDRequired},
		{"empty content", "f1", "u1", "", nil, feed.ErrContentRequired},
		{"5001 runes", "f1", "u1", strings.Repeat("a", 5001), nil, feed.ErrContentTooLong},
		{"5000 diacritic runes allowed", "f1", "u1", strings.Repeat("ạ", 5000), nil, nil},
		{"11 images", "f1", "u1", "ảnh", elevenImages(), feed.ErrTooManyImages},
		{"ftp scheme", "f1", "u1", "ảnh", []string{"ftp://a.com/1.jpg"}, feed.ErrInvalidImageURL},
		{"relative url", "f1", "u1", "ảnh", []string{"/uploads/1.jpg"}, feed.ErrInvalidImageURL},
		{"url over 2048 bytes", "f1", "u1", "ảnh", []string{"https://a.com/" + strings.Repeat("x", 2048)}, feed.ErrImageURLTooLong},
		{"valid mixed schemes", "f1", "u1", "ảnh", []string{"http://a.com/1.jpg", "https://a.com/2.jpg"}, nil},
		{"10 images allowed", "f1", "u1", "ảnh", tenImages(), nil},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			p, err := svc.Create(context.Background(), tt.famID, tt.authorID, nil, tt.content, tt.images)
			if tt.wantErr != nil {
				if err == nil {
					t.Fatalf("expected error %v, got nil", tt.wantErr)
				}
				if !errors.Is(err, tt.wantErr) && err.Error() != tt.wantErr.Error() {
					t.Fatalf("error = %v, want %v", err, tt.wantErr)
				}
				return
			}
			if err != nil {
				t.Fatalf("unexpected error: %v", err)
			}
			if p == nil {
				t.Fatal("expected created post")
			}
		})
	}

	// Exactly the 3 passing cases must have enqueued outbox rows; every
	// validation failure is rejected BEFORE any store/outbox call.
	if len(outbox.events) != 3 {
		t.Fatalf("expected outbox rows only for passing cases, got %d, want 3", len(outbox.events))
	}
}

func tenImages() []string {
	urls := make([]string, 0, 10)
	for i := 1; i <= 10; i++ {
		urls = append(urls, "https://a.com/"+strings.Repeat("i", i)+".jpg")
	}
	return urls
}

func elevenImages() []string {
	return append(tenImages(), "https://a.com/11.jpg")
}

func TestPreview(t *testing.T) {
	if got := feed.Preview("Ngắn gọn", 120); got != "Ngắn gọn" {
		t.Fatalf("Preview short = %q", got)
	}
	long := strings.Repeat("Nguyễn ", 30) // 210 runes
	got := feed.Preview(long, 120)
	if !strings.HasSuffix(got, "…") {
		t.Fatalf("long preview must end with …: %q", got)
	}
	if n := len([]rune(strings.TrimSuffix(got, "…"))); n != 120 {
		t.Fatalf("preview body = %d runes, want 120", n)
	}
}

func TestList_CursorOrdering(t *testing.T) {
	posts := newFakePostStore()
	t1 := time.Date(2026, 9, 21, 10, 0, 0, 0, time.UTC)
	t2 := time.Date(2026, 9, 21, 11, 0, 0, 0, time.UTC)
	t3 := time.Date(2026, 9, 21, 12, 0, 0, 0, time.UTC)
	posts.familyPosts["fam-1"] = []model.Post{
		{ID: "p3", FamilyID: "fam-1", Content: "mới nhất", CreatedAt: t3},
		{ID: "p2", FamilyID: "fam-1", Content: "giữa", CreatedAt: t2},
		{ID: "p1", FamilyID: "fam-1", Content: "cũ nhất", CreatedAt: t1},
	}
	svc := feed.NewService(&fakeTxRunner{}, posts, &fakeOutboxEnqueuer{}, nil)

	// Page 1: newest first, limit 2.
	page1, err := svc.List(context.Background(), "fam-1", 2, feed.Cursor{})
	if err != nil {
		t.Fatalf("List page 1 failed: %v", err)
	}
	if len(page1) != 2 || page1[0].ID != "p3" || page1[1].ID != "p2" {
		t.Fatalf("page 1 = %v+%v, want [p3 p2]", page1[0].ID, page1[1].ID)
	}

	// Page 2: keyed after the last post of page 1.
	page2, err := svc.List(context.Background(), "fam-1", 2, feed.Cursor{
		CreatedAt: page1[1].CreatedAt.Format(time.RFC3339),
		ID:        page1[1].ID,
	})
	if err != nil {
		t.Fatalf("List page 2 failed: %v", err)
	}
	if len(page2) != 1 || page2[0].ID != "p1" {
		t.Fatalf("page 2 = %v, want [p1]", page2)
	}

	// Empty family id → sentinel.
	if _, err := svc.List(context.Background(), "", 2, feed.Cursor{}); !errors.Is(err, feed.ErrFamilyIDRequired) {
		t.Fatalf("empty family id error = %v", err)
	}
}

func TestGetByID(t *testing.T) {
	posts := newFakePostStore()
	svc := feed.NewService(&fakeTxRunner{}, posts, &fakeOutboxEnqueuer{}, nil)
	mustCreate(t, svc, "bài đầu tiên", nil)

	p, err := svc.GetByID(context.Background(), "post-uuid-1")
	if err != nil || p == nil {
		t.Fatalf("GetByID failed: %v", err)
	}
	if _, err := svc.GetByID(context.Background(), "missing"); !errors.Is(err, feed.ErrPostNotFound) {
		t.Fatalf("missing post error = %v, want ErrPostNotFound", err)
	}
}
