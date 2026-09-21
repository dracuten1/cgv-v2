package model

// ErrorEnvelope is the uniform error response body (INV-02: Vietnamese-first
// messages). HTTP error handlers always answer with this shape:
//
//	{"success": false, "code": "LAST_IDENTITY_CANNOT_BE_REMOVED",
//	 "message": "Không thể hủy liên kết định danh cuối cùng của tài khoản."}
type ErrorEnvelope struct {
	Success bool   `json:"success"` // always false on errors
	Code    string `json:"code"`
	Message string `json:"message"` // proper Vietnamese with diacritics
}

// NewErrorEnvelope builds an ErrorEnvelope with Success fixed to false.
func NewErrorEnvelope(code, vietnameseMessage string) ErrorEnvelope {
	return ErrorEnvelope{Success: false, Code: code, Message: vietnameseMessage}
}

// Well-known error codes shared by handlers across domains.
const (
	CodeUnauthorized                = "UNAUTHORIZED"
	CodeForbidden                   = "FORBIDDEN"
	CodeNotFound                    = "NOT_FOUND"
	CodeValidationError             = "VALIDATION_ERROR"
	CodeConflict                    = "CONFLICT"
	CodeLastIdentityCannotBeRemoved = "LAST_IDENTITY_CANNOT_BE_REMOVED"
	CodeDemoIsolationViolation      = "DEMO_ISOLATION_VIOLATION"
	CodeInvalidGender               = "INVALID_GENDER"
	CodeInternalError               = "INTERNAL_ERROR"
)

// TreeNode is one node of the hierarchical tree returned by
// GET /api/v1/families/:id/tree, nested via Children.
type TreeNode struct {
	ID              string      `json:"id"`
	FullName        string      `json:"full_name"`
	Gender          Gender      `json:"gender"` // canonical "male"/"female"; UI renders "Nam"/"Nữ"
	GenerationIndex int         `json:"generation_index"`
	BirthDate       *string     `json:"birth_date,omitempty"` // RFC3339 date or empty
	DeathDate       *string     `json:"death_date,omitempty"`
	IsLiving        bool        `json:"is_living"`
	AvatarURL       string      `json:"avatar_url,omitempty"`
	SpouseIDs       []string    `json:"spouse_ids,omitempty"`
	Children        []*TreeNode `json:"children,omitempty"`
}

// Page is the generic pagination envelope for list endpoints.
type Page[T any] struct {
	Items  []T   `json:"items"`
	Total  int64 `json:"total"`
	Limit  int   `json:"limit"`
	Offset int   `json:"offset"`
}
