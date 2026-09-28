#!/bin/bash
# Phase 3 member-detail browser pack: serve existing web/dist on a random loopback
# port, proxy /api/* to the live Docker backend at 127.0.0.1:3456 (Origin rewritten
# to http://localhost:3456 for the backend CSRF allowlist), then run the independent
# /members/:id verification spec e2e/specs/apple-phase3-memberdetail.spec.cjs.
#
# Structure: this OUTER script only resolves the repo root, arms the 270 s Perl
# watchdog (process-group terminate, exit 124 on timeout) and maps the exit code to
# the RESULT: PASS/FAIL/TIMEOUT contract (0/1/124). All server/playwright logic
# lives in the sibling .worker file (invoked by path — avoids nested-quote traps,
# precedent: apple_redesign_focused_regression.sh.worker).
#
# NEVER touches 127.0.0.1:5432 (ensemble's own Postgres); never binds 8088.
set -uo pipefail
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/local/go/bin:$PATH"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo 'RESULT: FAIL'; exit 1; }
cd "$ROOT"
WORKER="$ROOT/.agents/tester/packs/apple_phase3_memberdetail_browser_test.sh.worker"
if [[ ! -f "$WORKER" ]]; then echo "RESULT: FAIL (worker missing: $WORKER)"; exit 1; fi
chmod +x "$WORKER" 2>/dev/null || true
perl -e '
use strict; use warnings; use POSIX ":sys_wait_h";
my $child; $SIG{ALRM}=sub { kill "INT",-$child; sleep 2; kill "TERM",-$child; sleep 2; kill "KILL",-$child; waitpid($child,0); exit 124 };
$child=fork(); exit 125 unless defined $child;
if (!$child) { setpgrp(0,0); exec @ARGV; exit 127 }
setpgrp(0,$child); alarm 270; waitpid($child,0); my $r=$?; alarm 0; exit((($r&127)!=0)?1:($r>>8));
' bash "$WORKER"
rc=$?
case "$rc" in
  0)   echo 'RESULT: PASS' ;;
  124) echo 'RESULT: TIMEOUT (270s inner watchdog; process group terminated)' ;;
  *)   echo "RESULT: FAIL (exit $rc)" ;;
esac
exit "$rc"
