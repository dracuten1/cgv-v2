const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const base = process.env.APPLE_PHASE1_BASE;
const fixtureBase = process.env.APPLE_PHASE1_FIXTURE_BASE;
const out = process.env.APPLE_PHASE1_ARTIFACTS || path.resolve(__dirname, '../../.agents/tester/RESULTS/apple_phase1_shell_e2e');
const runId = process.env.APPLE_PHASE1_RUN_ID || new Date().toISOString().replace(/[:.]/g, '-');
if (!base || !/^http:\/\/127\.0\.0\.1:1[0-9]{4}$/.test(base)) throw new Error('Pack-managed local preview URL required');
fs.mkdirSync(out, { recursive: true });
const summaryPath = path.join(out, `summary-${runId}.json`);
function writeSummary(patch) { let prev = {}; try { prev = JSON.parse(fs.readFileSync(summaryPath, 'utf8')); } catch {} const next = { ...prev, runId, ...patch, lastUpdatedAt: new Date().toISOString() }; fs.writeFileSync(summaryPath, JSON.stringify(next, null, 2)); }
writeSummary({ base, fixtureBase: fixtureBase || null, preFixBaseline: { genLabels: '1.81–2.14:1', authInterstitialHover: '~1.8:1' }, cases: [], errors: [], fontResponses: [], externalFonts: [] });
async function appendCase(caseRow) { const prev = JSON.parse(fs.readFileSync(summaryPath, 'utf8')); prev.cases = [...(prev.cases||[]), caseRow]; fs.writeFileSync(summaryPath, JSON.stringify(prev, null, 2)); }
async function recordErrors(page) {
  page.on('pageerror', e => { const prev = JSON.parse(fs.readFileSync(summaryPath, 'utf8')); prev.errors = [...(prev.errors||[]), { type: 'pageerror', message: e.message, at: new Date().toISOString() }]; fs.writeFileSync(summaryPath, JSON.stringify(prev, null, 2)); });
  page.on('console', e => { if (e.type() === 'error') { const prev = JSON.parse(fs.readFileSync(summaryPath, 'utf8')); prev.errors = [...(prev.errors||[]), { type: 'console', message: e.text(), at: new Date().toISOString() }]; fs.writeFileSync(summaryPath, JSON.stringify(prev, null, 2)); } });
  page.on('requestfailed', r => { const prev = JSON.parse(fs.readFileSync(summaryPath, 'utf8')); prev.errors = [...(prev.errors||[]), { type: 'requestfailed', message: `${r.url()}: ${r.failure()?.errorText}`, at: new Date().toISOString() }]; fs.writeFileSync(summaryPath, JSON.stringify(prev, null, 2)); });
}
async function safeClose(ctx) { try { await ctx.close(); } catch (e) { const prev = JSON.parse(fs.readFileSync(summaryPath, 'utf8')); prev.warnings = [...(prev.warnings||[]), `context close failed: ${e.message}`]; fs.writeFileSync(summaryPath, JSON.stringify(prev, null, 2)); } }

