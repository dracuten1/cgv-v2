package auth

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"
)

// OAuth machinery parameters.
const (
	// stateCookieName carries the signed OAuth state between redirect and
	// callback.
	stateCookieName = "cgp_oauth_state"
	// stateTTL is the burn-on-read lifetime of the state cookie.
	stateTTL = 5 * time.Minute
	// stateRandomBytes — 32 random bytes ⇒ 43-char URL-safe nonce.
	stateRandomBytes = 32
	// pkceVerifierBytes — 48 random bytes ⇒ 64-char verifier (RFC 7636).
	pkceVerifierBytes = 48
	// providerTimeout bounds every outbound provider HTTP call (per spec).
	providerTimeout = 5 * time.Second
	// maxProviderBodyBytes caps provider response reads.
	maxProviderBodyBytes = 1 << 20
)

// oauthHTTPClient is the shared provider-bound HTTP client: 5s hard timeout
// per call. Tests swap the transport via httptest servers through the
// per-adapter client fields; this default is only a fallback.
var oauthHTTPClient = &http.Client{Timeout: providerTimeout}

// randomToken returns n crypto/rand bytes as URL-safe base64 (state nonces,
// PKCE verifiers, magic-link raw tokens).
func randomToken(n int) (string, error) {
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return "", fmt.Errorf("không thể sinh dữ liệu ngẫu nhiên: %w", err)
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

// hmacSHA256Hex returns the lowercase hex HMAC-SHA256 of data under key —
// the state-cookie signature.
func hmacSHA256Hex(key []byte, data string) string {
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(data))
	return hex.EncodeToString(mac.Sum(nil))
}

// signState binds "<nonce>.<hmac(nonce)>" so the cookie cannot be forged.
func signState(secret []byte, nonce string) string {
	return nonce + "." + hmacSHA256Hex(secret, nonce)
}

// bindState builds the authorize-URL state parameter: the HMAC-signed
// "nonce|pkce_verifier" payload, so the callback can recover the PKCE
// verifier from a value only this server could have minted.
func bindState(secret []byte, nonce, verifier string) string {
	return signState(secret, nonce+"|"+verifier)
}

// unbindState validates the signed URL state and splits it into
// (nonce, verifier). Foreign/tampered state → ok=false.
func unbindState(secret []byte, signed string) (nonce, verifier string, ok bool) {
	payload, valid := unsignState(secret, signed)
	if !valid {
		return "", "", false
	}
	i := strings.IndexByte(payload, '|')
	if i <= 0 || i == len(payload)-1 {
		return "", "", false
	}
	return payload[:i], payload[i+1:], true
}

// unsignState validates the HMAC signature and returns the inner payload.
func unsignState(secret []byte, signed string) (string, bool) {
	nonce, mac, ok := splitSigned(signed)
	if !ok || !constantTimeEquals(mac, hmacSHA256Hex(secret, nonce)) {
		return "", false
	}
	return nonce, true
}

// splitSigned splits "payload.mac" into its two parts.
// When payload itself contains dots (such as a signed JWT), it splits on the LAST dot.
func splitSigned(s string) (payload, mac string, ok bool) {
	i := strings.LastIndexByte(s, '.')
	if i <= 0 || i == len(s)-1 {
		return "", "", false
	}
	return s[:i], s[i+1:], true
}

