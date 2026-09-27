// Independent Phase 3 /kinship verification spec (REWRITE of the unvalidated draft).
// Authoring contract: expectations anchored in SOURCE, not mockups. Mockup
// .agents/shared/planning/apple-redesign/mockups/kinship.html is visual
// reference only; disagreements resolved toward source (noted below).
//
// EXPECTATION → SOURCE ANCHOR TABLE
// | # | Expectation                                                        | Source anchor                                   |
// |---|--------------------------------------------------------------------|--------------------------------------------------|
// | 1 | Page head eyebrow "Công cụ", h1 "Tính quan hệ họ hàng"             | web/src/views/KinshipView.vue:5-13               |
// | 2 | quick-demo chip testid + label "Thử nhanh: Ông → Cháu nội (…An → …Bình)", amber (INV-04) | KinshipView.vue:16-28                |
// | 3 | Picker testids picker-input-1/2 (fallthrough → root), input[role=combobox] inside | KinshipView.vue:59-81; AppCombobox.vue:55-78 |
// | 4 | Swap testids swap-pickers-desktop (hidden md:flex) / swap-pickers-mobile (flex md:hidden) | KinshipView.vue:43-52, 86-98 |
// | 5 | swapSelections exchanges store.from/to; store watch invalidates stale result | KinshipView.vue:277-281; stores/kinship.ts:26-45 |
// | 6 | Dialect native select label "Phương ngữ xưng hô", bac/trung/nam → 'Miền Bắc (Chuẩn)'/'Miền Trung'/'Miền Nam' | KinshipView.vue:100-111; AppSelect.vue:10-29 |
// | 7 | calculate-btn "Tính quan hệ" :disabled until both picked, :loading=store.loading | KinshipView.vue:119-128                |
// | 8 | AppButton loading → [disabled] + svg.animate-spin spinner           | components/ui/AppButton.vue:6-27                 |
// | 9 | reset-btn "Chọn lại" → store.reset() → prompt returns              | KinshipView.vue:130-137, 303-305                 |
// |10 | kinship-initial-prompt v-if !bothSelected && !result               | KinshipView.vue:151-170, 224-226                 |
// |11 | kinship-error banner on store.error; retry = calculate still active| KinshipView.vue:141-148                          |
// |12 | kinship-unrelated: result && !line && path empty, heading "Không tìm thấy quan hệ họ hàng" | KinshipView.vue:172-190, 228-231 |
// |13 | members-error banner when list load fails (§2 state)               | KinshipView.vue:30-37, 261-275                   |
// |14 | kinship-term BARE textContent; decorative quotes ONLY via .kinship-term-quoted::before/after content \201C/\201D (INV-05) | components/kinship/KinshipResult.vue:8-9; assets/main.css:379-384 |
// |15 | Term terracotta color = --accent-fg token                          | KinshipResult.vue:8; main.css:196/286            |
// |16 | Metadata chips: line, distance_label, is_blood, dialect label      | KinshipResult.vue:17-30, 144-154                 |
// |17 | Path timeline data-testid="kinship-step-N" per path index          | KinshipResult.vue:39-47, 190-222                 |
// |18 | Listbox ul.absolute.z-30[role=listbox], li[role=option] with NATIVE button; '.absolute.z-30 button' pinned selector | AppCombobox.vue:83-155 |
// |19 | ARIA: role=combobox, aria-expanded, aria-controls=listboxId, aria-autocomplete=list | AppCombobox.vue:59-77            |
// |20 | Keyboard: ArrowDown opens/moves active, Enter selects, Escape closes | AppCombobox.vue:258-288                         |
// |21 | picker input IDs = generated app-combobox-N, stable per mount (swap must not remount) | AppCombobox.vue:203-206        |
// |22 | PD-P3-1: genBadgeStyle → bg var(--gen-N-soft), color var(--gen-N-fg) | AppCombobox.vue:290-300                        |
// |23 | genAccentVar/genSoftVar modulo-4 slots                             | components/tree/card-visual.ts:44-52             |
// |24 | Light tokens --gen-N-fg ≠ --gen-N (pre-fix failure side); dark --gen-N-fg = var(--gen-N) | assets/main.css:226-233, 313-320 |
// |25 | GET /api/v1/kinship?from&to&dialect                                | api/kinship.ts:12-24; api/client.ts:71           |
// |26 | GET /api/v1/members?limit=100 → Page{items,total,limit,offset}     | api/members.ts:16-18; KinshipView.vue:222,265; types/api.ts:122-127 |
// |27 | Demo pair ids DEMO_ROOT_ID/DEMO_GRANDSON_ID (An gen1 → Bình gen3)  | utils/demo.ts:19-45                              |
// |28 | Demo result term "Ông nội" / line "Chi nội" / distance "Cách 2 đời" (staged echo of source contract) | web/src/test/kinship-result.spec.ts:8-11, task INV-05 |
//
// MOCKUP DISAGREEMENTS (source wins):
// - mockup chip "Dùng thử nhanh: An → Phúc" (Nguyễn Minh Phúc) vs source chip "Thử nhanh: Ông → Cháu nội (Nguyễn Văn An → Nguyễn Văn Bình)" → source.
// - mockup h1 "Tính quan hệ" vs source h1 "Tính quan hệ họ hàng" → source.
// - mockup result term "Cụ và chắt" for An→Phúc vs source demo pair An→Bình yielding "Ông nội" → source.
// - mockup shows NO dialect selector; source ships native select Bắc/Trung/Nam → source.
// - mockup combobox inputs are readonly display fields; source uses real AppCombobox (role=combobox + native option buttons) → source.
const { test, expect } = require('@playwright/test');
const fs = require('node:fs'), path = require('node:path');
const MIN_AA = 4.5, DELAY_MS = 650;
const SIZES = [[1440, 900], [390, 844], [320, 568]], THEMES = ['light', 'dark'], STATE_SIZES = [[1440, 900], [390, 844]];
const base = process.env.APPLE_PHASE3_KINSHIP_BASE;
if (!base || !/^http:\/\/127\.0\.0\.1:1[0-9]{4}$/.test(base)) throw Error('APPLE_PHASE3_KINSHIP_BASE required (http://127.0.0.1:1xxxx)');
const out = process.env.APPLE_PHASE3_KINSHIP_ARTIFACTS || path.resolve(__dirname, '../../.agents/tester/RESULTS/apple_phase3_kinship_browser');
fs.mkdirSync(out, { recursive: true });