const CONTRAST_EVALUATOR = `(() => {
  const parseColor = (raw) => {
    if (!raw) return null;
    const s = String(raw).trim();
    if (s.startsWith('#')) {
      let h = s.slice(1);
      if (h.length === 3) h = h.split('').map(c => c + c).join('');
      if (h.length === 4) h = h.slice(0,3).split('').map(c => c + c).join('');
      if (h.length === 6 || h.length === 8) { const n = parseInt(h.slice(0,6), 16); return [(n>>16)&255, (n>>8)&255, n&255, h.length===8 ? parseInt(h.slice(6,8),16)/255 : 1]; }
      return null;
    }
    const rgb = s.match(/^rgba?\\(([^)]+)\\)$/i);
    if (rgb) {
      const parts = rgb[1].split(/[,\\s/]+/).filter(Boolean);
      if (parts.length >= 3) {
        const r = +parts[0], g = +parts[1], b = +parts[2];
        const a = parts.length >= 4 ? parseFloat(parts[3]) : 1;
        if ([r,g,b,a].every(Number.isFinite)) return [r,g,b,a];
      }
      return null;
    }
    const off = document.createElement('canvas'); off.width = off.height = 1;
    const ctx2 = off.getContext('2d');
    ctx2.fillStyle = '#000';
    ctx2.fillStyle = s;
    const painted = ctx2.fillStyle;
    if (/^#[0-9a-f]{3,8}$/i.test(painted)) return parseColor(painted);
    ctx2.clearRect(0,0,1,1); ctx2.fillStyle = s; ctx2.fillRect(0,0,1,1); const d = ctx2.getImageData(0,0,1,1).data;
    return [d[0], d[1], d[2], d[3]/255];
  };
  const luminance = ([r,g,b]) => {
    const ch = [r,g,b].map(v => { v/=255; return v<=0.04045 ? v/12.92 : Math.pow((v+0.055)/1.055, 2.4); });
    return 0.2126*ch[0] + 0.7152*ch[1] + 0.0722*ch[2];
  };
  const composite = (top, bottom) => {
    const a = top[3];
    return [Math.round(top[0]*a + bottom[0]*(1-a)), Math.round(top[1]*a + bottom[1]*(1-a)), Math.round(top[2]*a + bottom[2]*(1-a)), 1];
  };
  const opaqueBase = () => {
    const html = parseColor(getComputedStyle(document.documentElement).backgroundColor);
    if (html && html[3] > 0) return html[3] === 1 ? html : composite(html, [255,255,255,1]);
    return [255,255,255,1];
  };
  const ancestorLayers = (el) => {
    const layers = [];
    let node = el;
    while (node && node.nodeType === 1) {
      const raw = getComputedStyle(node).backgroundColor;
      const c = parseColor(raw);
      if (c && c[3] > 0) layers.push({ color: c, node });
      node = node.parentElement;
    }
    return layers;
  };
  const effectiveBackground = (el) => {
    const layers = ancestorLayers(el);
    if (!layers.length) {
      const base = opaqueBase();
      return { color: base, node: document.documentElement, chain: ['html-base'] };
    }
    let acc = layers[layers.length - 1].color[3] === 1 ? layers[layers.length - 1].color : composite(layers[layers.length - 1].color, opaqueBase());
    const chain = [layers[layers.length - 1].node.tagName + (layers[layers.length - 1].node.id ? '#' + layers[layers.length - 1].node.id : '')];
    for (let i = layers.length - 2; i >= 0; i--) {
      acc = composite(layers[i].color, acc);
      chain.unshift(layers[i].node.tagName + (layers[i].node.id ? '#' + layers[i].node.id : ''));
    }
    return { color: acc, node: layers[0].node, chain };
  };
  const measure = (el) => {
    const cs = getComputedStyle(el);
    let fg = parseColor(cs.color) || [0,0,0,1];
    let bgInfo = effectiveBackground(el);
    let bg = bgInfo.color;
    let chain = [bgInfo.node ? bgInfo.node.tagName + (bgInfo.node.id?'#'+bgInfo.node.id:'') : 'html'];
    let safety = 0;
    while (fg[3] < 1 && safety++ < 8) {
      fg = composite(fg, bg);
      bgInfo = effectiveBackground(bgInfo.node);
      bg = bgInfo.color;
      chain.push(bgInfo.node ? bgInfo.node.tagName : 'html');
    }
    const L1 = luminance(fg), L2 = luminance(bg);
    const ratio = (Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05);
    return { fg: cs.color, bg: getComputedStyle(bgInfo.node||document.body).backgroundColor, fgRgb: fg.slice(0,3), bgRgb: bg.slice(0,3), ratio, ancestors: chain };
  };
  return { measure, parseColor };
})()`;

const scenarios = [
  { name: 'shell-light-desktop', width: 1440, theme: 'light' },
  { name: 'shell-light-390', width: 390, theme: 'light' },
  { name: 'shell-light-320', width: 320, theme: 'light' },
  { name: 'shell-dark-desktop', width: 1440, theme: 'dark' },
  { name: 'shell-dark-390', width: 390, theme: 'dark' },
  { name: 'shell-dark-320', width: 320, theme: 'dark' },
];

