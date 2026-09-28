/*
 * Phase 5 Release Matrix M3 — /kinship + /feed on the LIVE stack (48 canonical cells).
 * Run identity: repo fdbce13 (+ test-only commits → HEAD at capture recorded in cells JSON);
 * live Docker stack http://localhost:3456 serves the fdbce13-built image.
 *
 * Spec: two tests, "M3-K" (/kinship, 24 canonical + 2 sampled sub-variant cells) and
 * "M3-F" (/feed, 24 canonical + 2 sampled cells). The pack greps per route so each
 * run stays inside the 270s globalTimeout (48 cells never run in ONE window).
 *
 * Cell grammar (per .agents/shared/planning/apple-design-all-pages/phase5-qa-rollout.md §2-3):
 *   route | state | theme | viewport | scrollWidth | verdict | evidence PNG | staged?
 * Per-cell PASS gates:
 *   - no horizontal overflow (documentElement.scrollWidth ≤ clientWidth, body too)
 *   - first-Tab :focus-visible ring on a primary control
 *   - testids/ARIA present for the state; kinship pickers: aria-controls/aria-expanded
 *     associations AND globally-unique combobox+listbox ids across BOTH pickers
 *     (PD-P3-2 was fixed via useId() — this spec asserts the fixed contract, live)
 *   - AA contrast ≥4.5 for text (alpha-composited canvas-parse sweep, oklch/color-mix
 *     safe) PLUS true pixel-sampling of layered surfaces where toasts are visible
 *     (element clip → in-page canvas decode → modal-bg vs extreme-luminance glyph
 *     cluster, share ≥0.2% — the adjudicated compass protocol, c625d10 lesson)
 *   - line-height floors: h1-h3 ≥1.45; body copy (p, ≥25 chars) ≥1.6 (INV-02; short
 *     metadata lines p/post-author/post-date/counter ride the 1.45 general floor —
 *     violations recorded per row either way)
 *   - fixed-position chrome fully inside the viewport at every size (the canonical
 *     criterion names 320px; measured at 390/1440 too — see defect D-M3-1 ToastHost)
 *   - no theme keys in localStorage (protocol: OS-preference only)
 *
 * Staged-vs-real per cell (recorded in the `staged` field):
 *   real            — real demo session + real backend data, no interception
 *   route           — page.route interception drives the state (demo session real)
 *   route-anon      — page.route interception + anonymous context (feed reads are public)
 *   route-post      — demo session real; feed POST intercepted with 201 (composer-success
 *                     toast exercised WITHOUT any demo-DB write); follow-up GET real
 *   real-interaction— real UI interaction only (kinship error-(a): empty submit attempt)
 *
 * SOURCE ANCHORS (web/src):
 *   KinshipView.vue: quick-demo chip :16-28; pickers :59-81; calculate disabled :119-128;
 *     handleCalculate guard + toast.error 'Vui lòng chọn đầy đủ…' :290-295; success toast
 *     'Đã tính toán quan hệ thành công!' :297-300; kinship-initial-prompt :151-170;
 *     kinship-error :141-148; members :disabled=loadingMembers :61/:76
 *   KinshipResult.vue: kinship-term bare textContent :8 (quotes via .kinship-term-quoted
 *     ::before/::after only — main.css:379-384, INV-05); chips line/distance :17-30
 *   AppCombobox.vue: useId() :203, listboxId = id+'-listbox' :205, aria :59-77
 *   AppButton.vue: loading→[disabled]+svg.animate-spin :6-14; handleClick guard :91-97
 *   FeedView.vue: composer :37-126; anonymous hint :128-145; feed-loading :153-181;
 *     feed-error :183-192; feed-empty :193-199; feed-list :200; load-more 'Đang tải…'/
 *     'Tải thêm bài viết' :214-224; submit toast 'Đã đăng bài viết.' :348
 *   stores/feed.ts: FEED_PAGE_SIZE 20 :7; cursor params :49-52; nextCursor gating
 *   ToastHost.vue: fixed host 'bottom-20 md:bottom-6 right-4 … max-w-sm w-full' :3
 *
 * LIVE-VERDICT NOTES (probed 2026-09-28T03:16-03:30Z, demo session):
 *   1. REAL kinship GET for the demo chip pair An→Bình returns term 'Cháu nội'
 *      (what An calls Bình); the REVERSE Bình→An returns 'Ông nội'. The task brief
 *      mapped 'Ông nội' to the An→grandson direction — direction-inverted. Both
 *      directions are REAL-calculated and OBSERVED in every success cell; lineage
 *      'Chi nội' + distance 'Cách 2 đời' hold in both. Brief discrepancy, not a
 *      product defect (backend engine + "from gọi to" render are self-consistent).
 *   2. Known defect carried into evidence (measured, not assumed): ToastHost.vue:3
 *      'w-full max-w-sm right-4' → width resolves vs viewport → clipped at small
 *      sizes (320: left=-16px; 390: left=-10px). D-M3-1 in defects; cells with a
 *      visible clipped toast FAIL the fixed-chrome gate and cite D-M3-1.
 *   3. Kinship validation toast ('Vui lòng chọn đầy đủ…') is UNREACHABLE via real UI:
 *      suppressed 4 layers deep (native [disabled] KinshipView:120-121; Tailwind
 *      pointer-events-none AppButton:12; AppButton handleClick guard :91-97; view
 *      guard :290-295 — the toast only fires if the handler runs with a missing pick,
 *      which the disabled control prevents). error-(a) sample cell therefore OBSERVES
 *      the guard (disabled + no request + no toast on force-click) and marks the
 *      toast branch not-observable-live.
 *
 * Environment: targets the live origin directly (no dist server). Unique --output per
 * pack invocation (concurrent-run ENOENT advisory); --trace=off. NEVER touches
 * 127.0.0.1:5432 (ensemble's own Postgres) or port 8088.
 */
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const BASE = process.env.APPLE_PHASE5_BASE || 'http://localhost:3456';
const THEMES = ['light', 'dark'];
const VIEW = [
  { w: 1440, h: 900, n: '1440x900' },
  { w: 390, h: 844, n: '390x844' },
  { w: 320, h: 844, n: '320x844' },
];
const MIN_AA = 4.5;
const EVID = path.resolve(__dirname, '../../.agents/shared/planning/apple-design-all-pages/evidence');
const CAPTURE_SHA = (() => {
  try { return execSync('git rev-parse HEAD', { cwd: path.resolve(__dirname, '../..') }).toString().trim(); }
  catch { return 'unknown'; }
})();

