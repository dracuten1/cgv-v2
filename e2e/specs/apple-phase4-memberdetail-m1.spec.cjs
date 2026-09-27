const { test, expect } = require('@playwright/test');

const MEMBER_ID = process.env.APPLE_PHASE4_MEMBER_ID || 'aaaaaaa1-0000-4000-8000-000000000001';
const FAMILY_ID = process.env.APPLE_PHASE4_FAMILY_ID || '11111111-1111-4111-8111-000000000001';
const BASE = process.env.APPLE_PHASE4_MEMBER_BASE || 'http://localhost:3456';
const FIXTURE = {
  id: MEMBER_ID, family_id: FAMILY_ID, full_name: 'Nguyễn Văn An', gender: 'male',
  generation_index: 1, birth_date: '1928-03-15T00:00:00Z', death_date: null,
  is_living: true, avatar_url: null, notes: '', family_name: 'Gia phả thử nghiệm',
  relations: { parents: [], children: [], siblings: [], spouses: [] }, posts: [],
};

async function stageApi(context) {
  await context.route('**/api/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const json = (data) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(data) });
    if (req.method() === 'GET' && url.pathname === '/api/v1/me') {
      return json({ id: 'e2e-user', display_name: 'E2E User', is_demo: false, created_at: '2026-01-01T00:00:00Z' });
    }
    if (req.method() === 'GET' && url.pathname === `/api/v1/members/${MEMBER_ID}`) return json(FIXTURE);
    return json({});
  });
}

async function ratioFor(page, locator) {
  return locator.evaluate((el) => {
    const rgb = (s) => { const m = s.match(/rgba?\(([^)]+)\)/); return m ? m[1].split(/[ ,/]+/).filter(Boolean).slice(0,3).map(Number) : [0,0,0]; };
    const lum = (v) => { const a = v.map(x => { x /= 255; return x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4; }); return .2126*a[0]+.7152*a[1]+.0722*a[2]; };
    const fg = lum(rgb(getComputedStyle(el).color));
    let n = el, bg = [255,255,255];
    while (n) { const c = getComputedStyle(n).backgroundColor; const m = c.match(/[\d.]+/g)?.map(Number); if (m && m.length >= 3 && (m[3] ?? 1) > 0) { bg = m.slice(0,3); if ((m[3] ?? 1) === 1) break; } n=n.parentElement; }
    const b = lum(bg); return +((Math.max(fg,b)+.05)/(Math.min(fg,b)+.05)).toFixed(2);
  });
}

test('member detail M1 affordances: links, AA contrast, mobile fit and focus', async ({ browser }) => {
  const rows = [];
  for (const colorScheme of ['light', 'dark']) {
    const context = await browser.newContext({ colorScheme, viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
    await stageApi(context);
    const page = await context.newPage();
    await page.goto(`${BASE}/members/${MEMBER_ID}`);
    await expect(page.getByTestId('member-name')).toHaveText(FIXTURE.full_name);
    const breadcrumb = page.getByTestId('member-tree-breadcrumb');
    const desktop = page.getByTestId('member-view-tree');
    const desktopMobile = page.getByTestId('member-view-tree-mobile');
    await expect(breadcrumb).toHaveAttribute('href', '/tree');
    await expect(desktop).toHaveAttribute('href', `/tree?family=${FAMILY_ID}`);
    await expect(desktop).toBeVisible();
    await expect(desktopMobile).toBeHidden();
    const deskRatios = { breadcrumb: await ratioFor(page, breadcrumb), button: await ratioFor(page, desktop) };
    expect(deskRatios.breadcrumb).toBeGreaterThanOrEqual(4.5);
    expect(deskRatios.button).toBeGreaterThanOrEqual(4.5);
    rows.push({ colorScheme, viewport: 1440, ...deskRatios });
    await page.setViewportSize({ width: 390, height: 844 });
    const mobile = desktopMobile;
    await expect(mobile).toBeVisible();
    await expect(mobile).toHaveAttribute('href', `/tree?family=${FAMILY_ID}`);
    const metrics = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
    const mobileRatios = { breadcrumb: await ratioFor(page, breadcrumb), button: await ratioFor(page, mobile) };
    expect(mobileRatios.breadcrumb).toBeGreaterThanOrEqual(4.5);
    expect(mobileRatios.button).toBeGreaterThanOrEqual(4.5);
    rows.push({ colorScheme, viewport: 390, ...mobileRatios, overflow: metrics });
    await breadcrumb.evaluate(el => el.blur());
    await page.keyboard.press('Tab');
    await page.waitForTimeout(250);
    await expect(breadcrumb).toBeFocused();
    const focus = await breadcrumb.evaluate(el => {
      const s = getComputedStyle(el); return { outlineStyle: s.outlineStyle, outlineWidth: s.outlineWidth, boxShadow: s.boxShadow };
    });
    expect(focus.outlineStyle !== 'none' || focus.boxShadow !== 'none').toBeTruthy();
    rows.push({ colorScheme, focus });
    await context.close();
  }
  console.log('M1_EVIDENCE ' + JSON.stringify(rows));
});
