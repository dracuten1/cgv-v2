package model

import "time"

// ParentChild is one edge of the blood-relationship DAG (parent_child table).
// PRIMARY KEY (parent_id, child_id); CHECK parent_id <> child_id.
type ParentChild struct {
	ParentID string `json:"parent_id"`
	ChildID  string `json:"child_id"`
}

// Spouse is one marriage edge (spouses table).
//
// Canonical-order invariant: rows are stored with MemberA < MemberB (the
// spouses_canonical_order CHECK enforces it) so the UNIQUE(MemberA, MemberB)
// constraint blocks reversed duplicates. Repositories MUST insert
// (LEAST(a, b), GREATEST(a, b)) — see migration 002.
type Spouse struct {
	ID           string     `json:"id"`
	MemberA      string     `json:"member_a"` // canonical: MemberA < MemberB
	MemberB      string     `json:"member_b"`
	MarriageDate *time.Time `json:"marriage_date,omitempty"`
}
