/**
 * Phase 3 content-route browser evidence matrix — CGP v2, feature/apple-design-all-pages.
 *
 * AUTH IS STAGED FOR VISUAL CAPTURE, NEVER REAL:
 *   Per .agents/shared/planning/apple-design-all-pages/phase3-content.md
 *   ("Staging vs Backend Distinction"), every authenticated visual state below is
 *   produced by page.route()/context.route() interception of the /api/v1/* endpoints
 *   (GET /me → 200 UserProfile, families, feed, members, kinship, member detail).
 *   Real demo login e2e belongs same-origin on localhost:3456 only: POST /api/v1/auth/demo
 *   returns 403 for any Origin not on the backend allowlist (e.g. this isolated
 *   127.0.0.1:18743 evidence origin) and the SPA silently swallows it — an
 *   environment artifact of the proxy setup, NOT a product defect.
 *
 * Environment:
 *   - SPA served from web/dist on $APPLE_PHASE3_BASE (isolated 127.0.0.1:1xxxx origin,
 *     /api/* proxied to the live backend localhost:3456).
 *   - NEVER touch host 127.0.0.1:5432 (ensemble's own Postgres).
 *   - Real member id for /members/:id is fetched from the live backend GET
 *     /api/v1/members (public read); the member DETAIL response itself is staged for
 *     deterministic visuals (noted in summary.json → liveBackendMember).
 *
 * Matrix: screens × {light,dark} (emulated prefers-color-scheme) ×
 *   1440×900 / 390×844 / 320×568; /account is 1440×900 light+dark only (Phase 1 drift check).
 * Per capture gates (recorded in summary.json, asserted per test):
 *   (a) alpha-compositing contrast sweep (Phase-2 convention incl. ::placeholder) ≥ 4.5:1;
 *   (b) document.documentElement.scrollWidth ≤ viewport width;
 *   (c) :focus-visible indication on the first Tab target;
 *   (d) console clean under a url-aware whitelist that explicitly allows the known
 *       ERR_BLOCKED_BY_ORB noise for absolute localhost:3456/static/... assets
 *       (proxy environment artifact) and 401 GET /api/v1/me.
 */
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const MIN_AA = 4.5;
const THEMES = ['light', 'dark'];
const SIZES = [[1440, 900], [390, 844], [320, 568]];
const base = process.env.APPLE_PHASE3_BASE;
if (!base || !/^http:\/\/127\.0\.0\.1:1[0-9]{4}$/.test(base)) {
  throw Error('APPLE_PHASE3_BASE must be the isolated evidence origin http://127.0.0.1:1xxxx');
}
const out = path.resolve(__dirname, '../../.phase3-content-evidence');
fs.mkdirSync(out, { recursive: true });
// Durable across Playwright worker reloads: the runner may load this module in a
// SECOND worker mid-run (observed after test failures), which would wipe the
// first worker's evidence. Cleanup therefore runs only in worker 0, and rows
// persist via append-only rows.jsonl that writeSummary() rebuilds from disk.
const rowsFile = path.join(out, 'rows.jsonl');
// APPLE_PHASE3_APPEND=1 → partial re-run mode: keep existing rows.jsonl/PNGs and
// let the png-keyed last-write-wins merge in writeSummary() replace only the
// re-captured screens (used for post-fix re-verification without recapturing
// the whole matrix).
// SAFE BY DEFAULT: the destructive wipe of prior PNG/summary/rows evidence runs
// ONLY with explicit operator opt-in APPLE_PHASE3_FRESH=1 (and never in append
// mode, never outside worker 0). Without it, pre-existing files are never
// deleted — append/merge semantics handle stale rows via last-write-wins.
const APPEND_MODE = process.env.APPLE_PHASE3_APPEND === '1';
const FRESH_MODE = process.env.APPLE_PHASE3_FRESH === '1';
if (FRESH_MODE && !APPEND_MODE && process.env.TEST_WORKER_INDEX === '0') {
  for (const f of fs.readdirSync(out)) {
    if (f.endsWith('.png') || f === 'summary.json' || f === 'rows.jsonl') {
      fs.unlinkSync(path.join(out, f));
    }
  }
}