// --- staged world (fresh context per row; production code paths untouched) ---
const FAM = '11111111-1111-4111-8111-000000000001';
const AN = 'aaaaaaa1-0000-4000-8000-000000000001', BINH = 'bbbbbbb2-0000-4000-8000-000000000002';
const CUONG = 'ccccccc3-0000-4000-8000-000000000003', HANH = 'ddddddd4-0000-4000-8000-000000000004';
const MEMBERS = [
  { id: AN, family_id: FAM, full_name: 'Nguyễn Văn An', gender: 'male', generation_index: 1, is_living: false, avatar_url: null, created_at: '2026-01-01T00:00:00Z' },
  { id: BINH, family_id: FAM, full_name: 'Nguyễn Văn Bình', gender: 'male', generation_index: 3, is_living: true, avatar_url: null, created_at: '2026-01-01T00:00:00Z' },
  { id: CUONG, family_id: FAM, full_name: 'Nguyễn Văn Cường', gender: 'male', generation_index: 2, is_living: true, avatar_url: null, created_at: '2026-01-01T00:00:00Z' },
  { id: HANH, family_id: FAM, full_name: 'Nguyễn Thị Hạnh', gender: 'female', generation_index: 3, is_living: true, avatar_url: null, created_at: '2026-01-01T00:00:00Z' },
];
// Source contract for the demo pair (An → grandson Bình): INV-05 exact term set.
const pairResult = dialect => ({ term: 'Ông nội', line: 'Chi nội', generation_distance: 2, distance_label: 'Cách 2 đời', is_blood: true, dialect, path: [AN, BINH] });
const UNRELATED = { term: 'Không rõ', line: null, generation_distance: 0, distance_label: '', is_blood: false, dialect: 'bac', path: [] };

async function staged(browser, { w = 1440, h = 900, theme = 'light', kinship = 'ok', membersStatus = 200 } = {}) {
  const c = await browser.newContext({ viewport: { width: w, height: h }, locale: 'vi-VN', colorScheme: theme });
  await c.route('**/api/**', async r => {
    const u = r.request().url();
    if (/\/api\/v1\/me(?:\?|$)/.test(u)) return r.fulfill({ status: 401, contentType: 'application/json', body: '{"code":"UNAUTHENTICATED"}' });
    if (/\/api\/v1\/members(?:\?|$)/.test(u)) {
      if (membersStatus !== 200) return r.fulfill({ status: membersStatus, contentType: 'application/json', body: '{"code":"INTERNAL","message":"Không tải được thành viên"}' });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: MEMBERS, total: MEMBERS.length, limit: 100, offset: 0 }) });
    }
    if (u.includes('/api/v1/kinship')) {
      if (kinship === 'delay') await new Promise(res => setTimeout(res, DELAY_MS));
      if (kinship === 'error') return r.fulfill({ status: 500, contentType: 'application/json', body: '{"code":"INTERNAL","message":"Lỗi máy chủ"}' });
      if (kinship === 'unrelated') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(UNRELATED) });
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(pairResult(new URL(u).searchParams.get('dialect') || 'bac')) });
    }
    return r.fulfill({ status: 404, contentType: 'application/json', body: '{}' });
  });
  return c;
}

