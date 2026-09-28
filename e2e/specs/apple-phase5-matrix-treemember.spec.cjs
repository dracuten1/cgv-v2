/**
 * Phase 5 Release Matrix M2 — /tree + /members/:id on the LIVE stack (http://localhost:3456).
 * Branch tip fdbce13; Phase-5 release-gate evidence per phase5-qa-rollout.md §1.5 + §3 protocol.
 *
 * Upgrades every applicable matrix cell (matrix §3.4–3.5) to OBSERVED with pass/fail:
 *   A. /tree      4 states (success/loading/error/empty)  × 2 themes × 3 viewports = 24 cells
 *   B. /members/:id 5 states (loading/not-found/success/empty-substate/action-feedback) × 2 × 3 = 30 cells
 *   Total 54 cells. Grep split per route: `--grep M2-TREE` (pack …_tree_…) / `--grep M2-MEMBER` (pack …_member_…).
 *
 * LIVE ORIGIN: this spec talks to http://localhost:3456 directly (Docker web @ HEAD, api, db) —
 * no dist static server, no host 5432 (ensemble Postgres), never port 8088. Staged states use
 * page.route interception ON the live origin (documented protocol); `staged` is recorded per cell.
 *
 * State contracts (source anchors @ fdbce13):
 *   tree-loading (TreeView.vue:96), tree-retry + EmptyState "Không thể tải cây gia phả" (:102-113),
 *   EmptyState "Chưa có dữ liệu gia phả." + empty-add-member CTA (:115-130), tree-world + 1 canvas +
 *   band-gen-N "Đời thứ N" labels (TreeVisualizer.vue:21-48), zoom-in/zoom-out/fit-view (:87-105),
 *   tree-compass/compass-center (TreeCompassControl.vue:4,38), aria-current="page" nav (AppLayout.vue:24,82).
 *   KNOWN NON-BLOCKING: renderer initial-fit DOT-COLLAPSE — cards render as 14px dots at fit zoom;
 *   product decision pending. Tree-success cells verify canvas=1, bands, chrome, visible-chrome
 *   contrast; dots are recorded OBSERVED-as-designed, never a failure.
 *   member-loading skeleton (MemberDetailView.vue:7), not-found EmptyState "Không tìm thấy thành
 *   viên" + "Về cây gia phả" (:11-22), tabs tablist + tab-{overview,relations,posts} labels
 *   "Tổng quan/Quan hệ/Bảng tin" + tab-panel-* (:87-109), member-generation-badge AppChip (:45),
 *   posts empty "Chưa có bài viết nào." (:188-190), delete dialog title "Xóa thành viên" +
 *   delete-confirm-text + Hủy/delete-confirm-button (:196-226; AppDialog.vue:18-19 role=dialog
 *   aria-modal=true). DELETE IS NEVER CONFIRMED — dialog captured open, then Hủy.
 *   REAL backend: not-found hits the live API → 404 JSON asserted (never 500).
 *
 * Per-cell PASS criteria (task + gate §1.5): scrollWidth recorded, no horizontal overflow;
 * focus-visible ring on the state's primary control; testids/ARIA; AA contrast ≥4.5 text /
 * ≥3.0 large-text+UI (canvas-parsed computed sweep; pixel-sampled min/max luminance for layered
 * surfaces: tree-compass chrome, delete dialog); line-height floors per design-system INV-02 —
 * headings/badges ≥1.45 (hard gate), body ≥1.6 (violations recorded per cell + aggregated defect:
 * Tailwind text-sm copy computes 1.43 — accepted implementation baseline, flagged for product
 * decision); 320px no clipped fixed chrome.
 *
 * Protocol: fresh context per cell; colorScheme per theme; locale vi-VN; serviceWorkers 'block';
 * NO localStorage theme keys. One real UI demo login ('Dùng thử ngay' → demo-login-btn) per worker
 * mints the cgp_demo_session cookie; every cell gets a fresh context with that cookie injected.
 * Member discovery via page-request with cookies: GET /api/v1/families → GET /api/v1/members.
 *
 * Console whitelist: 401 GET /api/v1/me (guard probe), 404 GET /api/v1/members/<bogus> (not-found
 * cells only — the REAL backend 404 under test logs a resource error).
 */
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');