/* ---------------- Staged payloads (deterministic Vietnamese content) ---------------- */
const NOW = '2026-09-27T12:00:00Z';
const DEMO_USER = {
  id: 'usr-e2e-demo',
  display_name: 'Demo E2E',
  is_demo: true,
  member_id: null,
  created_at: '2026-01-01T00:00:00Z',
};
const PROFILE = {
  User: DEMO_USER,
  Identities: [
    {
      id: 'idn-e2e-1',
      user_id: DEMO_USER.id,
      provider: 'demo',
      provider_subject: 'demo-e2e',
      linked_at: '2026-01-02T00:00:00Z',
      last_login_at: NOW,
    },
  ],
  Contacts: [
    {
      id: 'ctc-e2e-1',
      user_id: DEMO_USER.id,
      kind: 'email',
      value: 'demo-e2e@cgp.test',
      verified: true,
      verified_via: 'mock',
      created_at: '2026-01-02T00:00:00Z',
    },
    {
      id: 'ctc-e2e-2',
      user_id: DEMO_USER.id,
      kind: 'phone',
      value: '+84 90 000 00 02',
      verified: false,
      verified_via: null,
      created_at: '2026-01-03T00:00:00Z',
    },
  ],
};
const FAMILY = {
  id: '11111111-1111-4111-8111-000000000001',
  name: 'Gia phả họ Nguyễn Văn',
  version: 3,
  created_at: '2026-01-01T00:00:00Z',
};
// Mirrors the live seed + the kinship quick-demo pair (web/src/utils/demo.ts ids).
const member = (id, name, gen, gender, extra = {}) => ({
  id,
  family_id: FAMILY.id,
  full_name: name,
  gender,
  generation_index: gen,
  birth_date: null,
  death_date: null,
  is_living: true,
  avatar_url: null,
  notes: null,
  created_at: '2026-01-01T08:00:00Z',
  ...extra,
});
const M_AN = member('aaaaaaa1-0000-4000-8000-000000000001', 'Nguyễn Văn An', 1, 'male', {
  birth_date: '1928-03-15T00:00:00Z',
  death_date: '2015-10-02T00:00:00Z',
  is_living: false,
  avatar_url: '/static/avatars/avatar-m1.svg',
  notes: 'Thủy tổ gia phả (staged specimen).',
});
const M_BINH = member('bbbbbbb2-0000-4000-8000-000000000002', 'Nguyễn Văn Bình', 3, 'male', {
  avatar_url: '/static/avatars/avatar-m3.svg',
});
const M_CUC = member('ccccccc3-0000-4000-8000-000000000003', 'Nguyễn Thị Cúc', 2, 'female', {
  avatar_url: '/static/avatars/avatar-f1.svg',
});
const M_DUNG = member('ddddddd4-0000-4000-8000-000000000004', 'Nguyễn Văn Dũng', 2, 'male', {
  avatar_url: '/static/avatars/avatar-m4.svg',
});
const MEMBERS_PAGE = { items: [M_AN, M_BINH, M_CUC, M_DUNG], total: 4, limit: 100, offset: 0 };

