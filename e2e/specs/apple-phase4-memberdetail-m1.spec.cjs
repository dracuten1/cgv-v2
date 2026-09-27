const { test, expect } = require('@playwright/test');

// M1 targeted contract: URL, responsive placement, visible focus and no overflow.
const base = process.env.APPLE_PHASE4_MEMBER_BASE || 'http://localhost:3456';
const id = process.env.APPLE_PHASE4_MEMBER_ID;
const familyId = process.env.APPLE_PHASE4_FAMILY_ID;
test('member detail tree affordances use the member family and responsive placement', async ({ page }) => {
  test.skip(!id || !familyId, 'Set APPLE_PHASE4_MEMBER_ID and APPLE_PHASE4_FAMILY_ID from live member data');
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`${base}/members/${id}`);
  await expect(page.getByTestId('member-name')).toBeVisible();
  const breadcrumb = page.getByTestId('member-tree-breadcrumb');
  await expect(breadcrumb).toHaveAttribute('href', '/tree');
  const desktop = page.getByTestId('member-view-tree');
  await expect(desktop).toHaveAttribute('href', `/tree?family=${familyId}`);
  await expect(desktop).toBeVisible();
  await expect(page.getByTestId('member-view-tree-mobile')).toBeHidden();
  await page.setViewportSize({ width: 390, height: 844 });
  const mobile = page.getByTestId('member-view-tree-mobile');
  await expect(mobile).toHaveAttribute('href', `/tree?family=${familyId}`);
  await expect(mobile).toBeVisible();
  expect(await mobile.evaluate(el => getComputedStyle(el).width)).toBe(`${await page.evaluate(() => document.querySelector('.max-w-4xl').clientWidth)}px`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBeTruthy();
  await page.keyboard.press('Tab');
  await expect(breadcrumb).toBeFocused();
});
