import { test, expect } from '@playwright/test';
import { demoLogin, loginViaMock } from '../helpers/auth';

/**
 * Journey 3: Account linking & the last-identity unlink guard.
 *
 * LOGIN CHOICE DOCUMENTED (INV-04): demo accounts never merge with real
 * accounts — AccountView.vue hides the whole "Thêm phương thức đăng nhập"
 * section when authStore.isDemo (v-if="!authStore.isDemo") and the backend
 * rejects demo linking (demo_restricted). So this journey logs in as a
 * REGULAR dev user through the offline Mock OAuth provider (loginViaMock;
 * MOCK_OAUTH_ENABLED=true on the dev main stack per deploy/.env). The fresh
 * mock account has exactly ONE identity (provider "mock", label
 * "Mock Provider"), which makes it the perfect fixture for the
 * last-identity 409 guard at the end.
 *
 * Real DOM (web/src/views/AccountView.vue + stores/auth.ts):
 * - data-testid="user-display-name" — display-name heading
 * - Identity cards data-testid="identity-card-<id>"; provider label for
 *   provider id "mock" renders as "Mock Provider" (getProviderLabel)
 * - Unlink buttons data-testid="unlink-btn-<id>" text "Hủy liên kết",
 *   DISABLED when isSoleIdentity (identities.length <= 1); the disabled
 *   button carries title "Không thể hủy liên kết phương thức đăng nhập duy nhất"
 * - Sole-identity card hint: "Phương thức đăng nhập duy nhất"
 * - 409 copy (frontend toast + backend error envelope): the API returns 409
 *   LAST_IDENTITY_CANNOT_BE_REMOVED "Không thể hủy liên kết phương thức đăng
 *   nhập duy nhất của tài khoản" (api/internal/auth/service.go ErrLastIdentity);
 *   the UI surfaces the same sentence as a toast on 409.
 */
const SOLE_IDENTITY_409_COPY =
  'Không thể hủy liên kết phương thức đăng nhập duy nhất của tài khoản';

test.describe('Journey 3 — Tài khoản (Linking)', () => {
  test('Mock provider card appears, persists after reload, and the last identity cannot be unlinked (409)', async ({ page }) => {
    test.setTimeout(90000); // login round-trip + reload + guard assertions

    // 1. Regular dev login via the Mock OAuth provider (NOT demo — INV-04).
    //    Fall back to demo only if this stack does not advertise mock.
    await page.goto('/login');
    const hasMock = await page
      .getByRole('button', { name: /Đăng nhập với Mock/ })
      .count()
      .then((n) => n > 0);
    test.info().annotations.push({
      description: hasMock
        ? 'Login strategy: Mock OAuth (regular dev user — demo accounts cannot link, INV-04)'
        : 'Login strategy: demo session (mock provider not enabled on this stack)',
      type: 'info',
    });
    if (hasMock) {
      await loginViaMock(page);
    } else {
      await demoLogin(page);
    }

    // 2. Open AccountView through the real nav link "Tài khoản"
    await page.locator('a[href="/account"]').click();
    await expect(page).toHaveURL(/\/account/);
    await expect(page.locator('[data-testid="user-display-name"]')).toBeVisible();

    // 3. The Mock provider identity card is present…
    const identityCards = page.locator('[data-testid^="identity-card-"]');
    await expect(identityCards.first()).toBeVisible();
    const mockCard = page.locator('[data-testid^="identity-card-"]', {
      hasText: hasMock ? 'Mock Provider' : 'Dùng thử (Demo)',
    });
    await expect(mockCard.first()).toBeVisible();

    // 4. …and PERSISTS after a full page reload
    await page.reload();
    await expect(page.locator('[data-testid="user-display-name"]')).toBeVisible();
    await expect(mockCard.first()).toBeVisible();

    // 5. Unlink identities down to the last one through the real dialog
    for (;;) {
      if ((await identityCards.count()) <= 1) break;
      const unlinkBtn = page.locator('[data-testid^="unlink-btn-"]').first();
      await expect(unlinkBtn).toBeEnabled();
      await unlinkBtn.click();
      await page.locator('[data-testid="confirm-unlink-btn"]').click();
      await expect(page.locator('[data-testid="confirm-unlink-btn"]')).toBeHidden();
    }

    // 6. Last identity guard: the unlink button is disabled (isSoleIdentity)
    //    and the UI carries the exact guard copy — button title tooltip…
    const lastUnlink = page.locator('[data-testid^="unlink-btn-"]').first();
    await expect(lastUnlink).toBeDisabled();
    await expect(lastUnlink).toHaveAttribute(
      'title',
      'Không thể hủy liên kết phương thức đăng nhập duy nhất',
    );
    // …and the card's sole-identity hint
    await expect(page.locator('[data-testid^="identity-card-"]').first()).toContainText(
      'Phương thức đăng nhập duy nhất',
    );

    // 7. The REAL 409: deleting the sole identity through the API (same
    //    session cookie) must fail with LAST_IDENTITY_CANNOT_BE_REMOVED and
    //    the canonical Vietnamese message the UI would toast.
    const identityId = (await page.locator('[data-testid^="identity-card-"]').first()
      .getAttribute('data-testid'))!
      .replace('identity-card-', '');
    const resp = await page.request.delete(`/api/v1/me/identities/${identityId}`);
    expect(resp.status()).toBe(409);
    const body = await resp.json().catch(() => ({}) as Record<string, unknown>);
    const errMessage = JSON.stringify(body);
    expect(errMessage).toContain(SOLE_IDENTITY_409_COPY);

    // 8. The identity survives — nothing was unlinked
    await page.reload();
    await expect(page.locator('[data-testid^="identity-card-"]').first()).toBeVisible();
  });
});
