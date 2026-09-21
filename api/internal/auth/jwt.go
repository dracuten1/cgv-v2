package auth

import (
	"crypto/hmac"
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"time"

	"github.com/dracuten1/cgv-v2/api/internal/config"
	"github.com/dracuten1/cgv-v2/api/internal/model"
	"github.com/golang-jwt/jwt/v5"
)

// TokenTTL is the JWT validity window (spec: 24h).
const TokenTTL = 24 * time.Hour

// Claims is the CGP v2 JWT claim set (DICTATED contract — the cycle-3
// middleware compiles against these exact field names).
type Claims struct {
	UserID   string `json:"sub"`     // user UUID
	IsDemo   bool   `json:"is_demo"` // demo-account marker (INV-04)
	Issuer   string `json:"iss"`     // cgp-demo | cgp-prod
	Audience string `json:"aud"`     // equals Issuer
	jwt.RegisteredClaims
}

// issueJTI returns a fresh 16-byte random hex jti.
func issueJTI() (string, error) {
	buf := make([]byte, 16)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("không thể sinh mã định danh phiên: %w", err)
	}
	return hex.EncodeToString(buf), nil
}

// IssueToken signs an HMAC-SHA256 JWT for user with the configured issuer
// (config.JWTIssuer: cgp-demo in demo mode, cgp-prod otherwise), audience
// equal to issuer, 24h expiry and a 16-byte hex jti. The demo flag always
// mirrors user.IsDemo so VerifyToken can reject any demo/real mismatch (INV-04).
func (s *Service) IssueToken(user model.User) (string, error) {
	jti, err := issueJTI()
	if err != nil {
		return "", err
	}
	now := time.Now()
	issuer := s.cfg.JWTIssuer
	if user.IsDemo {
		issuer = config.DemoJWTIssuer
	} else if issuer == config.DemoJWTIssuer {
		issuer = config.ProdJWTIssuer
	}
	claims := &Claims{
		UserID:   user.ID,
		IsDemo:   user.IsDemo,
		Issuer:   issuer,
		Audience: issuer,
		RegisteredClaims: jwt.RegisteredClaims{
			ID:        jti,
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(TokenTTL)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(s.cfg.JWTSecret))
	if err != nil {
		return "", fmt.Errorf("không thể ký mã phiên đăng nhập: %w", err)
	}
	return signed, nil
}

// VerifyToken parses and validates signature, issuer, audience and expiry,
// then enforces the INV-04 demo isolation invariant: the issuer must match
// the configured issuer AND align with the is_demo flag — demo tokens
// (cgp-demo) must carry is_demo=true; real tokens (cgp-prod) is_demo=false.
// Any mismatch (including tokens minted under a foreign issuer) is rejected
// with ErrInvalidToken.
func (s *Service) VerifyToken(tokenStr string) (*Claims, error) {
	key := func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("phương thức ký không được hỗ trợ: %v", t.Header["alg"])
		}
		return []byte(s.cfg.JWTSecret), nil
	}
	parsed, err := jwt.ParseWithClaims(tokenStr, &Claims{}, key,
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithExpirationRequired())
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidToken, err)
	}
	claims, ok := parsed.Claims.(*Claims)
	if !ok || !parsed.Valid {
		return nil, ErrInvalidToken
	}
	// Issuer must equal audience (spec invariant — aud coupled to iss).
	//
	// Dev-only relaxation (leader-decided refinement of close-out option (a)):
	// a dev-mode deployment runs with AppEnv=EnvDev + JWTIssuer=cgp-prod, yet
	// the LoginView "Dùng thử ngay" button may mint a demo-session token
	// (iss=cgp-demo + is_demo=true) for the embedded demo identity. In dev
	// only we therefore accept the known issuer set {cfg.JWTIssuer, cgp-demo}.
	// Strict modes (prod AND demo) keep the EXACT single-issuer match so the
	// round-1 C3 hardening (prod never accepts cgp-demo tokens) and the demo
	// Mode A isolation are byte-for-byte unchanged.
	allowedIssuers := map[string]struct{}{s.cfg.JWTIssuer: {}}
	if s.cfg.AppEnv == config.EnvDev {
		allowedIssuers[config.DemoJWTIssuer] = struct{}{}
	}
	if claims.Issuer == "" || claims.Audience == "" ||
		claims.Issuer != claims.Audience {
		return nil, ErrInvalidToken
	}
	if _, ok := allowedIssuers[claims.Issuer]; !ok {
		return nil, ErrInvalidToken
	}
	// Demo isolation enforcement: issuer must agree with the demo flag.
	if (claims.Issuer == config.DemoJWTIssuer) != claims.IsDemo {
		return nil, ErrInvalidToken
	}
	return claims, nil
}

// LinkStatePurpose is the explicit purpose claim for account-linking state JWTs.
const LinkStatePurpose = "oauth_link"

// LinkStateClaims represents the signed state JWT for account linking.
type LinkStateClaims struct {
	UserID   string `json:"sub"`
	Provider string `json:"provider"`
	Nonce    string `json:"nonce"`
	Purpose  string `json:"purpose"`
	jwt.RegisteredClaims
}

// IssueLinkState signs a state JWT for account linking (exp 10m, aud: "link").
func (s *Service) IssueLinkState(userID, provider, nonce string) (string, error) {
	now := time.Now()
	issuer := s.cfg.JWTIssuer
	if issuer == "" {
		issuer = config.ProdJWTIssuer
	}
	claims := &LinkStateClaims{
		UserID:   userID,
		Provider: provider,
		Nonce:    nonce,
		Purpose:  LinkStatePurpose,
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    issuer,
			Audience:  jwt.ClaimStrings{"link"},
			IssuedAt:  jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(now.Add(10 * time.Minute)),
		},
	}
	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	signed, err := token.SignedString([]byte(s.cfg.JWTSecret))
	if err != nil {
		return "", fmt.Errorf("không thể ký trạng thái liên kết tài khoản: %w", err)
	}
	return signed, nil
}

// VerifyLinkState parses and validates a link state JWT.
func (s *Service) VerifyLinkState(stateJWT string) (*LinkStateClaims, error) {
	key := func(t *jwt.Token) (any, error) {
		if _, ok := t.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("phương thức ký không được hỗ trợ: %v", t.Header["alg"])
		}
		return []byte(s.cfg.JWTSecret), nil
	}
	issuer := s.cfg.JWTIssuer
	if issuer == "" {
		issuer = config.ProdJWTIssuer
	}
	parsed, err := jwt.ParseWithClaims(stateJWT, &LinkStateClaims{}, key,
		jwt.WithValidMethods([]string{jwt.SigningMethodHS256.Alg()}),
		jwt.WithExpirationRequired(),
		jwt.WithAudience("link"),
		jwt.WithIssuer(issuer))
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidState, err)
	}
	claims, ok := parsed.Claims.(*LinkStateClaims)
	if !ok || !parsed.Valid {
		return nil, ErrInvalidState
	}
	if claims.Purpose != LinkStatePurpose {
		return nil, fmt.Errorf("%w: mục đích token không hợp lệ", ErrInvalidState)
	}
	return claims, nil
}

// constantTimeEquals is an hmac-secure constant-time comparison helper.
func constantTimeEquals(a, b string) bool {
	return hmac.Equal([]byte(a), []byte(b))
}