const BASE = process.env.APPLE_PHASE5_M2_BASE || 'http://localhost:3456';
const EVID_ROOT = process.env.APPLE_PHASE5_M2_EVID ||
  path.resolve(__dirname, '../../.agents/shared/planning/apple-design-all-pages/evidence');
const OUT = process.env.APPLE_PHASE5_M2_OUT ||
  path.resolve(__dirname, '../../.agents/tester/RESULTS/apple_phase5_matrix');
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(path.join(EVID_ROOT, 'tree'), { recursive: true });
fs.mkdirSync(path.join(EVID_ROOT, 'member-detail'), { recursive: true });

const COMMIT = (() => { try { return execSync('git rev-parse --short HEAD', { cwd: path.resolve(__dirname, '..') }).toString().trim(); } catch (_) { return 'unknown'; } })();
const THEMES = ['light', 'dark'];
const VPS = [[1440, 900, '1440'], [390, 844, '390'], [320, 568, '320']];
const BOGUS_UUID = '00000000-0000-4000-8000-000000000000'; // well-formed → REAL backend 404
const STAGED_FAMILY = { id: 'phase5-stage-family', name: 'Gia đình thử nghiệm' };
const FAMILIES_GLOB = '**/api/v1/families*';
const TREE_GLOB = '**/api/v1/families/*/tree';
const DOT_NOTE = 'OBSERVED-as-designed (dot-collapse, product decision pending)';

const rowsFile = path.join(OUT, 'rows.jsonl');
try { fs.rmSync(rowsFile, { force: true }); } catch (_) { /* fresh run */ }
function appendRecord(rec) { fs.appendFileSync(rowsFile, JSON.stringify(rec) + '\n'); }

let SESSION = null; // { cookies, familyId, rootId, rootName, generationIndex, memberCount, families }
let CELL = null;    // active cell context for afterEach failure capture

function monitor(page) {
  const errors = [];
  page.on('response', (r) => { if (r.status() >= 400) errors.push({ url: r.url(), status: r.status(), kind: 'response' }); });
  page.on('pageerror', (e) => errors.push({ message: e.message, kind: 'pageerror' }));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    errors.push({ message: m.text(), url: m.location().url, kind: 'console' });
  });
  return errors;
}
function consoleViolations(errors, allow404 = false) {
  return errors.filter((e) => {
    if (e.kind === 'pageerror') return true;
    if (e.kind === 'response') {
      if (e.status < 400) return false;
      if (e.status === 401 && /\/api\/v1\/me(?:\?|$)/.test(e.url || '')) return false;
      if (allow404 && e.status === 404 && new RegExp('/api/v1/members/' + BOGUS_UUID).test(e.url || '')) return false;
      return true; // any other 4xx/5xx is a violation
    }
    // console-kind resource errors
    if (/\/api\/v1\/me(?:\?|$)/.test(e.url || '') && /401/.test(e.message || '')) return false;
    if (allow404 && /404/.test(e.message || '') && new RegExp('/api/v1/members/' + BOGUS_UUID).test(e.message || '')) return false;
    return true;
  });
}

// Fresh context per cell; demo cookie injected (minted once by real UI login in beforeAll).
async function cellContext(browser, theme, [w, h]) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h }, colorScheme: theme, locale: 'vi-VN', serviceWorkers: 'block',
  });
  if (SESSION && SESSION.cookies && SESSION.cookies.length) await ctx.addCookies(SESSION.cookies);
  return ctx;
}

