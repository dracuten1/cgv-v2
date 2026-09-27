/**
 * Independent Phase 3 verification: /members/:id (MemberDetailView) — CGP v2,
 * branch feature/apple-design-all-pages (production tip 3f061e4, code FROZEN:
 * this spec reports defects, it never fixes or writes).
 *
 * Every expectation is derived from SOURCE. Anchor table (file:line @ 1b1ca98):
 *   EXPECTATION                              → SOURCE
 *   loading skeleton testid + 'Đang tải hồ sơ…' (role=status)
 *                                            → web/src/views/MemberDetailView.vue:4-10
 *   not-found EmptyState: h3 'Không tìm thấy thành viên', description =
 *     store error (real 404 message) || 'Thành viên này không tồn tại hoặc đã bị xóa.',
 *     action 'Về cây gia phả' → /tree         → MemberDetailView.vue:13-21; EmptyState.vue:10-18
 *   hero: member-hero-avatar / member-name / member-generation-badge ('Đời thứ N')
 *     / member-living-status ('Đang sống'|'Đã mất') / yearsText
 *                                            → MemberDetailView.vue:28-47
 *   edit/delete visible only when authenticated; guest hint 'Đăng nhập để chỉnh sửa'
 *                                            → MemberDetailView.vue:52-70
 *   gen badge chip variant genN = variants[(idx-1) % 4] → AppChip 'bg-gen-N-soft text-gen-N-fg'
 *                                            → MemberDetailView.vue:266-270; AppChip.vue:41-48
 *   tabs: role=tablist on member-tabs; 3 <button role=tab> with testids
 *     tab-{overview,relations,posts}, labels 'Tổng quan'/'Quan hệ'/'Bảng tin',
 *     aria-selected via :aria-selected="activeTab === tab.key", @click ONLY (no
 *     keyboard handler), panels v-if testids tab-panel-*
 *                                            → MemberDetailView.vue:76-94, 250-254, 98/128/174
 *   relations: 4 groups 'Cha mẹ'(parents)/'Vợ chồng'(spouses)/'Anh chị em'(siblings)/
 *     'Con cái'(children), h3 heading + exact emptyText per group; member cards are
 *     <router-link :to="/members/${encodeURIComponent(id)}"> with testid relation-<id>;
 *     gen stripe borderLeftWidth:4px + borderLeftColor var(--gen-${clamp(gen,1,4)})
 *                                            → MemberDetailView.vue:128-171, 286-294, 140
 *   edit dialog: AppDialog role=dialog aria-modal=true; title 'Cập nhật thành viên'
 *     (edit mode); LIVE MemberCardPreview (member-card-preview / preview-name /
 *     preview-initials) bound to form state (v-model, no network); footer 'Hủy' + member-save
 *                                            → MemberDetailView.vue:188-193; MemberEditDialog.vue:4, 9-16,
 *                                              18-25, 82-95; AppDialog.vue:16-20
 *   getInitials = initials of last two words, uppercased
 *                                            → web/src/components/tree/card-visual.ts:7-14
 *   delete dialog: title 'Xóa thành viên'; delete-confirm-text 'Xóa thành viên này?';
 *     child-reassignment copy 'Con của thành viên này sẽ được gán lại …gốc riêng…';
 *     footer 'Hủy' + delete-confirm-button   → MemberDetailView.vue:196-217
 *   route /members/:id has NO requiresAuth/guest meta → guests stay on page (no
 *     redirect); member reads GET /members(+/:id) are PUBLIC; writes POST/PUT/DELETE
 *     are protected                          → web/src/router/index.ts:44-50, 95-131;
 *                                              api/internal/handler/router.go:82-83, 107-109
 *   router.beforeEach fetchMe() probe when idle → known benign 401 GET /api/v1/me on
 *     anonymous contexts                     → web/src/router/index.ts:98-101
 *   store: fetchMember GET /members/:id → MemberDetailResponse{relations{...}, posts}
 *                                            → web/src/stores/member.ts:18-32; web/src/api/members.ts:15-17
 *   real demo login: POST /api/v1/auth/demo (public); CSRF origin middleware allows
 *     Origin http://localhost:3456 (the pack proxy rewrites Origin); demo button
 *     data-testid=demo-login-btn 'Vào bản dùng thử' → redirect /tree
 *                                            → api/internal/handler/router.go:73; LoginView.vue:243-250;
 *                                              api/internal/handler/middleware.go:125-170
 *
 * MOCKUP DISAGREEMENT NOTES (canonical mockup .agents/shared/planning/apple-redesign/
 * mockups/person-detail*.html vs SOURCE — SOURCE WINS in every case):
 *   1. Task brief expected "tabs as RouterLinks with real hrefs". SOURCE implements
 *      plain <button>s with @click only (MemberDetailView.vue:77-93) — no href, no
 *      Left/Right keyboard nav. The states mockup (person-detail-states.html #overview)
 *      also renders <button role=tab>, agreeing with source. Spec asserts the BUTTON
 *      contract and adds a NEGATIVE keyboard assertion (ArrowRight must NOT change
 *      aria-selected) to pin the real behavior.
 *   2. Mockup person-detail.html:51,54 shows a '← Gia phả' back-link and a
 *      'Xem trên cây →' button. The source view implements NEITHER. Not asserted.
 *   3. Mockup delete-dialog specimen uses role=group scaffolding; the runtime renders
 *      AppDialog role=dialog aria-modal=true (AppDialog.vue:18-19). Source wins.
 *   4. Mockup states #fallback shows loading/not-found as separate cards with
 *      'Không tìm thấy hồ sơ' copy; source uses EmptyState 'Không tìm thấy thành viên'
 *      (MemberDetailView.vue:15). Source wins.
 *
 * Harness (ported proven patterns):
 *   - Contrast sweep is ALPHA-COMPOSITED and parses CSS colors via canvas 2D
 *     (ctx.fillStyle → getImageData) because Tailwind v4 computes to oklch(...)/
 *     color-mix(...) and a numeric-regex parser silently mis-parses oklch into bogus
 *     ratio≈1 findings (verified lesson from apple-phase3-content.spec.cjs).
 *     ::placeholder pseudo-element color is measured for empty inputs/textareas.
 *     Elements rendered smaller than 2×2 px or classed sr-only are skipped (not
 *     visually rendered text — avoids the AppDialog sr-only 'Đóng' false positive;
 *     this sweep is the first of the family to gate dialog states).
 *   - Console whitelist records url+status; allows 401 GET /api/v1/me (guest
 *     fetchMe probe) and — only in the not-found rows — 404 GET /api/v1/members/:id
 *     (the REAL backend 404 under test logs a resource error).
 *   - Evidence is worker-durable: rows append to rows.jsonl, cleanup runs only in
 *     worker 0, summary.json rebuilt from disk (Playwright 1.63 may reload the spec
 *     module in a second worker mid-run — verified lesson from phase 3 content run).
 *
 * Environment:
 *   APPLE_PHASE3_MEMBER_BASE      isolated origin http://127.0.0.1:1xxxx serving
 *                                 web/dist with /api/* proxied to the live backend
 *                                 127.0.0.1:3456 (Origin rewritten for the allowlist).
 *   APPLE_PHASE3_MEMBER_ARTIFACTS artifacts dir (summary.json, rows.jsonl, PNGs).
 *   NEVER touches 127.0.0.1:5432 (ensemble's own Postgres).
 *
 * Matrix: 3 tab states × {1440×900, 390×844, 320×568} × {light,dark} in-test, plus
 * dialog/skeleton/not-found/guest states at {1440,390} × both themes. No sleep > 1s.
 */
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const MIN_AA = 4.5;
const THEMES = ['light', 'dark'];
const SIZES = [[1440, 900], [390, 844], [320, 568]];
const STATE_SIZES = [[1440, 900], [390, 844]];
const ROOT_NAME = 'Nguyễn Văn An'; // seed family 1 root ancestor, generation 1
const BOGUS_UUID = '00000000-0000-4000-8000-000000000000'; // well-formed, real backend 404
const SKELETON_DELAY_MS = 900; // task floor is ≥800 ms; member-loading must be visible inside it
const TABS = [
  { key: 'overview', label: 'Tổng quan' },
  { key: 'relations', label: 'Quan hệ' },
  { key: 'posts', label: 'Bảng tin' },
];
const GROUPS = [
  { title: 'Cha mẹ', rel: 'parents', empty: 'Chưa có thông tin cha mẹ.' },
  { title: 'Vợ chồng', rel: 'spouses', empty: 'Chưa có thông tin vợ/chồng.' },
  { title: 'Anh chị em', rel: 'siblings', empty: 'Không có anh chị em.' },
  { title: 'Con cái', rel: 'children', empty: 'Chưa có thông tin con cái.' },
];

