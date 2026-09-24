package auth

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/config"
	"github.com/dracuten1/cgv-v2/api/internal/model"
)

// Service is the auth orchestration surface the handler layer (cycle 3)
// codes against. It wires configuration, the transaction runner and the
// repository ports; provider adapters are built lazily from cfg.
type Service struct {
	cfg *config.Config
	tx  TxRunner

	users      UserStore
	identities IdentityStore
	contacts   ContactStore
	tokens     MagicLinkStore
	sessions   SessionStore
	locker     ContactLocker
	outbox     OutboxEnqueuer

	zalo     *ZaloProvider
	google   *GoogleProvider
	facebook *FacebookProvider
	mock     *MockProvider

	members MemberLookup

	flows oauthFlows
}

// ServiceDeps bundles the repository ports NewService consumes. Zero-value
// members are legal for flows that never touch them, but production wiring
// passes every concrete repository from internal/repository/auth.
type ServiceDeps struct {
	Users      UserStore
	Identities IdentityStore
	Contacts   ContactStore
	Tokens     MagicLinkStore
	Sessions   SessionStore
	Locker     ContactLocker
	Outbox     OutboxEnqueuer
	// Members backs the POST /me/member existence check (M1 Rule 2).
	// Optional: flows that never link members may omit it.
	Members MemberLookup
}

// NewService assembles the auth Service. The concrete repository types in
// internal/repository/auth satisfy these ports at compile time (asserted
// there).
func NewService(cfg *config.Config, tx TxRunner, deps ServiceDeps) *Service {
	return &Service{
		cfg:        cfg,
		tx:         tx,
		users:      deps.Users,
		identities: deps.Identities,
		contacts:   deps.Contacts,
		tokens:     deps.Tokens,
		sessions:   deps.Sessions,
		locker:     deps.Locker,
		outbox:     deps.Outbox,
		members:    deps.Members,
		zalo:       NewZaloProvider(cfg),
		google:     NewGoogleProvider(cfg),
		facebook:   NewFacebookProvider(cfg),
		mock:       NewMockProvider(cfg),
		flows:      oauthFlows{secret: []byte(cfg.JWTSecret), secure: cfg.SecureCookies()},
	}
}

// providerAdapter resolves the provider adapter by name; unknown →
// ErrUnknownProvider.
func (s *Service) providerAdapter(provider string) (authURLSetter, exchanger, error) {
	switch provider {
	case model.ProviderZalo:
		return s.zalo, s.zalo, nil
	case model.ProviderGoogle:
		return s.google, s.google, nil
	case model.ProviderFacebook:
		return s.facebook, s.facebook, nil
	case model.ProviderMock:
		return s.mock, s.mock, nil
	default:
		return nil, nil, ErrUnknownProvider
	}
}

// authURLSetter is the AuthURL half of a provider adapter.
type authURLSetter interface {
	AuthURL(state, challenge string) (string, error)
}

// exchanger is the Exchange half of a provider adapter.
type exchanger interface {
	Exchange(ctx context.Context, code, verifier string) (*ProviderClaims, error)
}

// LoginURL returns the OAuth authorize URL for provider, minting a signed
// burn-on-read state cookie into w (the handler's ResponseWriter) and
// binding the S256 PKCE challenge. The state parameter also carries the
// PKCE verifier (HMAC-signed) so the callback can complete the challenge.
// Provider not configured (empty client ID) → ErrProviderDisabled.
//
// Signature deviation from the dictated LoginURL(ctx, provider): the state
// cookie needs the HTTP surfaces (http.ResponseWriter / *http.Request); ctx
// alone cannot carry Set-Cookie. The name and return shape are unchanged.
func (s *Service) LoginURL(w http.ResponseWriter, r *http.Request, provider string) (string, error) {
	adapter, _, err := s.providerAdapter(provider)
	if err != nil {
		return "", err
	}
	nonce, err := s.flows.SetStateCookie(w, r)
	if err != nil {
		return "", fmt.Errorf("không thể tạo phiên bảo mật đăng nhập: %w", err)
	}
	verifier, challenge, err := s.flows.pkcePair()
	if err != nil {
		return "", err
	}
	stateParam := bindState(s.flows.secret, nonce, verifier)
	return adapter.AuthURL(stateParam, challenge)
}

