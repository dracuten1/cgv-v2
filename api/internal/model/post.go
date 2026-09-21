package model

import (
	"encoding/json"
	"fmt"
	"time"
)

// Post is a family feed post (feed_posts table). Images mirrors the JSONB
// column: a JSON array of image URLs, exposed as []string.
type Post struct {
	ID             string    `json:"id"`
	FamilyID       string    `json:"family_id"`
	AuthorMemberID *string   `json:"author_member_id,omitempty"` // NULL after the author member is deleted (ON DELETE SET NULL)
	Content        string    `json:"content"`
	Images         []string  `json:"images"` // decoded from JSONB DEFAULT '[]'
	CreatedAt      time.Time `json:"created_at"`
}

// ImagesToJSON encodes the Images slice into the JSONB storage form.
// A nil slice encodes as "[]" to match the column default.
func ImagesToJSON(images []string) ([]byte, error) {
	if images == nil {
		images = []string{}
	}
	b, err := json.Marshal(images)
	if err != nil {
		return nil, fmt.Errorf("không thể mã hóa danh sách ảnh: %w", err)
	}
	return b, nil
}

// ImagesFromJSON decodes the JSONB storage form into the Images slice.
func ImagesFromJSON(raw []byte) ([]string, error) {
	var images []string
	if err := json.Unmarshal(raw, &images); err != nil {
		return nil, fmt.Errorf("không thể giải mã danh sách ảnh: %w", err)
	}
	return images, nil
}
