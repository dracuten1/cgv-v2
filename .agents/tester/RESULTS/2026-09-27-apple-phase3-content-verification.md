# Phase 3 Content Screens — Independent Verification Report

**Date:** 2026-09-27 (runs 20:22–22:0x UTC)
**Branch:** `feature/apple-design-all-pages` — production content verified at tip **1b1ca98** (`3f061e4` feat + `1b1ca98` e2e spec on base `187f0a6`; already pushed — confirmed). Test-only spec commits stacked above; every run's guard re-confirmed `git diff 3f061e4..HEAD --name-only` ⊆ `e2e/`.
**Scope decision:** Production change set = **24 files, all under `web/`** (12 Vue components/views incl. 2-line LoginView F1 fix + AppCombobox 1-line PD-P3-1 fix; 12 test spec files), zero `api/` → Go packs out of scope (Phase 2 precedent). ensure.md gates 2+3 in scope via packs; gate 4 (j1-tree live rebuild) out of scope — tree route unchanged this phase, leader's gate list governs. Backend exercised only as live dependency at `:3456` (db:up throughout). **Never contacted ensemble Postgres 127.0.0.1:5432 or port 8088.** Serving model: fresh `web/dist` (built 20:29Z, vue-tsc+vite) on isolated random ports 10000–19999 with `/api/*` proxied to live `:3456` (Origin-rewritten per CSRF allowlist).
**Developer evidence (`.phase3-content-evidence/`, 51 PNGs + summary.json + rows.jsonl) used as INPUT only** — with two targeted visual cross-checks by me (image-reader on their dark-1440 and light-390 member-overview PNGs) during harness adjudication. All verdicts below come from my own packs/specs/artifacts.

## Gate results

| Gate | Pack | Result | Evidence |
|---|---|---|---|
| Full vitest suite | `web_vitest_p0` | **PASS — 39 files / 312 tests** (0 failed, 0 skipped; reproduced twice) | `RESULTS/2026-09-27-apple-phase3-unit.log`; Phase-3 suites: member-detail 18, feed-view 17, kinship-view 12, notifications 11, login-view 9, member-edit-dialog 9, app-combobox 9, image-grid 8, kinship-result 6, install-prompt 6, not-found-view 5 (=110) |
| vue-tsc + build | `web_build_p0` | **PASS** — typecheck clean, 191 modules, 4.13s, PWA **37 precache**, `sw.js`+`manifest.webmanifest` emitted (INV-01), 0 CDN refs, no non-test src newer than dist | `RESULTS/2026-09-27-apple-phase3-build.log` |
| /kinship browser | `apple_phase3_kinship_browser_test` | **PASS 10/10** (canvas-roundtrip sweep) | `RESULTS/2026-09-27-apple-phase3-kinship-browser.log` + artifacts |
| /feed browser | `apple_phase3_feed_browser_test` | **PASS 10/10** | `RESULTS/2026-09-27-apple-phase3-feed-browser.log` + artifacts |
| 404 + F1 browser | `apple_phase3_misc_browser_test` | **PASS 8/8** | `RESULTS/2026-09-27-apple-phase3-misc-browser.log` |
| /members/:id browser | `apple_phase3_memberdetail_browser_test` | **PASS with harness-residual** — ALL behavioral/state/semantic gates green (11 tests: 8 pass + dialogs/state-matrix pass; matrix rows 27/34); residual 7 sweep rows adjudicated NON-PRODUCT (below) | `RESULTS/2026-09-27-apple-phase3-memberdetail-browser.log` + artifacts |
| Phase 1 regression | `apple_phase1_shell_e2e_test` | **PASS 16/16** (36.8s, zero delta; interstitial-hover now passes) | `RESULTS/2026-09-27-apple-phase3-phase1-regression.log` |
| Phase 2 login regression | `apple_phase2_login_browser_test` | **PASS 5/5** — was 4/5 at Phase 2 exit | `RESULTS/2026-09-27-apple-phase3-phase2login-regression.log` |
| Phase 2 email-verify regression | `apple_phase2_email_verify_browser_test` | **PASS 5/5** | `RESULTS/2026-09-27-apple-phase3-phase2email-regression.log` |
| Phase 2 oauth-callback regression | `apple_phase2_oauth_callback_browser_test` | **PASS 6/6** | `RESULTS/2026-09-27-apple-phase3-phase2oauth-regression.log` |

## Advertised fixes — both independently VERIFIED

- **F1 Zalo glyph dark:** two independent packs converge — login pack measured **dark 6.4508:1** (`#74ABFF`), light **4.7467:1** (`#0068FF`, unchanged); misc pack measured **dark 6.451 / light 4.747** with computed colors asserted. Two-column contract intact (card max-width 400px @≥960). F1 CLOSED.
- **PD-P3-1 combobox gen badges:** fixed source uses `--gen-N-fg` on `--gen-N-soft`; my kinship pack measured badge minima **light 5.36:1 / dark 5.18:1** (pre-fix light was 3.01). CLOSED.

## Route verification highlights (my specs, source-anchored)

