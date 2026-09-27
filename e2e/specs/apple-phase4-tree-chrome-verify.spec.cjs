const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const BASE = process.env.APPLE_PHASE4TC_BASE || 'http://127.0.0.1:14180';
const OUT = process.env.APPLE_PHASE4TC_ARTIFACTS || path.resolve(__dirname, '../../.agents/tester/RESULTS/apple_phase4_tree_chrome');
fs.mkdirSync(OUT, { recursive: true });
const viewports = [[1440, 900], [390, 844], [320, 800]];
const themes = ['light', 'dark'];
const states = ['canvas', 'loading', 'error', 'empty'];
const familiesPath = '**/api/v1/families*';
const treePath = '**/api/v1/families/*/tree';
const transparent = s => s === 'transparent' || /rgba\([^)]*,\s*0\s*\)$/.test(s);

async function measureText(locator) {
  return locator.evaluate(el => {
    const parse = s => { const m = s.match(/[\d.]+/g) || []; return [Number(m[0] || 0), Number(m[1] || 0), Number(m[2] || 0), m.length > 3 ? Number(m[3]) : 1]; };
    const luminance = c => { const a = c.slice(0, 3).map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * a[0] + .7152 * a[1] + .0722 * a[2]; };
    const fg = parse(getComputedStyle(el).color); let node = el, bg = [255, 255, 255, 1];
    while (node) { const c = parse(getComputedStyle(node).backgroundColor); if (c[3] > 0) { bg = c; if (c[3] >= 1) break; } node = node.parentElement; }
    const f = luminance(fg), b = luminance(bg); return +((Math.max(f, b) + .05) / (Math.min(f, b) + .05)).toFixed(3);
  });
}
async function chromeText(page, state) {
  const out = [], selectors = ['[data-testid="tree-family-name"]', '[data-testid="tree-generation-filter"] button', '[data-testid="tree-demo-notice"]', '[data-testid="tree-loading"] p', '.tree-error h2', '.tree-error p', '.tree-empty h2', '.tree-empty p', '[data-testid="zoom-in"]', '[data-testid="zoom-out"]', '[data-testid="fit-view"]', '[data-testid="tree-compass"] button', '[data-testid="tree-inspector"] *'];
  for (const selector of selectors) { const loc = page.locator(selector); for (let i = 0; i < await loc.count(); i++) { const el = loc.nth(i); if (!(await el.isVisible().catch(() => false))) continue; const text = (await el.innerText().catch(() => '')).trim() || (await el.getAttribute('aria-label')) || ''; if (!text) continue; out.push({ selector, text: text.slice(0, 90), ratio: await measureText(el) }); } }
  return out;
}
function collectErrors(page) { const result = { pageErrors: [], consoleErrors: [], warnings: [] }; page.on('pageerror', e => result.pageErrors.push(e.message)); page.on('console', m => { if (m.type() === 'error') result.consoleErrors.push(m.text()); if (m.type() === 'warning') result.warnings.push(m.text()); }); return result; }
async function stageFailure(page, kind) {
  await page.route(familiesPath, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(kind === 'empty' ? { families: [] } : { families: [{ id: 'phase4-stage-family', name: 'Gia đình thử nghiệm' }] }) }));
  await page.route(treePath, route => route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Lỗi kiểm tra' }) }));
}
async function focusRing(locator) {
  await locator.focus();
  return locator.evaluate(el => { const s = getComputedStyle(el); const shadow = s.boxShadow; return el.matches(':focus-visible') || (parseFloat(s.outlineWidth) > 0 && s.outlineStyle !== 'none' && s.outlineColor !== 'transparent') || (shadow !== 'none' && !shadow.includes('rgba(0, 0, 0, 0)')); });
}