const svgImg = (hue, label) =>
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="480" height="480"><rect width="480" height="480" fill="hsl(${hue},42%,82%)"/><rect x="36" y="36" width="408" height="408" rx="24" fill="none" stroke="hsl(${hue},42%,45%)" stroke-width="6"/><text x="50%" y="52%" font-family="sans-serif" font-size="30" fill="#55555C" text-anchor="middle">${label}</text></svg>`
  );
const POSTS = {
  posts: [
    {
      id: 'post-e2e-1',
      family_id: FAMILY.id,
      author_member_id: M_BINH.id,
      author_display_name: 'Nguyễn Văn Bình',
      content:
        'Kỷ niệm mùa rằm năm ngoái cả họ sum vầy tại nhà cụ — bài viết dựng cho bằng chứng Phase 3 (staged).',
      images: [svgImg(18, 'Ảnh giả định 1'), svgImg(210, 'Ảnh giả định 2')],
      created_at: '2026-09-24T09:30:00Z',
    },
    {
      id: 'post-e2e-2',
      family_id: FAMILY.id,
      author_member_id: M_CUC.id,
      author_display_name: 'Nguyễn Thị Cúc',
      content: 'Đã quét dọn nhà thờ họ, mong anh em gần xa góp ý chuẩn bị lễ giỗ (staged).',
      images: [],
      created_at: '2026-09-25T15:05:00Z',
    },
    {
      id: 'post-e2e-3',
      family_id: FAMILY.id,
      author_member_id: null,
      author_display_name: 'Demo E2E',
      content: 'Tài khoản dùng thử đăng dòng thời gian này — composer staged, không gọi backend (staged).',
      images: [],
      created_at: '2026-09-26T18:40:00Z',
    },
  ],
  next_cursor: null,
};

const kinshipTermFor = (q) => ({
  term: 'Cháu nội',
  line: 'Chi nội',
  generation_distance: 2,
  distance_label: 'Cách 2 đời',
  is_blood: true,
  dialect: q.get('dialect') || 'bac',
  path: [q.get('from'), q.get('to')].filter(Boolean),
});
const KINSHIP_UNRELATED = {
  term: '',
  line: '',
  generation_distance: 0,
  distance_label: '',
  is_blood: false,
  dialect: 'bac',
  path: [],
};

const MEMBER_DETAIL = (id, name) => ({
  id,
  family_id: FAMILY.id,
  full_name: name,
  gender: 'male',
  generation_index: 2,
  birth_date: '1962-03-15T00:00:00Z',
  death_date: null,
  is_living: true,
  avatar_url: '/static/avatars/avatar-m2.svg',
  notes: 'Hồ sơ thành viên dựng deterministic cho bằng chứng Phase 3 (staged detail, real id).',
  created_at: '2026-01-01T08:00:00Z',
  family_name: FAMILY.name,
  relations: {
    parents: [M_AN],
    spouses: [
      member('fffffff6-0000-4000-8000-000000000006', 'Nguyễn Thị Phương', 2, 'female', {
        avatar_url: '/static/avatars/avatar-f2.svg',
      }),
    ],
    siblings: [M_CUC],
    children: [
      member('eeeeeee5-0000-4000-8000-000000000005', 'Nguyễn Văn Em', 3, 'male', {
        avatar_url: '/static/avatars/avatar-m4.svg',
      }),
    ],
  },
  posts: POSTS.posts.slice(0, 2),
});

/* ---------------- API staging (page.route — sanctioned visual staging) ---------------- */
function stageApi(ctx, opts = {}) {
  const o = {
    authed: false,
    kinshipMode: 'term', // 'term' | 'unrelated' — mutable between captures
    memberId: null,
    memberName: 'Thành viên E2E',
    ...opts,
  };
  return ctx.route('**/api/**', async (route) => {
    const req = route.request();
    const u = new URL(req.url());
    const p = u.pathname;
    const j = (x) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(x) });
    if (p === '/api/v1/me') {
      return o.authed
        ? j(PROFILE)
        : route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ code: 'UNAUTHENTICATED', message: 'anonymous (staged)' }),
          });
    }
    if (p === '/api/v1/auth/providers') {
      return j({
        providers: [
          { id: 'google', name: 'Google' },
          { id: 'facebook', name: 'Facebook' },
          { id: 'zalo', name: 'Zalo' },
        ],
      });
    }
    if (p === '/api/v1/families') return j({ families: [FAMILY] });
    if (/^\/api\/v1\/families\/[^/]+\/feed$/.test(p)) {
      return req.method() === 'GET'
        ? j(POSTS)
        : j({ id: 'post-created-e2e', ...POSTS.posts[0] });
    }
    if (p === '/api/v1/members') return j(MEMBERS_PAGE);
    if (/^\/api\/v1\/members\/[^/]+$/.test(p)) {
      return j(MEMBER_DETAIL(o.memberId || 'aaaaaaa1-0000-4000-8000-000000000001', o.memberName));
    }
    if (p === '/api/v1/kinship') {
      return j(o.kinshipMode === 'unrelated' ? KINSHIP_UNRELATED : kinshipTermFor(u.searchParams));
    }
    return j({});
  });
}

/* ---------------- Console monitor + whitelist (Phase-2 conventions) ---------------- */
function monitor(p) {
  const errors = [];
  const responses = [];
  p.on('response', (r) => responses.push({ url: r.url(), status: r.status() }));
  p.on('pageerror', (e) => errors.push({ message: e.message, url: null, status: null }));
  p.on('console', (m) => {
    if (m.type() === 'error') {
      const loc = m.location().url || null;
      const hit =
        responses.find((r) => r.url === loc) || responses.find((r) => m.text().includes(r.url));
      errors.push({ message: m.text(), url: hit ? hit.url : loc, status: hit ? hit.status : null });
    }
  });
  return errors;
}
// 401 GET /me (anonymous probe) + the known ORB proxy artifact for absolute
// localhost:3456/static/... assets (environment, not product defect).
const whitelisted = (e) =>
  (e.status === 401 && /\/api\/v1\/me(?:\?|$)/.test(e.url || '')) ||
  /(?:localhost|127\.0\.0\.1):3456\/static\//.test((e.url || '') + ' ' + (e.message || ''));

/* ---------------- Alpha-compositing contrast sweep (Phase-2 convention) ----------------
 * Color parsing MUST go through canvas fillStyle: Tailwind v4 utility colors compute to
 * oklch(...), and a numeric regex mis-parses them (a previous run produced bogus ratio≈1).
 * Canvas 2D converts any CSS color (rgb/hsl/oklch/color()) to sRGB bytes for free.
 */
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
    let text = '', fg = parse(cs.color), kind = 'text';
    if (e.tagName === 'INPUT' || e.tagName === 'TEXTAREA') {
      text = e.value || e.getAttribute('placeholder') || '';
      if (!e.value && e.getAttribute('placeholder')) { fg = parse(getComputedStyle(e, '::placeholder').color); kind = 'placeholder'; }
    } else text = (e.innerText || '').trim();
    if (!text.trim()) continue;
    let bg = [255, 255, 255], n = e, opaque = false;
    while (n) { const c = parse(getComputedStyle(n).backgroundColor); if (c[3] > 0) { bg = bg.map((v, i) => c[i] * c[3] + v * (1 - c[3])); if (c[3] === 1) { opaque = true; break; } } n = n.parentElement; }
    const f = lum(fg.slice(0, 3)), b = lum(bg);
    out.push({ tag: e.tagName.toLowerCase(), kind, text: text.trim().replace(/\\s+/g, ' ').slice(0, 60), ratio: +( (Math.max(f, b) + 0.05) / (Math.min(f, b) + 0.05) ).toFixed(3), fg: 'rgb(' + fg.slice(0, 3).map(Math.round).join(', ') + ')', bg: 'rgb(' + bg.map(Math.round).join(', ') + ')', opaqueBg: opaque });
  }
  return out; })()`;