const base = process.env.APPLE_PHASE3_MEMBER_BASE;
if (!base || !/^http:\/\/127\.0\.0\.1:1[0-9]{4}$/.test(base)) {
  throw Error('APPLE_PHASE3_MEMBER_BASE required (isolated origin http://127.0.0.1:1xxxx)');
}
const out = process.env.APPLE_PHASE3_MEMBER_ARTIFACTS ||
  path.resolve(__dirname, '../../.agents/tester/RESULTS/apple_phase3_memberdetail_browser');
fs.mkdirSync(out, { recursive: true });

// ---- Worker-durable evidence (rows.jsonl is append-only; summary rebuilt from disk).
// Cleanup only in worker 0: the Playwright 1.63 runner may load this module in a
// second worker mid-run; unconditional cleanup would wipe worker 0's evidence.
const rowsFile = path.join(out, 'rows.jsonl');
const FRESH = process.env.APPLE_PHASE3_MEMBER_FRESH === '1' && process.env.TEST_WORKER_INDEX === '0';
if (FRESH) {
  for (const f of [rowsFile, path.join(out, 'summary.json')]) {
    try { fs.rmSync(f, { force: true }); } catch (_) { /* already gone */ }
  }
  for (const f of fs.readdirSync(out)) {
    if (f.startsWith('fail-') && f.endsWith('.png')) { try { fs.rmSync(path.join(out, f), { force: true }); } catch (_) {} }
  }
}
function appendRecord(rec) { fs.appendFileSync(rowsFile, JSON.stringify(rec) + '\n'); }
function readRecords() {
  if (!fs.existsSync(rowsFile)) return [];
  const recs = [];
  for (const line of fs.readFileSync(rowsFile, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { recs.push(JSON.parse(t)); } catch (_) { /* torn tail from an interrupted run */ }
  }
  return recs;
}
function writeSummary(extra) {
  const recs = readRecords();
  const byPng = new Map();
  const rows = [];
  for (const r of recs) {
    if (r.type === 'row' && r.row) {
      if (r.row.png && byPng.has(r.row.png)) rows[byPng.get(r.row.png)] = r.row; // last write wins
      else { if (r.row.png) byPng.set(r.row.png, rows.length); rows.push(r.row); }
    }
  }
  const cases = recs.filter((r) => r.type === 'case').map((r) => r.case);
  fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ meta: extra?.meta || {}, cases, rows }, null, 2));
}

