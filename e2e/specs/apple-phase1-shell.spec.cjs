const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const base = process.env.APPLE_PHASE1_BASE;
const out = process.env.APPLE_PHASE1_ARTIFACTS || path.resolve(__dirname, '../../.agents/tester/RESULTS/apple_phase1_shell_e2e');
if (!base || !/^http:\/\/127\.0\.0\.1:1[0-9]{4}$/.test(base)) throw new Error('Pack-managed local preview URL required');
fs.mkdirSync(out, { recursive: true });
function summaryRead() { try { return JSON.parse(fs.readFileSync(path.join(out, 'summary.json'), 'utf8')); } catch { return { cases: [], errors: [], fontResponses: [], externalFonts: [], preFixBaseline: { genLabels: '1.81–2.14:1', authInterstitialHover: '~1.8:1' } }; } }
function summaryWrite(patch) { const prev = summaryRead(); const next = { ...prev, ...patch, lastUpdatedAt: new Date().toISOString() }; fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(next, null, 2)); }
function lum(c) { const m = c.match(/[\d.]+/g); if (!m || m.length < 3) return NaN; const [r,g,b] = m.slice(0,3).map(v=>+v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4); return .2126*r+.7152*g+.0722*b; }
function ratio(a,b) { const x=lum(a),y=lum(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); }
async function recordErrors(page, sink) {
  page.on('pageerror', e => { sink.push({ type: 'pageerror', message: e.message }); summaryWrite({ errors: [...summaryRead().errors, { type: 'pageerror', message: e.message, at: new Date().toISOString() }] }); });
  page.on('console', e => { if (e.type() === 'error') { sink.push({ type: 'console', message: e.text() }); summaryWrite({ errors: [...summaryRead().errors, { type: 'console', message: e.text(), at: new Date().toISOString() }] }); } });
  page.on('requestfailed', r => { sink.push({ type: 'requestfailed', message: `${r.url()}: ${r.failure()?.errorText}` }); summaryWrite({ errors: [...summaryRead().errors, { type: 'requestfailed', message: `${r.url()}: ${r.failure()?.errorText}`, at: new Date().toISOString() }] }); });
}
async function safeClose(ctx) { try { await ctx.close(); } catch (e) { summaryWrite({ warnings: [...(summaryRead().warnings||[]), `context close failed: ${e.message}`] }); } }
async function appendCase(caseRow) { const cur = summaryRead(); cur.cases = [...(cur.cases||[]), caseRow]; fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify(cur, null, 2)); }

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
  const localErrors = [];
  await recordErrors(page, localErrors);
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
  const localErrors = [];
  await recordErrors(page, localErrors);
  try {
    await page.goto(base + '/login', { waitUntil: 'networkidle' });
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('Tab');
    const focus = page.locator(':focus-visible');
    await expect(focus).toHaveCount(1);
    const focusInfo = await focus.evaluate(e => ({ tag: e.tagName, outline: getComputedStyle(e).outlineStyle, outlineWidth: getComputedStyle(e).outlineWidth, shadow: getComputedStyle(e).boxShadow }));
    expect(focusInfo.outline !== 'none' || focusInfo.shadow !== 'none').toBeTruthy();
    const samples = await page.evaluate(() => [...document.querySelectorAll('main button,main a,nav a,main input')].filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden').map(e => { const s = getComputedStyle(e); let a = e; while (a && getComputedStyle(a).backgroundColor === 'rgba(0, 0, 0, 0)') a = a.parentElement; return { tag: e.tagName, fg: s.color, bg: a ? getComputedStyle(a).backgroundColor : getComputedStyle(document.body).backgroundColor }; }));
    expect(samples.length).toBeGreaterThan(0);
    const failures = samples.map(x => ({ ...x, ratio: ratio(x.fg, x.bg) })).filter(x => !Number.isFinite(x.ratio) || x.ratio < 3);
    expect(failures, JSON.stringify(failures)).toEqual([]);
    await appendCase({ name: 'focus-nontext', kind: 'contrast', viewport: 1440, theme: 'light', status: 'PASS', focus: focusInfo, functionalSamples: samples.length, minimum: Math.min(...samples.map(x => ratio(x.fg, x.bg))) });
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
  const localErrors = [];
  await recordErrors(page, localErrors);
  try {
    await page.goto(base + '/login', { waitUntil: 'networkidle' });
    const samples = await page.evaluate(() => { const out = []; const walk = document.createTreeWalker(document.querySelector('main'), NodeFilter.SHOW_TEXT); while (walk.nextNode()) { const n = walk.currentNode, e = n.parentElement; if (!n.textContent.trim() || !e.getClientRects().length) continue; const s = getComputedStyle(e); if (s.visibility === 'hidden' || +s.opacity === 0) continue; let a = e; while (a && getComputedStyle(a).backgroundColor === 'rgba(0, 0, 0, 0)') a = a.parentElement; out.push({ text: n.textContent.trim().slice(0, 70), fg: s.color, bg: a ? getComputedStyle(a).backgroundColor : getComputedStyle(document.body).backgroundColor }); } return out; });
    expect(samples.length).toBeGreaterThan(0);
    const measured = samples.map(x => ({ ...x, ratio: ratio(x.fg, x.bg) }));
    const failures = measured.filter(x => !Number.isFinite(x.ratio) || x.ratio < 4.5);
    expect(failures, JSON.stringify(failures)).toEqual([]);
    await appendCase({ name: 'text-contrast-dark', kind: 'contrast', viewport: 1440, theme: 'dark', status: 'PASS', sampleCount: measured.length, minimum: Math.min(...measured.map(x => x.ratio)) });
  } catch (e) {
    await appendCase({ name: 'text-contrast-dark', kind: 'contrast', viewport: 1440, theme: 'dark', status: 'FAIL', error: String(e.message || e) });
    throw e;
  } finally {
    try { await page.screenshot({ path: path.join(out, 'text-contrast-dark.png'), fullPage: true }); } catch {}
    await safeClose(ctx);
  }
});

