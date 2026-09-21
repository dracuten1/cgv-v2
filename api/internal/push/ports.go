// Package push delivers Web Push notifications (VAPID) and email magic links,
// and hosts the background transactional-outbox drainer (ADR-009/ADR-010/D10).
package push

import (
	"context"
	"errors"

	"github.com/dracuten1/cgv-v2/api/internal/model"
)

// Sentinel errors across the push & delivery domain (INV-02: Vietnamese-first).
var (
	// ErrSubscriptionGone is returned by the push sender when the browser
	// endpoint answers HTTP 404 or 410 (the subscription was revoked or expired).
	// The outbox worker catches this and automatically unregisters the endpoint.
	ErrSubscriptionGone = errors.New("đăng ký nhận thông báo đã hết hạn hoặc bị hủy bởi trình duyệt (404/410)")

	// ErrSMTPNotConfigured is returned by the mailer when SMTPHost is blank
	// (dev/demo mode without email configured).
	ErrSMTPNotConfigured = errors.New("máy chủ gửi thư (SMTP) chưa được cấu hình")

	// Subscription validation errors.
	ErrEndpointRequired = errors.New("thiếu địa chỉ endpoint của trình duyệt")
	ErrInvalidEndpoint  = errors.New("địa chỉ endpoint không hợp lệ: phải bắt đầu bằng https://")
	ErrP256DHRequired   = errors.New("thiếu khóa công khai p256dh")
	ErrAuthKeyRequired  = errors.New("thiếu khóa xác thực auth")
	ErrInvalidBase64Key = errors.New("khóa VAPID không phải định dạng base64 hợp lệ")
	ErrUserIDRequired   = errors.New("thiếu mã người dùng")
)

// Sender abstracts the Web Push delivery mechanism. Satisfied by
// *WebPushSender in production and by fakes in tests.
type Sender interface {
	Send(ctx context.Context, sub model.PushSubscription, payload []byte) error
}

// Mailer abstracts outbound email. Satisfied by *SMTPMailer in production
// and by fakes in tests.
type Mailer interface {
	SendMail(ctx context.Context, to, subject, body string) error
}

// PushStore is the persistence port for push_subscriptions.
type PushStore interface {
	Upsert(ctx context.Context, sub model.PushSubscription) error
	DeleteByEndpoint(ctx context.Context, endpoint string) error
	ListForFamily(ctx context.Context, familyID string) ([]model.PushSubscription, error)
}

// OutboxStore is the persistence port for draining outbox_events.
type OutboxStore interface {
	FetchPending(ctx context.Context, limit int) ([]model.OutboxEvent, error)
	MarkProcessed(ctx context.Context, ids []string) error
}
