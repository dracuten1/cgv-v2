package auth

import (
	"context"
	"errors"
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/model"
)

// Sentinel errors of the auth domain. Handlers map each to its HTTP status
// and model.ErrorEnvelope with the Vietnamese message embedded in the error.
var (
	// ErrProviderDisabled — the provider has no client ID configured
	// (→ 404 "Nhà cung cấp chưa được cấu hình").
	ErrProviderDisabled = errors.New("Nhà cung cấp chưa được cấu hình")
	// ErrUnknownProvider — provider name outside the supported set
	// (→ 404).
	ErrUnknownProvider = errors.New("Nhà cung cấp không được hỗ trợ")
	// ErrDemoIsolation — a demo/real account mix was attempted anywhere in
	// the flow (→ 403 model.CodeDemoIsolationViolation, INV-04).
	ErrDemoIsolation = errors.New("Tài khoản dùng thử không thể liên kết hoặc trộn với tài khoản thật")
	// ErrLastIdentity — unlinking the sole remaining login method
	// (→ 409 model.CodeLastIdentityCannotBeRemoved).
	ErrLastIdentity = errors.New("Không thể hủy liên kết phương thức đăng nhập duy nhất của tài khoản")
	// ErrAlreadyLinked — the provider account is already bound to a user
	// (→ 409 "Tài khoản này đã được liên kết…").
	ErrAlreadyLinked = errors.New("Tài khoản này đã được liên kết với một người dùng khác")
	// ErrInvalidState — OAuth state cookie missing, mismatched, expired or
	// already burned (→ 400).
	ErrInvalidState = errors.New("Phiên đăng nhập không hợp lệ hoặc đã hết hạn, vui lòng thử lại")
	// ErrInvalidToken — malformed/failed-verification input (JWT or magic
	// link) (→ 401 model.CodeUnauthorized).
	ErrInvalidToken = errors.New("Mã xác thực không hợp lệ hoặc đã hết hạn")
	// ErrTokenUsedOrExpired aliases the repository sentinel so callers of the
	// service surface need no repo import (→ 401).
	ErrTokenUsedOrExpired = errors.New("Liên kết đã được sử dụng hoặc hết hạn")
	// ErrProviderExchange — the provider rejected the code/token exchange or
	// returned an unusable profile (→ 502/401 at handler discretion).
	ErrProviderExchange = errors.New("Không thể xác thực với nhà cung cấp, vui lòng thử lại")
	// ErrUserNotFound — CurrentUser or HandleCallback link dispatch target
	// user missing (→ 404).
	ErrUserNotFound = errors.New("Không tìm thấy tài khoản")
	// ErrIdentityNotFound — UnlinkIdentity target identity missing or not
	// owned by the user (→ 404).
	ErrIdentityNotFound = errors.New("Không tìm thấy liên kết định danh")
	// ErrMemberNotFound — POST /me/member target member_id does not exist in
	// the members table (M1 Rule 2, → 404).
	ErrMemberNotFound = errors.New("Không tìm thấy thành viên trong gia phả")
	// ErrMemberAlreadyClaimed — the target member_id is already bound to
	// another user, either caught by the pre-check or by the
	// idx_users_member_id_unique partial unique index (pgx 23505 race)
	// (M1 Rule 4 + concurrent-claim path, → 409 CodeConflict).
	ErrMemberAlreadyClaimed = errors.New("Thành viên này đã được liên kết với một tài khoản khác")

	// Canonical repository sentinels (declared here, consumer side; the
	// concrete package aliases these exact values so errors.Is works across
	// the boundary without internal/auth importing the repo layer):
	ErrRepoNotFound = errors.New("bản ghi không tồn tại")
	// ErrDuplicateIdentity — UNIQUE(provider, provider_subject) violation
	// (pgx 23505). Lost first-login races re-resolve as auto-link (ADR-007);
	// the HandleCallback link dispatch (completeLinkWithClaims) maps it to
	// ErrAlreadyLinked.
	ErrDuplicateIdentity = errors.New("định danh đã tồn tại cho tài khoản khác")
)

