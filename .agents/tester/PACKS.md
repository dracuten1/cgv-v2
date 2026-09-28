# CGP v2 Test Packs

| Pack | Kind | Command / Script | Est | Inner / outer cap | Last Run | Status |
|------|------|------------------|-----|-------------------|----------|--------|
| web_vitest_p0 | frontend unit | `.agents/tester/packs/web_vitest_p0.sh` → `cd web && npm test` | <2m | 110s / 300s | 2026-09-27 @ 1b1ca98 | PASS (39 files / **312 tests**; Phase-3 suites 110; `RESULTS/2026-09-27-apple-phase3-unit.log`) |
| web_build_p0 | frontend typecheck + production build | `.agents/tester/packs/web_build_p0.sh` → `cd web && npm run build` | <3m | 270s / 300s | 2026-09-27 @ 1b1ca98 | PASS (vue-tsc clean · 191 modules · PWA 37 precache · dist fresh 20:29Z; `RESULTS/2026-09-27-apple-phase3-build.log`) |
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