/* ---------------- Evidence rows + summary (disk-durable across worker reloads) ---------------- */
const rows = [];
let LIVE_MEMBER = null; // {id, name, source} — set by the member test from the live backend
function appendRecord(rec) {
  fs.appendFileSync(rowsFile, JSON.stringify(rec) + '\n');
}
function readRecords() {
  if (!fs.existsSync(rowsFile)) return [];
  const recs = [];
  for (const line of fs.readFileSync(rowsFile, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    try { recs.push(JSON.parse(t)); } catch (_) { /* torn tail line from an interrupted run */ }
  }
  return recs;
}
function writeSummary() {
  const recs = readRecords();
  const meta = [...recs].reverse().find((r) => r.type === 'meta');
  const merged = [];
  const byPng = new Map();
  for (const r of recs) {
    if (r.type !== 'row' || !r.row || !r.row.png) continue;
    if (byPng.has(r.row.png)) merged[byPng.get(r.row.png)] = r.row; // last write wins
    else { byPng.set(r.row.png, merged.length); merged.push(r.row); }
  }
  const rowsAll = merged;
  const screens = {};
  for (const r of rowsAll) {
    const s = (screens[r.screen] ||= {
      captures: 0,
      minContrast: null,
      maxScrollWidth: 0,
      consoleRejected: 0,
      verdict: 'PASS',
      failures: [],
    });
    s.captures += 1;
    if (r.contrastMin !== null) s.minContrast = s.minContrast === null ? r.contrastMin : Math.min(s.minContrast, r.contrastMin);
    s.maxScrollWidth = Math.max(s.maxScrollWidth, r.scrollWidth);
    s.consoleRejected += r.rejectedConsole.length;
    const f = [];
    if (r.contrastMin !== null && r.contrastMin < MIN_AA) f.push(`contrast ${r.contrastMin}`);
    if (r.overflow) f.push(`scrollWidth ${r.scrollWidth}>${r.w}`);
    if (!r.focusVisible) f.push('focus-visible');
    if (r.rejectedConsole.length) f.push(`console x${r.rejectedConsole.length}`);
    if (f.length) { s.verdict = 'FAIL'; s.failures.push(`${r.theme}/${r.w}x${r.h}: ${f.join(' + ')}`); }
  }
  const overall =
    Object.keys(screens).length > 0 && Object.values(screens).every((s) => s.verdict === 'PASS')
      ? 'PASS'
      : Object.keys(screens).length === 0
        ? 'INCOMPLETE'
        : 'FAIL';
  fs.writeFileSync(
    path.join(out, 'summary.json'),
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        base,
        authStaging:
          'Authenticated UI staged via context.route()/page.route() interception of /api/v1/* (plan: phase3-content.md "Staging vs Backend Distinction"). Real demo login is same-origin localhost:3456 only (POST /api/v1/auth/demo 403s for off-allowlist Origins — environment artifact, not a product defect).',
        liveBackendMember: (meta && meta.liveBackendMember) || LIVE_MEMBER,
        productDefects: [
          {
            id: 'PD-P3-1',
            verdict: 'RESOLVED (fixed in product source 2026-09-28; re-verified by kinship-only re-run — see kinship-result / kinship-unrelated rows)',
            surface: 'AppCombobox "Đời N" gen micro-badges (selected-member chips + option rows), web/src/components/ui/AppCombobox.vue genBadgeStyle()',
            screens: ['kinship-result', 'kinship-unrelated'],
            finding:
              'ORIGINAL (2026-09-27 run): genBadgeStyle painted color:var(--gen-N) on background:var(--gen-N-soft). Light theme failed WCAG AA 4.5:1: gen-1 #8C8C94 on #F3F3F5 = 3.01:1, gen-3 #5E7F79 on #EFF5F4 = 3.98:1 (gen-2 #6E7B8E on #F1F4F8 ≈ 3.8:1 by token math, not exercised). Dark theme passed.',
            resolution:
              'Source fix (not made by this evidence run): genBadgeStyle now uses color:var(--gen-N-fg) on var(--gen-N-soft). Token math on fixed source: gen-1..4 light 5.36–6.06:1, dark 5.18–6.24:1. Kinship-only re-run swept the affected screens (light+dark × 1440/390/320 for result; unrelated at its established 1440-light combo) — measured minima are in the merged rows; original failing minima were 3.01 (light) on both screens. Companion vitest (app-combobox/kinship/member-detail) 39/39 green per dispatcher.',
            suggestedFix:
              'Applied as above (retained for history): use the AA-safe --gen-N-fg tokens for badge text; keep --gen-N for stripes/borders.',
            repro: 'Light theme, /kinship, click quick-demo chip (An gen1 → Bình gen3): the two selected chips render the failing badges.',
          },
        ],
        gates: {
          contrast: `alpha-compositing sweep (text + ::placeholder) >= ${MIN_AA}:1 on rendered surface`,
          overflow: 'documentElement.scrollWidth <= viewport width',
          focus: ':focus-visible indicated on first Tab target',
          console: 'no non-whitelisted console errors (whitelist: 401 GET /api/v1/me; ERR_BLOCKED_BY_ORB for absolute localhost:3456/static/* assets)',
        },
        screens,
        overallVerdict: overall,
        rows: rowsAll,
      },
      null,
      2
    )
  );
}