// s256Challenge derives the RFC 7636 S256 code_challenge from a verifier.
func s256Challenge(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

// oauthFlows is the embeddable state+PKCE machinery. Provider adapters embed
// it and get signed burn-on-read state cookies and S256 challenges for free.
// Burn is two-layered: (1) the consume response deletes the cookie, and
// (2) consumed nonces are remembered in-process for 2×TTL so a hostile
// client replaying a saved copy still fails closed. The in-memory nonce
// ledger matches the single api-container compose topology (INV-01; a
// multi-instance deployment would swap this for a shared store).
type oauthFlows struct {
	secret []byte
	// secure gates the Secure flag on the state cookie (set AND burn): dev
	// and non-localhost plain-HTTP deployments must not mark it, or
	// RFC 6265bis browsers silently drop it and the callback fails with
	// invalid_state. Derived from cfg.SecureCookies() at construction.
	secure bool

	mu       sync.Mutex
	consumed map[string]time.Time // nonce → consumed-at
}

// markConsumed records the nonce as spent and prunes stale entries; returns
// false when the nonce was ALREADY consumed (replay).
func (f *oauthFlows) markConsumed(nonce string) bool {
	f.mu.Lock()
	defer f.mu.Unlock()
	if f.consumed == nil {
		f.consumed = make(map[string]time.Time)
	}
	now := time.Now()
	// Opportunistic prune of entries older than 2× state TTL.
	for k, at := range f.consumed {
		if now.Sub(at) > 2*stateTTL {
			delete(f.consumed, k)
		}
	}
	if _, seen := f.consumed[nonce]; seen {
		return false
	}
	f.consumed[nonce] = now
	return true
}

// SetStateCookie issues a fresh signed state nonce, stores it in an
// httpOnly/SameSite=Lax burn-on-read cookie (5-min TTL; Secure only when the
// deployment is TLS — cfg.SecureCookies() — so plain-HTTP non-localhost
// browsers keep it) and returns the nonce for binding into the authorize
// URL's state parameter.
func (f *oauthFlows) SetStateCookie(w http.ResponseWriter, r *http.Request) (string, error) {
	nonce, err := randomToken(stateRandomBytes)
	if err != nil {
		return "", err
	}
	http.SetCookie(w, &http.Cookie{
		Name:     stateCookieName,
		Value:    signState(f.secret, nonce),
		Path:     "/",
		MaxAge:   int(stateTTL.Seconds()),
		HttpOnly: true,
		Secure:   f.secure,
		SameSite: http.SameSiteLaxMode,
	})
	return nonce, nil
}

// ConsumeStateCookie validates and burns the state cookie: signature check
// (constant-time), then unconditional deletion so a replayed callback fails
// closed. The caller compares the returned nonce against the `state` URL
// parameter. Missing/expired/foreign state → ErrInvalidState.
func (f *oauthFlows) ConsumeStateCookie(r *http.Request, w http.ResponseWriter) (string, error) {
	c, err := r.Cookie(stateCookieName)
	if err != nil || c.Value == "" {
		return "", ErrInvalidState
	}
	// Burn on read — delete the cookie regardless of the validation outcome.
	// Secure mirrors the set path so the deletion matches the stored cookie.
	http.SetCookie(w, &http.Cookie{
		Name:     stateCookieName,
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		HttpOnly: true,
		Secure:   f.secure,
		SameSite: http.SameSiteLaxMode,
	})
	nonce, mac, ok := splitSigned(c.Value)
	if !ok || !constantTimeEquals(mac, hmacSHA256Hex(f.secret, nonce)) {
		return "", ErrInvalidState
	}
	// Server-side burn: a replayed cookie copy fails closed.
	if !f.markConsumed(nonce) {
		return "", ErrInvalidState
	}
	return nonce, nil
}

// pkcePair returns a fresh (verifier, S256 challenge) pair (RFC 7636 §4.2).
func (f *oauthFlows) pkcePair() (verifier, challenge string, err error) {
	verifier, err = randomToken(pkceVerifierBytes)
	if err != nil {
		return "", "", err
	}
	return verifier, s256Challenge(verifier), nil
}

// providerContext bounds one provider HTTP call at 5s regardless of any
// caller deadline (ADR-007: external HTTP strictly outside transactions).
func providerContext(ctx context.Context) (context.Context, context.CancelFunc) {
	return context.WithTimeout(ctx, providerTimeout)
}

// buildAuthURL assembles an authorize URL with query encoding.
func buildAuthURL(base string, params url.Values) string {
	return base + "?" + params.Encode()
}

// httpFormPOST issues the token-exchange POST (code → access_token) and
// returns the raw body.
func httpFormPOST(ctx context.Context, client *http.Client, endpoint string, form url.Values) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, strings.NewReader(form.Encode()))
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrProviderExchange, err)
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: không thể kết nối tới nhà cung cấp: %v", ErrProviderExchange, err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxProviderBodyBytes))
	if err != nil {
		return nil, fmt.Errorf("%w: không thể đọc phản hồi của nhà cung cấp: %v", ErrProviderExchange, err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%w: mã trạng thái %d từ nhà cung cấp", ErrProviderExchange, resp.StatusCode)
	}
	return body, nil
}

// httpGetAuthorized issues an authenticated GET and returns the raw body.
func httpGetAuthorized(ctx context.Context, client *http.Client, endpoint, bearer string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, fmt.Errorf("%w: %v", ErrProviderExchange, err)
	}
	if bearer != "" {
		req.Header.Set("Authorization", "Bearer "+bearer)
	}
	req.Header.Set("Accept", "application/json")
	resp, err := client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("%w: không thể kết nối tới nhà cung cấp: %v", ErrProviderExchange, err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, maxProviderBodyBytes))
	if err != nil {
		return nil, fmt.Errorf("%w: không thể đọc phản hồi của nhà cung cấp: %v", ErrProviderExchange, err)
	}
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("%w: mã trạng thái %d từ nhà cung cấp", ErrProviderExchange, resp.StatusCode)
	}
	return body, nil
}

// oauthToken is the standard OAuth2 token-response subset.
type oauthToken struct {
	AccessToken string `json:"access_token"`
	TokenType   string `json:"token_type"`
	ExpiresIn   int64  `json:"expires_in"`
}

// decodeTokenResponse parses the JSON token envelope (falls back to
// form-encoding for providers that ignore Accept: json).
func decodeTokenResponse(raw []byte) (oauthToken, error) {
	var t oauthToken
	if err := json.Unmarshal(raw, &t); err == nil && t.AccessToken != "" {
		return t, nil
	}
	if values, err := url.ParseQuery(string(raw)); err == nil {
		if at := values.Get("access_token"); at != "" {
			return oauthToken{AccessToken: at}, nil
		}
	}
	return oauthToken{}, fmt.Errorf("%w: phản hồi mã thông báo không hợp lệ", ErrProviderExchange)
}