async function open(c) {
  const p = await c.newPage(), errors = [], responses = [];
  p.on('pageerror', e => errors.push({ message: e.message, url: null, status: null }));
  p.on('response', r => responses.push({ url: r.url(), status: r.status() }));
  p.on('console', m => {
    if (m.type() !== 'error') return;
    const loc = m.location().url || null;
    const match = responses.find(r => r.url === loc) || responses.find(r => (m.text() || '').includes(r.url));
    errors.push({ message: m.text(), url: match ? match.url : loc, status: match ? match.status : null });
  });
  current.errors = errors; current.p = p;
  await p.goto(base + '/kinship', { waitUntil: 'domcontentloaded' });
  return { p, errors };
}

const isWhitelisted = (e, allowed = []) => (e.status === 401 && /\/api\/v1\/me(?:\?|$)/.test(e.url || '')) ||
  (allowed || []).some(a => a.status === e.status && a.re.test(e.url || ''));
const expectConsoleClean = (allowed = []) => {
  const rejected = (current.errors || []).filter(e => !isWhitelisted(e, allowed));
  expect(rejected, 'unexpected console/page errors: ' + JSON.stringify(rejected)).toEqual([]);
};

// Alpha-composited contrast sweep over visible text-bearing elements (proven port,
// apple-phase2-email-verify.spec.cjs:13) + per-row overflow and first-Tab focus-visible.
async function rowGates(p, theme, w, state) {
  const rows = await p.evaluate(`(() => {
    const lum = s => { const m = s.match(/[\\d.]+/g) || [0,0,0], a = m.slice(0,3).map(v => +v/255).map(v => v <= .04045 ? v/12.92 : ((v+.055)/1.055) ** 2.4); return .2126*a[0] + .7152*a[1] + .0722*a[2]; };
    const parse = s => { const m=s.match(/rgba?\(([^)]+)\)/); if(m){const a=m[1].match(/[\\d.]+/g).map(Number);return[a[0],a[1],a[2],a.length>3?a[3]:1]} const c=document.createElement("canvas").getContext("2d"); c.fillStyle=s; const rgb=c.fillStyle.match(/[\\d.]+/g)||[]; return rgb.length>=3?[+rgb[0],+rgb[1],+rgb[2],1]:[0,0,0,0]; };
    const out = [];
    for (const e of document.querySelectorAll('h1,h2,h3,p,span,a,button,label'))
      if (e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && (e.innerText || '').trim() && !e.closest('[aria-hidden=true]')) {
        const fg = parse(getComputedStyle(e).color), color = getComputedStyle(e).color;
        let bg = [255,255,255], n = e;
        while (n) { let x = parse(getComputedStyle(n).backgroundColor); if (x[3]) { bg = x.slice(0,3).map((v,i) => v*x[3] + bg[i]*(1-x[3])); if (x[3] === 1) break; } n = n.parentElement; }
        const a = lum('rgb(' + fg.slice(0,3) + ')'), b = lum('rgb(' + bg + ')');
        out.push({ text: e.innerText.trim().slice(0,60), color, effectiveBackground: 'rgb(' + bg.map(Math.round).join(', ') + ')', ratio: (Math.max(a,b) + .05) / (Math.min(a,b) + .05) });
      }
    return out;
  })()`);
  expect(rows.length, state + ' ' + w + 'px ' + theme + ' sweep found text').toBeGreaterThan(0);
  const low = rows.filter(x => !Number.isFinite(x.ratio) || x.ratio < MIN_AA);
  if (low.length) await p.screenshot({ path: path.join(out, `fail-${state}-${w}-${theme}-contrast.png`), fullPage: true }).catch(() => {});
  expect(low, state + ' ' + w + 'px ' + theme + ' contrast < ' + MIN_AA + ': ' + JSON.stringify(low.slice(0, 5))).toEqual([]);
  const overflow = await p.evaluate(() => [document.documentElement, document.body].map(x => x.scrollWidth - x.clientWidth));
  if (overflow.some(x => x > 0)) await p.screenshot({ path: path.join(out, `fail-${state}-${w}-${theme}-overflow.png`), fullPage: true }).catch(() => {});
  expect(overflow.every(x => x <= 0), state + ' ' + w + 'px ' + theme + ' horizontal overflow ' + JSON.stringify(overflow)).toBeTruthy();
  await p.evaluate(() => document.activeElement && document.activeElement.blur());
  await p.keyboard.press('Tab');
  const focus = await p.locator(':focus-visible').first().evaluate(e => { const s = getComputedStyle(e); return s.outlineStyle !== 'none' || s.boxShadow !== 'none'; }).catch(() => false);
  expect(focus, state + ' ' + w + 'px ' + theme + ' first Tab shows focus-visible ring').toBeTruthy();
  const rec = { state, width: w, theme, swept: rows.length, lowest: rows.slice().sort((a, b) => a.ratio - b.ratio).slice(0, 3).map(x => ({ text: x.text, ratio: +x.ratio.toFixed(2) })), overflow, focusVisible: focus };
  (current.visual ||= []).push(rec);
  return rec;
}