/* ---------------- Matrix runner ---------------- */
async function matrix(browser, cfg) {
  const problems = [];
  const ctx = await browser.newContext({ locale: 'vi-VN' });
  const stageOpts = {
    authed: !!cfg.authed,
    kinshipMode: cfg.kinshipMode || 'term',
    memberId: cfg.memberId || null,
    memberName: cfg.memberName || 'Thành viên E2E',
  };
  await stageApi(ctx, stageOpts);
  for (const theme of THEMES) {
    for (const [w, h] of SIZES) {
      if (cfg.filter && !cfg.filter(theme, w)) continue;
      const page = await ctx.newPage();
      const errors = monitor(page);
      try {
        await page.emulateMedia({ colorScheme: theme });
        await page.setViewportSize({ width: w, height: h });
        await page.goto(base + cfg.url, { waitUntil: 'domcontentloaded' });
        if (cfg.ready) {
          await page.locator(cfg.ready).first().waitFor({ state: 'visible', timeout: 15000 });
        }
        if (cfg.setup) await cfg.setup(page);
        await page.waitForTimeout(400);
        const dims = await page.evaluate(() => ({
          sw: document.documentElement.scrollWidth,
          cw: document.documentElement.clientWidth,
        }));
        const entries = await page.evaluate(SWEEP);
        const min = entries.length ? Math.min(...entries.map((x) => x.ratio)) : null;
        await page.evaluate(() => {
          const el = document.activeElement;
          if (el && el.blur) el.blur();
        });
        await page.keyboard.press('Tab');
        await page.waitForTimeout(150);
        let focus = null;
        try {
          focus = await page.locator(':focus-visible').first().evaluate((el) => {
            const s = getComputedStyle(el);
            return {
              tag: el.tagName,
              label: (el.innerText || el.getAttribute('aria-label') || el.getAttribute('placeholder') || '')
                .trim()
                .slice(0, 40),
              outlineStyle: s.outlineStyle,
              boxShadow: s.boxShadow,
              indicated: s.outlineStyle !== 'none' || s.boxShadow !== 'none',
            };
          });
        } catch (_) { /* no focus-visible target */ }
        const extras = cfg.extras ? await cfg.extras(page) : {};
        const png = `${cfg.screen}-${theme}-${w}x${h}.png`;
        await page.screenshot({ path: path.join(out, png), fullPage: true });
        const rejected = errors.filter((e) => !whitelisted(e));
        const row = {
          screen: cfg.screen,
          url: cfg.url,
          theme,
          w,
          h,
          authed: stageOpts.authed,
          contrastSamples: entries.length,
          contrastMin: min === null ? null : +min.toFixed(2),
          worstContrast: entries
            .slice()
            .sort((a, b) => a.ratio - b.ratio)
            .slice(0, 3)
            .map((x) => ({ kind: x.kind, tag: x.tag, text: x.text, ratio: x.ratio })),
          scrollWidth: dims.sw,
          clientWidth: dims.cw,
          overflow: dims.sw > w,
          focusVisible: !!(focus && focus.indicated),
          focusTarget: focus ? `${focus.tag}${focus.label ? `:"${focus.label}"` : ''}` : null,
          consoleErrors: {
            all: errors.length,
            whitelisted: errors.filter(whitelisted).length,
            rejected: rejected.length,
          },
          rejectedConsole: rejected,
          png,
          extras,
        };
        rows.push(row);
        appendRecord({ type: 'row', row });
        writeSummary();
        const tag = `${cfg.screen}/${theme}/${w}x${h}`;
        if (entries.length === 0) problems.push(`${tag}: contrast sweep sampled 0 elements`);
        if (min !== null && min < MIN_AA) {
          problems.push(
            `${tag}: min contrast ${min.toFixed(2)} < ${MIN_AA} — worst: ` +
              row.worstContrast.map((x) => `${x.kind}:${x.tag}"${x.text}"=${x.ratio}`).join(', ')
          );
        }
        if (dims.sw > w) problems.push(`${tag}: scrollWidth ${dims.sw} > viewport ${w}`);
        if (!focus || !focus.indicated) problems.push(`${tag}: no focus-visible indication after Tab`);
        if (rejected.length) {
          problems.push(
            `${tag}: ${rejected.length} non-whitelisted console error(s): ` +
              rejected.map((e) => `${e.message} (${e.url || '-'} ${e.status ?? ''})`).join(' | ').slice(0, 500)
          );
        }
        if (cfg.assert) {
          const more = await cfg.assert(page, row);
          if (more && more.length) problems.push(...more.map((x) => `${tag}: ${x}`));
        }
      } finally {
        await page.close();
      }
    }
  }
  await ctx.close();
  return problems;
}

