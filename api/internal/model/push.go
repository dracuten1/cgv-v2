package model

import "time"

// PushSubscription is one Web Push (VAPID) endpoint registered by a User
// (push_subscriptions table). UNIQUE(endpoint).
type PushSubscription struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	Endpoint  string    `json:"endpoint"`
	P256DH    string    `json:"p256dh"`
	Auth      string    `json:"auth"`
	CreatedAt time.Time `json:"created_at"`
}