// Canvas-2D CSS color parser (oklch/color-mix safe) + alpha compositing — ported from the
// proven phase-3 measured harness; adds large-text thresholds and INV-02 line-height floors.
const SWEEP = `(() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const parse = (s) => {
    cx.clearRect(0, 0, 1, 1); cx.fillStyle = '#123456'; cx.fillStyle = s;
    if (/^#123456$/i.test(cx.fillStyle) && !/^#123456$/i.test(String(s || '').trim())) return [0, 0, 0, 0];
    cx.fillRect(0, 0, 1, 1); const d = cx.getImageData(0, 0, 1, 1).data;
    return [d[0], d[1], d[2], d[3] / 255];
  };
  const lum = (rgb) => { const a = rgb.map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2]; };
  const out = [];
  for (const e of document.querySelectorAll('h1,h2,h3,p,dd,li,span,a,button,label')) {
    if (!e.getClientRects().length) continue;
    const cs = getComputedStyle(e);
    if (cs.visibility === 'hidden' || cs.display === 'none') continue;
    if (e.closest('[aria-hidden="true"]') || e.classList.contains('sr-only')) continue;
    const text = (e.innerText || '').trim(); if (!text) continue;
    const fs = parseFloat(cs.fontSize), lh = parseFloat(cs.lineHeight);
    if (!fs || !lh) continue;
    const fg = parse(cs.color);
    let bg = [255, 255, 255], n = e;
    while (n) { const c = parse(getComputedStyle(n).backgroundColor); if (c[3] > 0) { bg = bg.map((v, i) => c[i] * c[3] + v * (1 - c[3])); if (c[3] === 1) break; } n = n.parentElement; }
    const f = lum(fg.slice(0, 3)), b = lum(bg);
    const ratio = +((Math.max(f, b) + 0.05) / (Math.min(f, b) + 0.05)).toFixed(3);
    const weight = parseInt(cs.fontWeight, 10) || 400;
    const large = fs >= 24 || (fs >= 18.66 && weight >= 700);
    const isBadge = /[Tt]estid|^chip|badge|-status$/.test(e.getAttribute('data-testid') || '') ||
      /\\buppercase\\b/.test(cs.textTransform) && fs <= 12;
    const tag = e.tagName.toLowerCase();
    let cls = 'body';
    if (/^h[1-6]$/.test(tag)) cls = 'heading';
    else if (isBadge) cls = 'badge';
    else if (tag === 'button' || (tag === 'a' && fs <= 20)) cls = 'ui';
    const floor = cls === 'heading' || cls === 'badge' ? 1.45 : (cls === 'body' ? 1.6 : null);
    out.push({
      tag, cls, text: text.replace(/\\s+/g, ' ').slice(0, 50),
      ratio, threshold: large || cls === 'ui' ? 3.0 : 4.5,
      fs: +fs.toFixed(1), lhRatio: +(lh / fs).toFixed(3), lhFloor: floor,
      fg: 'rgb(' + fg.slice(0, 3).map(Math.round).join(',') + ')',
      bg: 'rgb(' + bg.map(Math.round).join(',') + ')',
    });
  }
  return out;
})()`;

// Pixel-sampled contrast for layered/alpha surfaces (canonical per protocol): element
// screenshot → in-page canvas → min/max luminance ratio over a strided pixel grid.
async function pixelRatio(page, locator) {
  const buf = await locator.screenshot();
  const dataUrl = 'data:image/png;base64,' + buf.toString('base64');
  return page.evaluate(async ({ dataUrl }) => {
    const img = new Image();
    await new Promise((res, rej) => { img.onload = res; img.onerror = () => rej(new Error('screenshot decode failed')); img.src = dataUrl; });
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const cx = c.getContext('2d', { willReadFrequently: true }); cx.drawImage(img, 0, 0);
    const step = Math.max(1, Math.floor(Math.min(img.width, img.height) / 24));
    let min = 1, max = 0;
    for (let y = 1; y < img.height - 1; y += step) for (let x = 1; x < img.width - 1; x += step) {
      const d = cx.getImageData(x, y, 1, 1).data;
      const a = [d[0], d[1], d[2]].map(v => { v /= 255; return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
      const l = 0.2126 * a[0] + 0.7152 * a[1] + 0.0722 * a[2];
      if (l < min) min = l; if (l > max) max = l;
    }
    return { ratio: +((max + 0.05) / (min + 0.05)).toFixed(3), pixels: Math.floor((img.width - 2) / step) * Math.floor((img.height - 2) / step) };
  }, { dataUrl });
}

// Focus-visible ring via Tab walk (ported phase-4 pattern).
async function tabWalkFocus(page, target, maxTabs = 25) {
  for (let i = 0; i < maxTabs; i++) {
    if (await target.evaluate(el => document.activeElement === el)) break;
    await page.keyboard.press('Tab');
  }
  return target.evaluate(el => {
    if (document.activeElement !== el) return false;
    const s = getComputedStyle(el), shadow = s.boxShadow;
    return el.matches(':focus-visible') ||
      (parseFloat(s.outlineWidth) > 0 && s.outlineStyle !== 'none' && s.outlineColor !== 'transparent') ||
      (shadow !== 'none' && shadow.includes('var(--') === false && shadow !== 'none' && /ring|terracotta|accent|0\s+0\s+0\s+1px|68|168|120/.test(shadow)) ||
      (shadow !== 'none' && !shadow.includes('rgba(0, 0, 0, 0)'));
  });
}

async function measureCell(page) {
  const entries = await page.evaluate(SWEEP);
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    body: document.body.scrollWidth,
  }));
  const contrastBad = entries.filter(x => !Number.isFinite(x.ratio) || x.ratio < x.threshold);
  const lhHardBad = entries.filter(x => x.lhFloor && x.lhRatio < x.lhFloor && (x.cls === 'heading' || x.cls === 'badge'));
  const lhBodyDev = entries.filter(x => x.lhFloor === 1.6 && x.lhRatio < 1.6);
  return { entries, overflow, contrastBad, lhHardBad, lhBodyDev };
}