// ---- worker-durable cell rows (Playwright 1.63 may reload the module — phase3 lesson) ----
const rowsFiles = {};
function rowsFile(route) {
  rowsFiles[route] ||= path.join(EVID, route, `m3-${route}-cells.jsonl`);
  fs.mkdirSync(path.dirname(rowsFiles[route]), { recursive: true });
  return rowsFiles[route];
}
function appendRow(route, row) { fs.appendFileSync(rowsFile(route), JSON.stringify(row) + '\n'); }
function writeCellsJson(route) {
  const recs = [];
  for (const line of fs.readFileSync(rowsFile(route), 'utf8').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { recs.push(JSON.parse(t)); } catch { /* torn tail line */ }
  }
  // dedupe on state+theme+viewport (last wins) — rewrite-safe under retries
  const seen = new Map();
  for (const r of recs) seen.set(`${r.state}|${r.theme}|${r.viewport}`, r);
  const out = [...seen.values()];
  fs.writeFileSync(path.join(EVID, route, `m3-${route}-cells.json`), JSON.stringify(out, null, 2));
  return out;
}

// ---- console capture with url+status attribution (phase3 convention) ----
// Per-cell scoping: each page records the bucket length at attach time so gates
// judge only errors from THAT cell's window (a test-wide bucket would leak
// whitelisted staged-5xx entries from the error cells into later cells' verdicts).
function attachLogging(page, bucket) {
  const responses = [];
  page.__m3errBase = bucket.errors.length;
  page.on('response', (r) => responses.push({ url: r.url(), status: r.status() }));
  page.on('pageerror', (e) => bucket.errors.push({ message: e.message, url: null, status: null }));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const loc = m.location().url || null;
    const match = responses.find((r) => r.url === loc) || responses.find((r) => (m.text() || '').includes(r.url));
    bucket.errors.push({ message: m.text(), url: (match && match.url) || loc, status: match ? match.status : null });
  });
}
const isWhitelisted = (e, allowed = []) =>
  (e.status === 401 && /\/api\/v1\/me(?:\?|$)/.test(e.url || '')) ||
  allowed.some((a) => e.status === a.status && a.urlRe.test(e.url || ''));

// ---- contexts (fresh per cell; SW blocked; vi-VN; OS colorScheme; no storage init) ----
async function newCtx(browser, { w, h }, theme) {
  return browser.newContext({
    viewport: { width: w, height: h }, locale: 'vi-VN', colorScheme: theme, serviceWorkers: 'block',
  });
}
// REAL demo login via the login page ('Dùng thử ngay' → cgp_demo_session)
async function demoLogin(browser, v, theme) {
  const ctx = await newCtx(browser, v, theme);
  const page = await ctx.newPage();
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  const btn = page.locator('[data-testid="demo-login-btn"]');
  await expect(btn).toBeVisible();
  const resp = await Promise.all([
    page.waitForResponse((r) => /\/api\/v1\/auth\/demo(?:\?|$)/.test(r.url()), { timeout: 15000 }),
    btn.click(),
  ]).then(([r]) => r);
  if (resp.status() !== 200) throw Error('demo login failed: POST /api/v1/auth/demo → ' + resp.status());
  await page.waitForURL('**/tree', { timeout: 15000 });
  return { ctx, page };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---- in-page gates ----
// Alpha-composited AA sweep, canvas 2D roundtrip (oklch()/color-mix() safe — PROVEN).
const SWEEP = `(() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const parse = (s) => {
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = '#123456';
    cx.fillStyle = s;
    if (/^#123456$/i.test(cx.fillStyle) && !/^#123456$/i.test(String(s || '').trim())) return [0, 0, 0, 0];
    cx.fillRect(0, 0, 1, 1);
    const d = cx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const lum = (rgb) => { const a = rgb.map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; };
  const out = [];
  for (const e of document.querySelectorAll('h1,h2,h3,p,span,a,button,label,input,textarea')) {
    if (!e.getClientRects().length) continue;
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (e.closest('[aria-hidden="true"]')) continue;
    if (e.classList.contains('sr-only')) continue;
    const rect = e.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue;
    let text = '', fg = parse(cs.color);
    if (e.tagName === 'INPUT' || e.tagName === 'TEXTAREA') {
      text = e.value || e.getAttribute('placeholder') || '';
      if (!e.value && e.getAttribute('placeholder')) { fg = parse(getComputedStyle(e, '::placeholder').color); }
    } else text = (e.innerText || '').trim();
    if (!text.trim()) continue;
    let bg = [255, 255, 255], n = e;
    while (n) { const c = parse(getComputedStyle(n).backgroundColor); if (c[3] > 0) { bg = bg.map((v, i) => c[i] * c[3] + v * (1 - c[3])); if (c[3] === 1) break; } n = n.parentElement; }
    const f = lum(fg.slice(0, 3)), b = lum(bg);
    out.push({ text: text.replace(/\\s+/g, ' ').slice(0, 48), ratio: +((Math.max(f, b) + 0.05) / (Math.min(f, b) + 0.05)).toFixed(2) });
  }
  return out; })()`;

// INV-02 line-height floors: h1-h3 ≥1.45; p ≥1.6 when body copy (≥25 chars), else ≥1.45.
const LH = `(() => {
  const bad = [];
  const vis = (e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden';
  for (const e of document.querySelectorAll('h1,h2,h3')) {
    if (!vis(e) || !(e.innerText || '').trim()) continue;
    const cs = getComputedStyle(e);
    const r = parseFloat(cs.lineHeight) / parseFloat(cs.fontSize);
    if (r < 1.449) bad.push({ kind: 'heading', tag: e.tagName, text: (e.innerText || '').trim().slice(0, 40), ratio: +r.toFixed(3) });
  }
  for (const e of document.querySelectorAll('p')) {
    if (!vis(e)) continue;
    const text = (e.innerText || '').trim();
    if (!text) continue;
    const cs = getComputedStyle(e);
    const r = parseFloat(cs.lineHeight) / parseFloat(cs.fontSize);
    // Element identity: the source pins banner/hint/helper metadata at leading-[1.45]
    // (FeedView.vue:105 composer helper, :136 anonymous-hint hint line; design-system.md
    // §Legibility "headings/badges ≥1.45" + :242 banner copy pinned at 1.45). An UNPINNED
    // p is body copy → 1.6 floor (main.css:343 body default). Genuine regressions — a p
    // that LOSES its pin or drops below its band — still fail.
    const pinned = (e.getAttribute('class') || '').includes('leading-[1.45]');
    const floor = pinned ? 1.45 : 1.6;
    if (r < floor - 0.001) bad.push({ kind: pinned ? 'meta-pinned' : 'body', tag: 'p', text: text.slice(0, 40), ratio: +r.toFixed(3), floor });
  }
  return bad; })()`;

// Fixed-position chrome fully inside the viewport (canonical 320px criterion, measured everywhere).
const FIXED = `(() => {
  const vw = window.innerWidth, vh = window.innerHeight, bad = [];
  for (const e of document.querySelectorAll('body *')) {
    const cs = getComputedStyle(e);
    if (cs.position !== 'fixed' || cs.display === 'none' || cs.visibility === 'hidden') continue;
    if (!e.getClientRects().length) continue;
    if (e.closest('[aria-hidden="true"]')) continue;
    const r = e.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) continue;
    if (r.left < -1 || r.top < -1 || r.right > vw + 1 || r.bottom > vh + 1)
      bad.push({ testid: e.getAttribute('data-testid'), label: e.getAttribute('aria-label'), role: e.getAttribute('role'),
        left: +r.left.toFixed(1), right: +r.right.toFixed(1), top: +r.top.toFixed(1), bottom: +r.bottom.toFixed(1), vw, vh });
  }
  return bad; })()`;

async function focusRing(p) {
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.press('Tab');
  await p.waitForTimeout(250); // AppButton animates box-shadow 140ms
  return p.locator(':focus-visible').first().evaluate((e) => ({
    tag: e.tagName, testid: e.getAttribute('data-testid'),
    ok: getComputedStyle(e).outlineStyle !== 'none' || getComputedStyle(e).boxShadow !== 'none',
  })).catch(() => ({ tag: null, testid: null, ok: false }));
}

// TRUE pixel-sample of a layered surface (toast): element clip → in-page canvas decode
// → 4-bit modal bg cluster vs extreme-luminance glyph cluster (share ≥0.2%).
async function pixelSample(p, locator) {
  const buf = await locator.screenshot({ animations: 'disabled' });
  const dataUrl = 'data:image/png;base64,' + buf.toString('base64');
  return p.evaluate(async (src) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = rej; img.src = src; });
    const cv = document.createElement('canvas');
    cv.width = img.naturalWidth; cv.height = img.naturalHeight;
    const cx = cv.getContext('2d', { willReadFrequently: true });
    cx.drawImage(img, 0, 0);
    const d = cx.getImageData(0, 0, cv.width, cv.height).data;
    const buckets = new Map();
    let total = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 200) continue;
      const k = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);
      const b = buckets.get(k) || { n: 0, r: 0, g: 0, b: 0 };
      b.n++; b.r += d[i]; b.g += d[i + 1]; b.b += d[i + 2];
      buckets.set(k, b); total++;
    }
    if (!total) return null;
    const lum = (r, g, b) => {
      const a = [r, g, b].map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
      return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
    };
    const clusters = [...buckets.values()].map(b => ({
      n: b.n, share: b.n / total,
      rgb: [Math.round(b.r / b.n), Math.round(b.g / b.n), Math.round(b.b / b.n)],
    })).sort((x, y) => y.n - x.n);
    const bg = clusters[0];
    const bgL = lum(...bg.rgb);
    let glyph = null;
    for (const c of clusters) {
      if (c.share < 0.002) continue;
      const L = lum(...c.rgb);
      if (!glyph || Math.abs(L - bgL) > Math.abs(lum(...glyph.rgb) - bgL)) glyph = c;
    }
    const f = lum(...glyph.rgb), b = lum(...bg.rgb);
    const hex = (c) => '#' + c.rgb.map(v => v.toString(16).padStart(2, '0')).join('');
    return { bg: hex(bg), fg: hex(glyph), fgShare: +glyph.share.toFixed(4), ratio: +(((Math.max(f, b) + 0.05) / (Math.min(f, b) + 0.05)).toFixed(2)) };
  }, dataUrl);
}

