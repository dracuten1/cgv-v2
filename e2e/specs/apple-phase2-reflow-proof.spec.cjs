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

function viewportNameProof(page) {
  return page.evaluate(() => {
    const viewport = document.querySelector('.tree-viewport');
    const screen = { left: 0, top: 0, right: innerWidth, bottom: innerHeight };
    const rect = r => ({ x: r.left, y: r.top, width: r.width, height: r.height, right: r.right, bottom: r.bottom });
    const intersect = (a, b) => ({ left: Math.max(a.left, b.left), top: Math.max(a.top, b.top), right: Math.min(a.right, b.right), bottom: Math.min(a.bottom, b.bottom) });
    const contains = (outer, inner) => inner.left >= outer.left - .5 && inner.top >= outer.top - .5 && inner.right <= outer.right + .5 && inner.bottom <= outer.bottom + .5;
    const tree = viewport?.getBoundingClientRect();
    const nav = document.querySelector('nav[aria-label="Điều hướng di động"]');
    const navRect = nav && getComputedStyle(nav).display !== 'none' ? nav.getBoundingClientRect() : null;
    const appliedHeight = viewport ? Number.parseFloat(viewport.style.height) : null;
    const candidates = [...document.querySelectorAll('.tree-viewport button[aria-label*="Đời thứ"]')].map(control => {
      const box = control.getBoundingClientRect();
      const name = control.getAttribute('aria-label').split(', Đời thứ ')[0].trim();
      const tier = control.querySelector('p.font-display') ? 'full-card' : box.width <= 16 ? 'dot' : control.classList.contains('truncate') ? 'name-only' : 'chip';
      const nameEl = tier === 'full-card' ? control.querySelector('p.font-display') : control;
      const textNode = [...(nameEl?.childNodes || [])].find(n => n.nodeType === Node.TEXT_NODE && n.textContent.includes(name));
      let nameBox = null;
      if (textNode) { const range = document.createRange(); const at = textNode.textContent.indexOf(name); range.setStart(textNode, at); range.setEnd(textNode, at + name.length); nameBox = range.getBoundingClientRect(); }
      const css = nameEl && getComputedStyle(nameEl);
      // Name-only buttons may ellipsize trailing YEARS while the full name remains intact.
      // Measure the name text range against the padded content box, not total scrollWidth.
      const content = nameEl?.getBoundingClientRect();
      const scale = nameEl?.offsetWidth ? content.width / nameEl.offsetWidth : 1;
      const padLeft = css ? (parseFloat(css.paddingLeft) || 0) * scale : 0;
      const padRight = css ? (parseFloat(css.paddingRight) || 0) * scale : 0;
      const clippedText = !!nameEl && (tier === 'name-only' || tier === 'chip'
        ? !nameBox || nameBox.left < content.left + padLeft - .5 || nameBox.right > content.right - padRight + .5
        : nameEl.scrollWidth > nameEl.clientWidth + 1);
      const intersection = tree ? intersect(intersect(box, tree), screen) : null;
      const nameIntersection = nameBox && tree ? intersect(intersect(intersect(nameBox, box), tree), screen) : null;
      const fullNameOnScreen = !!nameBox && !!nameIntersection && contains(screen, nameBox) && contains(tree, nameBox) && contains(box, nameBox) && nameBox.width >= 35 && nameBox.height >= 10 && nameIntersection.right - nameIntersection.left >= 35 && nameIntersection.bottom - nameIntersection.top >= 10;
      const point = nameBox && { x: (nameBox.left + nameBox.right) / 2, y: (nameBox.top + nameBox.bottom) / 2 };
      const top = point && document.elementFromPoint(point.x, point.y);
      const unobscured = !!top && (top === control || control.contains(top));
      return { name, tier, box: rect(box), nameBox: nameBox && rect(nameBox), intersection, nameIntersection,
        cssTextOverflow: css?.textOverflow, scrollWidth: nameEl?.scrollWidth, clientWidth: nameEl?.clientWidth,
        clippedText, unobscured, occluder: unobscured ? null : top?.outerHTML.slice(0, 220),
        readable: tier !== 'dot' && fullNameOnScreen && !clippedText && unobscured };
    });
    return { viewport: { width: innerWidth, height: innerHeight }, treeViewport: tree && rect(tree), treeViewportBottom: tree?.bottom ?? null,
      mobileNav: navRect && rect(navRect), mobileNavTop: navRect?.top ?? null, appliedHeight, scrollY, scrollMax: Math.max(0, document.documentElement.scrollHeight - innerHeight), candidates,
      readableNames: candidates.filter(c => c.readable).map(c => ({ name: c.name, tier: c.tier, box: c.box, nameBox: c.nameBox, viewportIntersection: c.intersection, nameIntersection: c.nameIntersection })) };
  });
}