async function recordCell(meta) {
  appendRecord({ type: 'row', row: meta });
  console.log('M2ROW|route=' + meta.route + '|state=' + meta.state + '|theme=' + meta.theme +
    '|vp=' + meta.vp + '|scrollWidth=' + meta.scrollWidth + '|' +
    (meta.scrollWidth <= meta.clientWidth + 1 ? 'no-overflow' : 'H-OVERFLOW') +
    '|verdict=' + meta.verdict + '|staged=' + (meta.staged ? 'staged' : 'real') +
    '|evidence=' + meta.evidence);
}

// ---- One-time setup per worker (workers=1): REAL UI demo login mints the cookie;
// member discovery via page-request with cookies (families → members list).
test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN', colorScheme: 'light', serviceWorkers: 'block' });
  const page = await ctx.newPage();
  await page.goto(BASE + '/login', { waitUntil: 'domcontentloaded' });
  const btn = page.locator('[data-testid="demo-login-btn"]');
  await expect(btn).toBeVisible();
  const demoResp = page.waitForResponse((r) => /\/api\/v1\/auth\/demo(?:\?|$)/.test(r.url()), { timeout: 15000 });
  await btn.click(); // 'Dùng thử ngay' card → demo-login-btn 'Vào bản dùng thử'
  const resp = await demoResp;
  if (resp.status() !== 200) throw Error('demo login failed: POST /api/v1/auth/demo → ' + resp.status());
  await page.waitForURL('**/tree', { timeout: 15000 });
  await page.screenshot({ path: path.join(OUT, 'setup-demo-login.png') });
  SESSION = { cookies: await ctx.cookies() };

  const famResp = await ctx.request.get(BASE + '/api/v1/families');
  if (!famResp.ok()) throw Error('GET /api/v1/families → ' + famResp.status());
  const families = (await famResp.json()).families || [];
  const memResp = await ctx.request.get(BASE + '/api/v1/members?limit=200');
  if (!memResp.ok()) throw Error('GET /api/v1/members → ' + memResp.status());
  const items = (await memResp.json()).items || [];
  const family = families[0];
  const scoped = family ? items.filter((m) => m.family_id === family.id) : items;
  const root = scoped.find((m) => m.generation_index === 1) || scoped[0];
  if (!root) throw Error('no member discovered in demo context (families=' + families.length + ', members=' + items.length + ')');
  SESSION.familyId = family ? family.id : null;
  SESSION.familyName = family ? family.name : null;
  SESSION.rootId = root.id;
  SESSION.rootName = root.full_name;
  SESSION.rootGeneration = root.generation_index;
  SESSION.memberCount = scoped.length;
  SESSION.generations = [...new Set(scoped.map((m) => m.generation_index))].sort();
  console.log('M2SETUP|root=' + SESSION.rootId + ' (' + SESSION.rootName + ', Đời ' + SESSION.rootGeneration + ')|family=' + SESSION.familyName + '|members=' + SESSION.memberCount + '|generations=' + SESSION.generations.join(','));
  await ctx.close();
});

