# Phase 2 Auth Screens — Independent Verification Report

**Date:** 2026-09-27 (runs 17:34–18:5x UTC)
**Branch:** `feature/apple-design-all-pages` — production content verified at tip **cb7e783** (`15711fa` + `cb7e783` on `95078c3`); test-only spec commits stacked on top (`348f380`, `e22c992`, `8f938aa`, `a32d3b2`, `0119529`, `e9c3664`, `48ae169` — every run's guard re-confirmed `git diff cb7e783..HEAD` excluding `e2e/`+`.agents/` is EMPTY).
**Scope decision:** Change set = 8 files, ALL frontend (`LoginView.vue` +87, `EmailVerifyView.vue` +11, `OAuthCallbackView.vue` +9, `AuthInterstitial.vue` +20, 5 test specs +333). Zero `api/` change → Go packs out of scope; "full unit suite" = entire web Vitest suite (per ensure.md gate 2). Backend exercised only as live dependency at `:3456` (db:up, healthy). Never contacted ensemble Postgres `127.0.0.1:5432` or port 8088. Serving model: fresh `web/dist` on isolated random port 10000–19999 with `/api/*` proxied to live `:3456` — identical for all browser packs.
**Developer evidence (`.phase2-auth-evidence/`, 131 PNGs + frozen-clock harness) used as input only; all verdicts below come from my own packs/specs/artifacts.**

## Gate results

| Gate | Pack | Result | Evidence |
|---|---|---|---|
| Full unit suite | `web_vitest_p0` | **PASS — 39 files / 280 tests** (19s) | `RESULTS/2026-09-27-apple-phase2-unit.log`; auth specs: oauth-callback 12, login 8, email-verify 4, auth-interstitial 7, auth-store 4 — all green |
| vue-tsc + build | `web_build_p0` | **PASS** — typecheck clean, Vite 189 modules, PWA 36 precache, dist strictly newer than src, `sw.js`+`manifest.webmanifest` present (INV-01) | `RESULTS/2026-09-27-apple-phase2-build.log` |
| /login browser | `apple_phase2_login_browser_test` | **FAIL 4/5 — sole failure PRE-EXISTING, out of changed-surface scope** (details below) | `RESULTS/2026-09-27-apple-phase2-login-browser.log` + `apple_phase2_login_browser/summary.json` |
| /auth/email/verify browser | `apple_phase2_email_verify_browser_test` | **PASS 5/5** | `RESULTS/2026-09-27-apple-phase2-email-verify-browser.log` + `apple_phase2_email_verify_browser/summary.json` |
| /auth/oauth/callback browser | `apple_phase2_oauth_callback_browser_test` | **PASS 6/6** (after correcting MY spec's invented expectation — see adjudication) | `RESULTS/2026-09-27-apple-phase2-oauth-callback-browser.log` + `apple_phase2_oauth_callback_browser/summary.json` |
| Phase 1 regression | `apple_phase1_shell_e2e_test` | **PASS 16/16, zero delta vs baseline** (shell 6 viewports, login keyboard-focus+contrast, dark login card, demo amber semantic token, self-hosted fonts, OS-theme switch, routes, demo-login→/tree, chips gen1–4, interstitial hover, /account) | `RESULTS/2026-09-27-apple-phase2-phase1-regression.log` |

## Behavior preservation (all three screens)

- **Email-verify:** pending (`verify-loading`/`status-disc-working` while endpoint hung) ✓; verified success held under frozen clock >700ms then redirected `/tree` in 1005ms live ✓ (500ms contract preserved); invalid token → `verify-error` + retry + return-to-login ✓; missing token → error, return-only (retry correctly absent) ✓.
- **OAuth callback:** bare route renders NO working/loading state (working-disc count 0; status ∈ {success,error}) ✓; authenticated success held frozen 1700ms then `/account` per provider google 2157ms / facebook 2127ms / zalo 2123ms ✓; **guest success = affordance-only by design** (see adjudication) — no auto-redirect >1700ms, affordance → `/account`, click-through lands `/login?redirect=/account` in 348ms via `requiresAuth` guard ✓; 5 error codes render exact Vietnamese copy ✓; unknown param → generic `server_error` fallback, no crash, no working state ✓; `demo_restricted` visibly amber (`rgb(253,236,236)` tint) with explicit demo wording ✓.
- **Login:** guest guard redirects authenticated visitor → `/tree` ✓; magic-link in-flight disabled / sent banner / inline validation / API error toast / `?verified=1` notice / demo pending all render ✓; testids + aria from source present ✓.
- **Adjudication (independent read-only investigator):** the oauth-callback redirect block is **byte-identical at base `95078c3`** (introduced `bf81f52` 2026-09-21); Phase 2 diff touches only classes + `currentSubtitle`. Guest auto-redirect to `/login` never existed in code or unit tests — my spec's original test-3 expectation was invented and was corrected to the evidence-adjudicated affordance-only contract (commit `a32d3b2`). **No behavior drift.**

## Layout contract — /login two-column (approved `apple-redesign/mockups/login.html`)

Measured on rendered Vue (fresh dist):
- `main .bg-card` computed **max-width exactly 400px** at ≥960 (width 400.0 @1440; 386.3 @960) — the 400px pin ✓
- At **959px**: card 448px wide (max-w-md), horizontally centered **delta 0px** (≤2 required) ✓
- `[data-testid="login-intro"]` display **flex @960 / none @959** — breakpoint edge exact ✓; root grid two-column ≥960 ✓

## Contrast (computed, WCAG alpha-composited, sweep ported from proven email-verify implementation)

| Surface | Light | Dark | Verdict |
|---|---|---|---|
| /login intro panel (CHANGED surface) @1440 | lead 16.26 · sub 7.15 · labels 5.77 | lead 14.83 · sub 9.40 · labels 7.42 | ✅ AA |
| /login small screens (390/320) lowest non-Z | 5.10 ("Dùng thử ngay" demo copy) | 5.62 | ✅ AA |
| Zalo "Z" glyph — **PRE-EXISTING, NOT changed by Phase 2** (`text-[#0068FF]` byte-identical at 95078c3) | 4.75 | **3.17 🔴** | ❌ dark fails 4.5 |
| /auth/email/verify all states | min 5.53 | min 6.06 | ✅ AA |
| /auth/oauth/callback success+error | min 5.53 | min 6.06 | ✅ AA |

- Overflow: `[0,0]` html+body on every viewport/theme/screen ✓. Focus-visible indication true everywhere ✓. Console: zero non-whitelisted errors; whitelisted = anonymous `/api/v1/me` 401 probe only (listed with url+status in artifacts) ✓. Zero pageerror ✓.

## Findings register

| ID | Severity | Finding | Scope | Disposition |
|---|---|---|---|---|
| F1 | 🟠 important (not Phase 2-blocking) | Zalo "Z" glyph `#0068FF` on dark surface = **3.17:1** (< 4.5); `text-sm font-bold` so no large-text exemption; raw Tailwind arbitrary value (not a semantic token) | Pre-existing at 95078c3; provider row untouched by Phase 2 | Surfaced for leader; fix is a production edit (dark variant or darker brand blue) — NOT made this run per zero-production-edits constraint. Light mode passes (4.75). |
| F2 | 🟢 platform | Daemon skill-injection defect (`is_active` boolean/integer DB mismatch) — `load_skill` bodies never reached workers; `skill_feedback` unrecordable | ensemble platform | Reported to leader; strict templates carried the full contract instead |
| F3 | 🟢 process | Cross-worker file collision: one spec write reverted by a sibling within ~30s (recovered, committed atomically); root lesson = parallel workers editing shared `e2e/` need serialized spec-edit phases | test infra | LESSONS entries written (outputdir collision + PATH/portable-watchdog) |

## Artifacts & commits (all test-only; production tree = cb7e783 exactly)

- New specs: `e2e/specs/apple-phase2-{login,email-verify,oauth-callback}.spec.cjs`; new packs registered in PACKS.md.
- Spec commits: `348f380` (create), `e22c992`+`8f938aa` (email-verify whitelist/artifacts), `a32d3b2`+`0119529` (oauth correction + providers-route mock fidelity, curl-verified payload), `e9c3664`+`48ae169` (login DOM-alignment + proven-sweep port).
- Every pack run: precondition guard (branch/ancestor/prod-diff-empty/clean-tree/dist-freshness/backend-health) + dual-layer timeout (inner Perl watchdog 270s + outer portable Perl 300s; GNU `timeout` absent on host).

## Verdict

**PHASE 2 AUTH VERIFICATION: PASS** on the leader's stated gates — full unit suite ✅, vue-tsc+build ✅, live-Vue behavior/state/timing/contrast on all three screens ✅ (every **changed** surface AA ≥4.5 both themes, geometry contract exact, redirects/testids/aria preserved, no invented loading state), Phase 1 regression ✅ 16/16.

The single red measurement (F1, Zalo Z dark 3.17:1) is **pre-existing, byte-identical at base, outside the Phase 2 changed-surface scope** — it does not block Phase 2 exit under the stated gate ("AA ≥4.5 on all changed surfaces"), but it IS a real AA defect on /login dark that should be scheduled (same family as Phase 1's D1–D5, which were subsequently fixed in `bc4210d`).

**Recommendation: Phase 2 exit APPROVED; push the branch** (2 feature commits + test-only verification commits; production content == cb7e783 verified). Schedule F1 as a follow-up production fix (suggest `dark:` variant on the Z glyph or brand-blue token override in dark theme; one-line class change).
