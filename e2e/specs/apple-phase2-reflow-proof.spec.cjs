const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const BASE = process.env.APPLE_PHASE2RP_BASE || 'http://127.0.0.1:14180';
const OUT = process.env.APPLE_PHASE2RP_ARTIFACTS || path.resolve(__dirname, '../../.agents/tester/RESULTS/apple_phase2_reflow_proof');
fs.mkdirSync(OUT, { recursive: true });
function collectErrors(page) { const result = { pageErrors: [], consoleErrors: [] }; page.on('pageerror', e => result.pageErrors.push(e.message)); page.on('console', m => { if (m.type() === 'error') result.consoleErrors.push(m.text()); }); return result; }
async function demoContext(browser, theme = 'light', viewport = { width: 1440, height: 900 }) {
  const ctx = await browser.newContext({ colorScheme: theme, viewport, locale: 'vi-VN', serviceWorkers: 'block' });
  const origin = new URL(BASE).origin;
  const response = await ctx.request.post(BASE + '/api/v1/auth/demo', { headers: { Origin: origin }, data: '' });
  if (!response.ok()) throw new Error(`demo login failed: ${response.status()}`);
  return ctx;
}
const viewports = [[1440, 900], [390, 844], [320, 800]];
const themes = ['light', 'dark'];
async function readTransform(world) {
  return world.evaluate(el => { const m = el.getAttribute('style').match(/translate3d\(([-\d.]+)px,\s*([-\d.]+)px,\s*0(?:px)?\)\s*scale\(([-\d.]+)\)/); if (!m) throw new Error('tree-world transform not found'); return { tx: +m[1], ty: +m[2], zoom: +m[3] }; });
}
function expectSameTransform(a, b) { expect(Math.abs(a.zoom - b.zoom)).toBeLessThan(1e-6); expect(Math.abs(a.tx - b.tx)).toBeLessThan(1e-4); expect(Math.abs(a.ty - b.ty)).toBeLessThan(1e-4); }

test('initial /tree load renders NAME-tier-or-better for a wide family at 1440x900, 390x844, 320x800 (light+dark)', async ({ browser }) => {
  for (const theme of themes) for (const [width, height] of viewports) {
    const context = await demoContext(browser, theme, { width, height }); const page = await context.newPage(); const errors = collectErrors(page); const network = []; const serverErrors = []; page.on('response', r => { if (r.status() >= 500) serverErrors.push({ url: r.url(), status: r.status() }); }); page.on('response', async r => { if (r.url().includes('/api/v1/families')) network.push({ url: r.url(), status: r.status(), body: await r.text().catch(e => `BODY_ERROR ${e.message}`) }); });
    await page.goto(BASE + '/tree'); await expect(page.locator('[data-testid="tree-world"]')).toHaveCount(1, { timeout: 10000 }); await expect(page.locator('button[aria-label*="Đời thứ"]').first()).toBeVisible({ timeout: 10000 });
    const people = page.locator('button[aria-label*="Đời thứ"]'); await expect(people.first()).toBeVisible();
    for (let i = 0; i < await people.count(); i++) { const person = people.nth(i); if (!(await person.isVisible())) continue; const box = await person.boundingBox(); expect(box, `visible person ${i} has a box`).toBeTruthy(); expect(Math.abs(box.width - 14) > 1, `person ${i} is dot-sized (${box.width}px) at ${width}x${height} ${theme}`).toBeTruthy(); }
    await page.screenshot({ path: path.join(OUT, `initial-${theme}-${width}x${height}.png`), fullPage: true });
    if (!(await page.locator('[data-testid="tree-world"]').isVisible())) { const diagnostic = { url: page.url(), bodyText: await page.locator('body').innerText(), loading: await page.locator('[data-testid="tree-loading"]').count(), error: await page.locator('.tree-error, [data-testid="tree-retry"]').allTextContents(), network, consoleErrors: errors.consoleErrors, pageErrors: errors.pageErrors }; fs.writeFileSync(path.join(OUT, `diagnostic-${theme}-${width}x${height}.json`), JSON.stringify(diagnostic, null, 2)); }
    expect(serverErrors).toEqual([]); expect(errors.pageErrors).toEqual([]); expect(errors.consoleErrors).toEqual([]); await context.close();
  }
});