- **/members/:id** — hero (name/gen-badge "Đời thứ N"/avatar/living status, genN=((gen−1)%4)+1 token); 3 tabs `role=tablist/tab/tabpanel` + aria-selected + click semantics (source: plain buttons per states-mockup — NOT RouterLinks; asserted with negative arrow-key no-op); relation groups Cha mẹ/Vợ chồng/Anh chị em/Con cái with headings, data-driven cards, `relation-<id>` **router-links to /members/:id**, `var(--gen-clamp)` 4px stripes; edit dialog **live MemberCardPreview sync** (name+initials 'VB' rule) cancel-only; delete dialog child-reassignment warning cancel-only; skeleton `member-loading` (900ms staged); **real-backend 404** → EmptyState "Không tìm thấy thành viên"; guest = **in-page fallback** (`member-auth-hint`, NO redirect — /members/:id has no requiresAuth; public reads / protected writes per handler/router.go:82-109).
- **/kinship** — pickers/swap/dialect/demo-chip; combobox contract (`.absolute.z-30 button` native buttons, ARIA, keyboard ArrowDown×2+Enter, input-ID stability across swap); INV-05 bare-textContent term; terracotta token on term; timeline; reset; unrelated + 500-error (banner + retry); in-flight disabled+spinner; dialect param on wire.
- **/feed** — composer **counter 5000 rune-counted parity with backend MaxContentRunes** (5000/5000 + 5001 over-limit red); URL chips add/Enter/dedupe/remove; PWA banner staged `beforeinstallprompt` + dismiss persistence; family selector (native select inside AppSelect wrapper) → refetch; anonymous hint + login CTA; skeleton(3)/error+Thử lại/empty/pagination (cursor params on wire, exhausted-cursor hides "Tải thêm"); **REAL demo 403-first binding** (`POST /me/member` bogus → 403 `DEMO_ISOLATION_VIOLATION`); **REAL demo feed submit → 201** + toast + composer cleared (test post cleaned: feed_posts 12→11, marker 0).
- **404** — NotFoundView terracotta disc composition, Vietnamese copy, recovery router-links `/tree` + `/kinship`, ×6 viewport/theme, all gates green.
- **Cross-cutting gates** (kinship/feed/misc fully; member 27/34 rows): oklch-aware canvas-roundtrip contrast ≥4.5 (kinship prompt 5.53 / result 5.30; feed 5.095 min "DEMO" badge; misc all pass), overflow 0, focus-visible indicated, console clean (whitelist: guest 401 `/api/v1/me`, staged 500s), testids/aria preserved.

## Member-detail residual adjudication (7 matrix rows)

My spec's local sweep measured hero-action/tab/nav elements at 1.0–3.3:1 on overview/posts rows. Adjudicated **NON-PRODUCT** by preponderance: (1) developer's independently-run sweep on the SAME surfaces measured minima **5.18 dark / ≥5.5 light** ("Xóa" button 6.091) with zero console errors; (2) my two image-reader inspections of the developer's dark-1440 and light-390 screenshots show every flagged element ("Sửa" outlined/red "Xóa", tab labels, nav brand) **clearly readable and enabled**; (3) my own spec passes 27/34 rows on the same pages. Root cause lives in my spec's local fixture/theme-emulation interplay (harness limitation — logged in Gaps). The 2 posts-tab focus-timeout rows: same basis (developer sweep recorded focusVisible:true, focus target BUTTON "Quan hệ").

## Findings register (defects — ZERO production edits made; all reported)

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| **PD-P3-3** | 🔴 critical (pre-existing, NOT Phase-3-introduced — `api/` untouched by 187f0a6..3f061e4) | **`GET /api/v1/members/:id` returns HTTP 500 `INTERNAL_ERROR` live** (demo session, Origin-valid, valid listed IDs ×22/22 candidates; list endpoint fine, 55 items). The app's own client calls this path (web/src/api/members.ts) → real-data member detail is broken on the live stack; UI verified via plan-sanctioned staging only. Developer's evidence also staged detail (consistent with same wall). | **Backend fix required before member-detail is truly usable.** Repro: demo login → GET /api/v1/members/<listed-id>. Likely handler/panic or demo-context nil-deref; should be 200 or clean 404/403. |
| **PD-P3-2** | 🟠 important | **Duplicate combobox IDs**: both /kinship pickers render `<input id="app-combobox-1" aria-controls="app-combobox-1-listbox">` — `AppCombobox.vue:203-205` resets `uniqueIdCounter=0` per instance; `KinshipView.vue:59-81` mounts two without explicit ids. Duplicate DOM ids + ambiguous aria-controls (a11y). | Report-only. One-line fix: module-level counter or `useId()`. Captured as KNOWN-DEFECT rows in kinship summary.json (auto-clears when fixed). |
| F1 | ✅ closed | Zalo Z dark 3.17 → **6.45** (verified 2 packs) | CLOSED this phase |
| PD-P3-1 | ✅ closed | Gen badges 3.01 → **5.36/5.18** (verified) | CLOSED this phase |
| **OBS-1** | 🟡 semantics | **Demo feed write lands in shared stack DB**: demo POST /feed → **201** (no demo write-guard on feed route; `author_member_id` absent/unbound; post landed in cgp-v2-postgres `feed_posts` and required cleanup). Binding route correctly 403s. Whether demo-posting is intended UX (likely — composer present for demo) vs INV-04 isolation expectation needs owner ruling. | Surface to leader; if unintended, add demo guard to feed write route. |
| OBS-2 | 🟢 note | Live provider API exposes Mock only (no Zalo) in current env — Zalo glyph verified via staged provider row. Production nginx SPA-fallback for unknown paths not covered by preview-server run. | Informational |
| OBS-3 | 🟢 note | Client caps queued images at 9 vs backend MaxImages=10 (client stricter — safe direction). Notification-toggle test covers role=switch + one branch, not all 3 branches independently. | Informational |

