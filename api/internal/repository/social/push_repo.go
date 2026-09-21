package socialrepo

import (
	"context"
	"errors"
	"fmt"

	"github.com/dracuten1/cgv-v2/api/internal/database"
	"github.com/dracuten1/cgv-v2/api/internal/model"
	"github.com/jackc/pgx/v5"
)

// PushRepository handles database operations on the push_subscriptions table
// (PROMPT.md §4 DDL, UNIQUE(endpoint)).
type PushRepository struct{}

// NewPushRepository creates a new PushRepository.
func NewPushRepository() *PushRepository {
	return &PushRepository{}
}

// Upsert registers a Web Push subscription keyed on its endpoint: an existing
// endpoint re-subscribing with refreshed keys is updated in place.
func (r *PushRepository) Upsert(ctx context.Context, dbtx database.DBTX, sub model.PushSubscription) error {
	_, err := dbtx.Exec(ctx, `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
VALUES ($1, $2, $3, $4)
ON CONFLICT (endpoint) DO UPDATE SET user_id = EXCLUDED.user_id, p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
		sub.UserID, sub.Endpoint, sub.P256DH, sub.Auth)
	if err != nil {
		return fmt.Errorf("không thể lưu đăng ký nhận thông báo: %w", err)
	}
	return nil
}

// DeleteByEndpoint removes a subscription by its endpoint. Returns
// socialrepo.ErrNotFound when no row was deleted.
func (r *PushRepository) DeleteByEndpoint(ctx context.Context, dbtx database.DBTX, endpoint string) error {
	tag, err := dbtx.Exec(ctx, `DELETE FROM push_subscriptions WHERE endpoint = $1`, endpoint)
	if err != nil {
		return fmt.Errorf("không thể xóa đăng ký nhận thông báo: %w", err)
	}
	if tag.RowsAffected() == 0 {
		return ErrNotFound
	}
	return nil
}

// ListForFamily returns every push subscription whose owner is linked
// (users.member_id) to a member of the given family — the fanout audience for
// that family's feed events.
func (r *PushRepository) ListForFamily(ctx context.Context, dbtx database.DBTX, familyID string) ([]model.PushSubscription, error) {
	rows, err := dbtx.Query(ctx, `SELECT ps.id, ps.user_id, ps.endpoint, ps.p256dh, ps.auth, ps.created_at
FROM push_subscriptions ps
JOIN users u ON u.id = ps.user_id
JOIN members m ON m.id = u.member_id
WHERE m.family_id = $1
ORDER BY ps.created_at ASC`, familyID)
	if err != nil {
		return nil, fmt.Errorf("không thể truy vấn danh sách đăng ký nhận thông báo: %w", err)
	}
	defer rows.Close()

	subs := []model.PushSubscription{}
	for rows.Next() {
		var s model.PushSubscription
		if err := rows.Scan(&s.ID, &s.UserID, &s.Endpoint, &s.P256DH, &s.Auth, &s.CreatedAt); err != nil {
			return nil, fmt.Errorf("không thể đọc đăng ký nhận thông báo: %w", err)
		}
		subs = append(subs, s)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("lỗi trong quá trình đọc danh sách đăng ký: %w", err)
	}
	return subs, nil
}

// GetByEndpoint returns a single subscription, or socialrepo.ErrNotFound.
func (r *PushRepository) GetByEndpoint(ctx context.Context, dbtx database.DBTX, endpoint string) (*model.PushSubscription, error) {
	var s model.PushSubscription
	err := dbtx.QueryRow(ctx, `SELECT id, user_id, endpoint, p256dh, auth, created_at
FROM push_subscriptions WHERE endpoint = $1`, endpoint).Scan(&s.ID, &s.UserID, &s.Endpoint, &s.P256DH, &s.Auth, &s.CreatedAt)
	if err != nil {
		if errors.Is(err, pgx.ErrNoRows) {
			return nil, ErrNotFound
		}
		return nil, fmt.Errorf("không thể truy vấn đăng ký nhận thông báo: %w", err)
	}
	return &s, nil
}