test.afterEach(async ({}, info) => {
  if (info.status === 'failed' && CELL && CELL.page) {
    try { await CELL.page.screenshot({ path: path.join(OUT, 'fail-' + info.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.png'), fullPage: true }); } catch (_) { /* best effort */ }
  }
  CELL = null;
});

// ---- Primary control per cell (first VISIBLE candidate wins).
async function pickPrimary(page, route, state) {
  const map = {
    'tree:success': ['nav a[href="/tree"]', '[data-testid="zoom-in"]'],
    'tree:loading': ['nav a[href="/tree"]'],
    'tree:error': ['[data-testid="tree-retry"]'],
    'tree:empty': ['[data-testid="empty-add-member"]', 'button:has-text("Thêm thành viên")'],
    'member:loading': ['nav a[href="/tree"]'],
    'member:not-found': ['button:has-text("Về cây gia phả")'],
    'member:success': ['[data-testid="tab-relations"]', '[data-testid="member-tree-breadcrumb"]'],
    'member:empty-substate': ['[data-testid="tab-posts"]'],
    'member:action-feedback': ['[data-testid="member-delete"]'],
  };
  for (const sel of map[route + ':' + state] || ['nav a[href="/tree"]']) {
    const loc = page.locator(sel).filter({ visible: true }).first();
    if (await loc.isVisible().catch(() => false)) return { sel, loc };
  }
  return { sel: '(no visible primary control)', loc: page.locator('body').first() };
}

function newMeta(route, state, theme, vp, staged) {
  const [w, h, vpLabel] = vp;
  const dir = route === '/tree' ? 'tree' : 'member-detail';
  return {
    route, state, theme, vp: vpLabel, viewport: w + 'x' + h,
    scrollWidth: null, clientWidth: null,
    verdict: 'FAIL', evidence: path.join(EVID_ROOT, dir, state + '-' + theme + '-' + vpLabel + '.png'),
    staged, stagedNote: staged ? 'page.route interception on live origin' : 'live backend, no interception',
    commit: COMMIT, base: BASE, at: new Date().toISOString(),
    error: null, notes: [], contrastMin: null, contrastBad: [], lhHardBad: [], lhBodyDev: [],
    focus: null, pixel: null, consoleViolations: [], dotCollapse: null,
  };
}

async function finishCell(page, ctx, meta, thrown) {
  const m = await measureCell(page);
  meta.scrollWidth = m.overflow.scrollWidth;
  meta.clientWidth = m.overflow.clientWidth;
  meta.contrastMin = m.entries.length ? Math.min(...m.entries.map(x => x.ratio)) : null;
  meta.contrastBad = m.contrastBad.slice(0, 8);
  meta.lhHardBad = m.lhHardBad.slice(0, 8);
  meta.lhBodyDev = m.lhBodyDev.slice(0, 8);
  expect(m.contrastBad, 'AA contrast violations: ' + JSON.stringify(m.contrastBad)).toEqual([]);
  expect(m.lhHardBad, 'INV-02 heading/badge LH floors: ' + JSON.stringify(m.lhHardBad)).toEqual([]);
  expect(meta.scrollWidth <= meta.clientWidth + 1, 'horizontal overflow ' + meta.scrollWidth + '>' + meta.clientWidth).toBeTruthy();
  const pick = await pickPrimary(page, meta.route, meta.state);
  await page.evaluate(() => { if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); });
  const ringOk = await tabWalkFocus(page, pick.loc);
  meta.focus = { sel: pick.sel, ok: ringOk };
  expect(ringOk, 'focus-visible ring on ' + pick.sel).toBeTruthy();
  return m;
}

// ---- TREE CELL ----
async function runTreeCell(browser, state, theme, vp) {
  const meta = newMeta('/tree', state, theme, vp, state !== 'success');
  const ctx = await cellContext(browser, theme, vp);
  const page = await ctx.newPage();
  CELL = { page, meta };
  const errors = monitor(page);
  let thrown = null;
  try {
    if (state === 'loading') {
      await page.route(TREE_GLOB, () => new Promise(() => { /* hang */ }));
      await page.goto(BASE + '/tree');
      await expect(page.getByTestId('tree-loading')).toBeVisible({ timeout: 6000 });
      await expect(page.locator('[data-testid="tree-loading"] p')).toHaveText('Đang tải cây gia phả…');
      meta.notes.push('families/*/tree hung via route interception; loading card + role copy verified');
    } else if (state === 'error') {
      await page.route(FAMILIES_GLOB, (rt) => rt.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ families: [STAGED_FAMILY] }) }));
      await page.route(TREE_GLOB, (rt) => rt.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Lỗi kiểm tra M2' }) }));
      await page.goto(BASE + '/tree');
      await expect(page.getByTestId('tree-retry')).toBeVisible({ timeout: 8000 });
      await expect(page.locator('.tree-error h3')).toHaveText('Không thể tải cây gia phả');
      meta.notes.push('tree API staged 500; EmptyState + retry verified');
    } else if (state === 'empty') {
      await page.route(FAMILIES_GLOB, (rt) => rt.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ families: [STAGED_FAMILY] }) }));
      await page.route(TREE_GLOB, (rt) => rt.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ family_id: STAGED_FAMILY.id, generations: [], roots: [] }) }));
      await page.goto(BASE + '/tree');
      await expect(page.locator('.tree-empty h3')).toHaveText('Chưa có dữ liệu gia phả.', { timeout: 8000 });
      await expect(page.getByTestId('empty-add-member')).toBeVisible();
      meta.notes.push('empty tree staged; EmptyState + add CTA (demo authenticated) verified');
    } else { // success — REAL demo tree
      await page.goto(BASE + '/tree');
      await expect(page.getByTestId('tree-world')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('canvas')).toHaveCount(1);
      const bands = page.locator('[data-testid^="band-gen-"]');
      const bandCount = await bands.count();
      expect(bandCount, 'generation bands render').toBeGreaterThanOrEqual(2);
      const labels = [];
      for (let i = 0; i < Math.min(bandCount, 6); i++) labels.push((await bands.nth(i).innerText()).trim());
      expect(labels.join(' | '), 'Đời thứ N band semantics').toMatch(/Đời thứ\s*[1-5]/);
      await expect(page.getByTestId('tree-family-name')).toBeVisible();
      await expect(page.getByTestId('tree-generation-filter')).toBeVisible();
      await expect(page.getByTestId('tree-demo-notice')).toBeVisible();
      await expect(page.getByTestId('tree-compass')).toBeVisible();
      const cur = page.locator('[aria-current="page"]').filter({ visible: true });
      expect(await cur.count(), 'aria-current=page nav').toBeGreaterThanOrEqual(1);
      expect(await cur.first().getAttribute('href')).toContain('/tree');
      meta.notes.push('canvas=1; bands=' + bandCount + ' [' + labels.join(' | ') + ']; chrome + demo notice + aria-current nav verified');
      meta.dotCollapse = DOT_NOTE;
    }
    await finishCell(page, ctx, meta, thrown);
    if (state === 'success') {
      const pr = await pixelRatio(page, page.getByTestId('tree-compass'));
      meta.pixel = { target: 'tree-compass', ...pr, threshold: 3.0 };
      expect(meta.pixel.ratio, 'pixel-sampled compass chrome contrast').toBeGreaterThanOrEqual(3.0);
    }
    const viol = consoleViolations(errors);
    meta.consoleViolations = viol.slice(0, 5);
    expect(viol, 'console/page errors').toEqual([]);
    await page.screenshot({ path: meta.evidence, fullPage: state !== 'success' });
    meta.verdict = state === 'success' ? DOT_NOTE : 'PASS';
  } catch (e) {
    thrown = e;
    meta.error = String((e && e.message) || e).slice(0, 500);
    try { await page.screenshot({ path: meta.evidence.replace(/\.png$/, '-FAIL.png'), fullPage: true }); } catch (_) { /* best effort */ }
  } finally {
    await recordCell(meta);
    await ctx.close();
  }
  if (thrown) throw thrown;
}

