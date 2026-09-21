package kinship

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"strings"

	"github.com/dracuten1/cgv-v2/api/internal/model"
)

//go:embed lexicon_bac.json
var lexiconBacJSON []byte

//go:embed lexicon_trung.json
var lexiconTrungJSON []byte

//go:embed lexicon_nam.json
var lexiconNamJSON []byte

// LexiconStore holds terms for each dialect.
type LexiconStore struct {
	bac   map[string]any
	trung map[string]any
	nam   map[string]any
}

var globalLexicon *LexiconStore

func init() {
	globalLexicon = loadLexicons()
}

func loadLexicons() *LexiconStore {
	var bacData, trungData, namData map[string]any
	_ = json.Unmarshal(lexiconBacJSON, &bacData)
	_ = json.Unmarshal(lexiconTrungJSON, &trungData)
	_ = json.Unmarshal(lexiconNamJSON, &namData)

	return &LexiconStore{
		bac:   bacData,
		trung: trungData,
		nam:   namData,
	}
}

// NormalizeDialect maps input string to "bac", "trung", or "nam". Default is "bac".
func NormalizeDialect(d string) string {
	switch strings.ToLower(strings.TrimSpace(d)) {
	case "trung":
		return "trung"
	case "nam":
		return "nam"
	default:
		return "bac"
	}
}

// ResolveTerm looks up the kinship term based on calculated metadata.
// Falls back from nam/trung to bac.
func (ls *LexiconStore) ResolveTerm(
	dialect string,
	isBlood bool,
	isSpouseDirect bool,
	deltaG int, // toNode generation minus fromNode generation (e.g. from An to grandson = +2)
	isDirectLine bool, // true if direct ancestor/descendant
	isPatrilineal bool, // true if connecting ancestor chain is through male parents
	targetGender model.Gender,
	seniority int, // +1 if target is older, -1 if younger, 0 if unknown/same
	subKey string, // e.g. "patri_older_male", "patri_younger_male", etc.
) string {
	dialect = NormalizeDialect(dialect)

	// Try requested dialect first
	term := ls.lookupKey(dialect, isBlood, isSpouseDirect, deltaG, isDirectLine, isPatrilineal, targetGender, seniority, subKey)
	if term != "" {
		return term
	}

	// Fallback to "bac" if not found
	if dialect != "bac" {
		term = ls.lookupKey("bac", isBlood, isSpouseDirect, deltaG, isDirectLine, isPatrilineal, targetGender, seniority, subKey)
		if term != "" {
			return term
		}
	}

	return ""
}

func (ls *LexiconStore) lookupKey(
	dialect string,
	isBlood bool,
	isSpouseDirect bool,
	deltaG int,
	isDirectLine bool,
	isPatrilineal bool,
	targetGender model.Gender,
	seniority int,
	subKey string,
) string {
	var dict map[string]any
	switch dialect {
	case "nam":
		dict = ls.nam["nam"].(map[string]any)
	case "trung":
		dict = ls.trung["trung"].(map[string]any)
	default:
		dict = ls.bac["bac"].(map[string]any)
	}

	if dict == nil {
		return ""
	}

	if isSpouseDirect {
		if affinal, ok := dict["affinal"].(map[string]any); ok {
			if sp, ok := affinal["spouse"].(map[string]any); ok {
				if val, ok := sp[string(targetGender)].(string); ok {
					return val
				}
			}
		}
		return ""
	}

	// Blood or affinal fallback
	category := "blood"
	if !isBlood {
		category = "affinal"
	}

	catMap, ok := dict[category].(map[string]any)
	if !ok {
		return ""
	}

	var genKey string
	if deltaG > 0 {
		genKey = fmt.Sprintf("up%d", deltaG)
	} else if deltaG < 0 {
		genKey = fmt.Sprintf("down%d", -deltaG)
	} else {
		genKey = "0"
	}

	genMap, ok := catMap[genKey].(map[string]any)
	if !ok {
		return ""
	}

	// If explicit subKey provided
	if subKey != "" {
		if val, ok := genMap[subKey].(string); ok {
			return val
		}
	}

	// Try gender fallback
	if val, ok := genMap[string(targetGender)].(string); ok {
		return val
	}

	return ""
}