test('initial /tree load renders on-screen FULL readable NAME at exact viewport sizes (light+dark)', async ({ browser }) => {
  const cells = [];
  for (const theme of themes) for (const [width, height] of viewports) {
    const context = await demoContext(browser, theme, { width, height }); const page = await context.newPage(); const errors = collectErrors(page); const network = []; const serverErrors = [];
    page.on('response', r => { if (r.status() >= 500) serverErrors.push({ url: r.url(), status: r.status() }); });
    page.on('response', async r => { if (r.url().includes('/api/v1/families')) network.push({ url: r.url(), status: r.status(), body: await r.text().catch(e => `BODY_ERROR ${e.message}`) }); });
    await page.goto(BASE + '/tree'); await expect(page.locator('[data-testid="tree-world"]')).toHaveCount(1, { timeout: 10000 }); await expect(page.locator('button[aria-label*="Đời thứ"]').first()).toBeVisible({ timeout: 10000 });
    const screenshot = path.join(OUT, `viewport-${theme}-${width}x${height}.png`);
    await page.screenshot({ path: screenshot, fullPage: false });
    const proof = await viewportNameProof(page);
    const cell = { theme, expectedViewport: { width, height }, screenshot, ...proof, serverErrors, errors, network,
      pass: proof.viewport.width === width && proof.viewport.height === height && proof.readableNames.length > 0 &&
        Number.isFinite(proof.treeViewportBottom) && proof.treeViewport.height > 0 &&
        (!proof.mobileNav || (Number.isFinite(proof.mobileNavTop) && proof.treeViewportBottom <= proof.mobileNavTop + 1)) &&
        (width >= 768 || !!proof.mobileNav) && !serverErrors.length && !errors.pageErrors.length && !errors.consoleErrors.length };
    cells.push(cell);
    fs.writeFileSync(path.join(OUT, `viewport-${theme}-${width}x${height}.json`), JSON.stringify(cell, null, 2));
    console.log('VIEWPORT_PROOF ' + JSON.stringify({ theme, viewport: proof.viewport, treeViewportBottom: proof.treeViewportBottom, mobileNavTop: proof.mobileNavTop, readableNames: proof.readableNames, candidates: proof.candidates, screenshot, pass: cell.pass }));
    await context.close();
  }
  fs.writeFileSync(path.join(OUT, 'viewport-proof.json'), JSON.stringify(cells, null, 2));
  expect(cells.filter(c => !c.pass).map(c => ({ theme: c.theme, viewport: c.viewport, treeViewportBottom: c.treeViewportBottom, mobileNavTop: c.mobileNavTop, readableNames: c.readableNames, candidates: c.candidates, errors: c.errors, serverErrors: c.serverErrors })), 'all six viewport cells require an on-screen unobscured full name').toEqual([]);
});

