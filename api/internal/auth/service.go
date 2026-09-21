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
		zalo:       NewZaloProvider(cfg),
		google:     NewGoogleProvider(cfg),
		facebook:   NewFacebookProvider(cfg),
		mock:       NewMockProvider(cfg),
		flows:      oauthFlows{secret: []byte(cfg.JWTSecret)},
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
// strictly outside any tx), then dispatches either to CompleteLink (when
// state carries explicit purpose:"oauth_link") or the identity-resolution
// state machine inside one tx.
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
	// Explicitly assert that link-state JWTs cannot log in (login-state JWTs must not dispatch to CompleteLink; link-state JWTs must not log in).
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

// validateState consumes the state cookie, validates the URL state's
// signature and cross-binds the two nonces; returns the recovered PKCE
// verifier.
func (s *Service) validateState(w http.ResponseWriter, r *http.Request, stateParam string) (string, error) {
	cookieNonce, err := s.flows.ConsumeStateCookie(r, w)
	if err != nil {
		return "", err
	}
	stateNonce, verifier, ok := unbindState(s.flows.secret, stateParam)
	if !ok || !constantTimeEquals(cookieNonce, stateNonce) {
		return "", ErrInvalidState
	}
	return verifier, nil
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

// CompleteLink finishes provider linking for an EXISTING user: exchange the
// code, then in ONE transaction lock the users row (GetByIDForUpdate),
// verify demo isolation and insert the identity. A 23505 (provider account
// already bound to any user) surfaces as ErrAlreadyLinked (→ 409 "Tài khoản
// này đã được liên kết").
func (s *Service) CompleteLink(ctx context.Context, w http.ResponseWriter, r *http.Request, userID, provider, code, stateParam string) error {
	if _, _, err := s.providerAdapter(provider); err != nil {
		return err
	}
	verifier, err := s.validateLinkState(w, r, userID, provider, stateParam)
	if err != nil {
		return err
	}

	// PRE-TX: provider exchange.
	_, exchangerAdapter, err := s.providerAdapter(provider)
	if err != nil {
		return err
	}
	claims, err := exchangerAdapter.Exchange(ctx, code, verifier)
	if err != nil {
		return err
	}

	_, err = s.completeLinkWithClaims(ctx, userID, claims)
	return err
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

// validateLinkState consumes the state cookie and validates the signed link state JWT.
func (s *Service) validateLinkState(w http.ResponseWriter, r *http.Request, currentUserID, provider, stateParam string) (string, error) {
	cookieNonce, err := s.flows.ConsumeStateCookie(r, w)
	if err != nil {
		return "", fmt.Errorf("ConsumeStateCookie: %w", err)
	}
	signedPayload, verifier, ok := unbindState(s.flows.secret, stateParam)
	if !ok {
		return "", fmt.Errorf("unbindState: %w", ErrInvalidState)
	}
	linkClaims, err := s.VerifyLinkState(signedPayload)
	if err != nil {
		return "", fmt.Errorf("VerifyLinkState: %w", err)
	}
	if !constantTimeEquals(cookieNonce, linkClaims.Nonce) {
		return "", fmt.Errorf("constantTimeEquals: %w", ErrInvalidState)
	}
	if (currentUserID != "" && linkClaims.UserID != currentUserID) || linkClaims.Provider != provider {
		return "", fmt.Errorf("claims mismatch: %w", ErrInvalidState)
	}
	return verifier, nil
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

// SetHTTPClient overrides the HTTP client on provider adapters (used for test harnesses).
func (s *Service) SetHTTPClient(client *http.Client) {
	if s.google != nil {
		s.google.HTTP = client
	}
	if s.facebook != nil {
		s.facebook.HTTP = client
	}
	if s.zalo != nil {
		s.zalo.HTTP = client
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