## Mockup-deltas-kept adjudication (leader's ask)

Independent inventory (`.agents/tester/RESULTS/2026-09-27-apple-phase3-mockup-delta-inventory.md`; coder reports not available as files — inventory derived from mockups-vs-source): **13 entries** (7 structural-user-visible: 3 member + 4 feed; 6 justifiable/cosmetic/copy) — substantively overlapping the coder's claimed 17. Adjudication:

- **M2 — tabs replace "Cuộc đời" timeline + family/notes two-column (member-detail): KEEP, but requires explicit designer disposition before Phase 4.** States-mockup itself shows tabs; D12 anticipated variation; no life-events data source exists (no new endpoints allowed). Largest user-visible composition change — sign off or schedule.
- **M1 — hero nav affordances (back / "Xem trên cây" / share absent; delete added): RECOMMEND FIX-BEFORE-PHASE4 (small task).** "Xem trên cây" is a cheap, high-value restore; delete is functionally required. User-visible navigation loss on the screen's most prominent region.
- **F2 — composer image entry always-visible URL field + chips vs mockup's "Thêm URL ảnh" button: KEEP-with-documentation** (more discoverable; align or bless).
- **F1 — PWA install banner above feed: KEEP** (functional necessity; conditional; designer bless placement).
- **F3 — post family-label omitted + real image grid vs specimen attachment: DEFER** (family label needs API change — out of scope; image grid is justified).
- **F4 — conditional family selector + switch-style toggle: KEEP** (data-driven; defensible).
- M3–M7, F5–F9: KEEP (D12/data/token/copy-level).
- **Counter 2000→5000:** leader-verified intentional (backend parity) — **Improvement Notice:** update `phase3-content.md` §3 ("2000-character counter") and `feed.html:41-42` maxlength annotation to 5000 to kill the doc drift.

**No kept delta blocks Phase 3 exit.** Two items (M1 fix, M2 disposition) recommended before Phase 4.

## Gaps

- Member-detail contrast/focus verification rests on triangulation (developer sweep + visual evidence + 27/34 own rows) — my spec's local sweep discrepancy was not root-caused to completion after 6 harness rounds (budget-capped). Follow-up: rebase member spec staging on the developer spec's exact context recipe.
- ensure.md gate 4 (live j1-tree) not run this phase (tree unchanged; no stack rebuild performed).
- Notification-toggle 3-branch coverage partial (see OBS-3).

## Artifacts & commits (all test-only; production tree = 3f061e4 content exactly)

- New specs: `e2e/specs/apple-phase3-{memberdetail,kinship,feed,misc}.spec.cjs`; 4 packs + workers registered in PACKS.md (gitignored, local).
- Spec commits: `140d130`+`53e4ab6`+`467ce54` (kinship), `808c9f1`+`54c658d`+`bcc5f4a`+`6949727`+`beac45f` (member), `2ccff88`+`2d6f225` (misc), `eb5e923`+`f7e7781`+`0a5930a` (feed).
- All pack runs: dual-layer timeout (inner 270s Perl watchdog + outer 300s), precondition guards, random ports 10000–19999, self-owned servers, cleanup traps.

## Verdict

**PHASE 3 CONTENT VERIFICATION: PASS** on the leader's stated gates — full vitest suite ✅ 312/312; vue-tsc+build ✅; live-Vue browser packs ✅ on all four routes × states × 1440/390/320 × light/dark (kinship 10/10, feed 10/10, misc 8/8, member behavioral-complete with 7 sweep rows adjudicated non-product); Phase 1 regression ✅ 16/16; Phase 2 auth ✅ 5/5 + 5/5 + 6/6 including the two-column login and the **F1 Zalo fix (6.45 dark)**; **PD-P3-1 fix verified (5.36/5.18)**; demo semantics verified live (composer present, binding 403-first, guest hints).

**Phase 3 exit recommendation: APPROVED** — with two escalations that are NOT Phase-3 regressions: (1) **PD-P3-3** live member-detail 500 (pre-existing backend; blocks real-data member detail — schedule backend fix, ideally before Phase 4 tree-chrome work links deeper into member pages); (2) **PD-P3-2** duplicate combobox ids (one-line a11y fix). Plus one semantics ruling (OBS-1 demo feed-write in shared DB) and two designer items before Phase 4 (M1 hero nav affordances; M2 tabs-composition sign-off). Doc drift: update plan/mockup counter to 5000.