// Keep this probe in the registered pack: resize an already-mounted visualizer,
// wait two animation frames for Vue + ResizeObserver, then test document scroll.
test('constrained-height / scroll-reflow keeps measured tree above mobile nav', async ({ browser }) => {
  const context = await demoContext(browser, 'light', { width: 320, height: 800 });
  const page = await context.newPage();
  const errors = collectErrors(page); const serverErrors = []; const stages = [];
  page.on('response', r => { if (r.status() >= 500) serverErrors.push({ url: r.url(), status: r.status() }); });
  const settle = () => page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  const capture = async label => {
    await settle();
    const proof = await viewportNameProof(page);
    const screenshot = path.join(OUT, `constrained-${label}.png`);
    await page.screenshot({ path: screenshot, fullPage: false });
    const expectedHeight = proof.treeViewport && proof.mobileNav ? Math.max(0, Math.floor(proof.mobileNavTop - proof.treeViewport.y - 16)) : null;
    const stage = { label, screenshot, ...proof, expectedHeight,
      navAligned: !!proof.mobileNav && Number.isFinite(proof.treeViewportBottom) && proof.treeViewportBottom <= proof.mobileNavTop + 1,
      measured: Number.isFinite(proof.appliedHeight) && expectedHeight !== null && Math.abs(proof.appliedHeight - expectedHeight) <= 1,
      nonCollapsed: !!proof.treeViewport && Number.isFinite(proof.treeViewport.height) && proof.treeViewport.height > 0 };
    stages.push(stage);
    fs.writeFileSync(path.join(OUT, `constrained-${label}.json`), JSON.stringify(stage, null, 2));
    return stage;
  };
  try {
    await page.goto(BASE + '/tree');
    await expect(page.locator('[data-testid="tree-world"]')).toHaveCount(1, { timeout: 10000 });
    await expect(page.locator('button[aria-label*="Đời thứ"]').first()).toBeVisible({ timeout: 10000 });
    const initial = await capture('initial-320x800');
    await page.setViewportSize({ width: 320, height: 568 });
    const shortened = await capture('shortened-320x568');
    const scroll = await page.evaluate(() => { window.scrollTo(0, document.documentElement.scrollHeight); return { max: Math.max(0, document.documentElement.scrollHeight - innerHeight) }; });
    const scrolled = await capture('scrolled-320x568');
    // 160px is a conservative name-card reading budget, not an app minimum:
    // smaller spaces are explicitly recorded as bounded-but-unreadable for adjudication.
    const minimumReadingHeight = 160;
    const boundary = stages.map(stage => ({ label: stage.label,
      classification: !stage.navAligned || !stage.measured || !stage.nonCollapsed ? 'BLOCKER_GEOMETRY'
        : stage.readableNames.length ? 'ACCEPTABLE_READABLE'
        : stage.treeViewport.height < minimumReadingHeight ? 'NEEDS_ADJUDICATION_BOUNDED_INSUFFICIENT_SPACE'
        : 'BLOCKER_UNREADABLE_WITH_SPACE',
      height: stage.treeViewport?.height, readableNames: stage.readableNames.length }));
    const evidence = { initial, shortened, scrolled, scroll, boundary, minimumReadingHeight, serverErrors, errors };
    fs.writeFileSync(path.join(OUT, 'constrained-reflow.json'), JSON.stringify(evidence, null, 2));
    console.log('CONSTRAINED_REFLOW ' + JSON.stringify({ boundary, scroll, serverErrors, errors, screenshots: stages.map(s => s.screenshot) }));
    expect(initial.readableNames.length, 'normal-height baseline must expose a full name').toBeGreaterThanOrEqual(1);
    expect(shortened.viewport.height).toBe(568); expect(scrolled.viewport.height).toBe(568);
    expect(scroll.max, 'document scroll must actually be available for this reflow probe').toBeGreaterThan(0);
    expect(scrolled.scrollY, 'document scroll must actually change the viewport position').toBeGreaterThan(0);
    expect(boundary.filter(b => b.classification.startsWith('BLOCKER')), 'no overlap, stale measurement, collapsed tree, or unreadable name where reading space exists').toEqual([]);
    expect(serverErrors).toEqual([]); expect(errors.pageErrors).toEqual([]); expect(errors.consoleErrors).toEqual([]);
  } finally { await context.close(); }
});

