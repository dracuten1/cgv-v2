package socialrepo

import (
	"context"
	"errors"
	"fmt"

	"github.com/dracuten1/cgv-v2/api/internal/database"
	"github.com/dracuten1/cgv-v2/api/internal/model"
	"github.com/jackc/pgx/v5"
)

// PostRepository handles database operations on the feed_posts table
// (PROMPT.md §4 DDL). Methods taking dbtx join the ambient transaction when
// invoked inside database.TxManager.WithTx (ADR-006/ADR-010).
type PostRepository struct{}

// NewPostRepository creates a new PostRepository.
func NewPostRepository() *PostRepository {
	return &PostRepository{}
}

// Feed limit bounds shared by the keyset-paginated queries.
const (
	// MaxFeedPageSize caps a single feed page.
	MaxFeedPageSize = 100
	// DefaultFeedPageSize is used when the caller passes limit <= 0.
	DefaultFeedPageSize = 20
)

// clampFeedLimit normalizes limit into [1, MaxFeedPageSize].
func clampFeedLimit(limit int) int {
	if limit <= 0 {
		return DefaultFeedPageSize
	}
	if limit > MaxFeedPageSize {
		return MaxFeedPageSize
	}
	return limit
}

// Cursor is the keyset cursor for feed pagination: the (created_at, id) pair
// of the last post of the previous page. Newest first means strictly
// (created_at DESC, id DESC), so the next page is
// WHERE (created_at, id) < (cursor.CreatedAt, cursor.ID).
type Cursor struct {
	CreatedAt string // RFC3339 timestamp of the previous page's last post
	ID        string // UUID of the previous page's last post
}

// Valid reports whether both halves of the cursor are present.
func (c Cursor) Valid() bool {
	return c.CreatedAt != "" && c.ID != ""
}

// ListByFamily returns one keyset page of the family feed, newest first
// (ORDER BY created_at DESC, id DESC). An empty Cursor returns the first page.
func (r *PostRepository) ListByFamily(ctx context.Context, dbtx database.DBTX, familyID string, limit int, cursor Cursor) ([]model.Post, error) {
	limit = clampFeedLimit(limit)

	const base = `SELECT id, family_id, author_member_id, content, images, created_at
FROM feed_posts WHERE family_id = $1`
	const tail = ` ORDER BY created_at DESC, id DESC LIMIT `

	var (
		query string
		args  []any
	)
	if cursor.Valid() {
		query = base + ` AND (created_at, id) < ($2::timestamptz, $3::uuid)` + tail + `$4`
		args = []any{familyID, cursor.CreatedAt, cursor.ID, limit}
	} else {
		query = base + tail + `$2`
		args = []any{familyID, limit}
	}
	rows, err := dbtx.Query(ctx, query, args...)
	if err != nil {
		return nil, fmt.Errorf("không thể truy vấn bảng tin gia đình: %w", err)
	}
	defer rows.Close()

	posts := []model.Post{} // never nil: JSON renders [] not null
	for rows.Next() {
		p, scanErr := scanPost(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		posts = append(posts, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("lỗi trong quá trình đọc bảng tin gia đình: %w", err)
	}
	return posts, nil
}

// ListByAuthor returns the newest posts authored by the given member.
func (r *PostRepository) ListByAuthor(ctx context.Context, dbtx database.DBTX, memberID string, limit int) ([]model.Post, error) {
	limit = clampFeedLimit(limit)
	rows, err := dbtx.Query(ctx, `SELECT id, family_id, author_member_id, content, images, created_at
FROM feed_posts WHERE author_member_id = $1 ORDER BY created_at DESC, id DESC LIMIT $2`, memberID, limit)
	if err != nil {
		return nil, fmt.Errorf("không thể truy vấn bài viết của thành viên: %w", err)
	}
	defer rows.Close()

	posts := []model.Post{}
	for rows.Next() {
		p, scanErr := scanPost(rows)
		if scanErr != nil {
			return nil, scanErr
		}
		posts = append(posts, p)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("lỗi trong quá trình đọc bài viết của thành viên: %w", err)
	}
	return posts, nil
}

// GetByID returns a single post, or socialrepo.ErrNotFound.
func (r *PostRepository) GetByID(ctx context.Context, dbtx database.DBTX, postID string) (*model.Post, error) {
	row := dbtx.QueryRow(ctx, `SELECT id, family_id, author_member_id, content, images, created_at
FROM feed_posts WHERE id = $1`, postID)
	p, err := scanPostRow(row)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("không thể truy vấn bài viết %s: %w", postID, err)
	}
	return &p, nil
}

// Create inserts a post and returns the stored row (including server-generated
// id and created_at). MUST run inside the same tx as the outbox enqueue
// (ADR-010) — pass the ambient database.DBTX from within WithTx.
func (r *PostRepository) Create(ctx context.Context, dbtx database.DBTX, p *model.Post) (*model.Post, error) {
	images, err := model.ImagesToJSON(p.Images)
	if err != nil {
		return nil, err
	}
	created := model.Post{
		ID:             p.ID,
		FamilyID:       p.FamilyID,
		AuthorMemberID: p.AuthorMemberID,
		Content:        p.Content,
		Images:         p.Images,
	}
	err = dbtx.QueryRow(ctx, `INSERT INTO feed_posts (family_id, author_member_id, content, images)
VALUES ($1, $2, $3, $4)
RETURNING id, created_at`, p.FamilyID, p.AuthorMemberID, p.Content, images).Scan(&created.ID, &created.CreatedAt)
	if err != nil {
		return nil, fmt.Errorf("không thể tạo bài viết bảng tin: %w", err)
	}
	return &created, nil
}

// rowScanner abstracts pgx.Rows and pgx.Row for shared scan helpers.
type rowScanner interface {
	Scan(dest ...any) error
}

// scanPost scans one feed_posts row, decoding the images JSONB column.
func scanPost(sc rowScanner) (model.Post, error) {
	var (
		p         model.Post
		author    *string
		imagesRaw []byte
	)
	if err := sc.Scan(&p.ID, &p.FamilyID, &author, &p.Content, &imagesRaw, &p.CreatedAt); err != nil {
		return p, err
	}
	p.AuthorMemberID = author
	images, err := model.ImagesFromJSON(imagesRaw)
	if err != nil {
		return p, err
	}
	p.Images = images
	return p, nil
}

// scanPostRow adapts a pgx.Row into scanPost, mapping pgx.ErrNoRows for the
// caller to translate into socialrepo.ErrNotFound.
func scanPostRow(row pgx.Row) (model.Post, error) {
	return scanPost(row)
}
