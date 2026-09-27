/* Independent Phase 3 verification — Feed (Bảng tin dòng họ). Authoring convention:
 * expectations anchored in SOURCE (file:line), mockups are visual reference only.
 *
 * expectation → source anchor
 * --------------------------------------------------------------------------
 * route /feed → web/src/router/index.ts (feed view); view = FeedView.vue
 * eyebrow 'Chuyện nhà' / h1 'Bảng tin dòng họ' → web/src/views/FeedView.vue:10,15
 * family selector (families.length>1, label 'Dòng họ', aria 'Chọn dòng họ',
 *   change → reset+refetch) → FeedView.vue:22-31,311-315; native <select> →
 *   components/ui/AppSelect.vue:8-29; public unfiltered list →
 *   api/internal/handler/tree_handler.go:73-83 (GET /families router.go:78)
 * notification toggle (3 exclusive branches) → components/notifications/
 *   NotificationToggle.vue:3,9,21 (role=switch :18)
 * PWA install banner staged via 'beforeinstallprompt' → InstallPrompt.vue:61-65,
 *   :96-102; banner copy/buttons :18,:28,:37,:40; dismiss persists in
 *   sessionStorage 'cgp.installPrompt.dismissed' → :56,:87-93
 * composer (authed only) → FeedView.vue:37-43; maxlength=MAX_CONTENT_RUNES :51;
 *   counter runeCount/5000 :108-115; runeCount=[...content].length :267;
 *   MAX_CONTENT_RUNES=5000 :265 ← api/internal/feed/service.go:21
 *   MaxContentRunes=5000 (rune-counted; UTF-16 maxlength caps BMP input at the
 *   same 5000) — client/backend parity as briefed
 * over-limit counter pins legacy class 'text-red-600' remapped to
 *   var(--danger-fg) for AA → FeedView.vue:111,360-370; canSubmit
 *   (trim>0 && !overLimit && !posting) → :274-276; submit 'Đăng bài' :117-122
 * image URL chips (no upload endpoint — JSONB URL array) → FeedView.vue:56-101;
 *   add via button :70-75 or Enter :67; dedupe :329-331; remove aria
 *   'Xóa ảnh N' :92-99; UI caps at 9 queued (>=9 no-op :328) vs backend
 *   MaxImages=10 (service.go:23) — client stricter, NOT a contract breach, noted
 * anonymous hint + login CTA (reads public, writes authed) → FeedView.vue:127-142
 * skeleton 3 cards role=status 'Đang tải bài viết…' → FeedView.vue:155-179
 * error card role=alert + 'Thử lại' retry → FeedView.vue:182-190,317-323
 * empty state → FeedView.vue:193-198; list + pagination → :200-224;
 *   'Tải thêm bài viết' :221; nextCursor gating :214; FEED_PAGE_SIZE=20 →
 *   stores/feed.ts:7 (cursor params :49-52) ↔ service.go:27 DefaultPageSize=20
 * submit flow → FeedView.vue:339-357 (success toast :348, clear :349-351,
 *   error toast :352-353); create POST /families/:id/feed → router.go:116
 *
 * ⚑ LIVE-VERDICT DISAGREEMENT (brief vs source, resolved to source):
 *   The brief expected a REAL demo feed submit to yield 403. Probed live
 *   backend 127.0.0.1:3456 (2026-09-27T21:14Z, demo session via
 *   POST /api/v1/auth/demo): POST /api/v1/families/<seed-family-1>/feed with
 *   demo cookie → **201 Created**, author_member_id null (probe row deleted).
 *   There is NO demo write-guard on the feed route: the protected group only
 *   requires JWT (router.go:116) and FeedHandler.Create resolves the optional
 *   author member (feed_handler.go:104-127). The demo-isolation 403s live on
 *   the BINDING/provider routes only (auth/service.go:278,403;
 *   auth/resolver.go:102,123 → 403 DEMO_ISOLATION_VIOLATION,
 *   handler/errors.go:32-33, model/api.go:27). This spec therefore asserts:
 *   (a) the REAL 403-FIRST binding guard — POST /api/v1/me/member as demo with
 *   a well-formed but NONEXISTENT member_id still returns 403
 *   DEMO_ISOLATION_VIOLATION, proving rule 1 fires before the member-existence
 *   check (auth/service.go:381-404 comment "Fires before anything else",
 *   handler route router.go:99, body key auth_handler.go:242); and
 *   (b) the REAL 201 feed submit with success toast + cleared composer.
 *
 * Harness (ported proven patterns):
 *   - Contrast sweep is ALPHA-COMPOSITED and parses CSS colors via CANVAS 2D
 *     roundtrip (ctx.fillStyle → getImageData) — Tailwind v4 computes to
 *     oklch(...)/color-mix(...); string/regex parsing of color functions
 *     silently mis-parses into bogus ratio≈1 (verified lesson,
 *     apple-phase3-content.spec.cjs:309-338 / apple-phase3-memberdetail
 *     :60-77). ::placeholder color measured for empty inputs/textareas;
 *     sr-only and <2×2px elements skipped.
 *   - Evidence is worker-durable: rows append to rows.jsonl, cleanup runs only
 *     in worker 0, summary.json rebuilt from disk (Playwright 1.63 may reload
 *     the spec module in a second worker mid-run — verified lesson).
 *   - Console whitelist records url+status; 401 GET /api/v1/me (anonymous
 *     fetchMe probe) always allowed; staged-500 rows allow the resource-load
 *     error for the staged feed 500 only.
 *   - REAL demo login: POST /api/v1/auth/demo via the login page
 *     (data-testid demo-login-btn) works from this isolated origin because the
 *     pack proxy rewrites Origin → http://localhost:3456 for the CSRF
 *     Origin-first middleware (handler/middleware.go:125-170,
 *     config/config.go:176).
 *
 * Environment:
 *   APPLE_PHASE3_FEED_BASE       isolated origin http://127.0.0.1:1xxxx serving
 *                                web/dist with /api/* proxied to 127.0.0.1:3456
 *   APPLE_PHASE3_FEED_ARTIFACTS  artifacts dir (rows.jsonl, summary.json, PNGs)
 *   NEVER touches 127.0.0.1:5432 (ensemble's own Postgres).
 *
 * Matrix: primary list + authed composer at {1440×900, 390×844, 320×568} ×
 * {light,dark} in-test; skeleton/error/empty/banner at {1440,390} × both
 * themes. The REAL-demo proof runs once at 1440 light (it mutates the shared
 * dev backend by design — one demo post). No sleep > 1s (staged delay 900ms).
 */
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const MIN_AA = 4.5;
const THEMES = ['light', 'dark'];
const SIZES = [[1440, 900], [390, 844], [320, 568]];
const STATE_SIZES = [[1440, 900], [390, 844]];
const FEED_PAGE = 20; // stores/feed.ts:7 FEED_PAGE_SIZE ↔ service.go:27 DefaultPageSize
const MAX_RUNES = 5000; // FeedView.vue:265 ↔ service.go:21 MaxContentRunes
const SKELETON_DELAY_MS = 900;
const FAMILY1 = '11111111-1111-4111-8111-000000000001'; // seed family 1 'Gia phả họ Nguyễn Văn' (live-verified)
const FAMILY2 = '22222222-2222-4222-8222-000000000002'; // seed family 2 'Gia phả họ Trần Thị'
const BOGUS_MEMBER = '00000000-0000-4000-8000-000000000000'; // well-formed, nonexistent → 403-first proof