// ---- Console whitelist (url-aware; records url+status like the phase-2 harness).
const isWhitelisted = (e, allowed = []) =>
  (e.status === 401 && /\/api\/v1\/me(?:\?|$)/.test(e.url || '')) ||
  (allowed.includes('member-404') && e.status === 404 &&
    new RegExp('/api/v1/members/' + BOGUS_UUID + '(?:\\?|$)').test(e.url || ''));
function monitor(page) {
  const errors = [], responses = [];
  page.on('response', (r) => responses.push({ url: r.url(), status: r.status() }));
  page.on('pageerror', (e) => errors.push({ message: e.message, url: null, status: null }));
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    const loc = m.location().url || null;
    const hit = responses.find((r) => r.url === loc) || responses.find((r) => m.text().includes(r.url));
    errors.push({ message: m.text(), url: hit ? hit.url : loc, status: hit ? hit.status : null });
  });
  return errors;
}

// ---- REAL demo login ('Dùng thử ngay' → POST /api/v1/auth/demo → /tree).
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

// ---- Live-API member discovery (authenticated context.request shares the demo cookie).
// (a) root ancestor Nguyễn Văn An (generation_index === 1);
// (b) a mid-generation member whose DETAIL API shows ALL FOUR relation groups non-empty.
let MBR = null; // { rootId, root, midId, mid }
async function discoverMembers(browser) {
  const { ctx, page } = await demoLogin(browser);
  const api = ctx.request;
  const famResp = await api.get(base + '/api/v1/families');
  if (!famResp.ok()) throw Error('GET /api/v1/families → ' + famResp.status());
  const fams = (await famResp.json()).families || [];
  const famId = fams.length ? fams[0].id : null;
  const memResp = await api.get(base + '/api/v1/members?limit=200');
  if (!memResp.ok()) throw Error('GET /api/v1/members → ' + memResp.status());
  let items = (await memResp.json()).items || [];
  const scoped = famId ? items.filter((m) => m.family_id === famId) : [];
  if (scoped.length) items = scoped;
  const root = items.find((m) => m.full_name === ROOT_NAME && m.generation_index === 1) ||
    items.find((m) => m.generation_index === 1);
  if (!root) throw Error('root ancestor not found via API (looked for ' + ROOT_NAME + ' gen 1; members=' +
    items.map((m) => m.full_name + '#' + m.generation_index).slice(0, 20).join(', ') + ')');
  const candidates = items.filter((m) => m.id !== root.id && m.generation_index > 1)
    .sort((a, b) => a.generation_index - b.generation_index).slice(0, 10);
  let mid = null;
  for (const cand of candidates) {
    const d = await api.get(base + '/api/v1/members/' + cand.id);
    if (!d.ok()) continue;
    const rel = (await d.json()).relations || {};
    if (GROUPS.every((g) => (rel[g.rel] || []).length > 0)) { mid = { ...cand, relations: rel }; break; }
  }
  if (!mid) throw Error('no member with ALL FOUR relation groups non-empty found among ' +
    candidates.length + ' candidates (family=' + (famId || 'n/a') + ')');
  const rootDetail = await api.get(base + '/api/v1/members/' + root.id);
  if (!rootDetail.ok()) throw Error('GET /api/v1/members/' + root.id + ' → ' + rootDetail.status());
  const rootRelations = (await rootDetail.json()).relations || {};
  MBR = { rootId: root.id, root, rootRelations, midId: mid.id, mid };
  await ctx.close();
}

// ---- Color probe: resolve a var(--gen-*) reference to its computed color string.
const GEN_PROBE = (varName, prop) => `(() => {
  const p = document.createElement('div');
  p.style.${prop} = 'var(${varName})';
  p.style.display = 'none';
  document.body.appendChild(p);
  const v = getComputedStyle(p).${prop};
  p.remove();
  return v; })()`;

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
  });
  const bad = entries.filter((x) => !Number.isFinite(x.ratio) || x.ratio < MIN_AA);
  return { entries, bad, overflow, focus, ok: bad.length === 0 && overflow.html <= 0 && overflow.body <= 0 && focus.indicated };
}