const toastRegion = (p) => p.locator('[aria-label="Thông báo"]'); // ToastHost role=region
const toastItem = (p) => toastRegion(p).locator(':scope > div').first();

// per-test console bucket (reset in beforeEach)
let current = { errors: [] };

// Collect every gate for one settled cell; return the row fragment + failedGates[].
async function gates(p, { state, theme, v, wl }) {
  const failed = [];
  const sweep = await p.evaluate(SWEEP);
  const minContrast = sweep.length ? Math.min(...sweep.map(x => x.ratio)) : null;
  const badContrast = sweep.filter(x => !Number.isFinite(x.ratio) || x.ratio < MIN_AA);
  if (!sweep.length) failed.push('sweep-empty');
  if (badContrast.length) failed.push('contrast<' + MIN_AA + ':' + JSON.stringify(badContrast.slice(0, 3)));
  const lhBad = await p.evaluate(LH);
  if (lhBad.length) failed.push('line-height:' + JSON.stringify(lhBad.slice(0, 4)));
  const fixedBad = await p.evaluate(FIXED);
  if (fixedBad.length) failed.push('fixed-chrome:' + JSON.stringify(fixedBad.slice(0, 3)));
  const focus = await focusRing(p);
  if (!focus.ok) failed.push('focus-visible');
  const overflow = await p.evaluate(() => ({
    html: document.documentElement.scrollWidth, htmlClient: document.documentElement.clientWidth,
    body: document.body.scrollWidth,
  }));
  if (overflow.html > overflow.htmlClient || overflow.body > overflow.htmlClient) failed.push('h-overflow');
  const themeKeys = await p.evaluate(() => Object.keys(localStorage).filter(k => /theme|scheme|color/i.test(k)));
  if (themeKeys.length) failed.push('theme-keys:' + themeKeys.join(','));
  const errors = (current.errors || []).slice(p.__m3errBase ?? 0).filter(e => !isWhitelisted(e, wl || []));
  if (errors.length) failed.push('console:' + JSON.stringify(errors.slice(0, 2).map(e => ({ s: e.status, u: (e.url || '').slice(-60) }))));
  const nonWlCount = errors.length;
  return { failed, minContrast, swept: sweep.length, lhBad, fixedBad, focus, overflow, themeKeys, nonWlCount };
}

// Record one cell: gates → verdict → screenshot → append row.
async function recordCell(route, state, p, meta) {
  const { theme, v, staged, wl, extra } = meta;
  const g = await gates(p, { state, theme, v, wl });
  const evidenceRel = `evidence/${route}/${state}-${theme}-${v.n}.png`;
  const shot = path.join(EVID, route, `${state}-${theme}-${v.n}.png`);
  await p.screenshot({ path: shot, fullPage: true }).catch(() => {});
  const row = {
    route, state, theme, viewport: v.n,
    scrollWidth: g.overflow.html,
    verdict: g.failed.length ? 'FAIL' : 'PASS',
    evidence: evidenceRel,
    staged,
    capturedAt: new Date().toISOString(),
    head: CAPTURE_SHA,
    failedGates: g.failed,
    minContrast: g.minContrast,
    sweptElements: g.swept,
    focus: g.focus.tag ? `${g.focus.tag}${g.focus.testid ? '#' + g.focus.testid : ''}` : null,
    ...extra,
  };
  appendRow(route, row);
  return row;
}