const base = process.env.APPLE_PHASE3_FEED_BASE;
if (!base || !/^http:\/\/127\.0\.0\.1:1[0-9]{4}$/.test(base)) {
  throw Error('APPLE_PHASE3_FEED_BASE required (isolated origin http://127.0.0.1:1xxxx)');
}
const out = process.env.APPLE_PHASE3_FEED_ARTIFACTS ||
  path.resolve(__dirname, '../../.agents/tester/RESULTS/apple_phase3_feed_browser');
fs.mkdirSync(out, { recursive: true });

// ---- Worker-durable evidence (Playwright 1.63 second-worker reload safe) ----
const rowsFile = path.join(out, 'rows.jsonl');
if (process.env.TEST_WORKER_INDEX === '0') {
  try {
    for (const f of fs.readdirSync(out)) {
      if (f === 'test-results') continue;
      fs.rmSync(path.join(out, f), { recursive: true, force: true });
    }
  } catch (_) { /* first run / already clean */ }
}
function appendRecord(rec) { fs.appendFileSync(rowsFile, JSON.stringify(rec) + '\n'); }
function readRecords() {
  if (!fs.existsSync(rowsFile)) return [];
  const recs = [];
  for (const line of fs.readFileSync(rowsFile, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { recs.push(JSON.parse(t)); } catch (_) { /* torn tail line */ }
  }
  return recs;
}
function writeSummary() {
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ cases: readRecords() }, null, 2));
}