test.beforeAll(async ({ browser }) => { await discoverMembers(browser); });

let current = {};
test.afterEach(async ({}, info) => {
  const errors = Array.isArray(current.errors) ? current.errors : [];
  const allowed = current.allowedConsole || [];
  const rec = {
    title: info.title, status: info.status, expectedStatus: info.expectedStatus,
    allowedConsole: allowed,
    whitelisted: errors.filter((e) => isWhitelisted(e, allowed)),
    nonWhitelisted: errors.filter((e) => !isWhitelisted(e, allowed)),
    proof: current.proof || {}, rows: current.rows || [],
    errors,
  };
  appendRecord({ type: 'case', case: rec });
  writeSummary({ meta: { spec: 'apple-phase3-memberdetail', base, generatedAt: new Date().toISOString() } });
  if (info.status === 'failed' && current.page) {
    try { await current.page.screenshot({ path: path.join(out, 'fail-' + info.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.png'), fullPage: true }); } catch (_) {}
  }
  current = {};
});

// 1 — Hero contracts + gen-token styling on the generation badge (root ancestor).
test('hero: name/gen badge/avatar/living-status + gen token on badge (authenticated)', async ({ browser }) => {
  const { ctx, page } = await demoLogin(browser);
  current.errors = monitor(page); current.page = page;
  await page.goto(base + '/members/' + MBR.rootId, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-testid="member-name"]')).toHaveText(MBR.root.full_name);
  await expect(page.locator('[data-testid="member-generation-badge"]')).toHaveText('Đời thứ ' + MBR.root.generation_index);
  await expect(page.locator('[data-testid="member-hero-avatar"]')).toBeVisible();
  await expect(page.locator('[data-testid="member-living-status"]')).toHaveText(MBR.root.is_living ? 'Đang sống' : 'Đã mất');
  await expect(page.locator('[data-testid="member-edit"]')).toBeVisible();   // authenticated → actions per :52-66
  await expect(page.locator('[data-testid="member-delete"]')).toBeVisible();
  // Gen badge chip variant genN = ((gen-1) % 4) + 1 → text-gen-N-fg (MemberDetailView.vue:266-270).
  const n = ((MBR.root.generation_index - 1) % 4) + 1;
  const probe = await page.evaluate(GEN_PROBE('--gen-' + n + '-fg', 'color'));
  const badgeColor = await page.locator('[data-testid="member-generation-badge"]').evaluate((e) => getComputedStyle(e).color);
  expect(badgeColor, 'badge color must resolve to var(--gen-' + n + '-fg)').toBe(probe);
  // Overview extras per source :101-122.
  await expect(page.locator('[data-testid="member-gender"]')).toHaveText(MBR.root.gender === 'female' ? 'Nữ' : 'Nam');
  current.proof = { rootId: MBR.rootId, genToken: '--gen-' + n + '-fg', badgeColor, probe };
  expect(current.errors.filter((e) => !isWhitelisted(e))).toEqual([]);
  await ctx.close();
});

// 2 — Tabs: role/aria/click contract. SOURCE = plain buttons (no RouterLinks, no
// keyboard Left/Right) — negative assertion pins ArrowRight as a no-op.
test('tabs: tablist semantics, labels, aria-selected toggle, button (not link) contract', async ({ browser }) => {
  const { ctx, page } = await demoLogin(browser);
  current.errors = monitor(page); current.page = page;
  await page.goto(base + '/members/' + MBR.rootId, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-testid="member-name"]')).toBeVisible();
  const list = page.locator('[data-testid="member-tabs"]');
  await expect(list).toHaveAttribute('role', 'tablist');
  const tabs = TABS.map((t) => page.locator('[data-testid="tab-' + t.key + '"]'));
  for (let i = 0; i < TABS.length; i++) {
    await expect(tabs[i]).toHaveRole('tab');
    await expect(tabs[i]).toHaveText(TABS[i].label);
    await expect(tabs[i]).toHaveAttribute('aria-selected', i === 0 ? 'true' : 'false');
    const tag = await tabs[i].evaluate((e) => ({ tag: e.tagName, href: e.getAttribute('href') }));
    expect(tag.tag).toBe('BUTTON');           // source :77-93 — button, not RouterLink
    expect(tag.href).toBeNull();
  }
  await expect(page.locator('[data-testid="tab-panel-overview"]')).toBeVisible();
  await tabs[1].click();
  await expect(tabs[1]).toHaveAttribute('aria-selected', 'true');
  await expect(tabs[0]).toHaveAttribute('aria-selected', 'false');
  await expect(page.locator('[data-testid="tab-panel-relations"]')).toBeVisible();
  await expect(page.locator('[data-testid="tab-panel-overview"]')).toHaveCount(0);
  await tabs[2].click();
  await expect(page.locator('[data-testid="tab-panel-posts"]')).toBeVisible();
  await expect(page.locator('[data-testid="tab-panel-relations"]')).toHaveCount(0);
  // Negative keyboard contract: source implements NO arrow-key handler (:90 @click only).
  await tabs[0].click();
  await page.keyboard.press('ArrowRight');
  await expect(tabs[0]).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('[data-testid="tab-panel-overview"]')).toBeVisible();
  current.proof = { tabsAreButtons: true, arrowKeyNoOp: true };
  expect(current.errors.filter((e) => !isWhitelisted(e))).toEqual([]);
  await ctx.close();
});

// 3 — Relations tab on the all-four-groups member: headings in order, router-link
// cards matching the API ids, gen stripes resolving to var(--gen-clamp(gen,1,4)).
test('relations (mid-generation): 4 groups, router-link hrefs per API, gen stripes', async ({ browser }) => {
  const { ctx, page } = await demoLogin(browser);
  current.errors = monitor(page); current.page = page;
  await page.goto(base + '/members/' + MBR.midId, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-testid="member-name"]')).toBeVisible();
  await page.locator('[data-testid="tab-relations"]').click();
  const panel = page.locator('[data-testid="tab-panel-relations"]');
  await expect(panel).toBeVisible();
  // Group headings render in source order (:129-130, 289-292); h3s exist only as
  // group headings, so the ordered list pins all four groups at once.
  await expect(panel.locator('h3')).toHaveText(GROUPS.map((g) => g.title));
  const hrefs = [];
  let totalCards = 0;
  for (const g of GROUPS) {
    const apiMembers = MBR.mid.relations[g.rel] || [];
    expect(apiMembers.length, g.title + ' must be non-empty (discovery verified)').toBeGreaterThan(0);
    for (const m of apiMembers) {
      // Cards carry per-member testids from the API data itself (:141 relation-<id>),
      // so anchors are data-driven, not structure-driven.
      const card = page.locator('[data-testid="relation-' + m.id + '"]');
      await expect(card).toHaveAttribute('href', '/members/' + m.id); // :to encodeURIComponent(id) :138
      await expect(card.locator('span').first()).toContainText(m.full_name); // card names its member
      // Gen stripe: borderLeftWidth 4px + borderLeftColor var(--gen-clamp(gen,1,4)) (:140).
      const clamp = Math.min(4, Math.max(1, m.generation_index || 1));
      const stripe = await card.evaluate((e) => {
        const s = getComputedStyle(e);
        return { w: s.borderLeftWidth, c: s.borderLeftColor };
      });
      expect(stripe.w, g.title + ' card stripe width').toBe('4px');
      const probe = await page.evaluate(GEN_PROBE('--gen-' + clamp, 'borderLeftColor'));
      expect(stripe.c, g.title + ' stripe color must equal var(--gen-' + clamp + ')').toBe(probe);
      hrefs.push('/members/' + m.id);
      totalCards++;
    }
  }
  // No extra/unknown relation cards beyond the API-provided set.
  await expect(panel.locator('a[data-testid^="relation-"]')).toHaveCount(totalCards);
  expect(hrefs.length).toBeGreaterThanOrEqual(4); // ≥1 real href per non-empty group
  current.proof = { midId: MBR.midId, hrefs };
  expect(current.errors.filter((e) => !isWhitelisted(e))).toEqual([]);
  await ctx.close();
});

// 3b — Empty-group contract, fully data-driven from the root member's DETAIL API:
// every group with zero API members keeps its heading and shows its exact
// emptyText (:131-133, 289-292); non-empty groups render ≥1 card.
test('relations (root): empty groups keep headings and show exact emptyText', async ({ browser }) => {
  const { ctx, page } = await demoLogin(browser);
  current.errors = monitor(page); current.page = page;
  await page.goto(base + '/members/' + MBR.rootId, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-testid="tab-relations"]').click();
  const panel = page.locator('[data-testid="tab-panel-relations"]');
  await expect(panel).toBeVisible();
  let emptyCount = 0;
  for (const g of GROUPS) {
    const apiMembers = MBR.rootRelations[g.rel] || [];
    await expect(panel.getByRole('heading', { name: g.title })).toBeVisible(); // heading always rendered
    if (apiMembers.length === 0) {
      await expect(panel.getByText(g.empty)).toBeVisible(); // exact emptyText per group
      emptyCount++;
    } else {
      for (const m of apiMembers) {
        await expect(page.locator('[data-testid="relation-' + m.id + '"]')).toBeVisible();
      }
    }
  }
  expect(emptyCount, 'root ancestor must have ≥1 empty group for this contract (API: ' +
    GROUPS.map((g) => g.rel + '=' + (MBR.rootRelations[g.rel] || []).length).join(',') + ')').toBeGreaterThanOrEqual(1);
  current.proof = { rootId: MBR.rootId, emptyGroups: emptyCount };
  expect(current.errors.filter((e) => !isWhitelisted(e))).toEqual([]);
  await ctx.close();
});

// 4 — Edit dialog: a11y, LIVE preview sync (v-model, zero network), CANCEL only.
test('edit dialog: role=dialog/aria-modal, live preview sync, cancel = zero writes', async ({ browser }) => {
  const { ctx, page } = await demoLogin(browser);
  current.errors = monitor(page); current.page = page;
  const writes = [];
  page.on('request', (r) => {
    if (/\/api\/v1\/members/.test(r.url()) && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method())) writes.push(r.method() + ' ' + r.url());
  });
  await page.goto(base + '/members/' + MBR.rootId, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-testid="member-name"]')).toHaveText(MBR.root.full_name);
  await page.locator('[data-testid="member-edit"]').click();
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');                       // AppDialog.vue:18-19
  await expect(dialog.getByRole('heading', { name: 'Cập nhật thành viên' })).toBeVisible(); // edit mode :4
  const preview = page.locator('[data-testid="member-card-preview"]');
  await expect(preview).toBeVisible();                                             // MemberEditDialog.vue:9-16
  await expect(page.locator('[data-testid="preview-name"]')).toHaveText(MBR.root.full_name);
  await page.locator('#member-full-name').fill('Nguyễn Văn Bình');
  await expect(page.locator('[data-testid="preview-name"]')).toHaveText('Nguyễn Văn Bình'); // LIVE, no reload
  await expect(page.locator('[data-testid="preview-initials"]')).toHaveText('VB'); // getInitials: last-two-words
  await expect(page.locator('[data-testid="preview-generation"]')).toHaveText('Đời thứ ' + MBR.root.generation_index);
  await dialog.getByRole('button', { name: 'Hủy' }).click();                       // CANCEL ONLY (:83-85)
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-testid="member-name"]')).toHaveText(MBR.root.full_name); // unchanged
  expect(writes, 'cancel must produce zero member writes').toEqual([]);
  current.proof = { livePreview: true, initials: 'VB', writes: writes.length };
  expect(current.errors.filter((e) => !isWhitelisted(e))).toEqual([]);
  await ctx.close();
});

// 5 — Delete dialog on a member WITH children: child-reassignment warning + cancel.
test('delete dialog: child-reassignment warning copy visible, cancel = zero writes', async ({ browser }) => {
  const { ctx, page } = await demoLogin(browser);
  current.errors = monitor(page); current.page = page;
  const writes = [];
  page.on('request', (r) => {
    if (/\/api\/v1\/members/.test(r.url()) && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method())) writes.push(r.method() + ' ' + r.url());
  });
  await page.goto(base + '/members/' + MBR.midId, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-testid="member-name"]')).toBeVisible();
  await page.locator('[data-testid="member-delete"]').click();
  const dialog = page.locator('[role="dialog"]');
  await expect(dialog).toBeVisible();
  await expect(dialog).toHaveAttribute('aria-modal', 'true');
  await expect(dialog.getByRole('heading', { name: 'Xóa thành viên' })).toBeVisible();
  await expect(page.locator('[data-testid="delete-confirm-text"]')).toHaveText('Xóa thành viên này?');
  await expect(dialog.getByText(/Con của thành viên này sẽ được gán lại/)).toBeVisible(); // :200-203
  await expect(dialog.getByText(/trở thành gốc riêng/)).toBeVisible();
  await dialog.getByRole('button', { name: 'Hủy' }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('[data-testid="member-name"]')).toBeVisible(); // still on page
  expect(writes, 'cancel must produce zero member writes').toEqual([]);
  current.proof = { warningShown: true, writes: writes.length, midId: MBR.midId };
  expect(current.errors.filter((e) => !isWhitelisted(e))).toEqual([]);
  await ctx.close();
});