test('demo-amber uses semantic --demo-button', async ({ browser }) => {
  test.setTimeout(30000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN', colorScheme: 'dark' });
  const page = await ctx.newPage();
  const localErrors = [];
  await recordErrors(page, localErrors);
  try {
    await page.goto(base + '/login', { waitUntil: 'networkidle' });
    const b = page.locator('[data-testid="demo-login-btn"]');
    await expect(b).toHaveCount(1);
    await expect(b).toBeVisible();
    const m = await b.evaluate(e => ({ bg: getComputedStyle(e).backgroundColor, token: getComputedStyle(document.documentElement).getPropertyValue('--demo-button').trim(), fg: getComputedStyle(e).color }));
    expect(m.bg).toBe(m.token);
    expect(ratio(m.fg, m.bg)).toBeGreaterThanOrEqual(4.5);
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
  page.on('request', r => { if (/\.(woff2?|ttf|otf)(\?|$)/i.test(r.url()) && !r.url().startsWith(base + '/')) externalFonts.push(r.url()); });
  page.on('response', r => { if (/\.(woff2?|ttf|otf)(\?|$)/i.test(r.url())) fontResponses.push({ url: r.url(), status: r.status() }); });
  const localErrors = [];
  await recordErrors(page, localErrors);
  try {
    await page.goto(base + '/login', { waitUntil: 'networkidle' });
    const faces = await page.evaluate(async () => { await document.fonts.load('600 32px Fraunces', 'Phả'); return [...document.fonts].filter(x => x.family.includes('Fraunces')).map(x => ({ family: x.family, status: x.status })); });
    const own = fontResponses.filter(x => x.url.startsWith(base + '/') && x.status < 400);
    expect(faces.some(x => x.status === 'loaded')).toBeTruthy();
    expect(own.length).toBeGreaterThan(0);
    expect(externalFonts).toEqual([]);
    summaryWrite({ fontResponses, externalFonts });
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
  const localErrors = [];
  await recordErrors(page, localErrors);
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
  const localErrors = [];
  await recordErrors(page, localErrors);
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
  const localErrors = [];
  await recordErrors(page, localErrors);
  try {
    await page.goto(base + '/login', { waitUntil: 'networkidle' });
    const b = page.locator('[data-testid="demo-login-btn"]');
    await expect(b).toHaveCount(1);
    await b.click();
    await page.waitForURL(/\/tree/, { timeout: 12000 });
    await expect(page.locator('main')).toBeVisible();
    const current = page.locator('nav a[aria-current="page"]');
    await expect(current).toHaveCount(1);
    await appendCase({ name: 'demo-flow', kind: 'flow', viewport: 1440, theme: 'light', status: 'PASS', path: new URL(page.url()).pathname, current: await current.innerText() });
  } catch (e) {
    await appendCase({ name: 'demo-flow', kind: 'flow', viewport: 1440, theme: 'light', status: 'FAIL', error: String(e.message || e) });
    throw e;
  } finally {
    await safeClose(ctx);
  }
});

test('chip-contrast fixture: real AppChip gen1–gen4 both themes via built static HTML', async ({ browser }) => {
  test.setTimeout(30000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN', colorScheme: 'light' });
  const page = await ctx.newPage();
  const localErrors = [];
  await recordErrors(page, localErrors);
  try {
    const fixture = base + '/gen-chip-contrast.html';
    const resp = await page.goto(fixture, { waitUntil: 'networkidle' });
    if (!resp || resp.status() >= 400) throw new Error(`Fixture unavailable: ${fixture} status=${resp?.status()}`);
    const rows = [];
    for (const theme of ['light', 'dark']) {
      await page.emulateMedia({ colorScheme: theme });
      for (const variant of ['gen1', 'gen2', 'gen3', 'gen4']) {
        const chip = page.locator(`[data-generation="${variant}"]`);
        await expect(chip).toBeVisible();
        const colors = await chip.evaluate(el => ({ fg: getComputedStyle(el).color, bg: getComputedStyle(el).backgroundColor, text: el.textContent.trim() }));
        const r = ratio(colors.fg, colors.bg);
        rows.push({ variant, theme, ratio: r, fg: colors.fg, bg: colors.bg, text: colors.text });
        expect(r, `${theme} ${variant}: ${JSON.stringify(colors)}`).toBeGreaterThanOrEqual(4.5);
      }
    }
    await appendCase({ name: 'chip-contrast-gen1-4', kind: 'contrast', viewport: 1440, theme: 'both', status: 'PASS', source: 'fixture', rows });
  } catch (e) {
    await appendCase({ name: 'chip-contrast-gen1-4', kind: 'contrast', viewport: 1440, theme: 'both', status: 'FAIL', error: String(e.message || e), note: 'Real AppChip component not reachable; add /gen-chip-contrast.html + .ts to web/ and rebuild.' });
    throw e;
  } finally {
    try { await page.screenshot({ path: path.join(out, 'chip-contrast.png'), fullPage: true }); } catch {}
    await safeClose(ctx);
  }
});

test('auth-interstitial hover contrast dark + light', async ({ browser }) => {
  test.setTimeout(30000);
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN', colorScheme: 'dark' });
  const page = await ctx.newPage();
  const localErrors = [];
  await recordErrors(page, localErrors);
  try {
    await page.goto(base + '/auth/email/verify', { waitUntil: 'networkidle' });
    const rows = [];
    for (const theme of ['dark', 'light']) {
      await page.emulateMedia({ colorScheme: theme });
      const link = page.locator('main a').first();
      await expect(link).toBeVisible();
      await link.hover();
      const m = await link.evaluate(e => ({ fg: getComputedStyle(e).color, bg: getComputedStyle(e.parentElement.parentElement).backgroundColor, text: e.innerText }));
      const r = ratio(m.fg, m.bg);
      rows.push({ theme, ratio: r, fg: m.fg, bg: m.bg, text: m.text });
      expect(r, `${theme} auth-link:hover ${JSON.stringify(m)}`).toBeGreaterThanOrEqual(4.5);
    }
    await appendCase({ name: 'auth-interstitial-hover', kind: 'contrast', viewport: 1440, theme: 'both', status: 'PASS', source: '/auth/email/verify', rows });
  } catch (e) {
    await appendCase({ name: 'auth-interstitial-hover', kind: 'contrast', viewport: 1440, theme: 'both', status: 'FAIL', error: String(e.message || e) });
    throw e;
  } finally {
    try { await page.screenshot({ path: path.join(out, 'auth-interstitial-hover.png'), fullPage: true }); } catch {}
    await safeClose(ctx);
  }
});
