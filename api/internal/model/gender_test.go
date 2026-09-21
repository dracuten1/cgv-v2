package model

import (
	"strings"
	"testing"

	"golang.org/x/text/unicode/norm"
)

func TestParseGenderVN_Table(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    Gender
		wantErr bool
	}{
		{name: "lowercase nam", input: "nam", want: GenderMale},
		{name: "capitalized nam", input: "Nam", want: GenderMale},
		{name: "uppercase NAM", input: "NAM", want: GenderMale},
		{name: "padded nam", input: "  nam  ", want: GenderMale},
		{name: "precomposed nữ", input: "nữ", want: GenderFemale},
		{name: "capitalized Nữ", input: "Nữ", want: GenderFemale},
		{name: "uppercase NỮ", input: "NỮ", want: GenderFemale},
		{name: "ascii fallback nu", input: "nu", want: GenderFemale},
		{name: "uppercase NU", input: "NU", want: GenderFemale},
		{name: "NFD decomposed nữ", input: "nu\u031b\u0303", want: GenderFemale},
		{name: "invalid empty", input: "", wantErr: true},
		{name: "invalid english in VN parser", input: "male", wantErr: true},
		{name: "invalid gibberish", input: "khác", wantErr: true},
		{name: "invalid reversed", input: "man", wantErr: true},
		{name: "invalid whitespace only", input: "   ", wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseGenderVN(tt.input)
			if (err != nil) != tt.wantErr {
				t.Fatalf("ParseGenderVN(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
			}
			if tt.wantErr {
				if !strings.Contains(err.Error(), "giới tính") {
					t.Fatalf("ParseGenderVN(%q) error %q must be a descriptive Vietnamese message", tt.input, err.Error())
				}
				return
			}
			if got != tt.want {
				t.Fatalf("ParseGenderVN(%q) = %q, want %q", tt.input, got, tt.want)
			}
		})
	}
}

func TestParseGenderAPI_Table(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		want    Gender
		wantErr bool
	}{
		{name: "lowercase male", input: "male", want: GenderMale},
		{name: "capitalized Male", input: "Male", want: GenderMale},
		{name: "uppercase FEMALE", input: "FEMALE", want: GenderFemale},
		{name: "padded female", input: " female ", want: GenderFemale},
		{name: "invalid vietnamese in API parser", input: "nam", wantErr: true},
		{name: "invalid nữ in API parser", input: "nữ", wantErr: true},
		{name: "invalid empty", input: "", wantErr: true},
		{name: "invalid number-ish", input: "1", wantErr: true},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := ParseGenderAPI(tt.input)
			if (err != nil) != tt.wantErr {
				t.Fatalf("ParseGenderAPI(%q) error = %v, wantErr %v", tt.input, err, tt.wantErr)
			}
			if !tt.wantErr && got != tt.want {
				t.Fatalf("ParseGenderAPI(%q) = %q, want %q", tt.input, got, tt.want)
			}
			if tt.wantErr && !strings.Contains(err.Error(), "giới tính") {
				t.Fatalf("ParseGenderAPI(%q) error %q must be a descriptive Vietnamese message", tt.input, err.Error())
			}
		})
	}
}

func TestGenderToVN_Table(t *testing.T) {
	tests := []struct {
		g    Gender
		want string
	}{
		{GenderMale, "Nam"},
		{GenderFemale, "Nữ"},
		{Gender("unknown"), ""},
		{Gender(""), ""},
	}
	for _, tt := range tests {
		if got := tt.g.ToVN(); got != tt.want {
			t.Fatalf("Gender(%q).ToVN() = %q, want %q", tt.g, got, tt.want)
		}
	}
}

func TestGenderString(t *testing.T) {
	if GenderMale.String() != "male" {
		t.Fatalf("GenderMale.String() = %q, want %q", GenderMale.String(), "male")
	}
	if GenderFemale.String() != "female" {
		t.Fatalf("GenderFemale.String() = %q, want %q", GenderFemale.String(), "female")
	}
}

// TestGenderRoundtrip_DB_Excel_DB enforces INV-03 end-to-end: the canonical DB
// value exports as Vietnamese ("Nam"/"Nữ", as written into Excel cells), and
// importing that cell value maps back to the identical canonical value.
func TestGenderRoundtrip_DB_Excel_DB(t *testing.T) {
	cases := []Gender{GenderMale, GenderFemale}
	for _, dbValue := range cases {
		t.Run(string(dbValue), func(t *testing.T) {
			excelCell := dbValue.ToVN() // export: DB → Excel cell

			if norm.NFC.String(excelCell) != excelCell {
				t.Fatalf("exported cell %q must be NFC-composed", excelCell)
			}

			reimported, err := ParseGenderVN(excelCell) // import: Excel cell → DB
			if err != nil {
				t.Fatalf("re-import of %q failed: %v", excelCell, err)
			}
			if reimported != dbValue {
				t.Fatalf("roundtrip changed the value: DB %q → Excel %q → DB %q", dbValue, excelCell, reimported)
			}
			if reimported.String() != dbValue.String() {
				t.Fatalf("canonical string drift: %q vs %q", reimported.String(), dbValue.String())
			}
		})
	}
}

// TestGenderRoundtrip_API guarantees the API payload path is lossless too.
func TestGenderRoundtrip_API(t *testing.T) {
	for _, dbValue := range []Gender{GenderMale, GenderFemale} {
		payload := dbValue.String()
		got, err := ParseGenderAPI(payload)
		if err != nil {
			t.Fatalf("ParseGenderAPI(%q) unexpected error: %v", payload, err)
		}
		if got != dbValue {
			t.Fatalf("API roundtrip changed the value: %q → %q", dbValue, got)
		}
	}
}