// TxRunner propagates transactions through closures (ADR-006). It is
// satisfied by *database.TxManager; tests substitute a fake that just invokes
// fn. Declared here (consumer side) so internal/auth never imports
// database/pgx.
type TxRunner interface {
	WithTx(ctx context.Context, fn func(ctx context.Context) error) error
}

// UserStore mirrors the repository-side port (consumer declaration: the
// service depends on this subset only). See internal/repository/auth for the
// concrete pgx implementation.
type UserStore interface {
	GetByID(ctx context.Context, userID string) (*model.User, error)
	GetByIDForUpdate(ctx context.Context, userID string) (*model.User, error)
	Create(ctx context.Context, displayName string, isDemo bool) (*model.User, error)
	// GetByMemberID resolves the user currently holding the 1:1 member link
	// (M1 Rule 4 conflict pre-check); nil user with no error when unclaimed.
	GetByMemberID(ctx context.Context, memberID string) (*model.User, error)
	LinkMember(ctx context.Context, userID, memberID string) error
}

// MemberLookup mirrors the minimal member read the POST /me/member flow
// needs (M1 Rule 2 existence check). Declared consumer-side so internal/auth
// never imports the genealogy repository package.
type MemberLookup interface {
	GetByID(ctx context.Context, memberID string) (*model.Member, error)
}

// IdentityStore mirrors the repository-side identity port.
type IdentityStore interface {
	FindByProviderSubject(ctx context.Context, provider, subject string) (*model.Identity, error)
	Insert(ctx context.Context, userID, provider, subject string) (*model.Identity, error)
	TouchLastLogin(ctx context.Context, identityID string) error
	CountByUser(ctx context.Context, userID string) (int, error)
	Delete(ctx context.Context, identityID, userID string) error
	// ListByUser feeds the GET /api/v1/me profile view.
	ListByUser(ctx context.Context, userID string) ([]model.Identity, error)
}

// ContactStore mirrors the repository-side contact port.
type ContactStore interface {
	FindByKindValue(ctx context.Context, kind, value string) (*model.ContactPoint, error)
	Insert(ctx context.Context, userID, kind, value string, verified bool, verifiedVia string) (*model.ContactPoint, error)
	MarkVerified(ctx context.Context, contactID, via string) error
	GetByID(ctx context.Context, contactID string) (*model.ContactPoint, error)
	// ListByUser feeds the GET /api/v1/me profile view.
	ListByUser(ctx context.Context, userID string) ([]model.ContactPoint, error)
}

// MagicLinkStore mirrors the repository-side magic-link token port.
type MagicLinkStore interface {
	Insert(ctx context.Context, tokenHash, email string, expiresAt time.Time) error
	Consume(ctx context.Context, tokenHash string) (string, error)
}

// SessionStore mirrors the repository-side session port.
type SessionStore interface {
	Insert(ctx context.Context, jti, userID string, expiresAt time.Time) error
	RevokeByJti(ctx context.Context, jti string) error
}

// ContactLocker acquires the ADR-007 first-login advisory lock. The concrete
// repository exposes it as a package function plus wrapper; the service
// consumes it through this interface so fakes can observe locking.
type ContactLocker interface {
	AcquireContactAdvisoryLock(ctx context.Context, kind, value string) error
}

// OutboxEnqueuer writes transactional-outbox rows (magic_link.send contract
// payload {"email":…,"link":…}).
type OutboxEnqueuer interface {
	EnqueueMagicLink(ctx context.Context, email, linkURL string) error
}

// UserProfileStore composes the full read side of CurrentUser. The concrete
// repositories in internal/repository/auth satisfy it on the same structs
// that implement IdentityStore/ContactStore (compile-time asserted there).
type UserProfileStore interface {
	ListIdentities(ctx context.Context, userID string) ([]model.Identity, error)
	ListContacts(ctx context.Context, userID string) ([]model.ContactPoint, error)
}