// HandleCallback runs the full callback flow: state-cookie validation
// (burn-on-read), pre-transaction provider exchange (ADR-007: external HTTP
// strictly outside any tx), then dispatches either to account linking
// (completeLinkWithClaims, when state carries explicit purpose:"oauth_link")
// or the identity-resolution state machine inside one tx.
func (s *Service) HandleCallback(ctx context.Context, w http.ResponseWriter, r *http.Request, provider, code, stateParam string) (*AuthResult, error) {
	signedPayload, verifier, ok := unbindState(s.flows.secret, stateParam)
	if !ok {
		return nil, ErrInvalidState
	}

	// Determine if this state carries a link intent.
	linkClaims, linkErr := s.VerifyLinkState(signedPayload)
	if linkErr == nil && linkClaims != nil && linkClaims.Purpose == LinkStatePurpose {
		// LINK FLOW DISPATCH
		if linkClaims.Provider != provider {
			return nil, ErrInvalidState
		}

		cookieNonce, err := s.flows.ConsumeStateCookie(r, w)
		if err != nil || !constantTimeEquals(cookieNonce, linkClaims.Nonce) {
			return nil, ErrInvalidState
		}

		// Design intent: The binding proof is the burn-on-read state-cookie nonce
		// match verified above; an ABSENT session cookie (e.g. cross-site cookie
		// restrictions) is acceptable — the signed state nonce alone is sufficient;
		// but if a session cookie IS present, it must match the same user.
		// If a session cookie is present, assert it matches the session user in linkClaims.
		cookieName := getCookieName(s.cfg)
		if c, err := r.Cookie(cookieName); err == nil && c.Value != "" {
			if sessClaims, err := s.VerifyToken(c.Value); err == nil && sessClaims != nil {
				if sessClaims.UserID != linkClaims.UserID {
					return nil, fmt.Errorf("session user mismatch: %w", ErrInvalidState)
				}
			}
		}

		// PRE-TX: provider exchange.
		_, exchangerAdapter, err := s.providerAdapter(provider)
		if err != nil {
			return nil, err
		}
		claims, err := exchangerAdapter.Exchange(ctx, code, verifier)
		if err != nil {
			return nil, err
		}

		user, err := s.completeLinkWithClaims(ctx, linkClaims.UserID, claims)
		if err != nil {
			return nil, err
		}

		identities, err := s.identities.ListByUser(ctx, linkClaims.UserID)
		if err != nil {
			return nil, err
		}

		token, err := s.IssueToken(*user)
		if err != nil {
			return nil, err
		}

		return &AuthResult{
			User:       *user,
			Token:      token,
			CookieName: cookieName,
			IsNew:      false,
			IsLinked:   true,
			Identities: identities,
		}, nil
	}

	// NORMAL LOGIN FLOW:
	// Explicitly assert that link-state JWTs cannot log in (login-state JWTs
	// must not dispatch to the link path; link-state JWTs must not log in).
	if strings.Count(signedPayload, ".") >= 2 {
		return nil, ErrInvalidState
	}

	cookieNonce, err := s.flows.ConsumeStateCookie(r, w)
	if err != nil || !constantTimeEquals(cookieNonce, signedPayload) {
		return nil, ErrInvalidState
	}

	// PRE-TX: provider exchange (network I/O strictly outside transactions).
	_, exchangerAdapter, err := s.providerAdapter(provider)
	if err != nil {
		return nil, err
	}
	claims, err := exchangerAdapter.Exchange(ctx, code, verifier)
	if err != nil {
		return nil, err
	}

	// IN-TX: identity resolution with retry wrapper.
	return s.Resolve(ctx, claims)
}

// StartLinkProvider begins the "add another login method" flow for an
// EXISTING user (GET /api/v1/me/link/:provider/start): mint a signed state JWT,
// set the state cookie, return the authorize URL.
func (s *Service) StartLinkProvider(w http.ResponseWriter, r *http.Request, userID, provider string) (string, error) {
	if _, err := s.users.GetByID(r.Context(), userID); err != nil {
		if isNotFoundErr(err) {
			return "", ErrUserNotFound
		}
		return "", fmt.Errorf("không thể truy vấn tài khoản: %w", err)
	}

	adapter, _, err := s.providerAdapter(provider)
	if err != nil {
		return "", err
	}
	nonce, err := s.flows.SetStateCookie(w, r)
	if err != nil {
		return "", fmt.Errorf("không thể tạo phiên bảo mật đăng nhập: %w", err)
	}
	verifier, challenge, err := s.flows.pkcePair()
	if err != nil {
		return "", err
	}

	stateJWT, err := s.IssueLinkState(userID, provider, nonce)
	if err != nil {
		return "", err
	}
	stateParam := bindState(s.flows.secret, stateJWT, verifier)
	return adapter.AuthURL(stateParam, challenge)
}