// 6 — Skeleton: delayed member API (≥800 ms) → member-loading (role=status) before data.
test('skeleton: member-loading visible while detail API delayed ≥800ms', async ({ browser }) => {
  const { ctx, page } = await demoLogin(browser);
  current.errors = monitor(page); current.page = page;
  let delayed = 0;
  await ctx.route('**/api/v1/members/*', async (route) => {
    const u = route.request().url();
    if (route.request().method() === 'GET' && new RegExp('/api/v1/members/' + MBR.rootId + '(?:\\?|$)').test(u)) {
      delayed++;
      await new Promise((r) => setTimeout(r, SKELETON_DELAY_MS)); // pass-through to REAL backend
    }
    await route.continue();
  });
  await page.goto(base + '/members/' + MBR.rootId, { waitUntil: 'domcontentloaded' });
  const loading = page.locator('[data-testid="member-loading"]');
  await expect(loading).toBeVisible();                                   // MemberDetailView.vue:4-10
  await expect(loading.getByRole('status')).toBeVisible();
  await expect(loading.getByText('Đang tải hồ sơ…')).toBeVisible();
  await expect(page.locator('[data-testid="member-name"]')).toHaveText(MBR.root.full_name); // real data arrives
  await expect(loading).toHaveCount(0);
  expect(delayed).toBeGreaterThanOrEqual(1);
  current.proof = { delayedRequests: delayed, delayMs: SKELETON_DELAY_MS };
  expect(current.errors.filter((e) => !isWhitelisted(e))).toEqual([]);
  await ctx.close();
});