// ---- Alpha-composited contrast sweep, canvas-parsed (Tailwind v4 oklch/color-mix safe).
const SWEEP = `(() => {
  const cv = document.createElement('canvas'); cv.width = cv.height = 1;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  const parse = (s) => {
    cx.clearRect(0, 0, 1, 1);
    cx.fillStyle = '#123456'; // sentinel: detects rejected assignments
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
    if (e.classList.contains('sr-only')) continue; // not visually rendered
    const rect = e.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) continue; // clipped/not visibly rendered
    let text = '', fg = parse(cs.color), kind = 'text';
    if (e.tagName === 'INPUT' || e.tagName === 'TEXTAREA') {
      text = e.value || e.getAttribute('placeholder') || '';
      if (!e.value && e.getAttribute('placeholder')) { fg = parse(getComputedStyle(e, '::placeholder').color); kind = 'placeholder'; }
    } else text = (e.innerText || '').trim();
    if (!text.trim()) continue;
    let bg = [255, 255, 255], n = e, opaque = false;
    while (n) { const c = parse(getComputedStyle(n).backgroundColor); if (c[3] > 0) { bg = bg.map((v, i) => c[i] * c[3] + v * (1 - c[3])); if (c[3] === 1) { opaque = true; break; } } n = n.parentElement; }
    const f = lum(fg.slice(0, 3)), b = lum(bg);
    out.push({ tag: e.tagName.toLowerCase(), kind, text: text.trim().replace(/\\s+/g, ' ').slice(0, 60), ratio: +((Math.max(f, b) + 0.05) / (Math.min(f, b) + 0.05)).toFixed(3), fg: 'rgb(' + fg.slice(0, 3).map(Math.round).join(', ') + ')', bg: 'rgb(' + bg.map(Math.round).join(', ') + ')', opaqueBg: opaque });
  }
  return out; })()`;

// ---- Per-row gates: contrast ≥ 4.5, no horizontal overflow, first-Tab :focus-visible.
async function gates(page) {
  const entries = await page.evaluate(SWEEP);
  const overflow = await page.evaluate(() => ({
    html: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    body: document.body.scrollWidth - document.body.clientWidth,
  }));
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press('Tab');
  await page.waitForTimeout(250); // AppButton animates box-shadow 140ms — let it settle
  const focus = await page.locator(':focus-visible').first().evaluate((e) => {
    const s = getComputedStyle(e);
    return { tag: e.tagName, outline: s.outlineStyle, shadow: s.boxShadow,
      indicated: s.outlineStyle !== 'none' || s.boxShadow !== 'none' };
  }).catch(() => ({ tag: null, outline: null, shadow: null, indicated: false }));
  const bad = entries.filter((x) => !Number.isFinite(x.ratio) || x.ratio < MIN_AA);
  return { entries, bad, overflow, focus };
}

async function assertGates(page, state, w, h, theme) {
  const g = await gates(page);
  expect(g.bad, `${state} ${w}px ${theme}: contrast < ${MIN_AA}`).toEqual([]);
  expect(g.overflow.html, `${state} ${w}px ${theme}: html overflow`).toBeLessThanOrEqual(0);
  expect(g.overflow.body, `${state} ${w}px ${theme}: body overflow`).toBeLessThanOrEqual(0);
  expect(g.focus.indicated, `${state} ${w}px ${theme}: first-Tab focus-visible`).toBeTruthy();
  (current.visual ||= []).push({
    state, width: w, height: h, theme,
    lowest: g.entries.slice().sort((a, b) => a.ratio - b.ratio).slice(0, 3),
    overflow: g.overflow, focus: g.focus.tag,
  });
  return g;
}

// ---- Console capture with url+status attribution (phase2 convention) ----
function attachLogging(page, bucket) {
  const responses = [];
  page.on('response', (r) => responses.push({ url: r.url(), status: r.status() }));
  page.on('pageerror', (e) => bucket.errors.push({ message: e.message, url: null, status: null }));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const loc = m.location().url || null;
    const match = responses.find((r) => r.url === loc) || responses.find((r) => m.text().includes(r.url));
    bucket.errors.push({ message: m.text(), url: (match && match.url) || loc, status: match ? match.status : null });
  });
}
const isWhitelisted = (e, allowed = []) =>
  (e.status === 401 && /\/api\/v1\/me(?:\?|$)/.test(e.url || '')) ||
  allowed.some((a) => e.status === a.status && a.urlRe.test(e.url || ''));

// ---- Staged feed data (FeedPostItem shape — web/src/types/api.ts:197-209) ----
function mkPost(n, familyId, tag) {
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    family_id: familyId,
    author_member_id: null,
    author_display_name: `E2E Tác giả ${n}`,
    content: `${tag} bài đăng e2e số ${n} — nội dung staging cho ma trận gates`,
    images: [],
    created_at: new Date(Date.UTC(2026, 8, 20, 0, 0, 0) + n * 3600 * 1000).toISOString(),
  };
}
function feedBody(count, familyId, tag, offset = 0, withCursor = false) {
  const posts = Array.from({ length: count }, (_, k) => mkPost(offset + count - k, familyId, tag)); // newest first
  const oldest = posts[posts.length - 1];
  return { posts, next_cursor: withCursor ? { created_at: oldest.created_at, id: oldest.id } : null };
}
const fulfillFeed = (route, body) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });

