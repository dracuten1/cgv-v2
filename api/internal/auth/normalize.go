package auth

import (
	"strings"

	"github.com/dracuten1/cgv-v2/api/internal/config"
	"github.com/dracuten1/cgv-v2/api/internal/model"
)

// NormalizeContact canonicalizes a contact value before any DB read/write so
// the UNIQUE(kind, value) constraint sees one spelling per address:
//   - email: trim whitespace, NFC-compose (mac-apple-typo decomposed forms
//     fold onto a single rune sequence), lowercase;
//   - phone: trim, strip spaces, fold +84/84 country prefixes onto the
//     canonical 0-prefixed national form.
func NormalizeContact(kind, value string) string {
	if kind == model.ContactKindPhone {
		return NormalizePhone(value)
	}
	v := normNFC(strings.TrimSpace(value))
	if kind == model.ContactKindEmail {
		v = strings.ToLower(v)
	}
	return v
}

// NormalizePhone strips whitespace and folds +84/84 country prefixes onto
// the canonical 0-prefixed national form so identical phones written either
// way collide on UNIQUE(kind, value).
func NormalizePhone(p string) string {
	p = strings.TrimSpace(p)
	p = strings.ReplaceAll(p, " ", "")
	switch {
	case strings.HasPrefix(p, "+84"):
		return "0" + p[3:]
	case strings.HasPrefix(p, "84") && len(p) > 9:
		return "0" + p[2:]
	}
	return p
}

// enforceConfigured maps an unknown provider name to ErrUnknownProvider and
// an unset client ID to ErrProviderDisabled ("Nhà cung cấp chưa được cấu
// hình" → 404 at the handler).
func enforceConfigured(clientID string, known bool) error {
	if !known {
		return ErrUnknownProvider
	}
	if clientID == "" {
		return ErrProviderDisabled
	}
	return nil
}

// issuerMatches reports whether v is one of the two recognized CGP issuers.
func issuerMatches(v string) bool {
	return v == config.DemoJWTIssuer || v == config.ProdJWTIssuer
}
