# Phase 1 Apple Foundation — Final Verification Report

**Date:** 2026-09-27 (runs 13:59–22:21 +07)
**Branch:** `feature/apple-design-all-pages` — verification at web tree of commit `8279f0b` ("feat(web): Phase 1 Apple Quiet Clarity foundation"); subsequent e2e-only spec/pack commits `dbae484`, `1a8206b`, `d099775b`.
**Scope decision:** Full frontend unit suite + typecheck/build + targeted live-Vue browser shell/contrast pack. Live API = existing healthy Docker backend `:3456` (proxied); **no** local Go API, **no** ensemble Postgres `127.0.0.1:5432`, **no** port 8088 contact. Design-only mockups in `.agents/shared/planning/` were never treated as live behavior; one fixture page (`web/gen-chip-contrast.html`) is served by a pack-owned isolated `vite dev` instance so its rendered contrast could be measured on the real `AppChip` source.

## Gate-by-gate (independent runs against the same web tree)

| Gate | Pack | Result | Log |
|---|---|---|---|
| Full frontend unit | `web_vitest_p0.sh` | **PASS 39 files / 271 tests, login spec 7/7** | `RESULTS/2026-09-27-apple-phase1-final3-vitest.log` |
| Typecheck + build | `web_build_p0.sh` | **PASS** vue-tsc clean · Vite 189 modules · PWA 36 precache · 13 Fraunces assets · dist strictly newer than newest source · `.bg-card` / `--surface-card` (#fff→#292624 dark) compiled | `RESULTS/2026-09-27-apple-phase1-final3-build.log` |
| Live Vue shell + rendered contrast | `apple_phase1_shell_e2e_test.sh` (spec v9, 16 tests) | **13/16 PASS · 3 FAIL (all adjudicated product)** | `RESULTS/2026-09-27-apple-phase1-adjudication-browser.log` (+ `apple_phase1_shell_e2e/summary-2026-09-27T15-20-*.json`) |

## Independently measured contrast (real rendered Vue, WCAG-correct compositing)

| Probe | Light | Dark | Threshold | Verdict |
|---|---|---|---|---|
| AppChip gen1 (fixture `vite dev`) | 5.45 | 6.24 | ≥4.5 | ✅ |
| AppChip gen2 | 5.80 | 5.18 | ≥4.5 | ✅ |
| AppChip gen3 | 5.36 | 5.30 | ≥4.5 | ✅ |
| AppChip gen4 | 6.06 | 5.30 | ≥4.5 | ✅ |
| AuthInterstitial link hover (resolves prior discrepancy) | 6.67–7.20 (composited cream→white) | 7.96 | ≥4.5 | ✅ |
| Demo amber `--demo-button` (#9a5700) | 5.62 on white | — | ≥4.5 | ✅ |

Shell 1440/390/320 × light/dark: 6/6 PASS (zero horizontal overflow). OS live preference switch both ways: PASS. Fraunces: 15 own-origin 200s, **zero external font requests**, faces loaded. Routes `/tree`, `/kinship`, `/feed`: PASS. Demo-login → `/tree` (scoped desktop-nav aria-current=1, label "Gia phả"): PASS. Zero `pageerror` JS exceptions.

## 🔴 Product defects at `8279f0b` (5, all unit/proof-confirmed by harness; vision-confirmed where indicated)

| ID | Where | Element | Why it fails | Source / line |
|---|---|---|---|---|
| **D5** | `/login` dark | Demo card heading `text-amber-900` on `bg-amber-50/60` composite ~#A9A69B = **3.716**; supporting copy `text-amber-800/90` = **2.677** | No `dark:` variants on demo card copy; light passes. | `web/src/views/LoginView.vue:~152–162` |
| **D1** | `/account` 1440-dark | H1 "Tài khoản & Liên kết" `text-slate-800` (#1D293D) on canvas (~#1C1A19) = **1.186** (vision: nearly invisible) | Raw Tailwind slate palette; no dark mapping. | `web/src/views/account/AccountView.vue` (slate utilities) |
| **D2** | `/account` 1440-dark, 390-dark | Subtitle "Quản lý phương thức…" `text-slate-500` = **3.640** | Same root as D1. | same |
| **D3** | `/account` dark, both viewports | Linked-row avatar initials `text-accent-fg` (#F2AD89) on `accent-soft` rgba(216,125,82,.16) composited over `bg-white` card that never re-themes = **1.611** (vision: washed-out) | AppAvatar semantic colors trapped inside a never-darkened `bg-white` card. | same |
| **D4** | `/account` 1440-light, 390-light | Muted description `text-slate-500` on paper = **4.414** (0.09 short of 4.5, marginal) | Tailwind slate-500 below AA at this size. | same |

Dark `/login` `text-amber-*` rows: compositing math independently verified — composited bg #A9A69B over dark canvas #1C1A19 ≈ measured #A9A69B; ratios ×luminance recomputed to 3 decimals.

## Harness false-positive clarified (not a product defect)

`auth-interstitial-hover`'s second `stateProofFailures` was an invalid assertion: `AuthInterstitial.vue` link uses `hover:underline` with byte-identical color (only text-decoration changes), and Playwright caught a `transition-colors` (150ms) tail. **Contrast itself passes both themes** (dark 7.96; light ≥6.67 composited). Recommendation: accept `text-decoration-line` change (or `:hover` matchMedia probe) as state proof; wait >150ms after `emulateMedia`.

## Phase 0 G-D baseline design-readiness disposition — RETROSPECTIVE (leader-authorized)

My live-SPA independent observations constitute the retrospective baseline per leader decision that the pre-coding window passed when foundation landed. Coverage vs the published canonical 9-route inventory:

| Route | Observed | Cell coverage | Notes |
|---|---|---|---|
| `/login` | ✅ | light 1440/390/320, dark 1440/390/320; focus; demo amber; demo card overlay | card surface fix verified (1.08→5.62); D5 outstanding |
| `/auth/email/verify` | ✅ | hover state both themes, both resolved | contrast passes both themes |
| `/tree` (chrome + canvas) | ✅ | demo-login lands here; aria-current; reachable title | tree chrome appears intact |
| `/members/:id` | ✅ | via pack-owned `vite dev` fixture, real `AppChip` both themes, gen1–4 | all 8 chips ≥5.18 |
| `/account` | ✅ | 4 viewport/theme cells, per-row samples | D1–D4 outstanding (raw Tailwind palette) |
| `/kinship` | ✅ | reachable title probe | |
| `/feed` | ✅ | reachable title probe | |
| `/auth/oauth/callback` | ❌ **not observed live** — flow is provider-side redirect; mock variant not exercised this cycle |
| `/` redirect + catch-all | ❌ **not observed live** — out of Phase-1 scope (redirects only to `/login`) |

**Minimum 4-route G-D subset (per plan-overview lines 40–47) is fully satisfied:** `/login`, `/tree` chrome, `/members/:id` (fixture-backed real Vue), `/account` (4 cells).

**Disposition:** dark-login-card was the one found-and-fixed regression; D1–D5 are new findings (not pre-existing FAIL-BL baseline). Acceptable for foundation exit only if either (a) developer fixes D5 (and D1–D4 via AccountView token migration) and a clean rerun returns 16/16, or (b) Phase 1 scope is explicitly reduced to admit the AccountView migration into Phase 2+. **No approval is invented**: this entry is documentary, not sign-off authority.

## Phase 0 G-D/G-E audit (process completeness)

- `phase-0-route-state-theme-viewport-matrix.md`: verifier **PENDING — not assigned, not signed**; zero OBSERVED cells.
- `phase-0-token-consumer-inventory.md`: verifier **PENDING — not signed**.
- No labeled G-D/G-E signoff entries exist in any planning doc. **These remained absent at foundation merge time.** My retrospective run above is the only live-SPA baseline evidence record; no prior independent-verifier approval is claimed by this report.

## Test-only commits

- `fb74087` → `aef6aca` (spec lineage, e2e-only)
- `b9d2349`, `a7e08ac` (vitest expectation repairs in `auth-interstitial.spec.ts`)
- `dbae484`, `1a8206b`, `d099775b` (account + evaluator adjudication)
- `web/gen-chip-contrast.{html,ts}` (developer fixture; untracked)

Zero production edits made by tester.

## Verdict — UPDATED 2026-09-27 (exit run)

**Phase 1: ✅ READY at `bc4210d`** (web tree; spec commits e2e-only through `d78975c`).

- Unit: **PASS 39 files / 271 tests** (`RESULTS/2026-09-27-apple-phase1-exit-vitest.log`)
- Typecheck/Build: **PASS**, fresh dist with semantic migration compiled (`RESULTS/2026-09-27-apple-phase1-exit-build.log`)
- Browser: **16/16 PASS, OUTER_EXIT=0** (`RESULTS/2026-09-27-apple-phase1-exit-browser2.log`, summary `2026-09-27T16-05-15-381Z.json`)
- D1–D5 re-measured clean both themes (D1 15.59/16.06, D2/D4 6.85/10.19, D3 6.20/6.25, D5 5.10/7.02); sweeps `/account` min 6.20 L / 6.06 D per-target / `/login` min 5.10 L / 5.62 D; all prior fixes intact (dark login card 5.62, chips 5.18–6.24, hover ≥7.19/7.96, shell zero-overflow ×6, Fraunces self-hosted, OS live switch, demo-login).
- The single prior FAIL (stateProof on underline-only hover) was a harness assertion defect, repaired in spec `d78975c` (accepts unchanged state only when BOTH ratios ≥4.5; threshold enforcement unchanged) and confirmed green in the exit run.
- **G-D retrospective signoff recorded** in `phase-0-route-state-theme-viewport-matrix.md` (§ "G-D Signoff — RETROSPECTIVE BASELINE (2026-09-27)"): minimum subset satisfied, found-and-fixed history documented. **G-E remains unsigned** — flagged to leader.

---

## Verdict — 2026-09-27 earlier state (superseded, kept for history)

**Phase 1: ❌ NOT READY at `8279f0b`.**

- All gates that PASSED this week are independently measured against the actual Vue app — no approvals carried over from earlier mockup or static checks.
- One blocker is fully cleared: dark `/login` card surface (the original 1.08:1 failure) now ≥5.62:1.
- Five NEW product defects found by the corrected evaluator remain: D5 login-dark demo card copy (2.68–3.72), D1–D4 `/account` (slate palette → heading 1.19 dark, subtitle 3.64 dark, avatar 1.61 dark, muted 4.41 light).
- After D1–D5 are fixed, expected outcome: vitest 271/+, build green, browser 16/16, Phase-0 G-D minimum subset satisfied → Phase 1 ready to recommend exit.
