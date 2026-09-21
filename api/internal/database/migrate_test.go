package database

import (
	"testing"
	"testing/fstest"
)

func TestCollectMigrations_SortsLexicographicallyAndFiltersSQL(t *testing.T) {
	fsys := fstest.MapFS{
		"004_z_last.sql":       {Data: []byte("-- last")},
		"001_first.sql":        {Data: []byte("-- first")},
		"002_readme.md":        {Data: []byte("# not a migration")},
		"003_middle.sql":       {Data: []byte("-- middle")},
		"notes.txt":            {Data: []byte("nope")},
		"sub/010_nested.sql":   {Data: []byte("-- nested, ignored (flat scan)")},
		"000_even_earlier.sql": {Data: []byte("-- earliest")},
	}

	got, err := CollectMigrations(fsys)
	if err != nil {
		t.Fatalf("CollectMigrations() unexpected error: %v", err)
	}

	want := []string{"000_even_earlier.sql", "001_first.sql", "003_middle.sql", "004_z_last.sql"}
	if len(got) != len(want) {
		t.Fatalf("CollectMigrations() returned %d files (%v), want %d", len(got), names(got), len(want))
	}
	for i, m := range got {
		if m.name != want[i] {
			t.Fatalf("CollectMigrations()[%d] = %q, want %q (full order: %v)", i, m.name, want[i], names(got))
		}
		if m.sql == "" {
			t.Fatalf("CollectMigrations()[%d] (%s) has empty SQL body", i, m.name)
		}
	}
}

func TestCollectMigrations_EmptyFS(t *testing.T) {
	got, err := CollectMigrations(fstest.MapFS{})
	if err != nil {
		t.Fatalf("CollectMigrations() unexpected error: %v", err)
	}
	if len(got) != 0 {
		t.Fatalf("CollectMigrations() on empty FS returned %v, want empty", names(got))
	}
}

func names(ms []migration) []string {
	out := make([]string, len(ms))
	for i, m := range ms {
		out[i] = m.name
	}
	return out
}
