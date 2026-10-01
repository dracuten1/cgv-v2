#!/bin/bash
# Bounded outer watchdog for feeds-main focused browser E2E.
set -uo pipefail
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/local/go/bin:$PATH"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo 'RESULT: FAIL'; exit 1; }
cd "$ROOT"
WORKER="$ROOT/.agents/tester/packs/feeds_main_browser_test.sh.worker"
[[ -f "$WORKER" ]] || { echo "RESULT: FAIL (missing worker: $WORKER)"; exit 1; }
perl -e '
use strict; use warnings; use POSIX ":sys_wait_h";
my $child;
$SIG{ALRM} = sub { kill "INT", -$child; kill "INT", $child; sleep 2; kill "TERM", -$child; kill "TERM", $child; sleep 2; kill "KILL", -$child; kill "KILL", $child; waitpid($child, 0); exit 124; };
$child = fork(); exit 125 unless defined $child;
if (!$child) { setpgrp(0,0); exec @ARGV; exit 127; }
setpgrp(0, $child); alarm 240; waitpid($child, 0); my $r = $?; alarm 0;
exit((($r & 127) != 0) ? 1 : ($r >> 8));
' bash "$WORKER"
rc=$?
case "$rc" in 0) echo 'RESULT: PASS';; 124) echo 'RESULT: TIMEOUT (240s inner watchdog)';; *) echo "RESULT: FAIL (exit $rc)";; esac
exit "$rc"