test.describe.configure({ mode: 'default' });

for (const scenario of scenarios) test(`shell-${scenario.theme}-${scenario.width}`, async ({ browser }) => {
  test.setTimeout(45000);
  const ctx = await browser.newContext({ viewport: { width: scenario.width, height: 900 }, locale: 'vi-VN', colorScheme: scenario.theme });
  const page = await ctx.newPage();
  await recordErrors(page);
  try {
    await page.setViewportSize({ width: scenario.width, height: 900 });
    await page.emulateMedia({ colorScheme: scenario.theme });
    await page.goto(base + '/login', { waitUntil: 'networkidle' });
    await expect(page.locator('#app')).toBeAttached();
    await expect(page.locator('main')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Cây Gia Phả' })).toBeVisible();
    const overflow = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
    expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.clientWidth);
    const desktopNav = page.locator('nav[aria-label="Điều hướng chính"]');
    const mobileNav = page.locator('nav[aria-label="Điều hướng di động"]');
    const nav = scenario.width >= 768 ? desktopNav : mobileNav;
    const navVisible = await nav.count();
    let currentLabel = null;
    if (navVisible > 0) {
      await expect(nav.first()).toBeVisible();
      const current = nav.locator('a[aria-current="page"]');
      const currentCount = await current.count();
      expect([0, 1]).toContain(currentCount);
      currentLabel = currentCount === 1 ? await current.innerText() : null;
    }
    await appendCase({ name: scenario.name, kind: 'shell', viewport: scenario.width, theme: scenario.theme, status: 'PASS', overflow, navVisible, currentLabel });
  } catch (e) {
    await appendCase({ name: scenario.name, kind: 'shell', viewport: scenario.width, theme: scenario.theme, status: 'FAIL', error: String(e.message || e) });
    throw e;
  } finally {
    try { await page.screenshot({ path: path.join(out, `shell-${scenario.width}-${scenario.theme}.png`), fullPage: true }); } catch {}
    await safeClose(ctx);
  }
});