// ---- Staged '**/api/**' route: anon /me probe 401; feed per-mode; rest real passthrough.
function makeApiRoute(staged) {
  return async (route) => {
    const u = new URL(route.request().url());
    const p = u.pathname;
    if (staged.anon && p === '/api/v1/me') {
      return route.fulfill({ status: 401, contentType: 'application/json', body: '{"code":"UNAUTHENTICATED"}' });
    }
    const m = p.match(/^\/api\/v1\/families\/([0-9a-f-]{36})\/feed$/);
    if (!m) return route.continue();
    const familyId = m[1];
    if (familyId !== FAMILY1 && familyId !== FAMILY2) return route.continue();
    staged.hits.push(p + u.search);
    if (staged.mode === 'error' && !staged.failed) {
      staged.failed = true;
      return route.fulfill({ status: 500, contentType: 'application/json',
        body: JSON.stringify({ success: false, code: 'INTERNAL', message: 'Lỗi máy chủ' }) });
    }
    if (staged.mode === 'delay') await new Promise((r) => setTimeout(r, SKELETON_DELAY_MS));
    if (staged.mode === 'empty') return fulfillFeed(route, { posts: [], next_cursor: null });
    if (staged.mode === 'paginate' && familyId === FAMILY1) {
      if (u.searchParams.has('cursor_created_at')) return fulfillFeed(route, feedBody(5, familyId, 'F1', 20, false));
      return fulfillFeed(route, feedBody(FEED_PAGE, familyId, 'F1', 0, true));
    }
    const count = familyId === FAMILY2 ? 2 : FEED_PAGE;
    return fulfillFeed(route, feedBody(count, familyId, familyId === FAMILY2 ? 'F2' : 'F1', 0, familyId === FAMILY1));
  };
}
async function anonFeedCtx(browser, { w, h, theme, mode = 'list' }) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'vi-VN', colorScheme: theme });
  const staged = { anon: true, mode, failed: false, hits: [], tag: 'F1' };
  await ctx.route('**/api/**', makeApiRoute(staged));
  return { ctx, staged };
}
async function stageAuthedFeed(ctx, mode = 'list') {
  const staged = { anon: false, mode, failed: false, hits: [], tag: 'F1' };
  await ctx.route('**/api/**', makeApiRoute(staged));
  return staged;
}

// ---- REAL demo login (precedent apple-phase3-memberdetail:188-220) ----
async function demoLogin(browser, w = 1440, h = 900, theme = 'light') {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'vi-VN', colorScheme: theme });
  const page = await ctx.newPage();
  await page.goto(base + '/login', { waitUntil: 'domcontentloaded' });
  const btn = page.locator('[data-testid="demo-login-btn"]');
  await expect(btn).toBeVisible();
  const demoResp = page.waitForResponse((r) => /\/api\/v1\/auth\/demo(?:\?|$)/.test(r.url()), { timeout: 15000 });
  await btn.click();
  const resp = await demoResp;
  if (resp.status() !== 200) {
    throw Error('demo login failed: POST /api/v1/auth/demo → ' + resp.status() +
      ' (check the pack proxy rewrote Origin to http://localhost:3456 for the CSRF allowlist)');
  }
  await page.waitForURL('**/tree', { timeout: 15000 });
  return { ctx, page };
}

