package kinship

import (
	_ "embed"
	"encoding/json"
	"strings"
	"testing"

	"github.com/dracuten1/cgv-v2/api/internal/model"
)

// INV-05: Every term must be BARE text.
// Iterate ALL terms across all 3 dialect files asserting none contains any of " ' “ ” ‘ ’ &l &r.
func TestINV05_BareTextScan(t *testing.T) {
	forbiddenChars := []string{"\"", "'", "“", "”", "‘", "’", "&l", "&r"}

	files := map[string][]byte{
		"bac":   lexiconBacJSON,
		"trung": lexiconTrungJSON,
		"nam":   lexiconNamJSON,
	}

	for dialectName, data := range files {
		var root any
		err := json.Unmarshal(data, &root)
		if err != nil {
			t.Fatalf("failed to unmarshal %s: %v", dialectName, err)
		}

		terms := extractAllStrings(root)
		if len(terms) == 0 {
			t.Fatalf("no terms found in %s", dialectName)
		}

		for _, term := range terms {
			for _, forbidden := range forbiddenChars {
				if strings.Contains(term, forbidden) {
					t.Fatalf("dialect %s: term %q contains forbidden character %q (INV-05 violation)",
						dialectName, term, forbidden)
				}
			}
		}
	}
}

func extractAllStrings(v any) []string {
	var results []string
	switch val := v.(type) {
	case string:
		results = append(results, val)
	case map[string]any:
		for _, child := range val {
			results = append(results, extractAllStrings(child)...)
		}
	case []any:
		for _, item := range val {
			results = append(results, extractAllStrings(item)...)
		}
	}
	return results
}

func TestLexicon_HierarchicalFallback(t *testing.T) {
	store := loadLexicons()

	// Direct father: Trung has "Ba", Nam has "Ba", Bac has "Bố"
	termTrung := store.ResolveTerm("trung", true, false, 1, true, true, model.GenderMale, 0, "direct_male")
	if termTrung != "Ba" {
		t.Fatalf("termTrung = %q, want 'Ba'", termTrung)
	}

	termNam := store.ResolveTerm("nam", true, false, 1, true, true, model.GenderMale, 0, "direct_male")
	if termNam != "Ba" {
		t.Fatalf("termNam = %q, want 'Ba'", termNam)
	}

	termBac := store.ResolveTerm("bac", true, false, 1, true, true, model.GenderMale, 0, "direct_male")
	if termBac != "Bố" {
		t.Fatalf("termBac = %q, want 'Bố'", termBac)
	}

	// Fallback test: Trung doesn't override Grandparents up2, so should fallback to Bac
	termTrungFallback := store.ResolveTerm("trung", true, false, 2, false, true, model.GenderMale, 0, "patri_male")
	if termTrungFallback != "Ông nội" {
		t.Fatalf("termTrungFallback = %q, want 'Ông nội'", termTrungFallback)
	}

	// Nam has regional variant for up2: "Nội"
	termNamVariant := store.ResolveTerm("nam", true, false, 2, false, true, model.GenderMale, 0, "patri_male")
	if termNamVariant != "Nội" {
		t.Fatalf("termNamVariant = %q, want 'Nội'", termNamVariant)
	}
}

func TestNormalizeDialect(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{"bac", "bac"},
		{"BAC", "bac"},
		{"trung", "trung"},
		{"nam", "nam"},
		{"unknown", "bac"},
		{"", "bac"},
	}
	for _, tt := range tests {
		got := NormalizeDialect(tt.input)
		if got != tt.want {
			t.Fatalf("NormalizeDialect(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}
