package genrepo

import (
	"errors"

	"github.com/dracuten1/cgv-v2/api/internal/auth"
)

var (
	// ErrNotFound is returned when a requested record does not exist.
	// Aliased to the canonical auth.ErrRepoNotFound (same pattern as
	// authrepo) so errors.Is works across the auth↔genealogy boundary —
	// e.g. auth.Service.LinkMember maps a missing member to a clean 404.
	ErrNotFound = auth.ErrRepoNotFound
	// ErrDuplicate is returned when an insert/update violates a uniqueness constraint.
	ErrDuplicate = errors.New("bản ghi đã tồn tại")
)