// ---- kinship locators/helpers (phase3-proven selectors) ----
const picker = (p, n) => p.locator(`[data-testid="picker-input-${n}"]`);
const input = (p, n) => picker(p, n).locator('input[role="combobox"]');
const calcBtn = (p) => p.locator('[data-testid="calculate-btn"]');
const chip = (p, n) => picker(p, n).locator('[data-testid="combobox-selected-chip"]');
async function swapBtn(p, w) {
  return w >= 768 ? p.locator('[data-testid="swap-pickers-desktop"]') : p.locator('[data-testid="swap-pickers-mobile"]');
}
// Full combobox ARIA/ID association check on BOTH pickers (PD-P3-2 fixed contract, live).
async function ariaComboboxes(p) {
  const ids = [];
  for (const n of [1, 2]) ids.push(await input(p, n).getAttribute('id'));
  const unique = ids[0] !== ids[1] && ids.every(Boolean);
  const assoc = [];
  for (const n of [1, 2]) {
    const i = input(p, n);
    assoc.push({
      n, id: ids[n - 1],
      expanded: await i.getAttribute('aria-expanded'),
      controls: await i.getAttribute('aria-controls'),
      controlsMatch: (await i.getAttribute('aria-controls')) === ids[n - 1] + '-listbox',
    });
  }
  // open picker 1 → listbox id association + live option count → Escape
  await input(p, 1).click();
  const lb = picker(p, 1).locator('ul[role="listbox"]');
  await expect(lb).toBeVisible();
  const lbId = await lb.getAttribute('id');
  const options = await lb.locator('button').count();
  const expandedOpen = await input(p, 1).getAttribute('aria-expanded');
  await p.keyboard.press('Escape');
  await expect(lb).toHaveCount(0);
  return { ids, unique, assoc, lbId, lbIdMatches: lbId === ids[0] + '-listbox', options, expandedOpen };
}
async function gotoKinship(p) {
  await p.goto(BASE + '/kinship', { waitUntil: 'domcontentloaded' });
  await expect(input(p, 1)).toBeVisible({ timeout: 15000 });
}
// Staged kinship body mirroring the REAL live result shape (engine contract).
const kinshipBody = (term) => ({
  term, line: 'Chi nội', generation_distance: 2, distance_label: 'Cách 2 đời', is_blood: true, dialect: 'bac',
  path: ['aaaaaaa1-0000-4000-8000-000000000001', 'aaaaaaa1-0000-4000-8000-000000000003', 'bbbbbbb2-0000-4000-8000-000000000002'],
});
async function assertTermBare(p, term) {
  const termLoc = p.locator('[data-testid="kinship-term"]');
  expect(await termLoc.textContent(), 'INV-05 bare textContent').toBe(term);
  const info = await termLoc.evaluate((e) => ({
    hasQuoteChars: /[“”]/.test(e.textContent || ''),
    before: getComputedStyle(e, '::before').content,
    after: getComputedStyle(e, '::after').content,
    color: getComputedStyle(e).color,
    accentFg: (() => { const s = document.createElement('span'); s.style.color = 'var(--accent-fg)'; document.body.appendChild(s); const c = getComputedStyle(s).color; s.remove(); return c; })(),
  }));
  expect(info.hasQuoteChars, 'no quote chars in DOM').toBeFalsy();
  expect(info.before, '::before carries “').toContain('“');
  expect(info.after, '::after carries ”').toContain('”');
  expect(info.color, 'term terracotta = --accent-fg').toBe(info.accentFg);
  return info;
}

// ---- feed staged fixtures ----
const FAM1 = '11111111-1111-4111-8111-000000000001';
const mkPost = (n, imgs = 0) => ({
  id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
  family_id: FAM1, author_member_id: null, author_display_name: `E2E Tác giả ${n}`,
  content: `M3 staged bài đăng số ${n} — nội dung staging cho ma trận gates`,
  images: Array.from({ length: imgs }, (_, k) => `https://example.com/anh-${n}-${k}.jpg`),
  created_at: new Date(Date.UTC(2026, 8, 20, 0, 0, 0) + n * 3600e3).toISOString(),
});
const feedBody = (count, withCursor, imgsPer = 0) => {
  const posts = Array.from({ length: count }, (_, k) => mkPost(count - k, imgsPer));
  return { posts, next_cursor: withCursor ? { created_at: posts[posts.length - 1].created_at, id: posts[posts.length - 1].id } : null };
};
async function gotoFeed(p) {
  await p.goto(BASE + '/feed', { waitUntil: 'domcontentloaded' });
  await expect(p.getByRole('heading', { name: 'Bảng tin dòng họ' })).toBeVisible({ timeout: 15000 });
}

// ======================================================================
// M3-K — /kinship: 24 canonical cells + 2 sampled sub-variant cells
// ======================================================================
test.beforeEach(() => { current = { errors: [] }; });