test.afterEach(async () => { writeSummary(); });
test.afterAll(async () => {
  writeSummary();
  // Console table for the list-reporter trail.
  for (const r of rows) {
    console.log(
      `[phase3] ${r.screen.padEnd(18)} ${r.theme.padEnd(5)} ${String(r.w).padEnd(4)} ` +
        `contrast=${r.contrastMin === null ? 'n/a' : r.contrastMin} samples=${r.contrastSamples} ` +
        `scroll=${r.scrollWidth}/${r.w} focus=${r.focusVisible ? 'Y' : 'N'} ` +
        `console=${r.consoleErrors.all}(wl ${r.consoleErrors.whitelisted}, rej ${r.consoleErrors.rejected})`
    );
  }
});

/* ---------------- Per-screen setups / asserts ---------------- */
const CHIP_URL = 'https://images.example.test/hoi-he-rumbo-e2e.svg';
const feedDemoSetup = async (page) => {
  await page.locator('[data-testid="composer-char-counter"]').waitFor({ state: 'visible', timeout: 10000 });
  await page
    .locator('[data-testid="composer-form"] textarea')
    .fill('Chia sẻ kỷ niệm mùa giỗ họ — nội dung gõ cho bằng chứng Phase 3 (staged auth).');
  await page.locator('[data-testid="composer-form"] input[type="url"]').fill(CHIP_URL);
  await page.getByRole('button', { name: /Thêm ảnh/ }).click();
  await page.locator(`[title="${CHIP_URL}"]`).waitFor({ state: 'visible', timeout: 5000 });
};
const feedDemoAssert = async (page, row) => {
  const p = [];
  const counter = await page.locator('[data-testid="composer-char-counter"]').innerText();
  if (!/^\d+\/5000$/.test(counter.trim())) p.push(`char counter not n/5000: "${counter.trim()}"`);
  if ((await page.locator(`[title="${CHIP_URL}"]`).count()) !== 1) p.push('image-URL chip not present exactly once');
  if ((await page.locator('[data-testid="anonymous-hint"]').count()) !== 0) p.push('anonymous hint rendered in staged-auth feed');
  if ((await page.locator('[data-testid="post-author"]').count()) < 3) p.push('staged posts not rendered (<3)');
  row.extras.charCounter = counter.trim();
  return p;
};
const feedAnonAssert = async (page) => {
  const p = [];
  if ((await page.locator('[data-testid="composer-form"]').count()) !== 0) p.push('composer rendered for anonymous session');
  if ((await page.locator('[data-testid="anonymous-hint"]').count()) !== 1) p.push('login-hint banner not present exactly once');
  if ((await page.locator('[data-testid="login-cta"]').count()) !== 1) p.push('login CTA missing');
  if ((await page.locator('[data-testid="post-author"]').count()) === 0) p.push('no staged posts rendered (public read)');
  return p;
};
const kinshipPromptAssert = async (page) => {
  const p = [];
  if ((await page.locator('[data-testid="picker-input-1"]').count()) === 0) p.push('picker 1 missing');
  if ((await page.locator('[data-testid="picker-input-2"]').count()) === 0) p.push('picker 2 missing');
  if ((await page.locator('[data-testid="quick-demo-chip"]').count()) === 0) p.push('quick-demo chip missing');
  if ((await page.locator('[data-testid="kinship-initial-prompt"]').count()) === 0) p.push('initial prompt missing');
  if ((await page.locator('div.max-w-xs select').count()) !== 1) p.push('dialect select missing');
  return p;
};
const kinshipTermSetup = async (page) => {
  await page.locator('[data-testid="quick-demo-chip"]').click();
  await page.waitForFunction(
    () => { const b = document.querySelector('[data-testid="calculate-btn"]'); return b && !b.disabled; },
    null,
    { timeout: 8000 }
  );
  await page.locator('[data-testid="calculate-btn"]').click();
  await page.locator('[data-testid="kinship-term"]').waitFor({ state: 'visible', timeout: 10000 });
};
const kinshipTermExtras = async (page) => ({
  term: (await page.locator('[data-testid="kinship-term"]').innerText()).trim(),
  steps: await page.locator('[data-testid^="kinship-step-"]').count(),
  badges: await page.locator('[data-testid="kinship-result-container"] [class*="inline-flex"]').count(),
});
const kinshipTermAssert = async (page, row) => {
  const p = [];
  const term = row.extras.term || '';
  if (term !== 'Cháu nội') p.push(`kinship-term expected "Cháu nội", got "${term}"`);
  if ((row.extras.steps || 0) !== 2) p.push(`expected 2 path steps, got ${row.extras.steps}`);
  if ((await page.locator('[data-testid="kinship-unrelated"]').count()) !== 0) p.push('unrelated notice rendered for related result');
  return p;
};
const kinshipUnrelatedSetup = async (page) => {
  await page.locator('[data-testid="quick-demo-chip"]').click();
  await page.waitForFunction(
    () => { const b = document.querySelector('[data-testid="calculate-btn"]'); return b && !b.disabled; },
    null,
    { timeout: 8000 }
  );
  await page.locator('[data-testid="calculate-btn"]').click();
  await page.locator('[data-testid="kinship-unrelated"]').waitFor({ state: 'visible', timeout: 10000 });
};
const kinshipUnrelatedAssert = async (page) => {
  const p = [];
  if ((await page.locator('[data-testid="kinship-result-container"]').count()) !== 0) p.push('result panel rendered for unrelated variant');
  const heading = await page.locator('[data-testid="kinship-unrelated"] h2').innerText().catch(() => '');
  if (!/Không tìm thấy quan hệ/.test(heading)) p.push(`unrelated heading unexpected: "${heading}"`);
  return p;
};
const memberTabSetup = (tab) => async (page) => {
  await page.locator(`[data-testid="tab-${tab}"]`).click();
  await page.locator(`[data-testid="tab-panel-${tab}"]`).waitFor({ state: 'visible', timeout: 8000 });
};
const memberTabAssert = (tab) => async (page) => {
  const p = [];
  if ((await page.locator('[data-testid="member-loading"]').count()) !== 0) p.push('stuck in loading state');
  if ((await page.locator(`[data-testid="tab-panel-${tab}"]`).count()) !== 1) p.push(`tab panel ${tab} not visible`);
  if ((await page.locator('[data-testid="member-edit"]').count()) !== 1) p.push('edit affordance missing for staged-auth');
  return p;
};
const notFoundExtras = async (page) => ({
  discBg: await page
    .locator('[data-testid="not-found"] > div.rounded-full')
    .first()
    .evaluate((e) => getComputedStyle(e).backgroundColor)
    .catch(() => null),
});
const notFoundAssert = async (page, row) => {
  const p = [];
  if (!row.extras.discBg || /rgba?\(0, 0, 0, 0\)|transparent/.test(row.extras.discBg)) p.push('terracotta disc background missing/transparent');
  if ((await page.locator('[data-testid="not-found-home"]').count()) !== 1) p.push('recovery action /tree missing');
  if ((await page.locator('[data-testid="not-found-kinship"]').count()) !== 1) p.push('recovery action /kinship missing');
  return p;
};
const accountExtras = async (page) => ({
  displayName: (await page.locator('[data-testid="user-display-name"]').innerText()).trim(),
  demoBadge: (await page.locator('[data-testid="demo-badge"]').innerText().catch(() => '')) .trim(),
});
const accountAssert = async (page, row) => {
  const p = [];
  if (row.extras.displayName !== 'Demo E2E') p.push(`display name expected "Demo E2E", got "${row.extras.displayName}"`);
  if (!/Phiên demo/i.test(row.extras.demoBadge || '')) p.push('amber demo badge missing on /account');
  if ((await page.locator('[data-testid="logout-btn"]').count()) !== 1) p.push('logout button missing');
  if ((await page.locator('[data-testid="identity-card-idn-e2e-1"]').count()) !== 1) p.push('linked identity card missing');
  if ((await page.getByRole('button', { name: /Liên kết với/ }).count()) !== 0) p.push('demo provider-link affordance rendered (must stay hidden)');
  if ((await page.locator('[data-testid^="contact-row-"]').count()) !== 2) p.push('contact rows != 2');
  return p;
};