// Screenshot pixels, not a computed-style ancestor walk: transparent layers and
// dark-mode CSS variables can make an inherited "background" attribution false.
test('name-card contrast and real pointer clicks at 320x800 (light+dark)', async ({ browser }) => {
  const results = [];
  const rgb = value => { const m = value.match(/rgba?\((\d+)[, ]+([\d]+)[, ]+([\d]+)/); if (!m) throw new Error(`unknown foreground ${value}`); return m.slice(1, 4).map(Number); };
  const lum = color => color.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((v, c, i) => v + c * [.2126, .7152, .0722][i], 0);
  const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + .05) / (lo + .05); };
  for (const theme of themes) {
    const context = await demoContext(browser, theme, { width: 320, height: 800 });
    const page = await context.newPage(), errors = collectErrors(page), serverErrors = [];
    page.on('response', r => { if (r.status() >= 500) serverErrors.push({ url: r.url(), status: r.status() }); });
    try {
      await page.goto(BASE + '/tree');
      await expect(page.locator('button[aria-label*="Đời thứ"]').first()).toBeVisible({ timeout: 10000 });
      const proof = await viewportNameProof(page);
      const name = proof.readableNames.find(n => n.tier === 'name-only' || n.tier === 'full-card');
      expect(name, `${theme}: must have a readable name to measure`).toBeTruthy();
      const card = page.locator('.tree-viewport button[aria-label*="Đời thứ"]').filter({ hasText: name.name }).first();
      const foreground = await card.evaluate((el, tier) => getComputedStyle(tier === 'full-card' ? el.querySelector('p.font-display') : el).color, name.tier);
      const screenshot = path.join(OUT, `contrast-pointer-${theme}-320x800.png`);
      const image = await page.screenshot({ path: screenshot, fullPage: false });
      // Decode actual rendered pixels in the browser; sample two text-free lower
      // card corners. No guessed ancestor backgrounds or opaque-white assumption.
      const samples = await page.evaluate(async ({ encoded, box }) => {
        const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
        const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
        const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0);
        const points = [[box.x + 8, box.bottom - 8], [box.right - 8, box.bottom - 8]];
        return points.map(([x, y]) => {
          const px = [...ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data];
          return { x: Math.round(x), y: Math.round(y), rgba: px, hit: document.elementFromPoint(x, y)?.getAttribute('aria-label') };
        });
      }, { encoded: image.toString('base64'), box: name.box });
      const foregroundRgb = rgb(foreground);
      const contrasts = samples.map(s => ratio(foregroundRgb, s.rgba.slice(0, 3)));
      const world = page.locator('[data-testid="tree-world"]');
      // The real mouse synthesizes pointerdown/up/click; monkeypatch records
      // whether the viewport tries to steal capture from button targets.
      await page.evaluate(() => {
        window.__captureCalls = [];
        const original = HTMLElement.prototype.setPointerCapture;
        HTMLElement.prototype.setPointerCapture = function (id) { window.__captureCalls.push({ target: this.className, id }); return original.call(this, id); };
      });
      const before = await readTransform(world);
      await page.getByTestId('zoom-in').click();
      const zoomed = await readTransform(world);
      await page.getByTestId('compass-east').click();
      const panned = await readTransform(world);
      const captureCalls = await page.evaluate(() => window.__captureCalls);
      const result = { theme, name: name.name, tier: name.tier, foreground, foregroundRgb, samples, contrasts, screenshot,
        pointer: { before, zoomed, panned, captureCalls }, errors, serverErrors };
      results.push(result);
      fs.writeFileSync(path.join(OUT, `contrast-pointer-${theme}-320x800.json`), JSON.stringify(result, null, 2));
      console.log('CONTRAST_POINTER ' + JSON.stringify(result));
      expect(zoomed.zoom, 'real pointer click zooms').toBeGreaterThan(before.zoom);
      expect(panned.tx, 'real pointer click pans').not.toBe(zoomed.tx);
      expect(captureCalls, 'buttons must not trigger viewport pointer capture').toEqual([]);
      expect(errors.pageErrors).toEqual([]); expect(errors.consoleErrors).toEqual([]); expect(serverErrors).toEqual([]);
    } finally { await context.close(); }
  }
  fs.writeFileSync(path.join(OUT, 'contrast-pointer-summary.json'), JSON.stringify(results, null, 2));
  expect(results.flatMap(r => r.contrasts.map((contrast, sample) => ({ theme: r.theme, sample, contrast, foreground: r.foreground, background: r.samples[sample].rgba }))).filter(x => x.contrast < 4.5),
    'each screenshot-sampled name-card background must contrast >=4.5:1 with computed name ink').toEqual([]);
});