// PD-P3-1 badge scan: every visible "Đời N" micro-badge must carry color
// var(--gen-N-fg) on var(--gen-N-soft) with alpha-composited contrast ≥ MIN_AA.
const scanGenBadges = p => p.evaluate(() => {
  const probe = v => { const el = document.createElement('span'); el.style.color = v; document.body.appendChild(el); const c = getComputedStyle(el).color; el.remove(); return c; };
  const parse = s => { const m = (s || '').match(/[\d.]+/g) || []; return m.length >= 3 ? [+m[0], +m[1], +m[2]] : null; };
  const eq = (a, b) => { const x = parse(a), y = parse(b); return !!x && !!y && x.every((v, i) => Math.abs(v - y[i]) < 1); };
  const lum = c => { const a = c.map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4); return .2126 * a[0] + .7152 * a[1] + .0722 * a[2]; };
  const out = [];
  for (const el of document.querySelectorAll('span')) {
    const m = (el.textContent || '').trim().match(/^Đời (\d+)$/);
    if (!m || !el.getClientRects().length) continue;
    const slot = ((+m[1] - 1) % 4) + 1;
    const cs = getComputedStyle(el), fgToken = probe(`var(--gen-${slot}-fg)`), accent = probe(`var(--gen-${slot})`);
    let bg = [255, 255, 255], n = el;
    while (n) { const mm = getComputedStyle(n).backgroundColor.match(/[\d.]+/g) || []; if (mm.length >= 3) { const a = mm.length > 3 ? +mm[3] : 1; bg = bg.map((v, i) => +mm[i] * a + v * (1 - a)); if (a === 1) break; } n = n.parentElement; }
    const L1 = lum(cs.color.match(/[\d.]+/g).slice(0, 3).map(Number)), L2 = lum(bg);
    out.push({
      text: (el.textContent || '').trim(), slot, color: cs.color, background: `rgb(${bg.map(Math.round).join(', ')})`,
      colorIsFgToken: eq(cs.color, fgToken), tokensDiffer: !eq(fgToken, accent),
      colorIsBareAccent: eq(cs.color, accent) && !eq(fgToken, accent), ratio: +(((Math.max(L1, L2) + .05) / (Math.min(L1, L2) + .05))).toFixed(2),
    });
  }
  return out;
});

// --- helpers bound to current page ---
const picker1 = p => p.locator('[data-testid="picker-input-1"]');
const picker2 = p => p.locator('[data-testid="picker-input-2"]');
const input1 = p => picker1(p).locator('input[role="combobox"]');
const input2 = p => picker2(p).locator('input[role="combobox"]');
const calcBtn = p => p.locator('[data-testid="calculate-btn"]');
const quickDemo = p => p.locator('[data-testid="quick-demo-chip"]');

async function pickViaKeyboard(p) { // opens listbox, ArrowDown ×2, Enter (option index 1 = Nguyễn Văn Bình)
  await input1(p).click();
  await input1(p).press('ArrowDown');
  await input1(p).press('ArrowDown');
  await input1(p).press('Enter');
  await expect(picker1(p).locator('[data-testid="combobox-selected-chip"]')).toContainText('Nguyễn Văn Bình');
}
async function pickViaMouse(p, which, name) { // native button inside the pinned '.absolute.z-30' listbox
  await (which === 1 ? input1(p) : input2(p)).click();
  await (which === 1 ? picker1(p) : picker2(p)).locator('.absolute.z-30 button').filter({ hasText: name }).first().click();
  await expect((which === 1 ? picker1(p) : picker2(p)).locator('[data-testid="combobox-selected-chip"]')).toContainText(name);
}