test('REFLOW-SAME-ANCHOR: same-family tree refetch preserves pan/zoom transform (no auto-refit)', async ({ browser }) => {
  const context = await demoContext(browser), page = await context.newPage(), errors = collectErrors(page), treeResponses = [], serverErrors = [];
  page.on('response', r => { if (r.status() >= 500) serverErrors.push({ url: r.url(), status: r.status() }); });
  page.on('response', r => { if (/\/api\/v1\/families\/[^/]+\/tree(?:\?|$)/.test(r.url())) treeResponses.push({ url: r.url(), status: r.status() }); });
  await page.goto(BASE + '/tree'); const world = page.locator('[data-testid="tree-world"]');
  const people = page.locator('button[aria-label*="Đời thứ"]');
  await expect(world).toHaveCount(1, { timeout: 10000 }); await expect(people.first()).toBeVisible({ timeout: 10000 });
  const selected = await page.evaluate(() => {
    const app = document.querySelector('#app')?.__vue_app__;
    let pinia = app?.config?.globalProperties?.$pinia;
    if (!pinia) pinia = Object.values(app?._context?.provides || {}).find(v => v?._s instanceof Map && v._s.has('tree'));
    if (!pinia) { let node = document.querySelector('[data-testid="tree-world"]'); while (node && !pinia) { const c = node.__vueParentComponent; pinia = Object.values(c?.appContext?.provides || {}).find(v => v?._s instanceof Map && v._s.has('tree')); node = node.parentElement; } }
    const store = pinia?._s?.get('tree');
    return store ? { familyId: store.familyId, filter: store.generationFilter, anchor: document.querySelector('.tree-viewport')?.dataset.viewCentered } : null;
  });
  expect(selected, 'Pinia tree store accessible from mounted Vue app').toBeTruthy();
  expect(selected.familyId).toBeTruthy(); expect(selected.filter).toBeNull();
  await page.getByTestId('zoom-in').click();
  const viewport = page.locator('.tree-viewport');
  // App-visible pan control avoids accidentally selecting a member card during a drag.
  await page.getByTestId('compass-east').click();
  const before = await readTransform(world); const priorCount = treeResponses.length;
  expect(priorCount, 'initial family tree GET').toBeGreaterThan(0);
  // invalidate() is the store's real same-family refresh path: GET + roots reassignment,
  // without changing filter/anchor or unmounting the visualizer via loading UI.
  const refresh = page.evaluate(async () => {
    const app = document.querySelector('#app')?.__vue_app__;
    let pinia = app?.config?.globalProperties?.$pinia || Object.values(app?._context?.provides || {}).find(v => v?._s instanceof Map && v._s.has('tree'));
    if (!pinia) { let node = document.querySelector('[data-testid="tree-world"]'); while (node && !pinia) { const c = node.__vueParentComponent; pinia = Object.values(c?.appContext?.provides || {}).find(v => v?._s instanceof Map && v._s.has('tree')); node = node.parentElement; } }
    const store = pinia?._s?.get('tree'); if (!store) throw new Error('tree store unavailable');
    const oldRoots = store.roots; await store.invalidate();
    return { familyId: store.familyId, filter: store.generationFilter, rootsReplaced: store.roots !== oldRoots, error: store.error };
  });
  await expect.poll(() => treeResponses.length, { timeout: 10000 }).toBe(priorCount + 1);
  const state = await refresh; await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const after = await readTransform(world); const cards = await people.count();
  const evidence = { selected, state, before, after, cards, treeResponses, anchorAfter: await viewport.getAttribute('data-view-centered'), serverErrors, errors };
  fs.writeFileSync(path.join(OUT, 'same-anchor-refetch.json'), JSON.stringify(evidence, null, 2));
  console.log('REFLOW_EVIDENCE ' + JSON.stringify(evidence));
  expect(state.familyId).toBe(selected.familyId); expect(state.filter).toBe(selected.filter);
  expect(state.rootsReplaced).toBe(true); expect(state.error).toBeNull();
  expect(treeResponses.at(-1).status).toBe(200); expect(cards).toBeGreaterThan(0);
  expect(evidence.anchorAfter).toBe(selected.anchor); expectSameTransform(before, after);
  expect(serverErrors).toEqual([]); expect(errors.pageErrors).toEqual([]); expect(errors.consoleErrors).toEqual([]); await context.close();
});

test('explicit Fit button still performs whole-world fit only on click', async ({ browser }) => {
  const context = await demoContext(browser), page = await context.newPage(), errors = collectErrors(page), serverErrors = [];
  page.on('response', r => { if (r.status() >= 500) serverErrors.push({ url: r.url(), status: r.status() }); });
  await page.goto(BASE + '/tree'); const world = page.locator('[data-testid="tree-world"]'); await expect(world).toHaveCount(1, { timeout: 10000 }); await expect(page.locator('button[aria-label*="Đời thứ"]').first()).toBeVisible({ timeout: 10000 }); const anchorZoom = (await readTransform(world)).zoom;
  await page.getByTestId('zoom-in').click(); const beforeFit = await readTransform(world); expect(beforeFit.zoom).toBeGreaterThan(anchorZoom);
  await page.getByTestId('fit-view').click(); const fitted = await readTransform(world); expect(fitted.zoom).not.toBe(beforeFit.zoom);
  const layoutSize = await world.evaluate(el => { const canvas = el.querySelector('canvas'); return { width: Number.parseFloat(canvas.style.width), height: Number.parseFloat(canvas.style.height), viewport: el.parentElement.getBoundingClientRect() }; });
  const expected = Math.max(.05, Math.min((layoutSize.viewport.width - 48) / layoutSize.width, (layoutSize.viewport.height - 48) / layoutSize.height, 1));
  const fitEvidence = { anchorZoom, beforeFit, fitted, expected, serverErrors, errors };
  fs.writeFileSync(path.join(OUT, 'explicit-fit.json'), JSON.stringify(fitEvidence, null, 2)); console.log('FIT_EVIDENCE ' + JSON.stringify(fitEvidence));
  expect(Math.abs(fitted.zoom - expected)).toBeLessThan(1e-5); expect(fitted.zoom).toBeLessThanOrEqual(anchorZoom + 1e-6);
  expect(serverErrors).toEqual([]); expect(errors.pageErrors).toEqual([]); expect(errors.consoleErrors).toEqual([]); await context.close();
});
