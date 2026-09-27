# CGP v2 Test Packs

| Pack | Kind | Command / Script | Est | Inner / outer cap | Last Run | Status |
|------|------|------------------|-----|-------------------|----------|--------|
| web_vitest_p0 | frontend unit | `.agents/tester/packs/web_vitest_p0.sh` → `cd web && npm test` | <2m | 110s / 300s | 2026-09-27, 19s | PASS (39 files / 280 tests @ cb7e783; `RESULTS/2026-09-27-apple-phase2-unit.log`) |
| web_build_p0 | frontend typecheck + production build | `.agents/tester/packs/web_build_p0.sh` → `cd web && npm run build` | <3m | 270s / 300s | 2026-09-27, 11s | PASS (vue-tsc clean · 189 modules · PWA 36 · dist fresh; `RESULTS/2026-09-27-apple-phase2-build.log`) |
| apple_phase2_login_browser_test | live Vue /login states + 960-breakpoint + contrast | `.agents/tester/packs/apple_phase2_login_browser_test.sh` → `e2e/specs/apple-phase2-login.spec.cjs` | <1m | 270s / 300s | 2026-09-27 @ cb7e783 | FAIL 4/5 — sole fail = PRE-EXISTING Zalo Z dark 3.17:1 (out of changed-surface scope); all changed surfaces AA ✓, 400px pin ✓; `RESULTS/2026-09-27-apple-phase2-login-browser.log` |
| apple_phase2_email_verify_browser_test | live Vue /auth/email/verify states + windows | `.agents/tester/packs/apple_phase2_email_verify_browser_test.sh` → `e2e/specs/apple-phase2-email-verify.spec.cjs` | <1m | 270s / 300s | 2026-09-27 @ cb7e783 | PASS 5/5 (frozen 700ms hold, /tree 1005ms, min contrast 5.53/6.06; `RESULTS/2026-09-27-apple-phase2-email-verify-browser.log`) |
| apple_phase2_oauth_callback_browser_test | live Vue /auth/oauth/callback states + codes | `.agents/tester/packs/apple_phase2_oauth_callback_browser_test.sh` → `e2e/specs/apple-phase2-oauth-callback.spec.cjs` | <1m | 270s / 300s | 2026-09-27 @ cb7e783 | PASS 6/6 (affordance-only guest contract, /account ~2.1s, 5 codes + fallback, contrast 5.53/6.06; `RESULTS/2026-09-27-apple-phase2-oauth-callback-browser.log`) |
| apple_phase1_shell_e2e_test | live Vue shell + rendered contrast browser E2E | `.agents/tester/packs/apple_phase1_shell_e2e_test.sh` → `e2e/specs/apple-phase1-shell.spec.cjs` | 28–57s | 270s / 300s | 2026-09-27 @ cb7e783 (Phase 2 regression leg) | **PASS (exit 0, 16/16, zero delta)** — see `RESULTS/2026-09-27-apple-phase2-auth-verification.md` |
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
