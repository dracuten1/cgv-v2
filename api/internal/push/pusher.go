package push

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"time"

	webpush "github.com/SherClockHolmes/webpush-go"

	"github.com/dracuten1/cgv-v2/api/internal/config"
	"github.com/dracuten1/cgv-v2/api/internal/model"
)

// Delivery tuning constants.
const (
	// PushSendTimeout bounds one Web Push HTTP round-trip.
	PushSendTimeout = 5 * time.Second
	// PushTTL is the message time-to-live requested from the push service
	// (24 hours — notifications about a family event stay relevant a day).
	PushTTL = 24 * 60 * 60
	// VAPIDSubscriber identifies this application server to push services
	// (INV-01: self-hosted, free VAPID keys — no paid SaaS).
	VAPIDSubscriber = "mailto:admin@cgp.local"
)

// WebPushSender delivers Web Push messages via SherClockHolmes/webpush-go
// using the self-hosted VAPID key pair from configuration (INV-01).
type WebPushSender struct {
	vapidPublicKey  string
	vapidPrivateKey string
	httpClient      webpush.HTTPClient // injectable for tests; nil = library default
	logger          *slog.Logger
}

// NewWebPushSender builds a WebPushSender from configuration. httpClient may
// be nil to use the library's default *http.Client.
func NewWebPushSender(cfg *config.Config, httpClient webpush.HTTPClient, logger *slog.Logger) *WebPushSender {
	if logger == nil {
		logger = slog.Default()
	}
	return &WebPushSender{
		vapidPublicKey:  cfg.VAPIDPublicKey,
		vapidPrivateKey: cfg.VAPIDPrivateKey,
		httpClient:      httpClient,
		logger:          logger,
	}
}

// Send encrypts and POSTs payload to the subscription's endpoint. HTTP 404/410
// responses are translated to ErrSubscriptionGone so the caller can prune the
// dead subscription.
func (s *WebPushSender) Send(ctx context.Context, sub model.PushSubscription, payload []byte) error {
	sendCtx, cancel := context.WithTimeout(ctx, PushSendTimeout)
	defer cancel()

	opts := &webpush.Options{
		Subscriber:      VAPIDSubscriber,
		TTL:             PushTTL,
		VAPIDPublicKey:  s.vapidPublicKey,
		VAPIDPrivateKey: s.vapidPrivateKey,
		Urgency:         webpush.UrgencyNormal,
	}
	if s.httpClient != nil {
		opts.HTTPClient = s.httpClient
	}

	wpSub := &webpush.Subscription{
		Endpoint: sub.Endpoint,
		Keys: webpush.Keys{
			P256dh: sub.P256DH,
			Auth:   sub.Auth,
		},
	}

	resp, err := webpush.SendNotificationWithContext(sendCtx, payload, wpSub, opts)
	if err != nil {
		return fmt.Errorf("không thể gửi thông báo đẩy: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}
	if resp.StatusCode == http.StatusNotFound || resp.StatusCode == http.StatusGone {
		return ErrSubscriptionGone
	}
	return fmt.Errorf("push endpoint trả về mã %d", resp.StatusCode)
}

// IsGone reports whether err is (or wraps) ErrSubscriptionGone.
func IsGone(err error) bool {
	return errors.Is(err, ErrSubscriptionGone)
}