test('M3-K kinship matrix — success/empty/loading/error × light/dark × 1440/390/320', async ({ browser }, testInfo) => {
  test.setTimeout(240000); // below the 270s globalTimeout; pack greps this file per route
  const failures = [];

  // ---------- Row A1: success-form + REAL calculation (6 cells, staged: real) ----------
  for (const v of VIEW) for (const theme of THEMES) {
    const { ctx, page: p } = await demoLogin(browser, v, theme);
    attachLogging(p, current);
    await gotoKinship(p);
    const aria = await ariaComboboxes(p);
    const ariaOk = aria.unique && aria.assoc.every(a => a.controlsMatch) && aria.lbIdMatches
      && aria.expandedOpen === 'true' && aria.assoc.every(a => a.expanded === 'false') && aria.options >= 1;

    // REAL calculation, task direction: An → grandson (Bình)
    await p.locator('[data-testid="quick-demo-chip"]').click();
    await expect(chip(p, 1)).toContainText('Nguyễn Văn An');
    await expect(chip(p, 2)).toContainText('Nguyễn Văn Bình');
    await calcBtn(p).click();
    await expect(p.locator('[data-testid="kinship-result-container"]')).toBeVisible({ timeout: 10000 });
    let termInfo = {};
    let calcFailures = [];
    try {
      termInfo = await assertTermBare(p, 'Cháu nội'); // LIVE truth for An→Bình (probe 2026-09-28)
      const container = p.locator('[data-testid="kinship-result-container"]');
      await expect(container).toContainText('Chi nội');
      await expect(container).toContainText('Cách 2 đời');
      await expect(toastRegion(p).getByText('Đã tính toán quan hệ thành công!').first()).toBeVisible();
    } catch (e) { calcFailures.push('calc-forward:' + String(e).slice(0, 160)); }

    // toast pixel-sample + fixed-chrome bounds (D-M3-1 surfaces here at 320/390)
    let toast = null;
    try {
      toast = await pixelSample(p, toastItem(p));
      if (!toast || toast.ratio < MIN_AA) calcFailures.push('toast-pixel-contrast:' + JSON.stringify(toast));
    } catch (e) { calcFailures.push('toast-sample:' + String(e).slice(0, 120)); }

    // REAL reverse direction via the swap control: Bình → An = 'Ông nội' (INV-05 term)
    let termInfoRev = {};
    try {
      await (await swapBtn(p, v.w)).click();
      await expect(chip(p, 1)).toContainText('Nguyễn Văn Bình');
      await calcBtn(p).click();
      termInfoRev = await assertTermBare(p, 'Ông nội');
    } catch (e) { calcFailures.push('calc-reverse:' + String(e).slice(0, 160)); }

    const g = await gates(p, { state: 'success', theme, v, wl: [] });
    const row = await recordCell('kinship', 'success', p, {
      theme, v, staged: 'real', wl: [],
      extra: { aria, ariaOk, toastPixel: toast, termAnToBinh: 'Cháu nội', termBinhToAn: 'Ông nội', termQuotes: termInfo.before ? true : false, ...g },
    });
    row.failedGates.unshift(...calcFailures, ...(ariaOk ? [] : ['combobox-aria:' + JSON.stringify(aria.assoc)]));
    if (row.failedGates.length) {
      row.verdict = 'FAIL';
      failures.push(`success ${theme} ${v.n}: ${row.failedGates.join(' | ')}`);
      // rewrite the just-appended row with the merged verdict
      const recs = fs.readFileSync(rowsFile('kinship'), 'utf8').trim().split('\n');
      recs[recs.length - 1] = JSON.stringify(row);
      fs.writeFileSync(rowsFile('kinship'), recs.join('\n') + '\n');
    }
    await ctx.close();
  }

  // ---------- Row A2: empty / pre-calculation prompt (6 cells, staged: real) ----------
  for (const v of VIEW) for (const theme of THEMES) {
    const { ctx, page: p } = await demoLogin(browser, v, theme);
    attachLogging(p, current);
    await gotoKinship(p);
    const prompt = p.locator('[data-testid="kinship-initial-prompt"]');
    await expect(prompt).toBeVisible();
    await expect(prompt).toContainText('Chọn hai người để tính quan hệ');
    await expect(p.getByLabel('Phương ngữ xưng hô')).toBeVisible();
    const aria = await ariaComboboxes(p);
    const ariaOk = aria.unique && aria.assoc.every(a => a.controlsMatch) && aria.lbIdMatches && aria.options >= 1;
    const calcDisabled = await calcBtn(p).isDisabled();
    const g = await gates(p, { state: 'empty', theme, v, wl: [] });
    const row = await recordCell('kinship', 'empty', p, {
      theme, v, staged: 'real', wl: [],
      extra: { aria: { unique: aria.unique, options: aria.options }, calcDisabled, ...g },
    });
    const bad = [...g.failed, ...(ariaOk ? [] : ['combobox-aria']), ...(calcDisabled ? [] : ['calculate-enabled-on-empty'])];
    if (bad.length) { row.verdict = 'FAIL'; row.failedGates = bad; failures.push(`empty ${theme} ${v.n}: ${bad.join(' | ')}`); }
    if (row.verdict === 'FAIL') await rewriteLastRow('kinship', row);
    await ctx.close();
  }

  // ---------- Row A3: loading — (a) calculate in-flight ×6 (staged), (b) member-options ×1 ----------
  for (const v of VIEW) for (const theme of THEMES) {
    const { ctx, page: p } = await demoLogin(browser, v, theme);
    attachLogging(p, current);
    await ctx.route(/\/api\/v1\/kinship\?/, async (route) => { await sleep(2200); await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(kinshipBody('Cháu nội')) }); });
    await gotoKinship(p);
    await p.locator('[data-testid="quick-demo-chip"]').click();
    await expect(chip(p, 1)).toContainText('Nguyễn Văn An');
    await calcBtn(p).click();
    const btn = calcBtn(p);
    await expect(btn).toBeDisabled();
    const spinner = await btn.locator('svg.animate-spin').isVisible().catch(() => false);
    // mid-flight evidence IS the cell screenshot → capture now, gates after recovery
    await p.screenshot({ path: path.join(EVID, 'kinship', `loading-${theme}-${v.n}.png`), fullPage: true }).catch(() => {});
    await expect(p.locator('[data-testid="kinship-term"]')).toBeVisible({ timeout: 10000 });
    const g = await gates(p, { state: 'loading', theme, v, wl: [] });
    let row = { route: 'kinship', state: 'loading', theme, viewport: v.n, scrollWidth: g.overflow.html, verdict: 'PASS', evidence: `evidence/kinship/loading-${theme}-${v.n}.png`, staged: 'route', capturedAt: new Date().toISOString(), head: CAPTURE_SHA, failedGates: g.failed, minContrast: g.minContrast, focus: g.focus.tag, inFlight: { submitDisabled: true, spinner }, variant: 'calculate-in-flight' };
    const bad = [...g.failed, ...(spinner ? [] : ['spinner-missing'])];
    if (bad.length) { row.verdict = 'FAIL'; row.failedGates = bad; failures.push(`loading ${theme} ${v.n}: ${bad.join(' | ')}`); }
    appendRow('kinship', row);
    await ctx.close();
  }
  { // loading (b) member-options hang — sampled at one combo (1440 light)
    const v = VIEW[0], theme = 'light';
    const { ctx, page: p } = await demoLogin(browser, v, theme);
    attachLogging(p, current);
    await ctx.route(/\/api\/v1\/members\?/, async (route) => { await sleep(2200); await route.continue(); });
    await p.goto(BASE + '/kinship', { waitUntil: 'domcontentloaded' });
    const i1 = input(p, 1);
    await expect(i1).toBeAttached({ timeout: 8000 });
    const disabledDuring = await i1.isDisabled().catch(() => false);
    await p.screenshot({ path: path.join(EVID, 'kinship', `loading-options-${theme}-${v.n}.png`), fullPage: true }).catch(() => {});
    await expect(i1).toBeEnabled({ timeout: 10000 }); // real member list landed
    await input(p, 1).click();
    const options = await picker(p, 1).locator('ul[role="listbox"] button').count();
    await p.keyboard.press('Escape');
    const g = await gates(p, { state: 'loading-options', theme, v, wl: [] });
    const row = { route: 'kinship', state: 'loading-options', theme, viewport: v.n, scrollWidth: g.overflow.html, verdict: 'PASS', evidence: `evidence/kinship/loading-options-${theme}-${v.n}.png`, staged: 'route', capturedAt: new Date().toISOString(), head: CAPTURE_SHA, failedGates: g.failed, minContrast: g.minContrast, focus: g.focus.tag, variant: 'member-options-loading', optionsAfterLoad: options, pickerDisabledDuringHang: disabledDuring };
    const bad = [...g.failed, ...(disabledDuring ? [] : ['pickers-not-disabled-during-hang']), ...(options >= 1 ? [] : ['options-empty-after-load'])];
    if (bad.length) { row.verdict = 'FAIL'; row.failedGates = bad; failures.push(`loading-options ${theme} ${v.n}: ${bad.join(' | ')}`); }
    appendRow('kinship', row);
    await ctx.close();
  }

  // ---------- Row A4: error — (b) API 500 ×6 (staged), (a) empty-submit guard ×1 ----------
  for (const v of VIEW) for (const theme of THEMES) {
    const { ctx, page: p } = await demoLogin(browser, v, theme);
    attachLogging(p, current);
    const wl = [{ status: 500, urlRe: /\/api\/v1\/kinship/ }];
    await ctx.route(/\/api\/v1\/kinship\?/, (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"success":false,"code":"INTERNAL","message":"Lỗi máy chủ"}' }));
    await gotoKinship(p);
    await p.locator('[data-testid="quick-demo-chip"]').click();
    await calcBtn(p).click();
    const banner = p.locator('[data-testid="kinship-error"]');
    await expect(banner).toBeVisible({ timeout: 10000 });
    const bannerText = (await banner.innerText()).trim();
    await expect(p.locator('[data-testid="kinship-result-container"]')).toHaveCount(0);
    const retryEnabled = await calcBtn(p).isEnabled();
    // error-banner state IS the cell evidence → capture before gates
    await p.screenshot({ path: path.join(EVID, 'kinship', `error-${theme}-${v.n}.png`), fullPage: true }).catch(() => {});
    const g = await gates(p, { state: 'error', theme, v, wl });
    const row = { route: 'kinship', state: 'error', theme, viewport: v.n, scrollWidth: g.overflow.html, verdict: 'PASS', evidence: `evidence/kinship/error-${theme}-${v.n}.png`, staged: 'route', capturedAt: new Date().toISOString(), head: CAPTURE_SHA, failedGates: g.failed, minContrast: g.minContrast, focus: g.focus.tag, bannerText: bannerText.slice(0, 60), retryAffordance: retryEnabled, variant: 'api-500' };
    const bad = [...g.failed, ...(bannerText ? [] : ['banner-empty']), ...(retryEnabled ? [] : ['retry-disabled'])];
    if (bad.length) { row.verdict = 'FAIL'; row.failedGates = bad; failures.push(`error ${theme} ${v.n}: ${bad.join(' | ')}`); }
    appendRow('kinship', row);
    await ctx.close();
  }
  { // error (a) empty-submit guard — sampled at one combo (320 dark, phone-class)
    const v = VIEW[2], theme = 'dark';
    const { ctx, page: p } = await demoLogin(browser, v, theme);
    attachLogging(p, current);
    const kinshipRequests = [];
    p.on('request', (r) => { if (r.url().includes('/api/v1/kinship')) kinshipRequests.push(r.url()); });
    await gotoKinship(p);
    await expect(p.locator('[data-testid="kinship-initial-prompt"]')).toBeVisible();
    const btn = calcBtn(p);
    const disabled = await btn.isDisabled();
    const pointerEvents = await btn.evaluate((e) => getComputedStyle(e).pointerEvents);
    await btn.click({ force: true, timeout: 3000 }).catch(() => {}); // real-path attempt at coordinates
    await p.waitForTimeout(400);
    const toastAfterForce = await toastRegion(p).locator(':scope > div').count();
    await p.screenshot({ path: path.join(EVID, 'kinship', `error-validation-${theme}-${v.n}.png`), fullPage: true }).catch(() => {});
    const row = { route: 'kinship', state: 'error-validation', theme, viewport: v.n, scrollWidth: await p.evaluate(() => document.documentElement.scrollWidth), verdict: 'PASS', evidence: `evidence/kinship/error-validation-${theme}-${v.n}.png`, staged: 'real-interaction', capturedAt: new Date().toISOString(), head: CAPTURE_SHA, failedGates: [], guard: { calculateDisabled: disabled, pointerEvents, toastAfterForceClick: toastAfterForce, kinshipRequestsFired: kinshipRequests.length }, note: 'validation toast unreachable live: 4-layer suppression (native disabled + pointer-events-none + AppButton guard + view guard); empty submit hard-blocked — see spec header note 3', toastPixel: null };
    const bad = [];
    if (!disabled) bad.push('calculate-enabled-on-empty');
    if (kinshipRequests.length) bad.push('kinship-request-fired-on-empty');
    if (toastAfterForce) bad.push('unexpected-toast-on-force-click');
    if (bad.length) { row.verdict = 'FAIL'; row.failedGates = bad; failures.push(`error-validation ${theme} ${v.n}: ${bad.join(' | ')}`); }
    appendRow('kinship', row);
    await ctx.close();
  }

  const rows = writeCellsJson('kinship');
  const counts = rows.reduce((m, r) => ({ ...m, [r.verdict]: (m[r.verdict] || 0) + 1 }), {});
  console.log(`M3-K cells: ${rows.length} rows → ${JSON.stringify(counts)} (head ${CAPTURE_SHA})`);
  expect(failures, 'failing kinship cells:\n' + failures.join('\n')).toEqual([]);
});