test('keyboard-focus + functional-nontext contrast on /login', async ({ browser }) => {
  test.setTimeout(45000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN', colorScheme: 'light' });
  const page = await ctx.newPage();
  await recordErrors(page);
  try {
    await page.goto(base + '/login', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('Tab');
    const focus = page.locator(':focus-visible');
    await expect(focus).toHaveCount(1);
    const focusInfo = await focus.evaluate(e => ({ tag: e.tagName, outline: getComputedStyle(e).outlineStyle, outlineWidth: getComputedStyle(e).outlineWidth, shadow: getComputedStyle(e).boxShadow }));
    expect(focusInfo.outline !== 'none' || focusInfo.shadow !== 'none').toBeTruthy();
    const samples = await page.evaluate((evaluatorSrc) => { const ev = eval(evaluatorSrc); return [...document.querySelectorAll('main button,main a,nav a,main input')].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map(e => ev.measure(e)); }, CONTRAST_EVALUATOR);
    expect(samples.length).toBeGreaterThan(0);
    const failures = samples.filter(x => !Number.isFinite(x.ratio) || x.ratio < 3);
    expect(failures, JSON.stringify(failures)).toEqual([]);
    await appendCase({ name: 'focus-nontext', kind: 'contrast', viewport: 1440, theme: 'light', status: 'PASS', focus: focusInfo, functionalSamples: samples.length, minimum: Math.min(...samples.map(x => x.ratio)) });
  } catch (e) {
    await appendCase({ name: 'focus-nontext', kind: 'contrast', viewport: 1440, theme: 'light', status: 'FAIL', error: String(e.message || e) });
    throw e;
  } finally {
    try { await page.screenshot({ path: path.join(out, 'focus-nontext-light.png'), fullPage: true }); } catch {}
    await safeClose(ctx);
  }
});

test('text-contrast sample on /login dark', async ({ browser }) => {
  test.setTimeout(45000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN', colorScheme: 'dark' });
  const page = await ctx.newPage();
  await recordErrors(page);
  try {
    await page.goto(base + '/login', { waitUntil: 'networkidle' });
    const samples = await page.evaluate((evaluatorSrc) => { const ev = eval(evaluatorSrc); const out = []; const walk = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT); while (walk.nextNode()) { const n = walk.currentNode, e = n.parentElement; if (!n.textContent.trim() || !e.getClientRects().length) continue; const s = getComputedStyle(e); if (s.visibility === 'hidden' || +s.opacity === 0) continue; out.push({ text: n.textContent.trim().slice(0,70), ...ev.measure(e) }); } return out; }, CONTRAST_EVALUATOR);
    expect(samples.length).toBeGreaterThan(0);
    const failures = samples.filter(x => !Number.isFinite(x.ratio) || x.ratio < 4.5);
    expect(failures, JSON.stringify(failures)).toEqual([]);
    await appendCase({ name: 'text-contrast-dark', kind: 'contrast', viewport: 1440, theme: 'dark', status: 'PASS', sampleCount: samples.length, minimum: Math.min(...samples.map(x => x.ratio)) });
  } catch (e) {
    await appendCase({ name: 'text-contrast-dark', kind: 'contrast', viewport: 1440, theme: 'dark', status: 'FAIL', error: String(e.message || e) });
    throw e;
  } finally {
    try { await page.screenshot({ path: path.join(out, 'text-contrast-dark.png'), fullPage: true }); } catch {}
    await safeClose(ctx);
  }
});

test('demo-amber uses semantic --demo-button (resolved against root)', async ({ browser }) => {
  test.setTimeout(30000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN', colorScheme: 'dark' });
  const page = await ctx.newPage();
  await recordErrors(page);
  try {
    await page.goto(base + '/login', { waitUntil: 'networkidle' });
    const b = page.locator('[data-testid="demo-login-btn"]');
    await expect(b).toHaveCount(1);
    await expect(b).toBeVisible();
    const m = await b.evaluate((el, evaluatorSrc) => { const ev = eval(evaluatorSrc); const root = getComputedStyle(document.documentElement); const tokenName = '--demo-button'; const tokenRaw = root.getPropertyValue(tokenName).trim(); const tokenColor = (() => { if (!tokenRaw) return null; const probe = document.createElement('span'); probe.style.color = tokenRaw; document.body.appendChild(probe); const resolved = getComputedStyle(probe).color; probe.remove(); return resolved; })(); const measured = ev.measure(el); return { computedBg: getComputedStyle(el).backgroundColor, tokenRaw, tokenColor, computedFg: getComputedStyle(el).color, ratio: measured.ratio, ancestors: measured.ancestors }; }, CONTRAST_EVALUATOR);
    expect(m.tokenColor).toBeTruthy();
    expect(m.computedBg.toLowerCase()).toBe(m.tokenColor.toLowerCase());
    expect(m.ratio).toBeGreaterThanOrEqual(4.5);
    await appendCase({ name: 'demo-amber', kind: 'token', viewport: 1440, theme: 'dark', status: 'PASS', colors: m });
  } catch (e) {
    await appendCase({ name: 'demo-amber', kind: 'token', viewport: 1440, theme: 'dark', status: 'FAIL', error: String(e.message || e) });
    throw e;
  } finally {
    try { await page.screenshot({ path: path.join(out, 'demo-amber-dark.png'), fullPage: true }); } catch {}
    await safeClose(ctx);
  }
});

test('fraunces-self-hosted loaded + same-origin font response', async ({ browser }) => {
  test.setTimeout(45000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN', colorScheme: 'light' });
  const page = await ctx.newPage();
  const fontResponses = []; const externalFonts = [];
  page.on('request', r => { if (/\.(woff2?|ttf|otf)(\?|$)/i.test(r.url()) && !r.url().startsWith(base + '/') && (!fixtureBase || !r.url().startsWith(fixtureBase + '/'))) externalFonts.push(r.url()); });
  page.on('response', r => { if (/\.(woff2?|ttf|otf)(\?|$)/i.test(r.url())) fontResponses.push({ url: r.url(), status: r.status() }); });
  await recordErrors(page);
  try {
    await page.goto(base + '/login', { waitUntil: 'networkidle' });
    const faces = await page.evaluate(async () => { await document.fonts.load('600 32px Fraunces', 'Phả'); return [...document.fonts].filter(x => x.family.includes('Fraunces')).map(x => ({ family: x.family, status: x.status })); });
    const own = fontResponses.filter(x => (x.url.startsWith(base + '/') || (fixtureBase && x.url.startsWith(fixtureBase + '/'))) && x.status < 400);
    expect(faces.some(x => x.status === 'loaded')).toBeTruthy();
    expect(own.length).toBeGreaterThan(0);
    expect(externalFonts).toEqual([]);
    const prev = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
    prev.fontResponses = fontResponses; prev.externalFonts = externalFonts;
    fs.writeFileSync(summaryPath, JSON.stringify(prev, null, 2));
    await appendCase({ name: 'fraunces-self-hosted', kind: 'font', viewport: 1440, theme: 'light', status: 'PASS', faces, ownOriginResponses: own.length });
  } catch (e) {
    await appendCase({ name: 'fraunces-self-hosted', kind: 'font', viewport: 1440, theme: 'light', status: 'FAIL', error: String(e.message || e) });
    throw e;
  } finally {
    try { await page.screenshot({ path: path.join(out, 'fraunces.png'), fullPage: true }); } catch {}
    await safeClose(ctx);
  }
});

test('os-preference live switch', async ({ browser }) => {
  test.setTimeout(20000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN', colorScheme: 'light' });
  const page = await ctx.newPage();
  await recordErrors(page);
  try {
    await page.goto(base + '/login', { waitUntil: 'networkidle' });
    const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const light = await bg();
    await page.emulateMedia({ colorScheme: 'dark' });
    const dark = await bg();
    await page.emulateMedia({ colorScheme: 'light' });
    const again = await bg();
    expect(dark).not.toBe(light);
    expect(again).toBe(light);
    await appendCase({ name: 'os-preference-live', kind: 'theme', viewport: 1440, theme: 'light', status: 'PASS', light, dark, again });
  } catch (e) {
    await appendCase({ name: 'os-preference-live', kind: 'theme', viewport: 1440, theme: 'light', status: 'FAIL', error: String(e.message || e) });
    throw e;
  } finally {
    await safeClose(ctx);
  }
});

test('reachable routes assert Vue #app + main + correct pathname', async ({ browser }) => {
  test.setTimeout(60000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN', colorScheme: 'light' });
  const page = await ctx.newPage();
  await recordErrors(page);
  try {
    for (const route of ['/tree', '/kinship', '/feed']) {
      await page.goto(base + route, { waitUntil: 'networkidle' });
      await expect(page.locator('#app')).toBeAttached();
      await expect(page.locator('main')).toBeVisible();
      expect(new URL(page.url()).pathname).toBe(route);
      await appendCase({ name: `route-${route.slice(1)}`, kind: 'route', viewport: 1440, theme: 'light', status: 'PASS', path: route, title: await page.title() });
    }
  } catch (e) {
    await appendCase({ name: 'route-reachable', kind: 'route', viewport: 1440, theme: 'light', status: 'FAIL', error: String(e.message || e) });
    throw e;
  } finally {
    await safeClose(ctx);
  }
});

test('demo-login flow routes to /tree', async ({ browser }) => {
  test.setTimeout(30000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN', colorScheme: 'light' });
  const page = await ctx.newPage();
  await recordErrors(page);
  try {
    await page.goto(base + '/login', { waitUntil: 'networkidle' });
    const b = page.locator('[data-testid="demo-login-btn"]');
    await expect(b).toHaveCount(1);
    await b.click();
    await page.waitForURL(/\/tree/, { timeout: 12000 });
    await expect(page.locator('main')).toBeVisible();
    const current = page.locator('nav[aria-label="Điều hướng chính"] a[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await appendCase({ name: 'demo-flow', kind: 'flow', viewport: 1440, theme: 'light', status: 'PASS', path: new URL(page.url()).pathname, current: await current.innerText() });
  } catch (e) {
    await appendCase({ name: 'demo-flow', kind: 'flow', viewport: 1440, theme: 'light', status: 'FAIL', error: String(e.message || e) });
    throw e;
  } finally {
    await safeClose(ctx);
  }
});

test('chip-contrast fixture: real AppChip gen1–gen4 both themes via vite dev server', async ({ browser }) => {
  test.setTimeout(30000);
  if (!fixtureBase) { await appendCase({ name: 'chip-contrast-gen1-4', kind: 'contrast', viewport: 1440, theme: 'both', status: 'SKIPPED', error: 'APPLE_PHASE1_FIXTURE_BASE not set by pack' }); test.skip(true, 'fixture base URL missing'); }
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN', colorScheme: 'light' });
  const page = await ctx.newPage();
  await recordErrors(page);
  try {
    const fixture = fixtureBase + '/gen-chip-contrast.html';
    const resp = await page.goto(fixture, { waitUntil: 'networkidle' });
    if (!resp || resp.status() >= 400) throw new Error(`Fixture unavailable: ${fixture} status=${resp?.status()}`);
    await page.waitForFunction(() => document.querySelectorAll('[data-generation]').length === 4, { timeout: 10000 });
    const rows = [];
    let failures = [];
    for (const theme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: theme });
      for (const variant of ['gen1', 'gen2', 'gen3', 'gen4']) {
        const chip = page.locator(`[data-generation="${variant}"]`);
        await expect(chip).toBeVisible();
        const measured = await chip.evaluate((el, evaluatorSrc) => { const ev = eval(evaluatorSrc); return ev.measure(el); }, CONTRAST_EVALUATOR);
        const row = { variant, theme, ratio: measured.ratio, fg: measured.fg, bg: measured.bg, fgRgb: measured.fgRgb, bgRgb: measured.bgRgb, ancestors: measured.ancestors };
        rows.push(row);
        if (!Number.isFinite(measured.ratio) || measured.ratio < 4.5) failures.push(row);
      }
    }
    expect(failures, JSON.stringify(failures)).toEqual([]);
    await appendCase({ name: 'chip-contrast-gen1-4', kind: 'contrast', viewport: 1440, theme: 'both', status: 'PASS', source: 'vite-dev', fixture: fixture, rows });
  } catch (e) {
    await appendCase({ name: 'chip-contrast-gen1-4', kind: 'contrast', viewport: 1440, theme: 'both', status: 'FAIL', error: String(e.message || e) });
    throw e;
  } finally {
    try { await page.screenshot({ path: path.join(out, 'chip-contrast.png'), fullPage: true }); } catch {}
    await safeClose(ctx);
  }
});

test('auth-interstitial hover contrast both themes', async ({ browser }) => {
  test.setTimeout(45000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN', colorScheme: 'dark' });
  const page = await ctx.newPage();
  await recordErrors(page);
  try {
    await page.goto(base + '/auth/email/verify', { waitUntil: 'networkidle' });
    const rows = []; const failures = [];
    for (const theme of ['dark', 'light']) {
      await page.emulateMedia({ colorScheme: theme });
      const link = page.locator('main a').first();
      await expect(link).toBeVisible();
      await link.hover();
      const measured = await link.evaluate((el, evaluatorSrc) => { const ev = eval(evaluatorSrc); return ev.measure(el); }, CONTRAST_EVALUATOR);
      const row = { theme, ratio: measured.ratio, fg: measured.fg, bg: measured.bg, fgRgb: measured.fgRgb, bgRgb: measured.bgRgb, ancestors: measured.ancestors };
      rows.push(row);
      if (!Number.isFinite(measured.ratio) || measured.ratio < 4.5) failures.push(row);
    }
    expect(failures, JSON.stringify(failures)).toEqual([]);
    await appendCase({ name: 'auth-interstitial-hover', kind: 'contrast', viewport: 1440, theme: 'both', status: 'PASS', source: '/auth/email/verify', rows });
  } catch (e) {
    await appendCase({ name: 'auth-interstitial-hover', kind: 'contrast', viewport: 1440, theme: 'both', status: 'FAIL', error: String(e.message || e) });
    throw e;
  } finally {
    try { await page.screenshot({ path: path.join(out, 'auth-interstitial-hover.png'), fullPage: true }); } catch {}
    await safeClose(ctx);
  }
});

test('account-direction demo login → /account + contrast 1440 & 390 both themes', async ({ browser }) => {
  test.setTimeout(20000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN', colorScheme: 'light' });
  const page = await ctx.newPage();
  await recordErrors(page);
  try {
    await page.goto(base + '/login', { waitUntil: 'networkidle' });
    const b = page.locator('[data-testid="demo-login-btn"]');
    await expect(b).toHaveCount(1);
    await b.click();
    await page.waitForURL(/\/tree/, { timeout: 12000 });
    const observed = [];
    const cellFailures = [];
    for (const v of [{ width: 1440, theme: 'light' }, { width: 1440, theme: 'dark' }, { width: 390, theme: 'light' }, { width: 390, theme: 'dark' }]) {
      let cell = { viewport: v.width, theme: v.theme, status: 'FAIL', error: null };
      try {
        await page.setViewportSize({ width: v.width, height: 900 });
        await page.emulateMedia({ colorScheme: v.theme });
        await page.goto(base + '/account', { waitUntil: 'networkidle' });
        if (await page.locator('#app').count() === 0) throw new Error('#app missing');
        if (await page.locator('main').count() === 0) throw new Error('main missing');
        if (new URL(page.url()).pathname !== '/account') throw new Error(`unexpected pathname ${new URL(page.url()).pathname}`);
        const overflow = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
        if (overflow.scrollWidth > overflow.clientWidth) throw new Error(`horizontal overflow ${overflow.scrollWidth}>${overflow.clientWidth}`);
        const samples = await page.evaluate((evaluatorSrc) => { const ev = eval(evaluatorSrc); const out = []; const walk = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT); let count = 0; while (walk.nextNode() && count < 60) { const n = walk.currentNode, e = n.parentElement; if (!n.textContent.trim() || !e.getClientRects().length) continue; const s = getComputedStyle(e); if (s.visibility === 'hidden' || +s.opacity === 0) continue; out.push({ text: n.textContent.trim().slice(0, 70), ...ev.measure(e) }); count++; } return out; }, CONTRAST_EVALUATOR);
        if (samples.length < 3) throw new Error(`only ${samples.length} text samples on /account`);
        const sampled = samples.slice(0, Math.min(5, samples.length));
        const rowFailures = sampled.filter(x => !Number.isFinite(x.ratio) || x.ratio < 4.5);
        cell = { viewport: v.width, theme: v.theme, status: rowFailures.length === 0 ? 'PASS' : 'FAIL', path: new URL(page.url()).pathname, overflow, sampledCount: sampled.length, minimum: Math.min(...sampled.map(x => x.ratio)), sampled, rowFailures };
        if (rowFailures.length) cellFailures.push({ viewport: v.width, theme: v.theme, rowFailures });
      } catch (e) {
        cell.error = String(e.message || e);
        cellFailures.push({ viewport: v.width, theme: v.theme, error: cell.error });
      }
      observed.push(cell);
      await appendCase({ name: `account-direction-${v.width}-${v.theme}`, kind: 'route-contrast', viewport: v.width, theme: v.theme, status: cell.status, error: cell.error, overflow: cell.overflow, sampledCount: cell.sampledCount, minimum: cell.minimum });
    }
    expect(cellFailures, JSON.stringify(cellFailures)).toEqual([]);
    await appendCase({ name: 'account-direction', kind: 'route-contrast', viewport: 'multi', theme: 'both', status: 'PASS', summary: observed.map(o => ({ viewport: o.viewport, theme: o.theme, status: o.status, minimum: o.minimum })) });
  } catch (e) {
    await appendCase({ name: 'account-direction', kind: 'route-contrast', viewport: 'multi', theme: 'both', status: 'FAIL', error: String(e.message || e) });
    throw e;
  } finally {
    try { await page.screenshot({ path: path.join(out, 'account-direction.png'), fullPage: true }); } catch {}
    await safeClose(ctx);
  }
});
