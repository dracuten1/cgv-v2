package model

// KinshipResult is the exact response shape of GET /api/v1/kinship.
//
// RENDERING CONTRACT (INV-05 / F4): Term is BARE text — the Vue
// KinshipResult.vue component must render `term` via plain text interpolation
// (textContent === "Ông nội"); decorative quotes belong exclusively to CSS
// ::before/::after pseudo-elements. Never embed “ ” or &ldquo; here.
type KinshipResult struct {
	// Term is the calculated Vietnamese kinship term, e.g. "Ông nội".
	Term string `json:"term"`

	// Line is the family line, e.g. "Chi nội" or "Chi ngoại".
	Line string `json:"line"`

	// GenerationDistance is the signed generational gap between the two members.
	GenerationDistance int `json:"generation_distance"`

	// DistanceLabel is the human phrase, e.g. "Cách 2 đời".
	DistanceLabel string `json:"distance_label"`

	// IsBlood is true when the term was derived through a blood path,
	// false for affinal (marriage) paths.
	IsBlood bool `json:"is_blood"`

	// Dialect is the regional variant used for the lexicon: "bac" | "trung" | "nam".
	Dialect string `json:"dialect"`

	// Path is the chain of member IDs from the source to the target member.
	Path []string `json:"path"`
}
