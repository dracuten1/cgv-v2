// Package migrations embeds the SQL migration files consumed by the
// api/internal/database migration runner. Files apply in lexicographic order.
package migrations

import "embed"

// FS holds every *.sql migration shipped with the api binary (ADR-009/D7:
// migrations embedded, executed on api boot).
//
//go:embed *.sql
var FS embed.FS
