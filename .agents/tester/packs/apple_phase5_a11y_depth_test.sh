#!/bin/bash
set -uo pipefail
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
ROOT="$(git rev-parse --show-toplevel)" || exit 1; cd "$ROOT"
mkdir -p .agents/tester/RESULTS
ARTIFACTS=.agents/tester/RESULTS/apple_phase5_a11y_depth
export ARTIFACTS
LOG=.agents/tester/RESULTS/2026-09-28-apple-phase5-a11y-depth.log
rm -rf "$ARTIFACTS/test-results"; mkdir -p "$ARTIFACTS/test-results"
perl -e '
use POSIX ":sys_wait_h"; my $child; $SIG{ALRM}=sub { kill "INT",-$child; sleep 2; kill "TERM",-$child; sleep 2; kill "KILL",-$child; waitpid($child,0); exit 124 }; $child=fork(); exit 125 unless defined $child; if(!$child){setpgrp(0,0);exec @ARGV;exit 127} setpgrp(0,$child); alarm 270; waitpid($child,0); my $r=$?; alarm 0; exit((($r&127)!=0)?1:($r>>8));
' bash -c 'cd "$1/e2e"; mkdir -p "$ARTIFACTS/test-results"; npx playwright test specs/apple-phase5-a11y-depth.spec.cjs --config=playwright.config.ts --reporter=list --output="$ARTIFACTS/test-results"' _ "$ROOT" >"$LOG" 2>&1
rc=$?; case "$rc" in 0) echo 'RESULT: PASS' >>"$LOG";; 124) echo 'RESULT: TIMEOUT (270s inner watchdog)' >>"$LOG";; *) echo "RESULT: FAIL (exit $rc)" >>"$LOG";; esac
cat "$LOG"
exit "$rc"
