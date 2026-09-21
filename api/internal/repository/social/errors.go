package socialrepo

import "errors"

var (
	// ErrNotFound is returned when a requested record does not exist.
	ErrNotFound = errors.New("bản ghi không tồn tại")
	// ErrDuplicate is returned when an insert/update violates a uniqueness constraint.
	ErrDuplicate = errors.New("bản ghi đã tồn tại")
)