let current = {}, cases = [];
test.afterEach(async ({}, info) => {
  const allowed = current.allowedConsole || [];
  const record = {
    title: info.title, status: info.status, expectedStatus: info.expectedStatus,
    allowedConsole: allowed,
    errors: (current.errors || []).map(e => ({ url: e.url, status: e.status })),
    whitelisted: (current.errors || []).filter(e => isWhitelisted(e, allowed)).map(e => ({ url: e.url, status: e.status })),
    nonWhitelisted: (current.errors || []).filter(e => !isWhitelisted(e, allowed)).map(e => ({ url: e.url, status: e.status, message: (e.message || '').slice(0, 200) })),
    visual: current.visual || [], proof: current.proof || {},
  };
  if (info.status !== 'passed' && current.p) await current.p.screenshot({ path: path.join(out, 'fail-' + info.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.png'), fullPage: true }).catch(() => {});
  cases.push(record);
  await fs.promises.writeFile(path.join(out, 'case-' + info.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase() + '.json'), JSON.stringify(record, null, 2));
  await fs.promises.writeFile(path.join(out, 'summary.json'), JSON.stringify({ cases }, null, 2));
  current = {};
});

// 1) Prompt state matrix: composition + per-row gates, every size × theme.
test('prompt state: composition and per-row gates across sizes and themes', async ({ browser }) => {
  current.proof = {};
  for (const [w, h] of SIZES) for (const theme of THEMES) {
    const c = await staged(browser, { w, h, theme }); const { p } = await open(c);
    await expect(p.getByRole('heading', { name: 'Tính quan hệ họ hàng' })).toBeVisible();
    await expect(input1(p)).toBeVisible();
    await expect(input2(p)).toBeVisible();
    await expect(picker1(p).locator('[data-testid="combobox-selected-chip"]')).toHaveCount(0);
    await expect(p.locator('[data-testid="kinship-initial-prompt"]')).toBeVisible();
    await expect(quickDemo(p)).toContainText('Thử nhanh: Ông → Cháu nội');
    await expect(calcBtn(p)).toBeDisabled();
    const desktop = p.locator('[data-testid="swap-pickers-desktop"]'), mobile = p.locator('[data-testid="swap-pickers-mobile"]');
    if (w >= 768) { await expect(desktop).toBeVisible(); await expect(mobile).toBeHidden(); }
    else { await expect(mobile).toBeVisible(); await expect(desktop).toBeHidden(); }
    const dialect = p.getByLabel('Phương ngữ xưng hô');
    await expect(dialect).toBeVisible();
    const labels = await dialect.locator('option').allInnerTexts();
    for (const need of ['Miền Bắc (Chuẩn)', 'Miền Trung', 'Miền Nam']) expect(labels.some(l => l.includes(need)), 'dialect option ' + need).toBeTruthy();
    await expect(input1(p)).toHaveAttribute('aria-expanded', 'false');
    await rowGates(p, theme, w, 'prompt');
    expectConsoleClean();
    current.proof['prompt-' + w + '-' + theme] = { dialectOptions: labels, pickers: 2 };
    await c.close();
  }
});

// 2) Combobox contract: pinned selector, native buttons, keyboard, ARIA, IDs stable across swap.
test('combobox contract: native option buttons, keyboard select, ARIA, stable input IDs across swap', async ({ browser }) => {
  const c = await staged(browser); const { p } = await open(c);
  const id1 = await input1(p).getAttribute('id'), id2 = await input2(p).getAttribute('id');
  expect(id1).toBeTruthy(); expect(id2).toBeTruthy(); expect(id1).not.toBe(id2);
  await input1(p).click();
  const listbox = picker1(p).locator('ul[role="listbox"]');
  await expect(listbox).toBeVisible();
  await expect(input1(p)).toHaveAttribute('aria-expanded', 'true');
  await expect(input1(p)).toHaveAttribute('aria-controls', id1 + '-listbox');
  await expect(listbox).toHaveAttribute('id', id1 + '-listbox');
  const buttons = picker1(p).locator('.absolute.z-30 button');
  const n = await buttons.count();
  expect(n, "'.absolute.z-30 button' resolves >= 1").toBeGreaterThanOrEqual(1);
  const tags = await buttons.evaluateAll(els => els.map(e => e.tagName));
  expect(new Set(tags), 'options render NATIVE buttons').toEqual(new Set(['BUTTON']));
  const names = await buttons.evaluateAll(els => els.map(e => (e.textContent || '').trim()));
  for (const m of MEMBERS) expect(names.some(x => x.includes(m.full_name)), 'option for ' + m.full_name).toBeTruthy();
  await pickViaKeyboard(p);
  await pickViaMouse(p, 2, 'Nguyễn Văn Cường');
  await expect(input1(p)).toHaveCount(0); // trigger input replaced by chip view while selected
  await p.locator('[data-testid="swap-pickers-desktop"]').click();
  await expect(picker1(p).locator('[data-testid="combobox-selected-chip"]')).toContainText('Nguyễn Văn Cường');
  await expect(picker2(p).locator('[data-testid="combobox-selected-chip"]')).toContainText('Nguyễn Văn Bình');
  // While selected the trigger input is replaced by the chip view (AppCombobox v-if/v-else);
  // clearing one chip re-renders the input with the SAME generated id — components are not
  // remounted by selection changes or swap, so IDs survive the swap.
  await picker2(p).locator('[data-testid="combobox-clear-btn"]').click();
  await expect(input2(p)).toBeVisible();
  expect(await input2(p).getAttribute('id')).toBe(id2);
  await expect(picker1(p).locator('[data-testid="combobox-selected-chip"]')).toContainText('Nguyễn Văn Cường'); // picker1 selection untouched
  current.proof = { inputIds: [id1, id2], contractButtonCount: n, keyboardSelect: true, swapExchanged: true, idStableAfterSwapAndClear: id2 };
  expectConsoleClean();
  await c.close();
});

// 3) Swap at mobile width: quick-demo picks both, mobile control exchanges the chips.
test('swap: values exchanged via mobile swap control at 390px', async ({ browser }) => {
  const c = await staged(browser, { w: 390, h: 844 }); const { p } = await open(c);
  await quickDemo(p).click();
  await expect(picker1(p).locator('[data-testid="combobox-selected-chip"]')).toContainText('Nguyễn Văn An');
  await expect(picker2(p).locator('[data-testid="combobox-selected-chip"]')).toContainText('Nguyễn Văn Bình');
  await p.locator('[data-testid="swap-pickers-mobile"]').click();
  await expect(picker1(p).locator('[data-testid="combobox-selected-chip"]')).toContainText('Nguyễn Văn Bình');
  await expect(picker2(p).locator('[data-testid="combobox-selected-chip"]')).toContainText('Nguyễn Văn An');
  current.proof = { mobileSwapExchanged: true };
  expectConsoleClean();
  await c.close();
});

// 4) PD-P3-1 (critical): gen micro-badges resolve --gen-N-fg (not --gen-N) with AA contrast, both themes,
//    light being the pre-fix failure side (3.01:1 with var(--gen-N) on var(--gen-N-soft)).
test('PD-P3-1: gen badge color token + AA contrast on chips and option rows, both themes', async ({ browser }) => {
  current.proof = {};
  for (const theme of THEMES) for (const [w, h] of [[1440, 900], [390, 844]]) {
    const c = await staged(browser, { w, h, theme }); const { p } = await open(c);
    await input1(p).click();
    await expect(picker1(p).locator('ul[role="listbox"]').locator('button')).toHaveCount(MEMBERS.length);
    const optionBadges = await scanGenBadges(p);
    await p.keyboard.press('Escape'); // source: Escape closes the listbox (AppCombobox.vue:283-287)
    await quickDemo(p).click();
    await expect(picker1(p).locator('[data-testid="combobox-selected-chip"]')).toBeVisible();
    await expect(picker2(p).locator('[data-testid="combobox-selected-chip"]')).toBeVisible();
    const chipBadges = await scanGenBadges(p);
    const all = [...optionBadges, ...chipBadges];
    expect(optionBadges.length, 'option-row badges present').toBeGreaterThanOrEqual(MEMBERS.length);
    expect(chipBadges.length, 'selected-chip badges present').toBeGreaterThanOrEqual(2);
    for (const b of all) {
      expect(b.colorIsFgToken, b.text + ' color resolves --gen-' + b.slot + '-fg: ' + JSON.stringify(b)).toBeTruthy();
      if (b.tokensDiffer) expect(b.colorIsBareAccent, b.text + ' regressed to bare --gen-' + b.slot + ': ' + JSON.stringify(b)).toBeFalsy();
      expect(b.ratio, b.text + ' contrast ' + JSON.stringify(b)).toBeGreaterThanOrEqual(MIN_AA);
    }
    (current.visual ||= []).push({ state: 'pd-p3-1', width: w, theme, optionBadges: optionBadges.length, chipBadges: chipBadges.length, lowest: all.slice().sort((a, b) => a.ratio - b.ratio).slice(0, 3) });
    current.proof['pd-' + theme + '-' + w] = { optionBadges: optionBadges.length, chipBadges: chipBadges.length, minRatio: Math.min(...all.map(b => b.ratio)) };
    (current.proof.badgeMinima ||= {})[theme] = Math.min(current.proof.badgeMinima?.[theme] ?? Infinity, ...all.map(b => b.ratio));
    expectConsoleClean();
    await c.close();
  }
});

// 5) Result state matrix: quick-demo → calculate → term/badges/timeline → gates → reset, every size × theme.
test('result state: demo pair term (INV-05), terracotta token, timeline, reset across sizes and themes', async ({ browser }) => {
  current.proof = {};
  for (const [w, h] of SIZES) for (const theme of THEMES) {
    const c = await staged(browser, { w, h, theme }); const { p } = await open(c);
    await quickDemo(p).click();
    await expect(picker1(p).locator('[data-testid="combobox-selected-chip"]')).toContainText('Nguyễn Văn An');
    await expect(picker2(p).locator('[data-testid="combobox-selected-chip"]')).toContainText('Nguyễn Văn Bình');
    await calcBtn(p).click();
    const container = p.locator('[data-testid="kinship-result-container"]');
    await expect(container).toBeVisible();
    const term = p.locator('[data-testid="kinship-term"]');
    expect(await term.textContent(), 'INV-05 bare textContent').toBe('Ông nội');
    const termInfo = await term.evaluate(e => ({
      hasQuoteChars: /[“”]/.test(e.textContent || ''),
      beforeContent: getComputedStyle(e, '::before').content,
      afterContent: getComputedStyle(e, '::after').content,
      color: getComputedStyle(e).color,
      probeAccentFg: (() => { const s = document.createElement('span'); s.style.color = 'var(--accent-fg)'; document.body.appendChild(s); const c = getComputedStyle(s).color; s.remove(); return c; })(),
    }));
    expect(termInfo.hasQuoteChars, 'no decorative quote chars in DOM').toBeFalsy();
    expect(termInfo.beforeContent, 'CSS ::before carries the opening quote').toContain('“');
    expect(termInfo.afterContent, 'CSS ::after carries the closing quote').toContain('”');
    expect(termInfo.color, 'term color is the --accent-fg terracotta token').toBe(termInfo.probeAccentFg);
    await expect(container).toContainText('Chi nội');
    await expect(container).toContainText('Cách 2 đời');
    await expect(container).toContainText('Huyết thống');
    await expect(container).toContainText('Nguyễn Văn An gọi Nguyễn Văn Bình');
    await expect(container).toContainText('Phương ngữ: Miền Bắc (Chuẩn)');
    await expect(p.locator('[data-testid="kinship-step-0"]')).toContainText('Nguyễn Văn An');
    await expect(p.locator('[data-testid="kinship-step-0"]')).toContainText('Điểm bắt đầu');
    await expect(p.locator('[data-testid="kinship-step-1"]')).toContainText('Nguyễn Văn Bình');
    await expect(p.locator('[data-testid="kinship-step-1"]')).toContainText('Đối tượng xưng hô');
    await rowGates(p, theme, w, 'result');
    expectConsoleClean();
    await p.locator('[data-testid="reset-btn"]').click();
    await expect(container).toHaveCount(0);
    await expect(p.locator('[data-testid="kinship-initial-prompt"]')).toBeVisible();
    await expect(p.locator('[data-testid="combobox-selected-chip"]')).toHaveCount(0);
    current.proof['result-' + w + '-' + theme] = { term: 'Ông nội', steps: 2, resetCleared: true };
    await c.close();
  }
});

// 6) Dialect: request carries the dialect param; term re-renders with the dialect echo.
test('dialect: switch to Miền Trung → kinship request carries dialect=trung and result re-renders', async ({ browser }) => {
  const c = await staged(browser); const { p } = await open(c);
  const seen = [];
  p.on('request', r => { if (r.url().includes('/api/v1/kinship')) seen.push(r.url()); });
  const dialect = p.getByLabel('Phương ngữ xưng hô');
  await dialect.selectOption({ label: 'Miền Trung' });
  await quickDemo(p).click();
  await expect(picker1(p).locator('[data-testid="combobox-selected-chip"]')).toContainText('Nguyễn Văn An');
  await calcBtn(p).click();
  const container = p.locator('[data-testid="kinship-result-container"]');
  await expect(container).toBeVisible();
  expect(seen.length, 'kinship API called').toBeGreaterThanOrEqual(1);
  const params = new URL(seen[seen.length - 1]).searchParams;
  expect(params.get('from')).toBe(AN);
  expect(params.get('to')).toBe(BINH);
  expect(params.get('dialect')).toBe('trung');
  expect(await p.locator('[data-testid="kinship-term"]').textContent()).toBe('Ông nội');
  await expect(container).toContainText('Phương ngữ: Miền Trung');
  current.proof = { requestUrl: seen[seen.length - 1], dialectParam: params.get('dialect') };
  expectConsoleClean();
  await c.close();
});

// 7) In-flight: delayed kinship API → calculate disabled + spinner, then recovers (1440/390 × both themes).
test('in-flight: delayed kinship API disables calculate with spinner, then recovers', async ({ browser }) => {
  current.proof = {};
  for (const [w, h] of STATE_SIZES) for (const theme of THEMES) {
    const c = await staged(browser, { w, h, theme, kinship: 'delay' }); const { p } = await open(c);
    await quickDemo(p).click();
    await expect(picker1(p).locator('[data-testid="combobox-selected-chip"]')).toContainText('Nguyễn Văn An');
    const btn = calcBtn(p);
    await btn.click();
    await expect(btn).toBeDisabled();
    await expect(btn.locator('svg.animate-spin')).toBeVisible();
    await expect(p.locator('[data-testid="kinship-term"]')).toBeVisible({ timeout: 10000 });
    await expect(btn).toBeEnabled();
    await expect(btn.locator('svg.animate-spin')).toHaveCount(0);
    current.proof['inflight-' + w + '-' + theme] = { delayMs: DELAY_MS, disabledDuringFlight: true, spinnerSeen: true, recovered: true };
    expectConsoleClean();
    await c.close();
  }
});

// 8) Unrelated: engine fallback (no line, empty path) → unrelated panel, no result container.
test('unrelated pair: fallback panel instead of result', async ({ browser }) => {
  current.proof = {};
  for (const [w, h] of STATE_SIZES) for (const theme of THEMES) {
    const c = await staged(browser, { w, h, theme, kinship: 'unrelated' }); const { p } = await open(c);
    await quickDemo(p).click();
    await calcBtn(p).click();
    const unrelated = p.locator('[data-testid="kinship-unrelated"]');
    await expect(unrelated).toBeVisible();
    await expect(unrelated).toContainText('Không tìm thấy quan hệ họ hàng');
    await expect(unrelated).toContainText('Hai người này không có quan hệ trong phạm vi tra cứu');
    await expect(p.locator('[data-testid="kinship-result-container"]')).toHaveCount(0);
    await expect(p.locator('[data-testid="kinship-term"]')).toHaveCount(0);
    current.proof['unrelated-' + w + '-' + theme] = { panel: true, noResultContainer: true };
    expectConsoleClean();
    await c.close();
  }
});

// 9) Error: kinship API 500 → error banner; retry affordance (calculate/reset) stays available.
test('error: kinship API 500 shows error banner and keeps retry affordance', async ({ browser }) => {
  current.allowedConsole = [{ status: 500, re: /\/api\/v1\/kinship/ }];
  current.proof = {};
  for (const [w, h] of STATE_SIZES) for (const theme of THEMES) {
    const c = await staged(browser, { w, h, theme, kinship: 'error' }); const { p } = await open(c);
    await quickDemo(p).click();
    await calcBtn(p).click();
    const banner = p.locator('[data-testid="kinship-error"]');
    await expect(banner).toBeVisible();
    expect((await banner.innerText()).trim().length, 'banner carries non-empty copy').toBeGreaterThan(0);
    await expect(p.locator('[data-testid="kinship-result-container"]')).toHaveCount(0);
    await expect(calcBtn(p)).toBeEnabled(); // source-native retry affordance (KinshipView.vue:119-128)
    await expect(p.locator('[data-testid="reset-btn"]')).toBeEnabled();
    current.proof['error-' + w + '-' + theme] = { banner: true, retryAvailable: true };
    expectConsoleClean(current.allowedConsole);
    await c.close();
  }
});

// 10) Member list load failure: pickers stay empty and the failure banner explains why (§2 state).
test('members load failure: banner explains, pickers remain empty', async ({ browser }) => {
  current.allowedConsole = [{ status: 500, re: /\/api\/v1\/members/ }];
  const c = await staged(browser, { membersStatus: 500 }); const { p } = await open(c);
  const banner = p.locator('[data-testid="members-error"]');
  await expect(banner).toBeVisible();
  expect((await banner.innerText()).trim().length, 'banner non-empty').toBeGreaterThan(0);
  await expect(input1(p)).toBeVisible(); // combobox renders (empty options) rather than crashing
  await expect(picker1(p).locator('ul[role="listbox"]')).toHaveCount(0);
  current.proof = { membersBanner: true, pickersIntact: true };
  expectConsoleClean(current.allowedConsole);
  await c.close();
});