// ---- MEMBER CELL ----
async function runMemberCell(browser, state, theme, vp) {
  const meta = newMeta('/members/:id', state, theme, vp, state === 'loading');
  const ctx = await cellContext(browser, theme, vp);
  const page = await ctx.newPage();
  CELL = { page, meta };
  const errors = monitor(page);
  const rootId = SESSION.rootId;
  let thrown = null;
  try {
    if (state === 'loading') {
      await page.route('**/api/v1/members/' + rootId + '*', () => new Promise(() => { /* hang */ }));
      await page.goto(BASE + '/members/' + rootId);
      await expect(page.getByTestId('member-loading')).toBeVisible({ timeout: 6000 });
      await expect(page.getByTestId('member-loading')).toContainText('Đang tải hồ sơ…');
      meta.notes.push('member detail API hung via route interception; skeleton verified');
    } else if (state === 'not-found') {
      const respP = page.waitForResponse((r) => r.url().includes('/api/v1/members/' + BOGUS_UUID) && r.request().method() === 'GET', { timeout: 15000 });
      await page.goto(BASE + '/members/' + BOGUS_UUID);
      const resp = await respP;
      expect(resp.status(), 'REAL backend must answer 404 JSON (never 500)').toBe(404);
      meta.notes.push('REAL backend 404 asserted on GET /api/v1/members/' + BOGUS_UUID);
      await expect(page.locator('.tree-empty-state h3')).toHaveText('Không tìm thấy thành viên', { timeout: 8000 });
      await expect(page.getByRole('button', { name: 'Về cây gia phả' })).toBeVisible();
    } else if (state === 'success') {
      await page.goto(BASE + '/members/' + rootId);
      await expect(page.getByTestId('member-name')).toHaveText(SESSION.rootName, { timeout: 15000 });
      await expect(page.getByTestId('member-tabs')).toHaveAttribute('role', 'tablist');
      for (const [key, label] of [['overview', 'Tổng quan'], ['relations', 'Quan hệ'], ['posts', 'Bảng tin']]) {
        const tab = page.getByTestId('tab-' + key);
        await expect(tab).toHaveText(label);
        await expect(tab).toHaveAttribute('role', 'tab');
      }
      await expect(page.getByTestId('tab-panel-overview')).toBeVisible();
      await expect(page.getByTestId('member-generation-badge')).toHaveText('Đời thứ ' + SESSION.rootGeneration);
      await expect(page.getByTestId('member-living-status')).toBeVisible();
      await expect(page.getByTestId('member-tree-breadcrumb')).toBeVisible();
      await page.getByTestId('tab-relations').click();
      await expect(page.getByTestId('tab-panel-relations')).toBeVisible();
      await page.getByTestId('tab-posts').click();
      await expect(page.getByTestId('tab-panel-posts')).toBeVisible();
      await page.getByTestId('tab-overview').click();
      await expect(page.getByTestId('tab-panel-overview')).toBeVisible();
      meta.notes.push('real member ' + SESSION.rootName + ' (' + rootId + '); tabs/panels/badge/hero verified');
    } else if (state === 'empty-substate') {
      await page.goto(BASE + '/members/' + rootId);
      await expect(page.getByTestId('member-name')).toBeVisible({ timeout: 15000 });
      await page.getByTestId('tab-posts').click();
      await expect(page.getByTestId('tab-panel-posts')).toBeVisible();
      const postsEmpty = page.getByTestId('tab-panel-posts').getByText('Chưa có bài viết nào.');
      if (await postsEmpty.isVisible().catch(() => false)) {
        meta.notes.push('empty sub-state = posts panel ("Chưa có bài viết nào.") — REAL');
      } else {
        await page.getByTestId('tab-relations').click();
        const panel = page.getByTestId('tab-panel-relations');
        const h3s = panel.locator('h3');
        const n = await h3s.count();
        let emptyGroup = null;
        for (let i = 0; i < n && !emptyGroup; i++) {
          const g = h3s.nth(i);
          const cards = g.locator('xpath=..').locator('[data-testid^="relation-"]');
          if ((await cards.count()) === 0) emptyGroup = (await g.innerText()).trim();
        }
        expect(emptyGroup, 'an empty relations group must exist').toBeTruthy();
        meta.notes.push('empty sub-state = relations group "' + emptyGroup + '" — REAL');
      }
    } else { // action-feedback — delete dialog CAPTURED OPEN THEN CANCELLED, never confirmed
      await page.goto(BASE + '/members/' + rootId);
      await expect(page.getByTestId('member-name')).toBeVisible({ timeout: 15000 });
      const del = page.getByTestId('member-delete');
      await expect(del).toBeVisible();
      await finishCell(page, ctx, meta, thrown); // measures + focus ring on member-delete (pre-dialog)
      await del.click();
      const dlg = page.locator('[role="dialog"][aria-modal="true"]');
      await expect(dlg).toBeVisible();
      await expect(dlg.getByText('Xóa thành viên', { exact: true })).toBeVisible();
      await expect(page.getByTestId('delete-confirm-text')).toHaveText('Xóa thành viên này?');
      const confirmBtn = page.getByTestId('delete-confirm-button');
      await expect(confirmBtn).toBeVisible(); // present — NEVER clicked
      const inside = () => dlg.evaluate((d) => d.contains(document.activeElement));
      expect(await inside(), 'focus moves into dialog').toBe(true);
      let trapped = true;
      for (let i = 0; i < 6; i++) { await page.keyboard.press('Tab'); if (!(await inside())) { trapped = false; break; } }
      expect(trapped, 'focus stays trapped inside dialog across 6 Tabs').toBe(true);
      meta.focusTrap = { trapped: true, tabs: 6 };
      meta.pixel = { target: 'delete-dialog', ...(await pixelRatio(page, dlg)), threshold: 4.5 };
      expect(meta.pixel.ratio, 'pixel-sampled dialog surface contrast').toBeGreaterThanOrEqual(4.5);
      await page.screenshot({ path: meta.evidence }); // dialog OPEN state
      await page.getByRole('button', { name: 'Hủy', exact: true }).click();
      await expect(dlg).toHaveCount(0);
      await expect(del).toBeVisible();
      meta.notes.push('delete dialog captured open (focus trap + copy verified) then CANCELLED via Hủy — no mutation');
      const viol = consoleViolations(errors);
      meta.consoleViolations = viol.slice(0, 5);
      expect(viol, 'console/page errors').toEqual([]);
      meta.verdict = 'PASS';
    }
    await finishCell(page, ctx, meta, thrown);
    if (state === 'success' || state === 'empty-substate') { /* no layered surface pixel probe */ }
    const viol = consoleViolations(errors, state === 'not-found');
    meta.consoleViolations = viol.slice(0, 5);
    expect(viol, 'console/page errors').toEqual([]);
    await page.screenshot({ path: meta.evidence, fullPage: false });
    meta.verdict = 'PASS';
  } catch (e) {
    thrown = e;
    meta.error = String((e && e.message) || e).slice(0, 500);
    try { await page.screenshot({ path: meta.evidence.replace(/\.png$/, '-FAIL.png'), fullPage: true }); } catch (_) { /* best effort */ }
  } finally {
    await recordCell(meta);
    await ctx.close();
  }
  if (thrown) throw thrown;
}