// Extended contrast assertion: measure all six viewport×theme cells, not just 320x800,
// to catch future regressions in token changes on desktop full-card tiers.
test('rendered pixel contrast >=4.5:1 on all six cells (1440×900|390×844|320×800 × light|dark)', async ({ browser }) => {
  const cells = [];
  const rgb = value => { const m = value.match(/rgba?\((\d+)[, ]+([\d]+)[, ]+([\d]+)/); if (!m) throw new Error(`unknown foreground ${value}`); return m.slice(1, 4).map(Number); };
  const lum = color => color.map(v => { v /= 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }).reduce((v, c, i) => v + c * [.2126, .7152, .0722][i], 0);
  const ratio = (a, b) => { const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x); return (hi + .05) / (lo + .05); };
  for (const theme of themes) {
    for (const [width, height] of viewports) {
      const context = await demoContext(browser, theme, { width, height });
      const page = await context.newPage(), errors = collectErrors(page), serverErrors = [];
      page.on('response', r => { if (r.status() >= 500) serverErrors.push({ url: r.url(), status: r.status() }); });
      try {
        await page.goto(BASE + '/tree');
        await expect(page.locator('button[aria-label*="Đời thứ"]').first()).toBeVisible({ timeout: 10000 });
        const proof = await viewportNameProof(page);
        const name = proof.readableNames.find(n => n.tier === 'name-only' || n.tier === 'full-card');
        if (!name) { cells.push({ theme, viewport: { width, height }, skip: 'no readable name found', errors, serverErrors }); await context.close(); continue; }
        const card = page.locator('.tree-viewport button[aria-label*="Đời thứ"]').filter({ hasText: name.name }).first();
        const foreground = await card.evaluate((el, tier) => getComputedStyle(tier === 'full-card' ? el.querySelector('p.font-display') : el).color, name.tier);
        const screenshot = path.join(OUT, `contrast-6cell-${theme}-${width}x${height}.png`);
        const image = await page.screenshot({ path: screenshot, fullPage: false });
        const samples = await page.evaluate(async ({ encoded, box }) => {
          const bytes = Uint8Array.from(atob(encoded), c => c.charCodeAt(0));
          const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
          const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
          const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0);
          const points = [[box.x + 8, box.bottom - 8], [box.right - 8, box.bottom - 8]];
          return points.map(([x, y]) => {
            const px = [...ctx.getImageData(Math.round(x), Math.round(y), 1, 1).data];
            return { x: Math.round(x), y: Math.round(y), rgba: px };
          });
        }, { encoded: image.toString('base64'), box: name.box });
        const foregroundRgb = rgb(foreground);
        const contrasts = samples.map(s => ratio(foregroundRgb, s.rgba.slice(0, 3)));
        const cell = { theme, viewport: { width, height }, name: name.name, tier: name.tier, foreground, contrasts, screenshot, errors, serverErrors,
          pass: !errors.pageErrors.length && !errors.consoleErrors.length && !serverErrors.length && contrasts.every(c => c >= 4.5) };
        cells.push(cell);
        fs.writeFileSync(path.join(OUT, `contrast-6cell-${theme}-${width}x${height}.json`), JSON.stringify(cell, null, 2));
        console.log('CONTRAST_6CELL ' + JSON.stringify({ theme, viewport: { width, height }, tier: name.tier, contrasts, pass: cell.pass }));
      } finally { await context.close(); }
    }
  }
  fs.writeFileSync(path.join(OUT, 'contrast-6cell-summary.json'), JSON.stringify(cells, null, 2));
  expect(cells.filter(c => !c.pass).map(c => ({ theme: c.theme, viewport: c.viewport, tier: c.tier, contrasts: c.contrasts, errors: c.errors, serverErrors: c.serverErrors })),
    'all six viewport cells must have >=4.5:1 contrast on rendered pixels').toEqual([]);
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
