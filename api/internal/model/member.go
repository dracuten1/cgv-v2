package model

import "time"

// Member is a person node in a family tree (members table).
// Gender is always the canonical English value (INV-03); convert at the
// boundary with ParseGenderVN / Gender.ToVN.
type Member struct {
	ID              string     `json:"id"`
	FamilyID        string     `json:"family_id"`
	FullName        string     `json:"full_name"`
	Gender          Gender     `json:"gender"` // "male" | "female" (DB CHECK enforced)
	GenerationIndex int        `json:"generation_index"`
	BirthDate       *time.Time `json:"birth_date,omitempty"`
	DeathDate       *time.Time `json:"death_date,omitempty"`
	IsLiving        bool       `json:"is_living"`
	AvatarURL       *string    `json:"avatar_url,omitempty"`
	Notes           *string    `json:"notes,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}