/* ---------------- The matrix ---------------- */
test('phase3 matrix — /feed anonymous (login-hint banner, NO composer)', async ({ browser }) => {
  test.setTimeout(120000);
  const problems = await matrix(browser, {
    screen: 'feed-anonymous',
    url: '/feed',
    authed: false,
    ready: '[data-testid="anonymous-hint"]',
    assert: feedAnonAssert,
  });
  expect(problems, JSON.stringify(problems, null, 2)).toEqual([]);
});

test('phase3 matrix — /feed staged-auth (composer + counter + image-URL chips)', async ({ browser }) => {
  test.setTimeout(120000);
  const problems = await matrix(browser, {
    screen: 'feed-demo',
    url: '/feed',
    authed: true,
    ready: '[data-testid="composer-form"]',
    setup: feedDemoSetup,
    assert: feedDemoAssert,
  });
  expect(problems, JSON.stringify(problems, null, 2)).toEqual([]);
});

test('phase3 matrix — /kinship initial prompt (two pickers, dialect, demo chip)', async ({ browser }) => {
  test.setTimeout(120000);
  const problems = await matrix(browser, {
    screen: 'kinship-prompt',
    url: '/kinship',
    authed: true,
    ready: '[data-testid="kinship-initial-prompt"]',
    assert: kinshipPromptAssert,
  });
  expect(problems, JSON.stringify(problems, null, 2)).toEqual([]);
});