// 7 — Not-found: well-formed bogus uuid → REAL backend 404 → EmptyState Vietnamese copy.
test('not-found: real 404 shows EmptyState title + action (description recorded)', async ({ browser }) => {
  const { ctx, page } = await demoLogin(browser);
  current.errors = monitor(page); current.allowedConsole = ['member-404']; current.page = page;
  await page.goto(base + '/members/' + BOGUS_UUID, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Không tìm thấy thành viên' })).toBeVisible(); // EmptyState h3
  // Description = memberStore.error (real 404 message via formatApiError) || source fallback.
  const desc = await page.locator('p').filter({ hasText: /.+/ }).allTextContents();
  current.proof = { bogusId: BOGUS_UUID, descriptions: desc.map((t) => t.trim()).filter(Boolean) };
  await expect(page.getByRole('button', { name: 'Về cây gia phả' })).toBeVisible();
  expect(current.errors.filter((e) => !isWhitelisted(e, current.allowedConsole))).toEqual([]);
  await ctx.close();
});

// 8 — Guest: /members/:id has NO requiresAuth (router/index.ts:44-50) → NO redirect;
// in-page fallback: data renders (public reads), edit/delete absent, hint shown.
test('guest: stays on page (no guard redirect), auth hint replaces edit/delete', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'vi-VN' });
  const page = await ctx.newPage();
  current.errors = monitor(page); current.page = page; // 401 GET /api/v1/me whitelisted
  await page.goto(base + '/members/' + MBR.rootId, { waitUntil: 'domcontentloaded' });
  expect(new URL(page.url()).pathname, 'guest must NOT be redirected (no requiresAuth on route)').toBe('/members/' + MBR.rootId);
  await expect(page.locator('[data-testid="member-name"]')).toHaveText(MBR.root.full_name);
  await expect(page.locator('[data-testid="member-edit"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="member-delete"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="member-auth-hint"]')).toHaveText('Đăng nhập để chỉnh sửa');
  current.proof = { pathname: new URL(page.url()).pathname, hint: true };
  expect(current.errors.filter((e) => !isWhitelisted(e))).toEqual([]);
  await ctx.close();
});