// completeLinkWithClaims locks users row (ADR-007 global lock order), checks demo isolation,
// inserts identity (mapping duplicate to ErrAlreadyLinked), and confirms provider contacts.
func (s *Service) completeLinkWithClaims(ctx context.Context, userID string, claims *ProviderClaims) (*model.User, error) {
	var linkedUser *model.User
	err := s.tx.WithTx(ctx, func(txCtx context.Context) error {
		user, err := s.users.GetByIDForUpdate(txCtx, userID)
		if err != nil {
			if isNotFoundErr(err) {
				return ErrUserNotFound
			}
			return fmt.Errorf("không thể khóa tài khoản để liên kết: %w", err)
		}
		linkedUser = user
		// INV-04: demo accounts never gain extra providers.
		if user.IsDemo || claims.Provider == model.ProviderDemo {
			return ErrDemoIsolation
		}
		if _, err := s.identities.Insert(txCtx, user.ID, claims.Provider, claims.Subject); err != nil {
			if errors.Is(err, ErrDuplicateIdentity) {
				return ErrAlreadyLinked
			}
			return fmt.Errorf("không thể liên kết định danh: %w", err)
		}
		// Confirm contact claims supplied by the provider for this user.
		if claims.Email != nil && claims.Email.Value != "" {
			if err := s.confirmContact(txCtx, user.ID, model.ContactKindEmail, claims.Email); err != nil {
				return err
			}
		}
		if claims.Phone != nil && claims.Phone.Value != "" {
			if err := s.confirmContact(txCtx, user.ID, model.ContactKindPhone, claims.Phone); err != nil {
				return err
			}
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	return linkedUser, nil
}

// confirmContact inserts-or-marks a contact point verified for userID.
func (s *Service) confirmContact(ctx context.Context, userID, kind string, claim *ContactClaim) error {
	cleanVal := NormalizeContact(kind, claim.Value)
	existing, err := s.contacts.FindByKindValue(ctx, kind, cleanVal)
	if err != nil && !isNotFoundErr(err) {
		return fmt.Errorf("không thể tra cứu điểm liên hệ: %w", err)
	}
	switch {
	case existing == nil:
		if _, err := s.contacts.Insert(ctx, userID, kind, cleanVal, claim.Verified, model.ProviderMock); err != nil {
			return fmt.Errorf("không thể lưu điểm liên hệ: %w", err)
		}
	case existing.UserID == userID && !existing.Verified && claim.Verified:
		if err := s.contacts.MarkVerified(ctx, existing.ID, "link_provider"); err != nil {
			return fmt.Errorf("không thể xác nhận điểm liên hệ: %w", err)
		}
	}
	return nil
}

// UnlinkIdentity removes one provider identity from a user in ONE
// transaction (ADR-007): lock the users row FOR UPDATE → count identities →
// delete, or return ErrLastIdentity (→ 409 LAST_IDENTITY_CANNOT_BE_REMOVED
// "Không thể hủy liên kết phương thức đăng nhập duy nhất của tài khoản") if
// it is the last one.
func (s *Service) UnlinkIdentity(ctx context.Context, userID, identityID string) error {
	return s.tx.WithTx(ctx, func(txCtx context.Context) error {
		// Canonical ADR-007 form: parent users row lock FIRST.
		if _, err := s.users.GetByIDForUpdate(txCtx, userID); err != nil {
			if isNotFoundErr(err) {
				return ErrUserNotFound
			}
			return fmt.Errorf("không thể khóa tài khoản: %w", err)
		}
		count, err := s.identities.CountByUser(txCtx, userID)
		if err != nil {
			return fmt.Errorf("không thể đếm định danh: %w", err)
		}
		if count <= 1 {
			return ErrLastIdentity
		}
		if err := s.identities.Delete(txCtx, identityID, userID); err != nil {
			if isNotFoundErr(err) {
				return ErrIdentityNotFound
			}
			return fmt.Errorf("không thể hủy liên kết định danh: %w", err)
		}
		return nil
	})
}

// CurrentUser assembles the GET /api/v1/me payload: user + all linked
// identities + all contact points.
func (s *Service) CurrentUser(ctx context.Context, userID string) (*UserProfile, error) {
	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		if isNotFoundErr(err) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("không thể truy vấn tài khoản: %w", err)
	}
	identities, err := s.identities.ListByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("không thể liệt kê định danh đã liên kết: %w", err)
	}
	contacts, err := s.contacts.ListByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("không thể liệt kê điểm liên hệ: %w", err)
	}
	return &UserProfile{User: *user, Identities: identities, Contacts: contacts}, nil
}