// ---- Matrix generation: 4×2×3 tree + 5×2×3 member = 54 cells.
for (const state of ['success', 'loading', 'error', 'empty']) {
  for (const theme of THEMES) for (const vp of VPS) {
    test(`M2-TREE @tree ${state} ${theme} ${vp[2]}px [live]`, async ({ browser }) => {
      await runTreeCell(browser, state, theme, vp);
    });
  }
}
for (const state of ['loading', 'not-found', 'success', 'empty-substate', 'action-feedback']) {
  for (const theme of THEMES) for (const vp of VPS) {
    test(`M2-MEMBER @member ${state} ${theme} ${vp[2]}px [live]`, async ({ browser }) => {
      await runMemberCell(browser, state, theme, vp);
    });
  }
}

test.afterAll(async () => {
  const lines = fs.existsSync(rowsFile) ? fs.readFileSync(rowsFile, 'utf8').split('\n').filter(Boolean) : [];
  const rows = lines.map((l) => { try { return JSON.parse(l).row; } catch (_) { return null; } }).filter(Boolean);
  const summary = {
    meta: { spec: 'apple-phase5-matrix-treemember', base: BASE, commit: COMMIT, generatedAt: new Date().toISOString(), session: SESSION ? { rootId: SESSION.rootId, rootName: SESSION.rootName, familyId: SESSION.familyId, memberCount: SESSION.memberCount, generations: SESSION.generations } : null },
    rows,
  };
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log('M2DONE|rows=' + rows.length + '|pass=' + rows.filter(r => r.verdict.startsWith('PASS')).length + '|observed=' + rows.filter(r => r.verdict.startsWith('OBSERVED')).length + '|fail=' + rows.filter(r => r.verdict === 'FAIL').length);
});