test('phase3 matrix — /kinship result (staged calculate → deterministic term + path)', async ({ browser }) => {
  test.setTimeout(120000);
  const problems = await matrix(browser, {
    screen: 'kinship-result',
    url: '/kinship',
    authed: true,
    kinshipMode: 'term',
    ready: '[data-testid="kinship-initial-prompt"]',
    setup: kinshipTermSetup,
    extras: kinshipTermExtras,
    assert: kinshipTermAssert,
  });
  expect(problems, JSON.stringify(problems, null, 2)).toEqual([]);
});

test('phase3 variant — /kinship unrelated notice (staged empty-line result, 1440 light)', async ({ browser }) => {
  test.setTimeout(60000);
  const problems = await matrix(browser, {
    screen: 'kinship-unrelated',
    url: '/kinship',
    authed: true,
    kinshipMode: 'unrelated',
    ready: '[data-testid="kinship-initial-prompt"]',
    setup: kinshipUnrelatedSetup,
    assert: kinshipUnrelatedAssert,
    filter: (theme, w) => theme === 'light' && w === 1440,
  });
  expect(problems, JSON.stringify(problems, null, 2)).toEqual([]);
});

test('phase3 matrix — /members/:id tabs overview/relations/posts (real live id, staged detail)', async ({ browser }) => {
  test.setTimeout(240000);
  // Real member id from the live backend (public read) — GET is NOT origin-blocked.
  const request = await require('@playwright/test').request.newContext({ baseURL: 'http://localhost:3456' });
  let id = 'aaaaaaa1-0000-4000-8000-000000000001';
  let name = 'Nguyễn Văn An';
  let source = 'fallback (verified live 2026-09-27)';
  try {
    const r = await request.get('/api/v1/members?limit=5');
    if (r.ok()) {
      const j = await r.json();
      const first = (j.items || [])[0];
      if (first && first.id) { id = first.id; name = first.full_name; source = `live GET /api/v1/members (${r.status()})`; }
    }
  } catch (_) { /* keep fallback */ }
  await request.dispose();
  LIVE_MEMBER = { id, name, source, note: 'route id is real; detail payload staged for deterministic visuals' };
  appendRecord({ type: 'meta', liveBackendMember: LIVE_MEMBER });

  const cfg = (screen, tab) => ({
    screen,
    url: `/members/${encodeURIComponent(id)}`,
    authed: true,
    memberId: id,
    memberName: name,
    ready: '[data-testid="member-name"]',
    setup: memberTabSetup(tab),
    assert: memberTabAssert(tab),
  });
  const problems = [
    ...(await matrix(browser, cfg('member-overview', 'overview'))),
    ...(await matrix(browser, cfg('member-relations', 'relations'))),
    ...(await matrix(browser, cfg('member-posts', 'posts'))),
  ];
  expect(problems, JSON.stringify(problems, null, 2)).toEqual([]);
});

test('phase3 matrix — /404 bogus path (terracotta disc composition)', async ({ browser }) => {
  test.setTimeout(120000);
  const problems = await matrix(browser, {
    screen: 'not-found',
    url: '/phase3-e2e-bogus-khong-ton-tai',
    authed: false,
    ready: '[data-testid="not-found"]',
    extras: notFoundExtras,
    assert: notFoundAssert,
  });
  expect(problems, JSON.stringify(problems, null, 2)).toEqual([]);
});

test('phase3 matrix — /account staged-auth demo drift check (1440 light+dark)', async ({ browser }) => {
  test.setTimeout(60000);
  const problems = await matrix(browser, {
    screen: 'account',
    url: '/account',
    authed: true,
    ready: '[data-testid="user-display-name"]',
    extras: accountExtras,
    assert: accountAssert,
    filter: (_theme, w) => w === 1440,
  });
  expect(problems, JSON.stringify(problems, null, 2)).toEqual([]);
});