// 9 — Matrix: 3 tab states × 3 sizes × 2 themes; every row gated (contrast/overflow/
// focus/console/testids). Failures aggregate so one bad row never hides the others.
test('matrix: tabs × sizes × themes — per-row contrast/overflow/focus/console gates', async ({ browser }) => {
  const { ctx, page } = await demoLogin(browser);
  current.errors = monitor(page); current.page = page;
  await page.goto(base + '/members/' + MBR.midId, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-testid="member-name"]')).toBeVisible();
  const failures = [];
  const combosRun = { n: 0 };
  for (const [w, h] of SIZES) {
    for (const theme of THEMES) {
      await page.setViewportSize({ width: w, height: h });
      await page.emulateMedia({ colorScheme: theme });
      for (const t of TABS) {
        const label = t.key + '@' + w + 'x' + h + '-' + theme;
        const row = { png: 'row-' + label, tab: t.key, w, h, theme };
        try {
          await page.locator('[data-testid="tab-' + t.key + '"]').click();
          await expect(page.locator('[data-testid="tab-panel-' + t.key + '"]')).toBeVisible();
          await expect(page.locator('[data-testid="member-tabs"]')).toBeVisible();
          const g = await gates(page);
          Object.assign(row, { ok: g.ok, overflow: g.overflow, focus: g.focus,
            contrastFailures: g.bad.slice(0, 10), contrastChecked: g.entries.length });
          if (g.bad.length) throw Error(g.bad.length + ' contrast rows < ' + MIN_AA + ' (worst ' +
            Math.min(...g.bad.map((b) => b.ratio)) + ': ' + g.bad.slice(0, 3).map((b) => b.text).join(' | ') + ')');
          if (g.overflow.html > 0 || g.overflow.body > 0) throw Error('overflow html=' + g.overflow.html + 'px body=' + g.overflow.body + 'px');
          if (!g.focus.indicated) throw Error('first Tab target lacks :focus-visible indication');
          expect(current.errors.filter((e) => !isWhitelisted(e))).toEqual([]);
        } catch (e) {
          row.ok = false; row.error = String(e.message || e).slice(0, 300);
          failures.push(label + ': ' + row.error);
          try { await page.screenshot({ path: path.join(out, 'fail-' + label.replace(/[^a-z0-9]+/gi, '-') + '.png'), fullPage: true }); } catch (_) {}
        }
        appendRecord({ type: 'row', row });
        writeSummary({ meta: { spec: 'apple-phase3-memberdetail', base } });
        combosRun.n++;
      }
    }
  }
  current.rows = [];
  current.proof = { combos: SIZES.length * THEMES.length * TABS.length, rowsRecorded: combosRun.n, failures };
  expect(failures, 'matrix rows failed: ' + failures.join(' ;; ')).toEqual([]);
  await ctx.close();
});



