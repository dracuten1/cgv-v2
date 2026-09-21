package model

import "time"

// Family is a row of the families table.
type Family struct {
	ID   string `json:"id"`
	Name string `json:"name"`

	// Version is the kinship cache invalidation counter (ADR-009): bumped in
	// EVERY mutating transaction (member CRUD, edges, import, relink).
	Version int64 `json:"version"`

	CreatedAt time.Time `json:"created_at"`
}