for (const theme of themes) for (const [width, height] of viewports) for (const state of states) {
  test(`state matrix ${theme} ${width}x${height} ${state}: contrast, overflow, console, focus`, async ({ browser }) => {
    const context = await browser.newContext({ colorScheme: theme, viewport: { width, height } });
    const page = await context.newPage(), errors = collectErrors(page);
    if (state === 'loading') {
      await page.route(familiesPath, route => new Promise(() => {}));
      await page.route(treePath, route => new Promise(() => {}));
      await page.goto(BASE + '/tree'); await expect(page.getByTestId('tree-loading')).toBeVisible({ timeout: 5000 });
      await page.unroute(familiesPath); await page.unroute(treePath);
    } else if (state === 'error' || state === 'empty') {
      await stageFailure(page, state);
      if (state === 'empty') await page.route(familiesPath, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ families: [{ id: 'phase4-stage-family', name: 'Gia đình thử nghiệm' }] }) }));
      await page.goto(BASE + '/tree');
      if (state === 'error') { await expect(page.getByTestId('tree-retry')).toBeVisible(); await page.unroute(treePath); await page.getByTestId('tree-retry').click(); await expect(page.getByTestId('tree-retry')).toHaveCount(0, { timeout: 15000 }); await expect(page.getByTestId('tree-world').or(page.getByTestId('tree-loading'))).toBeVisible(); }
      else { await page.unroute(treePath); await page.route(treePath, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ family_id: 'phase4-stage-family', generations: [], roots: [] }) })); await page.reload(); await expect(page.locator('.tree-empty-state')).toBeVisible(); await expect(page.getByTestId('tree-add-auth-hint')).toBeVisible(); }
    } else { await page.goto(BASE + '/tree'); await expect(page.getByTestId('tree-world')).toBeVisible({ timeout: 20000 }); await expect(page.locator('canvas')).toHaveCount(1); const cards = page.locator('[aria-label*="Đời thứ"]'); expect(await cards.count()).toBeGreaterThan(0); expect(await cards.count()).toBeLessThanOrEqual(300); }
    const texts = await chromeText(page, state), overflow = await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1);
    expect(overflow, `horizontal overflow ${width}px`).toBeTruthy();
    for (const row of texts) expect(row.ratio, `${row.selector} "${row.text}" contrast ${row.ratio}`).toBeGreaterThanOrEqual(4.5);
    const controls = ['select', '[data-testid="zoom-in"]', '[data-testid="zoom-out"]', '[data-testid="fit-view"]', '[data-testid="tree-compass"] button'];
    if (state === 'error') controls.push('[data-testid="tree-retry"]');
    const focus = []; for (const selector of controls) { const loc = page.locator(selector).filter({ visible: true }); if (await loc.count()) { focus.push({ selector, passes: await focusRing(loc.first()) }); } }
    expect(focus.every(f => f.passes), JSON.stringify(focus)).toBeTruthy();
    expect(errors.pageErrors, 'page errors').toEqual([]); expect(errors.consoleErrors, 'console errors').toEqual([]);
    const record = { theme, width, height, state, minContrast: texts.length ? Math.min(...texts.map(x => x.ratio)) : null, textMeasurements: texts, overflow, focus, pageErrors: errors.pageErrors, consoleErrors: errors.consoleErrors, warnings: errors.warnings };
    fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, `cell-${theme}-${width}-${state}.json`), JSON.stringify(record, null, 2));
    if (errors.pageErrors.length || errors.consoleErrors.length || texts.some(x => x.ratio < 4.5) || !overflow) await page.screenshot({ path: path.join(OUT, `failure-${theme}-${width}-${state}.png`), fullPage: true });
    await context.close();
  });
}

