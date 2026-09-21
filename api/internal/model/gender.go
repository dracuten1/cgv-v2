package model

import (
	"fmt"
	"strings"

	"golang.org/x/text/unicode/norm"
)

// Gender is the canonical English DB/API gender value (INV-03).
// Database CHECK constraint and API payloads only ever see "male"/"female";
// Vietnamese forms ("nam"/"nữ") are accepted at every entry point and mapped
// bi-directionally. Never store Vietnamese values in the database.
type Gender string

const (
	// GenderMale is the canonical value for "nam".
	GenderMale Gender = "male"
	// GenderFemale is the canonical value for "nữ".
	GenderFemale Gender = "female"
)

// normalizeGenderToken trims space and composes to NFC so decomposed forms of
// "ữ" (u + U+031B + U+0303) match the precomposed "ữ" (U+1EEF).
func normalizeGenderToken(s string) string {
	return strings.TrimSpace(norm.NFC.String(s))
}

// ParseGenderVN maps a Vietnamese gender token to the canonical Gender.
// Accepts "nam", "nữ", "nu" case-insensitively (INV-03). STRICT: any unknown
// token returns a descriptive Vietnamese error — never a default fallback.
func ParseGenderVN(s string) (Gender, error) {
	switch strings.ToLower(normalizeGenderToken(s)) {
	case "nam":
		return GenderMale, nil
	case "nữ", "nu":
		return GenderFemale, nil
	default:
		return "", fmt.Errorf("giá trị giới tính không hợp lệ: %q (chỉ chấp nhận 'nam' hoặc 'nữ')", s)
	}
}

// ParseGenderAPI maps an English API payload token to the canonical Gender.
// Accepts "male", "female" case-insensitively (INV-03). STRICT: any unknown
// token returns a descriptive Vietnamese error — never a default fallback.
func ParseGenderAPI(s string) (Gender, error) {
	switch strings.ToLower(strings.TrimSpace(s)) {
	case "male":
		return GenderMale, nil
	case "female":
		return GenderFemale, nil
	default:
		return "", fmt.Errorf("giá trị giới tính không hợp lệ: %q (chỉ chấp nhận 'male' hoặc 'female')", s)
	}
}

// ToVN renders the Vietnamese display form with correct diacritics (INV-02):
// male → "Nam", female → "Nữ". Unknown values render as the empty string.
func (g Gender) ToVN() string {
	switch g {
	case GenderMale:
		return "Nam"
	case GenderFemale:
		return "Nữ"
	default:
		return ""
	}
}

// String returns the canonical English value stored in DB/API ("male"/"female").
func (g Gender) String() string {
	return string(g)
}
