import { expect, type Page, type Response } from '@playwright/test';

/**
 * Authentication helpers for CGP v2 acceptance journeys.
 *
 * Grounded in web/src source (do not guess selectors):
 * - LoginView.vue: demo button  [data-testid="demo-login-btn"]  text "Dùng thử ngay"
 *   → POST /api/v1/auth/demo → redirect to /tree.
 * - When MOCK_OAUTH_ENABLED=true (dev main stack), the login page also renders
 *   one outline button per provider: "Đăng nhập với Mock Provider (Thử nghiệm)".
 *   That button does window.location.href = /api/v1/auth/mock/login, which
 *   302s to /api/v1/auth/mock/callback?state=<state>. The mock callback
 *   REQUIRES a `code` query param (AuthHandler.Callback: empty code →
 *   invalid_state), so a plain browser click cannot complete the flow —
 *   loginViaMock() drives the round-trip manually with an explicit code.
 * - Authenticated state: desktop header shows nav link a[href="/tree"]
 *   (text "Gia phả") plus user chip / "Đăng xuất".
 */

/** Authenticated-only signal: header "Đăng xuất" button (AppLayout.vue). */
const AUTH_READY_SELECTOR = 'header button:has-text("Đăng xuất")';

/** True when the page is showing the login screen. */
export async function isOnLoginPage(page: Page): Promise<boolean> {
  return page.locator('[data-testid="demo-login-btn"]').count().then((n) => n > 0);
}

/**
 * Go to '/' and land on the login view if the session is anonymous
 * ('/' redirects to /tree; the router guard bounces anonymous users to /login).
 */
export async function gotoRoot(page: Page): Promise<void> {
  await page.goto('/');
  const onLogin = await isOnLoginPage(page);
  if (!onLogin) {
    await page.goto('/login');
  }
  await expect(page.locator('[data-testid="demo-login-btn"]')).toBeVisible();
}

/**
 * Wait until the app reports an authenticated session. The header renders the
 * display-name chip + "Đăng xuất" button ONLY when authenticated
 * (AppLayout.vue: <template v-if="auth.isAuthenticated">); an anonymous
 * session shows the "Đăng nhập" link instead. Nav links like a[href="/tree"]
 * are ALWAYS rendered and are NOT an auth signal.
 */
export async function waitForAuthenticated(page: Page): Promise<void> {
  await expect(page.locator(AUTH_READY_SELECTOR)).toBeVisible();
}

/**
 * Journey-1/2/4/5 default entry: demo session
 * (POST /api/v1/auth/demo, user.is_demo = true, seed family "Gia phả họ Nguyễn Văn").
 */
export async function demoLogin(page: Page): Promise<void> {
  await gotoRoot(page);
  await page.locator('[data-testid="demo-login-btn"]').click();
  await waitForAuthenticated(page);
}

/**
 * Regular (non-demo) dev login through the offline Mock OAuth provider.
 *
 * The mock provider round-trip must be driven manually because the mock
 * AuthURL (/api/v1/auth/mock/callback?state=…) omits the mandatory `code`.
 * Steps (api/internal/auth/oauth.go + handler/auth_handler.go):
 *   1. GET /api/v1/auth/mock/login  → 302 Location: callback?state=<state>,
 *      sets the signed, burn-on-read state cookie cgp_oauth_state.
 *      page.request shares the browser context cookie jar, so the state
 *      cookie is present when we hit the callback.
 *   2. GET callback?state=…&code=<code> with the browser context so the
 *      session cookie lands in the right jar → 302 /auth/oauth/callback?oauth_linked=mock.
 *   3. Mock exchange semantics: code "verified_email:<addr>" yields a verified
 *      email claim (display name "Người dùng <local-part>"); any other code is
 *      a bare mock:<code> identity.
 */
export async function loginViaMock(page: Page, code = 'verified_email:e2e-journey@cgp.test'): Promise<void> {
  await gotoRoot(page);

  const loginResp: Response = await page.request.get('/api/v1/auth/mock/login', {
    maxRedirects: 0, // capture the 302 instead of following into a code-less callback
  });
  if (loginResp.status() !== 302) {
    throw new Error(
      `Mock OAuth login disabled or misrouted (status ${loginResp.status()} — is MOCK_OAUTH_ENABLED=true on this stack?)`,
    );
  }
  const callbackPath = loginResp.headers()['location'];
  if (!callbackPath || !callbackPath.includes('/api/v1/auth/mock/callback')) {
    throw new Error(`Unexpected mock login redirect target: ${callbackPath}`);
  }

  // Follow the callback inside the page context so the session cookie sticks.
  // The mock AuthURL ALREADY carries `code=verified_email:dev-user@test.vn`
  // (api/internal/auth/mock_oauth.go:39) and Go's c.Query("code") is
  // FIRST-WINS — appending a second `code=` would be silently ignored,
  // collapsing every mock login onto one shared identity. REPLACE the
  // existing `code` param instead; `state` is left untouched.
  const cbUrl = new URL(callbackPath, 'http://mock.local'); // base only for parsing
  cbUrl.searchParams.set('code', code);
  await page.goto(`${cbUrl.pathname}${cbUrl.search}`);

  // The callback 302s to /auth/oauth/callback?oauth_linked=mock whose view
  // refreshes auth state, then auto-redirects to /account. Wait for any
  // authenticated page to settle.
  await page.waitForLoadState('domcontentloaded');
  await waitForAuthenticated(page);
}

export { AUTH_READY_SELECTOR };