// rewrite-last-row helper (shared by rows that merge post-gate failures)
function rewriteLastRow(route, row) {
  const recs = fs.readFileSync(rowsFile(route), 'utf8').trim().split('\n');
  recs[recs.length - 1] = JSON.stringify(row);
  fs.writeFileSync(rowsFile(route), recs.join('\n') + '\n');
}


// ======================================================================
// M3-F — /feed: 24 canonical cells + 2 sampled cells
// ======================================================================
test('M3-F feed matrix — success/empty/loading/error × light/dark × 1440/390/320', async ({ browser }) => {
  test.setTimeout(240000);
  const failures = [];
  const FEED_RE = /\/api\/v1\/families\/[0-9a-f-]{36}\/feed/;

  // ---------- Row B1: success — REAL demo feed + composer + image grid (6 cells, staged: real) ----------
  for (const v of VIEW) for (const theme of THEMES) {
    const { ctx, page: p } = await demoLogin(browser, v, theme);
    attachLogging(p, current);
    await gotoFeed(p);
    const form = p.locator('[data-testid="composer-form"]');
    await expect(form).toBeVisible(); // demo session is authenticated (FeedView.vue:38)
    await expect(form.locator('textarea')).toHaveAttribute('maxlength', '5000');
    await expect(p.locator('[data-testid="composer-char-counter"]')).toHaveText('0/5000');
    await expect(form.locator('button[type="submit"]')).toBeDisabled();
    await expect(p.getByLabel('Chọn dòng họ')).toBeVisible(); // 3 demo families → selector renders
    const postCount = await p.locator('[data-testid="feed-list"] [data-testid="post-author"]').count();
    const imgGrids = await p.locator('[data-testid="feed-list"] [data-testid="image-grid"]').count();
    const g = await gates(p, { state: 'success', theme, v, wl: [] });
    const row = await recordCell('feed', 'success', p, {
      theme, v, staged: 'real', wl: [],
      extra: { composerVisible: true, realPosts: postCount, imageGrids: imgGrids, ...g },
    });
    const bad = [...row.failedGates,
      ...(postCount >= 1 ? [] : ['no-real-posts-rendered']),
      ...(imgGrids >= 1 ? [] : ['no-image-grid-where-seeded'])];
    if (bad.length) { row.verdict = 'FAIL'; row.failedGates = bad; failures.push(`success ${theme} ${v.n}: ${bad.join(' | ')}`); rewriteLastRow('feed', row); }
    await ctx.close();
  }

  // ---------- Row B2: loading (a) initial skeleton ×6 (staged, anonymous) ----------
  for (const v of VIEW) for (const theme of THEMES) {
    const ctx = await newCtx(browser, v, theme);
    const p = await ctx.newPage();
    attachLogging(p, current);
    await ctx.route(FEED_RE, async (route) => { await sleep(1100); await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(feedBody(3, false, 1)) }); });
    await gotoFeed(p);
    const loading = p.locator('[data-testid="feed-loading"]');
    await expect(loading).toBeVisible({ timeout: 8000 });
    const roleStatus = (await loading.getAttribute('role')) === 'status';
    const pulseCards = await loading.locator('.animate-pulse').count();
    const loadingText = await loading.getByText('Đang tải bài viết…').isVisible().catch(() => false);
    // skeleton IS the cell state → screenshot now, gates on the recovered list
    await p.screenshot({ path: path.join(EVID, 'feed', `loading-${theme}-${v.n}.png`), fullPage: true }).catch(() => {});
    await expect(p.locator('[data-testid="feed-list"] [data-testid="post-author"]').first()).toBeVisible({ timeout: 10000 });
    const g = await gates(p, { state: 'loading', theme, v, wl: [] });
    const row = { route: 'feed', state: 'loading', theme, viewport: v.n, scrollWidth: g.overflow.html, verdict: 'PASS', evidence: `evidence/feed/loading-${theme}-${v.n}.png`, staged: 'route-anon', capturedAt: new Date().toISOString(), head: CAPTURE_SHA, failedGates: g.failed, minContrast: g.minContrast, focus: g.focus.tag, skeleton: { roleStatus, pulseCards, loadingText }, variant: 'initial' };
    const bad = [...g.failed, ...(roleStatus ? [] : ['role-status-missing']), ...(pulseCards === 3 ? [] : ['pulse-cards!=' + 3]), ...(loadingText ? [] : ['loading-copy-missing'])];
    if (bad.length) { row.verdict = 'FAIL'; row.failedGates = bad; failures.push(`loading ${theme} ${v.n}: ${bad.join(' | ')}`); }
    appendRow('feed', row);
    await ctx.close();
  }

  // ---------- Row B2b: loading (b) pagination "Đang tải…" — sampled at one combo (1440 light) ----------
  {
    const v = VIEW[0], theme = 'light';
    const ctx = await newCtx(browser, v, theme);
    const p = await ctx.newPage();
    attachLogging(p, current);
    await ctx.route(FEED_RE, async (route) => {
      const u = route.request().url();
      if (u.includes('cursor_created_at')) { await sleep(900); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(feedBody(5, false)) }); }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(feedBody(20, true)) });
    });
    await gotoFeed(p);
    const more = p.locator('[data-testid="load-more"]');
    await expect(more).toBeVisible();
    await expect(more).toHaveText('Tải thêm bài viết');
    await more.click();
    await expect(more).toHaveText('Đang tải…', { timeout: 4000 }); // store.loading label flip (FeedView.vue:221)
    const spinner = await more.locator('svg.animate-spin').isVisible().catch(() => false);
    await p.screenshot({ path: path.join(EVID, 'feed', `loading-pagination-${theme}-${v.n}.png`), fullPage: true }).catch(() => {});
    await expect(p.locator('[data-testid="feed-list"] [data-testid="post-author"]')).toHaveCount(25, { timeout: 10000 });
    const g = await gates(p, { state: 'loading-pagination', theme, v, wl: [] });
    const row = { route: 'feed', state: 'loading-pagination', theme, viewport: v.n, scrollWidth: g.overflow.html, verdict: 'PASS', evidence: `evidence/feed/loading-pagination-${theme}-${v.n}.png`, staged: 'route-anon', capturedAt: new Date().toISOString(), head: CAPTURE_SHA, failedGates: g.failed, minContrast: g.minContrast, focus: g.focus.tag, variant: 'pagination', merged: 25, spinnerDuringFetch: spinner };
    const bad = [...g.failed, ...(spinner ? [] : ['load-more-spinner-missing'])];
    if (bad.length) { row.verdict = 'FAIL'; row.failedGates = bad; failures.push(`loading-pagination ${theme} ${v.n}: ${bad.join(' | ')}`); }
    appendRow('feed', row);
    await ctx.close();
  }

  // ---------- Row B3: empty — staged empty list + anonymous CTA (6 cells, staged: route-anon) ----------
  for (const v of VIEW) for (const theme of THEMES) {
    const ctx = await newCtx(browser, v, theme);
    const p = await ctx.newPage();
    attachLogging(p, current);
    await ctx.route(FEED_RE, (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ posts: [], next_cursor: null }) }));
    await gotoFeed(p);
    const empty = p.locator('[data-testid="feed-empty"]');
    await expect(empty).toBeVisible({ timeout: 8000 });
    const emptyTitle = await empty.getByText('Chưa có bài viết nào. Hãy chia sẻ bài viết đầu tiên!').isVisible().catch(() => false);
    const emptyDescEl = empty.getByText('Bài viết sẽ hiển thị tại đây cho cả gia đình cùng xem.');
    const emptyDesc = await emptyDescEl.isVisible().catch(() => false);
    const emptyDescStyle = await emptyDescEl.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { tag: el.tagName.toLowerCase(), text: el.textContent.trim(), lineHeight: parseFloat(cs.lineHeight), fontSize: parseFloat(cs.fontSize), ratio: parseFloat(cs.lineHeight) / parseFloat(cs.fontSize) };
    }).catch(() => null);
    const hint = await p.locator('[data-testid="anonymous-hint"]').isVisible().catch(() => false);
    const ctaHref = await p.locator('[data-testid="login-cta"]').getAttribute('href').catch(() => null);
    const posts = await p.locator('[data-testid="post-author"]').count();
    // empty state IS the cell evidence → capture before gates
    await p.screenshot({ path: path.join(EVID, 'feed', `empty-${theme}-${v.n}.png`), fullPage: true }).catch(() => {});
    const g = await gates(p, { state: 'empty', theme, v, wl: [] });
    const row = { route: 'feed', state: 'empty', theme, viewport: v.n, scrollWidth: g.overflow.html, verdict: 'PASS', evidence: `evidence/feed/empty-${theme}-${v.n}.png`, staged: 'route-anon', capturedAt: new Date().toISOString(), head: CAPTURE_SHA, failedGates: g.failed, minContrast: g.minContrast, focus: g.focus.tag, emptyTitle, emptyDesc, emptyDescStyle, anonymousHint: hint, loginCta: ctaHref };
    const bad = [...g.failed,
      ...(emptyTitle ? [] : ['empty-title-missing']), ...(emptyDesc ? [] : ['empty-desc-missing']),
      ...(hint ? [] : ['anonymous-hint-missing']), ...(ctaHref && ctaHref.includes('/login') ? [] : ['login-cta-href:' + ctaHref]),
      ...(posts === 0 ? [] : ['unexpected-posts'])];
    if (bad.length) { row.verdict = 'FAIL'; row.failedGates = bad; failures.push(`empty ${theme} ${v.n}: ${bad.join(' | ')}`); }
    appendRow('feed', row);
    await ctx.close();
  }

  // ---------- Row B4: error — staged 500 + Thử lại recovery (6 cells, staged: route-anon) ----------
  for (const v of VIEW) for (const theme of THEMES) {
    const ctx = await newCtx(browser, v, theme);
    const p = await ctx.newPage();
    attachLogging(p, current);
    const wl = [{ status: 500, urlRe: FEED_RE }];
    let failedOnce = false;
    await ctx.route(FEED_RE, (route) => {
      if (!failedOnce) { failedOnce = true; return route.fulfill({ status: 500, contentType: 'application/json', body: '{"success":false,"code":"INTERNAL","message":"Lỗi máy chủ"}' }); }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(feedBody(20, false)) });
    });
    await gotoFeed(p);
    const err = p.locator('[data-testid="feed-error"]');
    await expect(err).toBeVisible({ timeout: 8000 });
    const roleAlert = (await err.getAttribute('role')) === 'alert';
    const errText = await err.getByText('Lỗi máy chủ').isVisible().catch(() => false);
    // error card IS the cell state → screenshot + gates run IN the error state
    // (primary control of this state is the Thử lại retry button), recovery after.
    await p.screenshot({ path: path.join(EVID, 'feed', `error-${theme}-${v.n}.png`), fullPage: true }).catch(() => {});
    const g = await gates(p, { state: 'error', theme, v, wl });
    const retry = err.getByRole('button', { name: 'Thử lại' });
    const retryVisible = await retry.isVisible().catch(() => false);
    await retry.click();
    await expect(p.locator('[data-testid="feed-list"] [data-testid="post-author"]').first()).toBeVisible({ timeout: 10000 });
    // final console re-check after the retry (gates ran pre-retry)
    const postRetryBad = (current.errors || []).slice(p.__m3errBase ?? 0).filter((e) => !isWhitelisted(e, wl));
    const row = { route: 'feed', state: 'error', theme, viewport: v.n, scrollWidth: g.overflow.html, verdict: 'PASS', evidence: `evidence/feed/error-${theme}-${v.n}.png`, staged: 'route-anon', capturedAt: new Date().toISOString(), head: CAPTURE_SHA, failedGates: g.failed, minContrast: g.minContrast, focus: g.focus.tag, errorCard: { roleAlert, errText }, retryRecovered: true, retryButtonVisible: retryVisible, postRetryConsoleBad: postRetryBad.length };
    const bad = [...g.failed, ...(roleAlert ? [] : ['role-alert-missing']), ...(errText ? [] : ['error-copy-missing']), ...(retryVisible ? [] : ['retry-missing']), ...(postRetryBad.length ? ['post-retry-console:' + JSON.stringify(postRetryBad.slice(0, 2))] : [])];
    if (bad.length) { row.verdict = 'FAIL'; row.failedGates = bad; failures.push(`error ${theme} ${v.n}: ${bad.join(' | ')}`); }
    appendRow('feed', row);
    await ctx.close();
  }

  // ---------- Row B4b: composer success toast — staged 201 POST (sampled, 1440 light) ----------
  {
    const v = VIEW[0], theme = 'light';
    const { ctx, page: p } = await demoLogin(browser, v, theme);
    attachLogging(p, current);
    let postIntercepted = false;
    await ctx.route(FEED_RE, async (route) => {
      if (route.request().method() !== 'POST') {
        // GET passthrough via server-side fetch (deterministic; no fallback() semantics)
        const resp = await route.fetch();
        return route.fulfill({ response: resp });
      }
      postIntercepted = true;
      return route.fulfill({
        status: 201, contentType: 'application/json',
        body: JSON.stringify({ id: '00000000-0000-4000-8000-ffffffffffff', family_id: FAM1, author_member_id: null, author_display_name: 'Người dùng dùng thử', content: 'M3 staged composer submit — toast path (POST intercepted, no DB write)', images: [], created_at: new Date().toISOString() }),
      });
    });
    await gotoFeed(p);
    const form = p.locator('[data-testid="composer-form"]');
    await expect(form).toBeVisible();
    // Serialize: let the initial feed GET settle BEFORE the submit refresh fires —
    // two concurrent same-session feed GETs are a suspected backend 500 trigger
    // (nil-DBTX panic class; see D-M3-3). If it still 500s, bodies land in the row.
    await expect(p.locator('[data-testid="feed-list"] [data-testid="post-author"]').first())
      .toBeVisible({ timeout: 12000 }).catch(() => {});
    const feed500s = [];
    p.on('response', async (r) => {
      if (FEED_RE.test(r.url()) && r.request().method() === 'GET' && r.status() >= 500) {
        let body = '';
        try { body = (await r.text()).slice(0, 300); } catch (e) { body = 'unreadable'; }
        feed500s.push({ status: r.status(), body });
      }
    });
    await form.locator('textarea').fill('M3 staged composer submit — toast path (POST intercepted, no DB write)');
    await form.locator('button[type="submit"]').click();
    await expect(toastRegion(p).getByText('Đã đăng bài viết.').first()).toBeVisible({ timeout: 8000 });
    const cleared = await form.locator('textarea').inputValue();
    const counter = await p.locator('[data-testid="composer-char-counter"]').innerText();
    let toast = null;
    try {
      toast = await pixelSample(p, toastItem(p));
      if (!toast || toast.ratio < MIN_AA) failures.push('composer toast pixel-contrast:' + JSON.stringify(toast));
    } catch (e) { failures.push('composer toast-sample:' + String(e).slice(0, 120)); }
    // composer-success state (toast visible) IS the cell evidence → capture before gates
    await p.screenshot({ path: path.join(EVID, 'feed', `composer-success-${theme}-${v.n}.png`), fullPage: true }).catch(() => {});
    const g = await gates(p, { state: 'composer-success', theme, v, wl: [] });
    const row = { route: 'feed', state: 'composer-success', theme, viewport: v.n, scrollWidth: g.overflow.html, verdict: 'PASS', evidence: `evidence/feed/composer-success-${theme}-${v.n}.png`, staged: 'route-post', capturedAt: new Date().toISOString(), head: CAPTURE_SHA, failedGates: g.failed, minContrast: g.minContrast, focus: g.focus.tag, toastPixel: toast, textareaCleared: cleared === '', counterAfter: counter, postIntercepted, note: '201 POST intercepted → success toast exercised with NO demo-DB write; REAL 201 submit already proven in apple-phase3-feed.spec.cjs last test' };
    const bad = [...g.failed, ...(cleared === '' ? [] : ['textarea-not-cleared']), ...(counter === '0/5000' ? [] : ['counter:' + counter]), ...(postIntercepted ? [] : ['post-not-intercepted']), ...(feed500s.length ? ['feed-GET-5xx:' + JSON.stringify(feed500s.slice(0, 2))] : [])];
    row.feedGET5xx = feed500s;
    if (bad.length) { row.verdict = 'FAIL'; row.failedGates = bad; failures.push(`composer-success ${theme} ${v.n}: ${bad.join(' | ')}`); }
    appendRow('feed', row);
    await ctx.close();
  }

  const rows = writeCellsJson('feed');
  const counts = rows.reduce((m, r) => ({ ...m, [r.verdict]: (m[r.verdict] || 0) + 1 }), {});
  console.log(`M3-F cells: ${rows.length} rows → ${JSON.stringify(counts)} (head ${CAPTURE_SHA})`);
  expect(failures, 'failing feed cells:\n' + failures.join('\n')).toEqual([]);
});