test('family preselect live: requested family, default family and invalid-query fallback', async ({ page }) => {
  const errors = collectErrors(page), response = await page.request.get(BASE + '/api/v1/families'); expect(response.ok()).toBeTruthy(); const families = (await response.json()).families; expect(families.length).toBeGreaterThan(1);
  for (const [url, family] of [[`/tree?family=${families[1].id}`, families[1]], ['/tree', families[0]], ['/tree?family=bogus', families[0]]]) {
    let observed; const capture = page.waitForResponse(r => r.url().includes('/api/v1/families/') && r.url().endsWith('/tree') && r.request().method() === 'GET').then(async r => { observed = await r.json(); });
    await page.goto(BASE + url); await expect(page.getByTestId('tree-family-name')).toHaveText(family.name); await expect(page.locator('select').first()).toHaveValue(family.id); await capture; expect(observed.family_id).toBe(family.id);
  }
  expect(errors.consoleErrors).toEqual([]);
});

test('live demo notice is accessible Vietnamese status with AA contrast in both themes', async ({ browser }) => {
  for (const theme of themes) { const context = await browser.newContext({ colorScheme: theme }), page = await context.newPage(), errors = collectErrors(page); const login = await page.request.post(BASE + '/api/v1/auth/demo', { headers: { Origin: 'http://localhost:3456' }, data: '' }); expect(login.ok()).toBeTruthy(); await page.goto(BASE + '/tree'); const notice = page.getByTestId('tree-demo-notice'); await expect(notice).toBeVisible(); await expect(notice).toHaveAttribute('role', 'status'); await expect(notice).toContainText('Phiên Demo'); expect(await measureText(notice)).toBeGreaterThanOrEqual(4.5); expect(errors.pageErrors).toEqual([]); expect(errors.consoleErrors).toEqual([]); await context.close(); }
});

test('live tree invariants: zoom transform, centered compass click, one canvas and card budget', async ({ page }) => {
  const errors = collectErrors(page); await page.goto(BASE + '/tree'); await expect(page.getByTestId('tree-world')).toBeVisible(); await expect(page.locator('canvas')).toHaveCount(1); const cards = page.locator('[aria-label*="Đời thứ"]'); expect(await cards.count()).toBeGreaterThan(0); expect(await cards.count()).toBeLessThanOrEqual(300);
  const world = page.getByTestId('tree-world'), scale = async () => Number((await world.getAttribute('style')).match(/scale\(([^)]+)\)/)[1]); const initial = await scale(); await page.getByTestId('zoom-in').click(); await expect.poll(scale).toBeGreaterThan(initial); const zoomed = await scale(); await page.getByTestId('zoom-out').click(); await expect.poll(scale).toBeLessThan(zoomed); await page.getByTestId('compass-center').click(); expect(errors.pageErrors).toEqual([]); expect(errors.consoleErrors).toEqual([]);
});

test('non-gating rendered card text contrast measurement by theme', async ({ browser }) => {
  const results = {};
  for (const theme of themes) { const context = await browser.newContext({ colorScheme: theme }), page = await context.newPage(); await page.goto(BASE + '/tree'); await expect(page.getByTestId('tree-world')).toBeVisible(); const cards = page.locator('[aria-label*="Đời thứ"]'); await expect.poll(() => cards.count()).toBeGreaterThanOrEqual(10); const values = { primary: [], secondary: [], kinship: [] };
    for (let i = 0; i < Math.min(await cards.count(), 10); i++) { const card = cards.nth(i); for (const [key, selector] of [['primary', 'p'], ['secondary', '[data-testid="years-text"]'], ['kinship', '[data-testid="kinship-badge"]']]) { const el = card.locator(selector).first(); if (await el.count() && await el.isVisible()) values[key].push({ ratio: await measureText(el), example: selector, text: (await el.innerText()).slice(0, 60) }); } }
    results[theme] = {}; for (const [key, rows] of Object.entries(values)) results[theme][key] = { min: rows.length ? Math.min(...rows.map(x => x.ratio)) : null, avg: rows.length ? rows.reduce((a, x) => a + x.ratio, 0) / rows.length : null, examples: rows.slice(0, 3) }; console.log('MEASUREMENT:', JSON.stringify({ theme, ...results[theme] })); await context.close(); }
  fs.writeFileSync(path.join(OUT, 'measurement.json'), JSON.stringify(results, null, 2));
});
