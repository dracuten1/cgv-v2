package push

import (
	"context"
	"encoding/base64"
	"net/url"
	"strings"

	"github.com/dracuten1/cgv-v2/api/internal/model"
)

// Service handles Web Push subscription lifecycle (PROMPT.md §5:
// POST/DELETE /api/v1/push/subscribe).
type Service struct {
	repo PushStore
}

// NewService wires the push subscription service.
func NewService(repo PushStore) *Service {
	return &Service{repo: repo}
}

// Subscribe validates and upserts a Web Push subscription keyed on endpoint:
// a browser re-subscribing with refreshed keys updates its row in place.
func (s *Service) Subscribe(ctx context.Context, userID, endpoint, p256dh, auth string) error {
	if strings.TrimSpace(userID) == "" {
		return ErrUserIDRequired
	}
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		return ErrEndpointRequired
	}
	u, err := url.Parse(endpoint)
	if err != nil || u.Host == "" || (u.Scheme != "http" && u.Scheme != "https") {
		return ErrInvalidEndpoint
	}
	if strings.TrimSpace(p256dh) == "" {
		return ErrP256DHRequired
	}
	if strings.TrimSpace(auth) == "" {
		return ErrAuthKeyRequired
	}
	// The Web Push client sends both keys as URL-safe base64; verify they
	// actually decode so garbage never reaches webpush-go's encryptor.
	if _, err := base64Decode(p256dh); err != nil {
		return ErrInvalidBase64Key
	}
	if _, err := base64Decode(auth); err != nil {
		return ErrInvalidBase64Key
	}

	return s.repo.Upsert(ctx, model.PushSubscription{
		UserID:   userID,
		Endpoint: endpoint,
		P256DH:   p256dh,
		Auth:     auth,
	})
}

// Unsubscribe removes a subscription by endpoint.
func (s *Service) Unsubscribe(ctx context.Context, endpoint string) error {
	endpoint = strings.TrimSpace(endpoint)
	if endpoint == "" {
		return ErrEndpointRequired
	}
	return s.repo.DeleteByEndpoint(ctx, endpoint)
}

// base64Decode accepts both URL-safe and standard base64 (with or without
// padding), matching what browsers emit for PushSubscription.getKey().
func base64Decode(s string) ([]byte, error) {
	s = strings.TrimSpace(s)
	if b, err := base64.RawURLEncoding.DecodeString(s); err == nil {
		return b, nil
	}
	if b, err := base64.URLEncoding.DecodeString(s); err == nil {
		return b, nil
	}
	if b, err := base64.StdEncoding.DecodeString(s); err == nil {
		return b, nil
	}
	return base64.RawStdEncoding.DecodeString(s)
}