// LinkMember binds the authenticated user to a family-tree member
// (POST /api/v1/me/member, Decision 3B, MUST-FIX M1) enforcing the FIVE
// canonical rules in order:
//
//  1. Demo isolation guard — demo accounts are NEVER linkable (→ 403
//     CodeDemoIsolationViolation, INV-04). Fires before anything else.
//  2. Missing member — target member_id must exist (→ 404).
//  3. Idempotent self-link — user already bound to the SAME member (→ 200,
//     no write).
//  4. Claim conflict — member already held by ANOTHER user (→ 409
//     CodeConflict), also enforced by idx_users_member_id_unique (23505)
//     under concurrency.
//  5. Unlinked claim — user.member_id is NULL (→ link, 200).
//
// Returns the refreshed UserProfile (uniform with CurrentUser / GET /me —
// no new DTO, D3: the binding is globally 1:1 across users and members).
func (s *Service) LinkMember(ctx context.Context, userID, memberID string) (*UserProfile, error) {
	// Rule 1 — demo isolation guard (canonical first check, INV-04).
	user, err := s.users.GetByID(ctx, userID)
	if err != nil {
		if isNotFoundErr(err) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("không thể truy vấn tài khoản: %w", err)
	}
	if user.IsDemo {
		return nil, ErrDemoIsolation
	}

	// Rule 2 — member must exist.
	if s.members == nil {
		return nil, fmt.Errorf("cổng tra cứu thành viên chưa được cấu hình")
	}
	if _, err := s.members.GetByID(ctx, memberID); err != nil {
		if isNotFoundErr(err) {
			return nil, ErrMemberNotFound
		}
		return nil, fmt.Errorf("không thể tra cứu thành viên gia phả: %w", err)
	}

	// Rule 3 — idempotent self-link: same member → no write, 200.
	if user.MemberID != nil && *user.MemberID == memberID {
		return s.CurrentUser(ctx, userID)
	}

	// Rule 4 — conflict pre-check: another user already holds this member.
	holder, err := s.users.GetByMemberID(ctx, memberID)
	if err != nil {
		return nil, fmt.Errorf("không thể kiểm tra liên kết thành viên: %w", err)
	}
	if holder != nil && holder.ID != userID {
		return nil, ErrMemberAlreadyClaimed
	}

	// Rule 5 — unlinked claim (or re-link from an old member): execute the
	// write. The partial unique index idx_users_member_id_unique turns a
	// lost concurrent race into 23505 → ErrMemberAlreadyClaimed (409).
	// A TOCTOU race where member is deleted before UPDATE turns 23503 →
	// ErrMemberNotFound (404, M-A).
	if err := s.users.LinkMember(ctx, userID, memberID); err != nil {
		if errors.Is(err, ErrMemberAlreadyClaimed) {
			return nil, ErrMemberAlreadyClaimed
		}
		if errors.Is(err, ErrMemberNotFound) {
			return nil, ErrMemberNotFound
		}
		if isNotFoundErr(err) {
			return nil, ErrUserNotFound
		}
		return nil, fmt.Errorf("không thể liên kết thành viên gia phả: %w", err)
	}

	return s.CurrentUser(ctx, userID)
}

// Logout revokes the session keyed by jti (best-effort: an unknown jti is a
// no-op; other failures are wrapped for the handler to log — cookie
// clearing is the handler's job).
func (s *Service) Logout(ctx context.Context, jti string) error {
	if jti == "" || s.sessions == nil {
		return nil
	}
	cancelCtx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	if err := s.sessions.RevokeByJti(cancelCtx, jti); err != nil {
		return fmt.Errorf("không thể thu hồi phiên đăng nhập: %w", err)
	}
	return nil
}

// FOR TESTING ONLY — mutates provider endpoints; not safe for concurrent production use.
// SetGoogleEndpoints overrides endpoints on the Google adapter (used for test harnesses).
func (s *Service) SetGoogleEndpoints(authURL, tokenURL, profileURL string) {
	if s.google != nil {
		if authURL != "" {
			s.google.AuthEndpoint = authURL
		}
		if tokenURL != "" {
			s.google.TokenEndpoint = tokenURL
		}
		if profileURL != "" {
			s.google.ProfileEndpoint = profileURL
		}
	}
}

func getCookieName(cfg *config.Config) string {
	if cfg.CookieName != "" {
		return cfg.CookieName
	}
	if cfg.DemoMode {
		return config.DemoCookieName
	}
	return config.ProdCookieName
}