// 10 — Dialog/not-found/guest states at {1440,390} × both themes, gated.
// Gates are captured and judged INLINE at each state (never deferred — the page keeps
// moving), so failure PNGs shoot the live page at the moment of failure.
test('state matrix: edit/delete dialogs + not-found + guest at 1440/390 light/dark', async ({ browser }) => {
  const failures = [];
  const rowCount = { n: 0 };
  current.allowedConsole = ['member-404'];
  current.errors = [];
  const trackedErrors = []; // { errs, guest }
  const judge = async (row, shooter) => {
    const label = row.label + '@' + row.w + 'x' + row.h + '-' + row.theme;
    try {
      if (row.err) throw Error(row.err);
      if (row.bad.length) throw Error(row.bad.length + ' contrast rows < ' + MIN_AA + ' (worst ' +
        Math.min(...row.bad.map((b) => b.ratio)) + ': ' + row.bad.slice(0, 3).map((b) => b.text).join(' | ') + ')');
      if (row.overflow.html > 0 || row.overflow.body > 0) throw Error('overflow html=' + row.overflow.html + 'px body=' + row.overflow.body + 'px');
      if (!row.focus.indicated) throw Error('first Tab target lacks :focus-visible indication');
    } catch (e) {
      const msg = String(e.message || e).slice(0, 300);
      failures.push(label + ': ' + msg);
      if (shooter) { try { await shooter.screenshot({ path: path.join(out, 'fail-' + row.png.replace(/[^a-z0-9]+/gi, '-') + '.png'), fullPage: true }); } catch (_) {} }
      row.failed = msg;
    }
    appendRecord({ type: 'row', row: { png: row.png, label: row.label, w: row.w, h: row.h, theme: row.theme,
      ok: !row.failed, overflow: row.overflow, focus: row.focus, contrastFailures: row.bad.slice(0, 10),
      contrastChecked: row.entries.length, a11y: row.a11y || null, error: row.failed || null } });
    writeSummary({ meta: { spec: 'apple-phase3-memberdetail', base } });
    rowCount.n++;
  };
  for (const [w, h] of STATE_SIZES) {
    for (const theme of THEMES) {
      const { ctx, page } = await demoLogin(browser, w, h, theme);
      trackedErrors.push({ errs: monitor(page), guest: false });
      // (a) edit dialog — role/aria-modal a11y + gates incl. ::placeholder surface.
      await page.goto(base + '/members/' + MBR.rootId, { waitUntil: 'domcontentloaded' });
      await expect(page.locator('[data-testid="member-name"]')).toBeVisible();
      await page.locator('[data-testid="member-edit"]').click();
      const dialog = page.locator('[role="dialog"]');
      await expect(dialog).toBeVisible();
      {
        const a11y = await dialog.evaluate((d) => ({ role: d.getAttribute('role'), modal: d.getAttribute('aria-modal') }));
        const g = await gates(page);
        await judge({ label: 'edit-dialog', w, h, theme, png: 'state-edit-dialog-' + w + '-' + theme,
          a11y, ...g, err: a11y.role !== 'dialog' || a11y.modal !== 'true'
            ? 'dialog role/aria-modal missing: ' + JSON.stringify(a11y) : null }, page);
      }
      await dialog.getByRole('button', { name: 'Hủy' }).click();
      await expect(dialog).toHaveCount(0);
      // (b) delete dialog.
      await page.locator('[data-testid="member-delete"]').click();
      await expect(page.locator('[data-testid="delete-confirm-text"]')).toBeVisible();
      {
        const g = await gates(page);
        await judge({ label: 'delete-dialog', w, h, theme, png: 'state-delete-dialog-' + w + '-' + theme, ...g, err: null }, page);
      }
      await page.locator('[role="dialog"]').getByRole('button', { name: 'Hủy' }).click();
      await expect(page.locator('[role="dialog"]')).toHaveCount(0);
      // (c) not-found — real 404 (console 404 whitelisted for auth pages here).
      await page.goto(base + '/members/' + BOGUS_UUID, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('heading', { name: 'Không tìm thấy thành viên' })).toBeVisible();
      {
        const g = await gates(page);
        await judge({ label: 'not-found', w, h, theme, png: 'state-not-found-' + w + '-' + theme, ...g, err: null }, page);
      }
      await ctx.close();
      // (d) guest — fresh anonymous context (401 GET /api/v1/me whitelisted).
      const gctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'vi-VN', colorScheme: theme });
      const gpage = await gctx.newPage();
      trackedErrors.push({ errs: monitor(gpage), guest: true });
      await gpage.goto(base + '/members/' + MBR.rootId, { waitUntil: 'domcontentloaded' });
      await expect(gpage.locator('[data-testid="member-name"]')).toBeVisible();
      {
        const g = await gates(gpage);
        await judge({ label: 'guest', w, h, theme, png: 'state-guest-' + w + '-' + theme, ...g, err: null }, gpage);
      }
      await gctx.close();
    }
  }
  // Console gates aggregated across every monitored page in this test.
  const rejected = [];
  for (const t of trackedErrors) {
    const allowed = t.guest ? [] : ['member-404'];
    rejected.push(...t.errs.filter((e) => !isWhitelisted(e, allowed)));
  }
  current.errors = rejected;
  current.proof = { combos: STATE_SIZES.length * THEMES.length, rows: rowCount.n, failures };
  expect(failures, 'state rows failed: ' + failures.join(' ;; ')).toEqual([]);
  expect(rejected, 'non-whitelisted console errors').toEqual([]);
});
