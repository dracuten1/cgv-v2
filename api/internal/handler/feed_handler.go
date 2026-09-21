package handler

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/dracuten1/cgv-v2/api/internal/auth"
	"github.com/dracuten1/cgv-v2/api/internal/feed"
	"github.com/dracuten1/cgv-v2/api/internal/model"
	"github.com/gin-gonic/gin"
)

// FeedHandler handles family feed posts (list & creation).
type FeedHandler struct {
	feedSvc FeedService
	users   auth.UserStore
	namer   feed.AuthorNamer
}

// NewFeedHandler creates a new FeedHandler.
func NewFeedHandler(feedSvc FeedService, users auth.UserStore, namer feed.AuthorNamer) *FeedHandler {
	return &FeedHandler{
		feedSvc: feedSvc,
		users:   users,
		namer:   namer,
	}
}

// PostItem represents a post returned with resolved author display name.
type PostItem struct {
	model.Post
	AuthorDisplayName string `json:"author_display_name"`
}

// FeedListResponse is the paginated response for GET /api/v1/families/:id/feed.
type FeedListResponse struct {
	Posts      []PostItem   `json:"posts"`
	NextCursor *feed.Cursor `json:"next_cursor,omitempty"`
}

// List handles GET /api/v1/families/:id/feed?limit=&cursor_created_at=&cursor_id=
func (h *FeedHandler) List(c *gin.Context) {
	familyID := c.Param("id")
	limitStr := c.DefaultQuery("limit", "20")
	limit, err := strconv.Atoi(limitStr)
	if err != nil || limit <= 0 {
		limit = 20
	}

	cursor := feed.Cursor{
		CreatedAt: strings.TrimSpace(c.Query("cursor_created_at")),
		ID:        strings.TrimSpace(c.Query("cursor_id")),
	}

	posts, err := h.feedSvc.List(c.Request.Context(), familyID, limit, cursor)
	if err != nil {
		respondError(c, err)
		return
	}

	items := make([]PostItem, 0, len(posts))
	for _, p := range posts {
		authorName := "Thành viên gia đình"
		if h.namer != nil {
			if name, err := h.namer.AuthorDisplayName(c.Request.Context(), "", p.AuthorMemberID); err == nil && name != "" {
				authorName = name
			}
		}
		items = append(items, PostItem{
			Post:              p,
			AuthorDisplayName: authorName,
		})
	}

	var nextCursor *feed.Cursor
	if len(posts) == limit && len(posts) > 0 {
		last := posts[len(posts)-1]
		nextCursor = &feed.Cursor{
			CreatedAt: last.CreatedAt.Format("2006-01-02T15:04:05.999999999Z07:00"),
			ID:        last.ID,
		}
	}

	c.JSON(http.StatusOK, FeedListResponse{
		Posts:      items,
		NextCursor: nextCursor,
	})
}

// CreatePostRequest is the request body for creating a feed post.
type CreatePostRequest struct {
	Content string   `json:"content" binding:"required"`
	Images  []string `json:"images"`
}

// Create handles POST /api/v1/families/:id/feed (Auth required)
func (h *FeedHandler) Create(c *gin.Context) {
	familyID := c.Param("id")
	userID := GetUserID(c)

	var req CreatePostRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, model.NewErrorEnvelope(model.CodeValidationError, "Nội dung bài viết không được để trống"))
		return
	}

	// Resolve author member ID from authenticated user if linked
	var authorMemberID *string
	if h.users != nil && userID != "" {
		if u, err := h.users.GetByID(c.Request.Context(), userID); err == nil && u != nil {
			authorMemberID = u.MemberID
		}
	}

	images := req.Images
	if images == nil {
		images = []string{}
	}

	post, err := h.feedSvc.Create(c.Request.Context(), familyID, userID, authorMemberID, req.Content, images)
	if err != nil {
		respondError(c, err)
		return
	}

	c.JSON(http.StatusCreated, post)
}