let current = { proof: {} };
test.beforeEach(() => { current = { proof: {} }; });
test.afterEach(async ({}, info) => {
  const errors = Array.isArray(current.errors) ? current.errors : [];
  const allowed = current.allowedConsole || [];
  const rec = {
    title: info.title, status: info.status, expectedStatus: info.expectedStatus,
    allowedConsole: allowed.map((a) => ({ status: a.status, url: String(a.urlRe) })),
    errors,
    whitelisted: errors.filter((e) => isWhitelisted(e, allowed)),
    nonWhitelisted: errors.filter((e) => !isWhitelisted(e, allowed)),
    visual: current.visual || [],
    proof: current.proof || {},
  };
  appendRecord(rec);
  writeSummary();
  if (info.status !== 'passed' && current.p) {
    try {
      await current.p.screenshot({ path: path.join(out, 'fail-' + info.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.png'), fullPage: true });
    } catch (_) { /* page already closed */ }
  }
  current = {};
});

test('anonymous feed list passes gates across viewports and themes (staged 20-post list)', async ({ browser }) => {
  for (const [w, h] of SIZES) for (const theme of THEMES) {
    const { ctx, staged } = await anonFeedCtx(browser, { w, h, theme, mode: 'list' });
    const page = await ctx.newPage();
    current.p = page; current.errors = []; attachLogging(page, current);
    await page.goto(base + '/feed', { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { name: 'Bảng tin dòng họ' })).toBeVisible(); // FeedView.vue:15
    await expect(page.getByText('Chuyện nhà')).toBeVisible(); // :10
    await expect(page.locator('[data-testid="composer-form"]')).toHaveCount(0); // authed-only :38
    await expect(page.locator('[data-testid="anonymous-hint"]')).toBeVisible(); // :131
    await expect(page.locator('[data-testid="login-cta"]')).toHaveAttribute('href', /\/login/); // :139
    await expect(page.locator('[data-testid="feed-list"] [data-testid="post-author"]')).toHaveCount(FEED_PAGE);
    await expect(page.locator('[data-testid="load-more"]')).toHaveText('Tải thêm bài viết'); // :214-222
    await expect(page.getByLabel('Chọn dòng họ')).toBeVisible(); // AppSelect aria-label FeedView.vue:27
    const toggleBranch = page.locator('[data-testid="notification-toggle"], [data-testid="notification-unconfigured"], [data-testid="notification-toggle-unsupported"]').first();
    await expect(toggleBranch).toBeAttached(); // NotificationToggle.vue:3,9,21
    await assertGates(page, 'anon-list', w, h, theme);
    expect(current.errors.filter((e) => !isWhitelisted(e, current.allowedConsole))).toEqual([]);
    current.proof['anon-' + w + '-' + theme] = { feedRequests: staged.hits.length, cards: FEED_PAGE };
    await ctx.close();
  }
});

test('authed composer passes gates across viewports and themes (real demo login + staged list)', async ({ browser }) => {
  for (const [w, h] of SIZES) for (const theme of THEMES) {
    const { ctx, page } = await demoLogin(browser, w, h, theme);
    await stageAuthedFeed(ctx, 'list');
    current.p = page; current.errors = []; attachLogging(page, current);
    await page.goto(base + '/feed', { waitUntil: 'domcontentloaded' });
    const form = page.locator('[data-testid="composer-form"]');
    await expect(form).toBeVisible(); // FeedView.vue:40
    await expect(form.locator('textarea')).toHaveAttribute('maxlength', String(MAX_RUNES)); // :51
    await expect(page.locator('[data-testid="composer-char-counter"]')).toHaveText('0/' + MAX_RUNES); // :108-115
    await expect(form.locator('button[type="submit"]')).toBeDisabled(); // canSubmit false on empty :274-276, AppButton native disabled
    await expect(page.getByText('Bài viết hiển thị cho cả gia đình')).toBeVisible(); // :105
    await expect(page.locator('[data-testid="feed-list"] [data-testid="post-author"]')).toHaveCount(FEED_PAGE);
    await expect(page.locator('[data-testid="load-more"]')).toBeVisible();
    const toggle = page.locator('[data-testid="notification-toggle"]');
    if (await toggle.count()) await expect(toggle).toHaveAttribute('role', 'switch'); // NotificationToggle.vue:18
    await assertGates(page, 'authed-composer', w, h, theme);
    expect(current.errors.filter((e) => !isWhitelisted(e, current.allowedConsole))).toEqual([]);
    await ctx.close();
  }
});

test('staged slow feed shows the 3-card skeleton before the list', async ({ browser }) => {
  for (const [w, h] of STATE_SIZES) for (const theme of THEMES) {
    const { ctx } = await anonFeedCtx(browser, { w, h, theme, mode: 'delay' });
    const page = await ctx.newPage();
    current.p = page; current.errors = []; attachLogging(page, current);
    await page.goto(base + '/feed', { waitUntil: 'domcontentloaded' });
    const loading = page.locator('[data-testid="feed-loading"]');
    await expect(loading).toBeVisible(); // FeedView.vue:155-159
    await expect(loading).toHaveAttribute('role', 'status');
    await expect(loading.locator('.animate-pulse')).toHaveCount(3); // v-for n in 3 :162
    await expect(loading.getByText('Đang tải bài viết…')).toBeVisible(); // :178
    await expect(page.locator('[data-testid="feed-list"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="feed-list"]')).toBeVisible({ timeout: 8000 }); // after 900ms staged delay
    await expect(loading).toHaveCount(0);
    await assertGates(page, 'skeleton-recovered', w, h, theme);
    expect(current.errors.filter((e) => !isWhitelisted(e, current.allowedConsole))).toEqual([]);
    current.proof['skeleton-' + w + '-' + theme] = { cards: 3, delayMs: SKELETON_DELAY_MS };
    await ctx.close();
  }
});

test('staged feed failure shows the error card and Thử lại recovers', async ({ browser }) => {
  for (const [w, h] of STATE_SIZES) for (const theme of THEMES) {
    const { ctx } = await anonFeedCtx(browser, { w, h, theme, mode: 'error' });
    current.allowedConsole = [{ status: 500, urlRe: /\/api\/v1\/families\/[0-9a-f-]+\/feed/ }];
    const page = await ctx.newPage();
    current.p = page; current.errors = []; attachLogging(page, current);
    await page.goto(base + '/feed', { waitUntil: 'domcontentloaded' });
    const err = page.locator('[data-testid="feed-error"]');
    await expect(err).toBeVisible(); // FeedView.vue:182-190
    await expect(err).toHaveAttribute('role', 'alert');
    await expect(err.getByText('Lỗi máy chủ')).toBeVisible(); // staged message via formatApiError
    const retry = err.getByRole('button', { name: 'Thử lại' }); // :189
    await expect(retry).toBeVisible();
    await expect(page.locator('[data-testid="feed-list"]')).toHaveCount(0);
    await retry.click(); // retryFetch :317-323 — second hit succeeds (staged flip)
    await expect(page.locator('[data-testid="feed-list"] [data-testid="post-author"]')).toHaveCount(FEED_PAGE);
    await expect(err).toHaveCount(0);
    await assertGates(page, 'error-recovered', w, h, theme);
    const nonWl = current.errors.filter((e) => !isWhitelisted(e, current.allowedConsole));
    expect(nonWl).toEqual([]);
    current.proof['error-' + w + '-' + theme] = { whitelisted: current.errors.filter((e) => isWhitelisted(e, current.allowedConsole)).length };
    await ctx.close();
  }
});

test('staged empty feed shows the empty state', async ({ browser }) => {
  for (const [w, h] of STATE_SIZES) for (const theme of THEMES) {
    const { ctx } = await anonFeedCtx(browser, { w, h, theme, mode: 'empty' });
    const page = await ctx.newPage();
    current.p = page; current.errors = []; attachLogging(page, current);
    await page.goto(base + '/feed', { waitUntil: 'domcontentloaded' });
    const empty = page.locator('[data-testid="feed-empty"]');
    await expect(empty).toBeVisible(); // FeedView.vue:193-198
    await expect(empty.getByText('Chưa có bài viết nào. Hãy chia sẻ bài viết đầu tiên!')).toBeVisible(); // :195
    await expect(empty.getByText('Bài viết sẽ hiển thị tại đây cho cả gia đình cùng xem.')).toBeVisible(); // :196
    await expect(page.locator('[data-testid="post-author"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="load-more"]')).toHaveCount(0); // nextCursor null :214
    await assertGates(page, 'empty', w, h, theme);
    expect(current.errors.filter((e) => !isWhitelisted(e, current.allowedConsole))).toEqual([]);
    await ctx.close();
  }
});

test('staged pagination: cursor params on page 2 and exhausted cursor hides Tải thêm', async ({ browser }) => {
  for (const [w, h, theme] of [[1440, 900, 'light'], [320, 568, 'dark']]) {
    const { ctx, staged } = await anonFeedCtx(browser, { w, h, theme, mode: 'paginate' });
    const page = await ctx.newPage();
    current.p = page; current.errors = []; attachLogging(page, current);
    await page.goto(base + '/feed', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="feed-list"] [data-testid="post-author"]')).toHaveCount(FEED_PAGE);
    expect(staged.hits[0]).toContain('/api/v1/families/' + FAMILY1 + '/feed?limit=' + FEED_PAGE); // stores/feed.ts:48
    const more = page.locator('[data-testid="load-more"]');
    await expect(more).toHaveText('Tải thêm bài viết');
    await more.click(); // feedStore.loadMore → cursor_created_at+cursor_id :49-52
    await expect(page.locator('[data-testid="feed-list"] [data-testid="post-author"]')).toHaveCount(25);
    await expect(more).toHaveCount(0); // next_cursor null on page 2 → v-if :214
    expect(staged.hits.length).toBe(2);
    expect(staged.hits[1]).toContain('cursor_created_at=');
    expect(staged.hits[1]).toContain('cursor_id=');
    await expect(page.locator('[data-testid="feed-page-error"]')).toHaveCount(0);
    await assertGates(page, 'pagination-merged', w, h, theme);
    expect(current.errors.filter((e) => !isWhitelisted(e, current.allowedConsole))).toEqual([]);
    current.proof['pagination-' + w + '-' + theme] = { hits: staged.hits.slice() };
    await ctx.close();
  }
});

test('composer interactions: rune counter parity, over-limit lock, and URL image chips', async ({ browser }) => {
  const { ctx, page } = await demoLogin(browser, 1440, 900, 'light');
  await stageAuthedFeed(ctx, 'list');
  current.p = page; current.errors = []; attachLogging(page, current);
  await page.goto(base + '/feed', { waitUntil: 'domcontentloaded' });
  const form = page.locator('[data-testid="composer-form"]');
  const textarea = form.locator('textarea');
  const counter = page.locator('[data-testid="composer-char-counter"]');
  const submit = form.locator('button[type="submit"]');
  await expect(textarea).toHaveAttribute('maxlength', String(MAX_RUNES));
  await expect(counter).toHaveText('0/' + MAX_RUNES);
  await expect(submit).toBeDisabled();

  await textarea.fill('Xin chào');
  await expect(counter).toHaveText('8/' + MAX_RUNES); // runeCount :267
  await textarea.fill('a'.repeat(MAX_RUNES));
  await expect(counter).toHaveText(MAX_RUNES + '/' + MAX_RUNES); // parity with backend service.go:21
  await expect(submit).toBeEnabled();

  await page.evaluate((max) => { // programmatic bypass of the maxlength attr — over-limit lock
    const ta = document.querySelector('[data-testid="composer-form"] textarea');
    ta.value = 'x'.repeat(max + 1);
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }, MAX_RUNES);
  await expect(counter).toHaveText((MAX_RUNES + 1) + '/' + MAX_RUNES); // overLimit :268
  expect(await counter.getAttribute('class')).toContain('text-red-600'); // pinned legacy class :111 → var(--danger-fg) :360-370
  await expect(submit).toBeDisabled(); // canSubmit false :274-276

  await textarea.fill('Bài đầu tiên của e2e');
  await expect(counter).toHaveText('20/' + MAX_RUNES);
  await expect(submit).toBeEnabled();

  const urlInput = form.locator('input[type="url"]');
  await urlInput.fill('https://example.com/anh-1.jpg');
  await form.getByRole('button', { name: 'Thêm ảnh' }).click(); // addImage :70-75
  await expect(form.locator('span[title="https://example.com/anh-1.jpg"]')).toBeVisible(); // chip :91
  await urlInput.fill('https://example.com/anh-2.jpg');
  await urlInput.press('Enter'); // Enter adds too :67
  await expect(form.locator('span[title="https://example.com/anh-2.jpg"]')).toBeVisible();
  await urlInput.fill('https://example.com/anh-1.jpg');
  await form.getByRole('button', { name: 'Thêm ảnh' }).click(); // dedupe :329-331
  await expect(form.locator('span[title="https://example.com/anh-1.jpg"]')).toHaveCount(1);
  await expect(form.getByRole('button', { name: 'Xóa ảnh 2' })).toBeVisible(); // index-based aria :95
  await form.getByRole('button', { name: 'Xóa ảnh 1' }).click(); // removeImage :335-337
  await expect(form.locator('span[title="https://example.com/anh-1.jpg"]')).toHaveCount(0);
  await expect(form.locator('span[title="https://example.com/anh-2.jpg"]')).toBeVisible();
  expect(current.errors.filter((e) => !isWhitelisted(e, current.allowedConsole))).toEqual([]);
  current.proof.composer = { counterMax: MAX_RUNES + '/' + MAX_RUNES, overLimit: (MAX_RUNES + 1) + '/' + MAX_RUNES, chips: 'add/enter/dedupe/remove verified' };
  await ctx.close();
});

test('family selector change refetches the chosen family', async ({ browser }) => {
  const { ctx, page } = await demoLogin(browser, 1440, 900, 'light');
  const staged = await stageAuthedFeed(ctx, 'list');
  current.p = page; current.errors = []; attachLogging(page, current);
  await page.goto(base + '/feed', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-testid="feed-list"] [data-testid="post-author"]')).toHaveCount(FEED_PAGE);
  const selector = page.getByLabel('Chọn dòng họ'); // AppSelect renders native <select>
  await expect(selector).toBeEnabled(); // loadingFamilies done :28
  await selector.selectOption(FAMILY2); // AppSelect.vue:8-29; onFamilyChange :311-315
  await expect(page.locator('[data-testid="feed-list"] [data-testid="post-author"]')).toHaveCount(2);
  await expect(page.getByText(/^F2 bài đăng e2e/).first()).toBeVisible();
  await expect(page.locator('[data-testid="load-more"]')).toHaveCount(0); // F2 page has no cursor
  expect(staged.hits.some((x) => x.includes('/families/' + FAMILY2 + '/feed'))).toBeTruthy();
  expect(current.errors.filter((e) => !isWhitelisted(e, current.allowedConsole))).toEqual([]);
  current.proof.selector = { hits: staged.hits.slice() };
  await ctx.close();
});

test('staged beforeinstallprompt banner shows and dismiss persists in the session', async ({ browser }) => {
  for (const [w, h, theme] of [[1440, 900, 'light'], [390, 844, 'dark']]) {
    const { ctx } = await anonFeedCtx(browser, { w, h, theme, mode: 'list' });
    const page = await ctx.newPage();
    current.p = page; current.errors = []; attachLogging(page, current);
    await page.goto(base + '/feed', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="feed-list"]')).toBeVisible();
    await expect(page.locator('[data-testid="install-prompt"]')).toHaveCount(0); // hidden until the event :58
    await page.evaluate(() => window.dispatchEvent(new Event('beforeinstallprompt'))); // InstallPrompt.vue:61-65
    const banner = page.locator('[data-testid="install-prompt"]');
    await expect(banner).toBeVisible(); // :6
    await expect(banner).toHaveAttribute('role', 'region');
    await expect(banner.getByText('Cài đặt Cây Gia Phả')).toBeVisible(); // :18
    await expect(page.locator('[data-testid="install-button"]')).toHaveText('Cài đặt'); // :28
    await assertGates(page, 'pwa-banner', w, h, theme);
    await page.locator('[data-testid="install-dismiss"]').click(); // 'Để sau' :37-40
    await expect(banner).toHaveCount(0);
    await page.evaluate(() => window.dispatchEvent(new Event('beforeinstallprompt'))); // re-emit
    await expect(banner).toHaveCount(0); // stays dismissed for the session :64,87-93
    expect(await page.evaluate(() => window.sessionStorage.getItem('cgp.installPrompt.dismissed'))).toBe('1');
    expect(current.errors.filter((e) => !isWhitelisted(e, current.allowedConsole))).toEqual([]);
    current.proof['pwa-' + w + '-' + theme] = { dismissedPersist: true };
    await ctx.close();
  }
});

test('REAL demo: 403-first member binding and a real 201 post submit', async ({ browser }) => {
  const { ctx, page } = await demoLogin(browser, 1440, 900, 'light');
  current.p = page; current.errors = []; attachLogging(page, current);
  await page.goto(base + '/feed', { waitUntil: 'domcontentloaded' });
  const form = page.locator('[data-testid="composer-form"]');
  await expect(form).toBeVisible(); // demo session counts as authenticated :38
  await expect(page.locator('[data-testid="feed-list"], [data-testid="feed-empty"]').first()).toBeVisible();

  // (a) 403-FIRST binding guard: bogus member_id still 403 — rule 1 fires before
  // the member-existence check (auth/service.go:397-404 vs :408-416, router.go:99).
  const linkResp = await ctx.request.post(base + '/api/v1/me/member', {
    data: { member_id: BOGUS_MEMBER }, // auth_handler.go:242 body key
    headers: { Origin: 'http://localhost:3456' }, // CSRF allowlist (middleware.go:125-170)
  });
  expect(linkResp.status()).toBe(403);
  const linkBody = await linkResp.json();
  expect(linkBody.code).toBe('DEMO_ISOLATION_VIOLATION'); // model/api.go:27 via errors.go:32-33
  expect(String(linkBody.message || '')).not.toBe('');
  current.proof.binding403 = { status: linkResp.status(), code: linkBody.code };

  // (b) REAL submit → 201 (LIVE-VERDICT: brief expected 403; the feed route has
  // no demo guard — feed_handler.go:104-127. Source wins; documented in header).
  const marker = 'E2E REAL feed submit ' + new Date().toISOString();
  const postRespPromise = page.waitForResponse(
    (r) => /\/api\/v1\/families\/[0-9a-f-]+\/feed/.test(r.url()) && r.request().method() === 'POST', { timeout: 15000 });
  await form.locator('textarea').fill(marker);
  await form.locator('button[type="submit"]').click(); // submitPost :339-357
  const postResp = await postRespPromise;
  expect(postResp.status()).toBe(201);
  const postBody = await postResp.json();
  expect(postBody.content).toBe(marker);
  expect(postBody.author_member_id).toBeNull(); // demo never links (INV-04) — author_member_id stays null
  current.proof.submit = { status: postResp.status(), author_member_id: postBody.author_member_id, family_id: postBody.family_id };

  await expect(page.getByText('Đã đăng bài viết.')).toBeVisible(); // success toast :348
  await expect(form.locator('textarea')).toHaveValue(''); // cleared :349
  await expect(page.locator('[data-testid="composer-char-counter"]')).toHaveText('0/' + MAX_RUNES); // :115
  expect(current.errors.filter((e) => !isWhitelisted(e, current.allowedConsole))).toEqual([]);
  await ctx.close();
});
