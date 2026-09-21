package feed

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"strings"
	"unicode/utf8"

	"github.com/dracuten1/cgv-v2/api/internal/model"
)

// Validation bounds (PROMPT.md §6 F6; cycle 2c contract).
const (
	// MinContentRunes is the shortest allowed post body.
	MinContentRunes = 1
	// MaxContentRunes is the longest allowed post body (counted in runes so
	// Vietnamese diacritics count as one character each).
	MaxContentRunes = 5000
	// MaxImages caps the number of attached image URLs per post.
	MaxImages = 10
	// MaxImageURLLen caps one image URL's length in bytes.
	MaxImageURLLen = 2048
	// DefaultPageSize is the List page size used when limit <= 0.
	DefaultPageSize = 20
	// MaxPageSize caps the List page size.
	MaxPageSize = 100
	// PreviewRunes truncates the fanout notification preview.
	PreviewRunes = 120
)

// Feed validation errors (INV-02: Vietnamese-first, safe to show users).
var (
	ErrContentRequired   = errors.New("nội dung bài viết không được để trống")
	ErrContentTooLong    = fmt.Errorf("nội dung bài viết không được vượt quá %d ký tự", MaxContentRunes)
	ErrTooManyImages     = fmt.Errorf("mỗi bài viết chỉ được đính kèm tối đa %d ảnh", MaxImages)
	ErrInvalidImageURL   = errors.New("đường dẫn ảnh không hợp lệ: chỉ chấp nhận http:// hoặc https://")
	ErrImageURLTooLong   = fmt.Errorf("đường dẫn ảnh không được vượt quá %d ký tự", MaxImageURLLen)
	ErrPostNotFound      = errors.New("bài viết không tồn tại")
	ErrFamilyIDRequired  = errors.New("thiếu mã gia đình")
	ErrAuthorIDRequired  = errors.New("thiếu mã tác giả")
	ErrAuthorNotResolved = errors.New("không tìm thấy thành viên tương ứng với tác giả")
)

// FeedCreatedPayload is the JSON shape of the `feed.created` outbox event.
// Producer: Service.Create. Consumer: the push.Worker drainer, which resolves
// the fanout audience via ListForFamily(payload.FamilyID).
type FeedCreatedPayload struct {
	FamilyID string `json:"family_id"` // fanout audience family
	PostID   string `json:"post_id"`   // the created post
	Author   string `json:"author"`    // author display or member name
	Preview  string `json:"preview"`   // ≤120-rune trimmed content preview
}

// AuthorNamer resolves the display name of a post author for the fanout
// notification (wired by cycle 3 over the auth/user store). Receives the
// authenticated userID and the optional linked member ID.
type AuthorNamer interface {
	AuthorDisplayName(ctx context.Context, userID string, memberID *string) (string, error)
}

// Service is the family feed domain service.
type Service struct {
	tx     TxRunner
	posts  PostStore
	outbox OutboxEnqueuer
	namer  AuthorNamer
}

// NewService wires the feed service. namer may be nil, in which case the
// fanout author field falls back to "Thành viên gia đình".
func NewService(tx TxRunner, posts PostStore, outbox OutboxEnqueuer, namer AuthorNamer) *Service {
	return &Service{tx: tx, posts: posts, outbox: outbox, namer: namer}
}

// List returns one keyset page of the family feed, newest first. An empty
// cursor starts a fresh page. limit <= 0 falls back to DefaultPageSize.
func (s *Service) List(ctx context.Context, familyID string, limit int, cursor Cursor) ([]model.Post, error) {
	if familyID == "" {
		return nil, ErrFamilyIDRequired
	}
	if limit <= 0 {
		limit = DefaultPageSize
	}
	if limit > MaxPageSize {
		limit = MaxPageSize
	}
	return s.posts.ListByFamily(ctx, familyID, limit, cursor)
}

// GetByID returns a single post or ErrPostNotFound.
func (s *Service) GetByID(ctx context.Context, postID string) (*model.Post, error) {
	p, err := s.posts.GetByID(ctx, postID)
	if err != nil {
		return nil, ErrPostNotFound
	}
	return p, nil
}

// Create validates and inserts a post TOGETHER with its `feed.created` outbox
// event inside ONE transaction (ADR-010). Either both rows land or neither
// does; the push fanout itself happens post-commit in the outbox drainer.
func (s *Service) Create(ctx context.Context, familyID string, authorUserID string, authorMemberID *string, content string, images []string) (*model.Post, error) {
	if familyID == "" {
		return nil, ErrFamilyIDRequired
	}
	if authorUserID == "" {
		return nil, ErrAuthorIDRequired
	}
	if err := ValidateContent(content); err != nil {
		return nil, err
	}
	if err := ValidateImages(images); err != nil {
		return nil, err
	}

	var created *model.Post
	err := s.tx.WithTx(ctx, func(txCtx context.Context) error {
		// 1) The business row…
		p, err := s.posts.Create(txCtx, &model.Post{
			FamilyID:       familyID,
			AuthorMemberID: authorMemberID,
			Content:        content,
			Images:         images,
		})
		if err != nil {
			return err
		}

		// 2) …and its outbox event, same tx (ADR-010 all-or-nothing).
		payload, err := s.buildPayload(txCtx, authorUserID, authorMemberID, p)
		if err != nil {
			return err
		}
		if _, err := s.outbox.EnqueueFeedCreated(txCtx, payload); err != nil {
			return err
		}
		created = p
		return nil
	})
	if err != nil {
		return nil, err
	}
	return created, nil
}

// buildPayload renders the `feed.created` JSON payload for a freshly created
// post: author display name (resolved best-effort) plus a whitespace-trimmed
// ≤120-rune preview.
func (s *Service) buildPayload(ctx context.Context, userID string, memberID *string, p *model.Post) ([]byte, error) {
	author := "Thành viên gia đình"
	if s.namer != nil {
		if name, err := s.namer.AuthorDisplayName(ctx, userID, memberID); err == nil && strings.TrimSpace(name) != "" {
			author = strings.TrimSpace(name)
		}
	}
	payload, err := json.Marshal(FeedCreatedPayload{
		FamilyID: p.FamilyID,
		PostID:   p.ID,
		Author:   author,
		Preview:  Preview(p.Content, PreviewRunes),
	})
	if err != nil {
		return nil, fmt.Errorf("không thể tạo sự kiện bảng tin: %w", err)
	}
	return payload, nil
}

// Preview truncates content to at most max runes, appending "…" when cut.
func Preview(content string, max int) string {
	trimmed := strings.TrimSpace(content)
	if utf8.RuneCountInString(trimmed) <= max {
		return trimmed
	}
	runes := []rune(trimmed)
	return string(runes[:max]) + "…"
}

// ValidateContent enforces the 1..MaxContentRunes rune budget.
func ValidateContent(content string) error {
	n := utf8.RuneCountInString(content)
	if n < MinContentRunes {
		return ErrContentRequired
	}
	if n > MaxContentRunes {
		return ErrContentTooLong
	}
	return nil
}

// ValidateImages enforces ≤ MaxImages attachments, each a well-formed
// http(s) URL of at most MaxImageURLLen bytes.
func ValidateImages(images []string) error {
	if len(images) > MaxImages {
		return ErrTooManyImages
	}
	for _, raw := range images {
		if len(raw) > MaxImageURLLen {
			return ErrImageURLTooLong
		}
		u, err := url.Parse(raw)
		if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
			return ErrInvalidImageURL
		}
	}
	return nil
}
