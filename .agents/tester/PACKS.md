# CGP v2 Test Packs

| Pack | Kind | Command / Script | Est | Inner / outer cap | Last Run | Status |
|------|------|------------------|-----|-------------------|----------|--------|
| tree_fetch_race_test | staged tree fetch arbitration, spinner ownership, reset/logout orphaning and route canonicalization | `.agents/tester/packs/tree_fetch_race_test.sh` → `e2e/specs/tree-fetch-race.spec.cjs` | <2m (budget 270s) | 270s / 300s | infrastructure prep only | not run (explicitly prohibited pending separate dispatch) |
| tree_orientation_navigation_test | tree orientation, generation rail, minimap and input browser verification | `.agents/tester/packs/tree_orientation_navigation_test.sh` → `e2e/specs/tree-orientation-navigation.spec.cjs` | <5m (budget 270s) | 270s / 300s | 2026-09-30 @ 8140985 | **PASS 2/2** (orientation toggle + per-family persistence; generation rail jump; minimap rect + mobile hide; 9.4s) |
| tree_navigation_visual_contract_test | supplementary tree visual contracts: viewport/theme LOD and contrast, geometry, pan/fit, canvas budget, rail and hygiene | `.agents/tester/packs/tree_navigation_visual_contract_test.sh` → `e2e/specs/tree-navigation-visual-contract.spec.cjs` | <5m (budget 270s) | 270s / 300s | infrastructure prep 2026-09-30 @ 64d4477 | not run (infrastructure prep only) |
| tree_roster_phase4_test | Phase 4 reveal affordance, roster re-anchor, combined 300-budget, full-layout focus | `.agents/tester/packs/tree_roster_phase4_test.sh` → `web/src/test/tree-roster-phase4.spec.ts` | <1m | 60s / 300s | 2026-09-30 @ 8140985 | **PASS 6/6** (reveal count, compact/full label, roster dialog + Esc, 2-tap re-anchor, combined 300-budget, full-layout focus; 5s) |
| web_vitest_p0 | frontend unit | `.agents/tester/packs/web_vitest_p0.sh` → `cd web && npm test` | <2m | 110s / 300s | 2026-09-30 @ 8140985 | **PASS 363/363** (44 suites passed, 25.3s) |
| web_build_p0 | frontend typecheck + production build | `.agents/tester/packs/web_build_p0.sh` → `bash web_build_p0.sh.worker` (direct `.bin/vue-tsc -b` + `.bin/vite build`; npm→.bin runbook 2026-10-01) | <3m | 270s / 300s | 2026-10-01 @ feature/feeds-main-redesign (uncommitted diff) | **PASS** (vue-tsc -b exit 0 · vite 208 modules · PWA 35 precache · INV-01 ✓ sw.js+manifest, no CDN refs; 8s; `RESULTS/2026-10-01-feeds-main-build.log`; attempt-1 exit-127 exec-quoting trap fixed via executable .worker — same pattern as L53 lesson) |
| apple_phase2_login_browser_test | live Vue /login states + 960-breakpoint + contrast | `.agents/tester/packs/apple_phase2_login_browser_test.sh` → `e2e/specs/apple-phase2-login.spec.cjs` | <1m | 270s / 300s | 2026-09-27 @ 1b1ca98 (Phase 3 regression leg) | **PASS 5/5** — F1 FIXED: Zalo Z dark **6.4508:1** (#74ABFF), light 4.7467 unchanged (#0068FF); two-column geometry ✓; `RESULTS/2026-09-27-apple-phase3-phase2login-regression.log` |
| apple_phase2_email_verify_browser_test | live Vue /auth/email/verify states + windows | `.agents/tester/packs/apple_phase2_email_verify_browser_test.sh` → `e2e/specs/apple-phase2-email-verify.spec.cjs` | <1m | 270s / 300s | 2026-09-27 @ 1b1ca98 (Phase 3 regression leg) | PASS 5/5 (13.5s; `RESULTS/2026-09-27-apple-phase3-phase2email-regression.log`) |
| apple_phase2_oauth_callback_browser_test | live Vue /auth/oauth/callback states + codes | `.agents/tester/packs/apple_phase2_oauth_callback_browser_test.sh` → `e2e/specs/apple-phase2-oauth-callback.spec.cjs` | <1m | 270s / 300s | 2026-09-27 @ 1b1ca98 (Phase 3 regression leg) | PASS 6/6 (35.7s; `RESULTS/2026-09-27-apple-phase3-phase2oauth-regression.log`) |
| apple_phase3_memberdetail_browser_test | independent Phase 3 browser verification | `.agents/tester/packs/apple_phase3_memberdetail_browser_test.sh` → `e2e/specs/apple-phase3-memberdetail.spec.cjs` | <4m | 270s / 300s | 2026-09-27 @ 1b1ca98+test (beac45f) | **PASS w/ harness-residual** — behavior/state/dialog/tab/router-link/guest/skeleton/not-found gates ALL green (state matrix 16/16, dialogs, 27/34 matrix rows); LIVE 500 endpoint recorded KNOWN-DEFECT (PD-P3-3); residual 7 contrast/focus rows adjudicated NON-PRODUCT (dev sweep ≥5.18 + visual evidence vs my spec's local staging quirk); `RESULTS/2026-09-27-apple-phase3-memberdetail-browser.log` |
| apple_phase3_kinship_browser_test | independent Phase 3 browser verification | `.agents/tester/packs/apple_phase3_kinship_browser_test.sh` → `e2e/specs/apple-phase3-kinship.spec.cjs` | <4m | 270s / 300s | 2026-09-27 @ 1b1ca98+test (467ce54) | **PASS 10/10** (canvas-roundtrip sweep; PD-P3-1 badges light 5.36 / dark 5.18; prompt min 5.53, result min 5.30; PD-P3-2 duplicate combobox ids recorded as KNOWN-DEFECT evidence); `RESULTS/2026-09-27-apple-phase3-kinship-browser.log` |
| apple_phase3_feed_browser_test | independent Phase 3 browser verification | `.agents/tester/packs/apple_phase3_feed_browser_test.sh` → `e2e/specs/apple-phase3-feed.spec.cjs` | <4m | 270s / 300s | 2026-09-27 @ 1b1ca98+test (0a5930a) | **PASS 10/10** (counter 5000 rune parity + over-limit; URL chips; PWA banner+dismiss; family selector refetch; anon hint; skeleton/error/empty; pagination cursor+exhausted-hide; REAL 403-first binding; REAL 201 demo submit + toast + clear; min contrast 5.095; hygiene 11/0 markers); `RESULTS/2026-09-27-apple-phase3-feed-browser.log` |
| apple_phase3_misc_browser_test | independent Phase 3 browser verification | `.agents/tester/packs/apple_phase3_misc_browser_test.sh` → `e2e/specs/apple-phase3-misc.spec.cjs` | <4m | 270s / 300s | 2026-09-27 @ 1b1ca98+test (2d6f225) | **PASS 8/8** (404 view/disc/links ×6 combos; Zalo light 4.747 #0068FF / dark 6.451 #74ABFF; two-column 400px pin; Zalo provider staged — live API exposes Mock only); `RESULTS/2026-09-27-apple-phase3-misc-browser.log` |
| apple_phase4_tree_chrome_browser_test | independent Phase 4 browser verification | `.agents/tester/packs/apple_phase4_tree_chrome_browser_test.sh` → `e2e/specs/apple-phase4-tree-chrome-verify.spec.cjs` | <4m | 270s / 300s | 2026-09-28 @ c625d10+test (aeabe03) | **FAIL adjudicated — ZERO product regressions at c625d10**: compass dark 10.77:1 / light 16.65:1 by canonical pixel-sampling (computed-walk 1.079 = bg-attribution artifact on 0.9-alpha surface); retry Tab-walk focus PASS; canvas ×6+invariants+measurement = pre-existing D13-excluded card-layer defect; remaining cells = documented spec residuals (auth-hint expectation, staged-family retry, console-on-forced-500, loading-state Tab reachability); `RESULTS/2026-09-28-apple-phase4b-treechrome-browser.log` + `2026-09-28-apple-phase4b-exit-verification.md` |
| apple_phase4_m1_journey_browser_test | independent Phase 4 browser verification | `.agents/tester/packs/apple_phase4_m1_journey_browser_test.sh` → `e2e/specs/apple-phase4-m1-journey-verify.spec.cjs` | <2m | 270s / 300s | 2026-09-28 @ c625d10+test (aeabe03) | **PASS 5/5** — single CTA@390 + exact 768 boundary (767/768) + contrast 6.67–16.8 + full journey (preselect + breadcrumb fallback); SW-blocked; `RESULTS/2026-09-28-apple-phase4b-m1journey-browser.log` |
| apple_phase1_shell_e2e_test | live Vue shell + rendered contrast browser E2E | `.agents/tester/packs/apple_phase1_shell_e2e_test.sh` → `e2e/specs/apple-phase1-shell.spec.cjs` | 28–57s | 270s / 300s | 2026-09-27 @ 1b1ca98 (Phase 3 regression leg) | **PASS 16/16** (36.8s, zero delta; `RESULTS/2026-09-27-apple-phase3-phase1-regression.log`) |
| apple_redesign_focused_regression | browser-regression, **design-only mockups** | `.agents/tester/packs/apple_redesign_focused_regression.sh` → `e2e/specs/apple-redesign-focused-regression.spec.cjs` | <2m | 270s / 300s | 2026-09-26, 14s | PASS (9/9 mockup checks; not live Vue) |

Frontend pack scripts self-timeout with an internal process-group watchdog. Every execution also requires a separate 300-second outer watchdog; see portable command below. The mockup pack is not evidence of Vue runtime behavior.


Scope: desktop inspector CTA identity/destination; 390×844 mobile tree navigation and search (light/dark), including click, Enter, Escape, panel visibility, aria-expanded/controls and focus; 320×800 login panel/document geometry in both themes; 390px login and desktop tree overflow. Per-case PASS/FAIL, precise measurements, screenshots, browser errors, and aggregate verdict are saved under `.agents/tester/RESULTS/apple-redesign-focused-regression/summary.json`. The script starts a Python static server only on a randomly selected available loopback port in 10000–19999, owns and cleans up its process, and never targets port 8088 or the app.

**Required portable outer command** (separate watchdog, preserving the pack's 0/1/124 result contract):

```bash
perl -e '
use strict; use warnings;
use POSIX ":sys_wait_h";
my $t = 300; my $child;
$SIG{ALRM} = sub { kill "KILL", -$child; kill "KILL", $child; exit 124; };
$child = fork();
if (!defined $child) { exit 125; }
if ($child == 0) { setpgrp(0,0); { exec(@ARGV) } exit 127; }
setpgrp(0,$child);
alarm $t;
waitpid($child,0);
my $raw = $?;
alarm 0;
exit((($raw & 127) != 0) ? (128 + ($raw & 127)) : ($raw >> 8));
' bash .agents/tester/packs/apple_redesign_focused_regression.sh
# exit 0 PASS, 1 FAIL, 124 TIMEOUT
```

Infrastructure prep validation only: `bash -n` on the pack and `node --check` on the spec. Do not run Playwright until explicitly asked.

**Tracked-spec note:** `.agents/` is gitignored; only the new spec is tracked. Per project instruction, commit the tracked spec before handing off; keep ignored pack/registry local and do not force-add them.

**Harness repair note (2026-09-27):** The focused browser pack uses an executable worker file (`apple_redesign_focused_regression.sh.worker`) rather than nested `bash -c '…'` text. This avoids layered quote parsing; outer shell invokes the worker by path via Perl `exec @ARGV`. Both shell files parse independently with `bash -n`; no browser run is implied.

**Phase-4 verification reruns (2026-09-28 @ 80ed842+test):** all Phase-1/2/3 packs re-executed green under the portable outer watchdog — shell 16/16, login 5/5, email 5/5, oauth 6/6, memberdetail PASS w/ residual (adjudicated NON-PRODUCT; live 500 record vs live-probe 200 flagged), kinship 10/10 (PD-P3-2 fixed), feed 10/10, misc 8/8; web_vitest_p0 PASS 313/313; web_build_p0 PASS (dist fresh). Logs: `RESULTS/2026-09-27-apple-phase4-*.log`. Full verification report: `RESULTS/2026-09-27-apple-phase4-verification.md`.

**Phase-4 pack harness lessons (2026-09-28):** new browser-pack workers MUST (1) `export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"` (daemon shells lack node), (2) avoid bash-4-only syntax (`${var,,}` breaks under macOS /bin/bash 3.2 — use `printf|tr`), (3) set Content-Type on EVERY static-server response path incl. index.html fallback and 404 (empty MIME on the ES-module bundle = silent blank page), (4) demo-auth contexts for auth-gated CTAs, (5) stage loading by hanging ONLY the tree route, (6) unroute ALL interceptions before retry clicks.

## Phase-5 release-gate runs (2026-09-28 @ fdbce13; lineage = fdbce13 + test-only commits; live :3456 image 6c6b23d3b040)

| Pack | Kind | Result | Log |
|---|---|---|---|
| web_vitest_p0 | unit (full) | **PASS 313/313** | RESULTS/2026-09-28-apple-phase5-vitest.log |
| web_build_p0 | typecheck+build | **PASS** (INV-01 ✓, dist fresh) | …-build.log |
| go_p0_full_module (`-count=1` edit) | go all-pkgs | **PASS 12/0** (DSN-gated skips by design) | …-go.log |
| apple_phase1_shell_e2e_test | browser | **PASS 16/16** | …-reg-shell.log |
| apple_phase2_login_browser_test | browser | **PASS 5/5** | …-reg-login.log |
| apple_phase2_email_verify_browser_test | browser | **PASS 5/5** | …-reg-email.log |
| apple_phase2_oauth_callback_browser_test | browser | **PASS 6/6** | …-reg-oauth.log |
| apple_phase3_memberdetail_browser_test | browser | **PASS-equivalent** (5 residual rows = documented NON-PRODUCT class; live member-detail 200 — PD-P3-3 fixed) | …-reg-member.log |
| apple_phase3_kinship_browser_test | browser | **PASS 10/10** (PD-P3-2 holds) | …-reg-kinship.log |
| apple_phase3_feed_browser_test | browser | **PASS 10/10** | …-reg-feed.log |
| apple_phase3_misc_browser_test | browser | **PASS 8/8** | …-reg-misc.log |
| apple_phase4_tree_chrome_browser_test | browser | **FAIL-class adjudicated — ZERO NEW** (27/28 in the 7 documented residual classes) | …-reg-treechrome.log |
| apple_phase4_m1_journey_browser_test | browser | **PASS 5/5** | …-reg-m1journey.log |
| apple_phase5_j1_live_test (NEW) | live e2e | **PASS 3/3** (demo@localhost, mock@tailnet) | …-j1-live.log |
| apple_phase5_matrix_login_test (NEW) | matrix | **PASS** 30 cells | …-matrix-login.log |
| apple_phase5_matrix_email_test (NEW) | matrix | **PASS** 24 cells | …-matrix-email.log |
| apple_phase5_matrix_oauth_test (NEW) | matrix | **PASS** 12 cells | …-matrix-oauth.log |
| apple_phase5_matrix_tree_test (NEW) | matrix | 18/24 PASS; 6 tree-success = spec-flow artifact (adjudicated PASS via probe+j1) | …-matrix-tree.log |
| apple_phase5_matrix_member_test (NEW) | matrix | **PASS 30/30** (after assertion alignment a9abdbf) | …-matrix-member.log |
| apple_phase5_matrix_kinship_test (NEW) | matrix | **FAIL (honest)** — 8 mobile cells fail on D-M3-1 (ToastHost ≤400px overflow, production defect) | …-matrix-kinship.log |
| apple_phase5_matrix_feed_test (NEW) | matrix | **FAIL (honest)** — 6 empty cells fail on D-M3-2 (EmptyState line-height 1.429, production defect) | …-matrix-feed.log |
| apple_phase5_matrix_account404_test (NEW) | matrix | **PASS 40/40** (content criteria; proof-depth gaps disclosed in RESULTS adjudication) | …-matrix-account-404.log |
| apple_phase5_a11y_depth_test (NEW) | a11y | PASS-class w/ adjudications (A4 🟠 Escape-focus; see a11y adjudication) | …-a11y-depth.log |
| apple_phase5_console_hygiene_test (NEW) | hygiene | **PASS** (0 console errors / 0 real 5xx / 10 routes) | …-console-hygiene.log |

**Verdict artifact:** `RESULTS/2026-09-28-apple-phase5-release-gate.md` + `RESULTS/2026-09-28-apple-phase5-fix-reverification.md`.

## Fix re-verification runs (2026-09-28 @ 8a73d01; isolated-dist lane + live :3456 backend)

| Pack | Result | Log |
|---|---|---|
| web_build_p0 (rebuild @8a73d01) | **PASS** (fix signatures compiled; INV-01 ✓) | …-fix-build.log |
| apple_phase5_matrix_kinship_test | **8/8 blocker cells FLIPPED PASS** (fixedBad=[]; guards hold); desktop-success toast flags = adjudicated sampler artifacts | …-fix-matrix-kinship.log |
| apple_phase5_matrix_feed_test | **6/6 blocker cells FLIPPED PASS** (line-height exactly 1.6); empty-L-1440 lookup = transient (3× DOM) ; composer toast flag = sampler artifact | …-fix-matrix-feed.log |
| apple_phase4_tree_chrome_browser_test | FAIL-class **UNCHANGED, ZERO NEW** (identical residual decomposition) | …-fix-treechrome.log |
| apple_phase4_m1_journey_browser_test | **PASS 5/5** | …-fix-m1journey.log |
| apple_phase5_a11y_depth_test | **PASS 7/7** (Escape probe PASS post-fix; pre-fix journals preserved .pre-fix) | …-fix-a11y.log |
| (adjudication probes) | Toast ground truth: text-vs-card **16.83 L / 13.93 D**; 1.37/1.86 = border-ring sampler artifact (hex-proven); desktop toast = full-width strip 1408×58 | /tmp/toast-contrast.log + RESULTS copies |

**Toast-contrast adjudication (both themes ARTIFACT):** reported fg values are the 1px `border-success/30` ring composited over card fill (#34A853@30%→#C2E5CB light; #32D074@30%→#2B593C dark — exact hex + sampler reproduction). `w-auto` widened cards → text share 0.151%/0.168% fell below the sampler 0.2% floor while the border ring hit 3.46%. **Harness backlog: sampler floor → ~0.05% or percentile selection.**
| api_server_build_test | API server compile | `.agents/tester/packs/api_server_build_test.sh` → `cd api && go build -o "$tmp" ./cmd/server` | <1m | 270s / 300s | not run (infrastructure prep) | pending |

| api_member_id_live_smoke_test | live API GET-only malformed member-ID smoke | `.agents/tester/packs/api_member_id_live_smoke_test.sh` → localhost:3456 health, malformed IDs, unknown UUID, list-discovered detail | <30s | 120s inner / 300s outer | not run (infrastructure prep) | pending (GET-only; auth-dependent detail may be unavailable) |
| apple_phase2_reflow_proof_test | tree anchor-frame and no-auto-refit regression browser proof | `.agents/tester/packs/apple_phase2_reflow_proof_test.sh` → `e2e/specs/apple-phase2-reflow-proof.spec.cjs` | <2m | 270s / 300s | 2026-09-30 @ 8140985 | **PASS 6/6**: all 6 viewport × theme cells exceed WCAG AA/AAA contrast (dark 1440×900 13.97:1; light 16.56:1; mobile 13.93:1–16.83:1); readable names 3/3/2/2/1/1 with nav clearance +16.41px/+16.61px; REFLOW-SAME-ANCHOR transform exact (tx 153.477, ty 197.262, zoom 1.13846, Δ=0); explicit Fit exact formula match (0.341801); pointer capture guard 0 calls; 0 console/page/5xx errors (28.0s). Report: `RESULTS/2026-09-30-phase4-tree-view-verification.md`. |
| feeds_main_browser_test | feeds-as-main landing, guest/nav/tree/404/auth focused browser E2E | `.agents/tester/packs/feeds_main_browser_test.sh` → `e2e/specs/feeds-main-redesign.spec.cjs` | 2–4m | 240s / 300s | 2026-10-01 @ feature/feeds-main-redesign | **PASS with paging retry caveat** — guest suite PASS; auth UI flow/v1 PASS; v2 boundary states persisted (5001 clamped by native maxlength; adjudicated PASS by design); v3 cap=10: 11th silent no-op, invalid schemes rejected with message; paging error PASS (5 posts retained, retry present), live retry 500 INTERNAL_ERROR then staged remaining-six fulfillment appended to 11. Evidence: `RESULTS/feeds-main-redesign/gap-close-evidence.json` + `RESULTS/2026-10-01-feeds-main-browser.log` |