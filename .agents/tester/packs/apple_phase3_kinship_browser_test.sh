#!/bin/bash
# Phase 3 kinship browser pack (outer). Supervises the worker with a 270s Perl
# watchdog; the worker serves web/dist on a random free port and proxies /api/*
# to the live backend at 127.0.0.1:3456. Inner command lives in a separate
# executable worker file (apple_phase3_kinship_browser_test.sh.worker) to avoid
# nested-quote traps — both files pass `bash -n` independently.
# Never targets 127.0.0.1:5432 (ensemble's own Postgres) or port 8088.
set -uo pipefail
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/local/go/bin:$PATH"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo 'RESULT: FAIL'; exit 1; }
cd "$ROOT"
WORKER="$ROOT/.agents/tester/packs/apple_phase3_kinship_browser_test.sh.worker"
[[ -f "$WORKER" ]] || { echo "RESULT: FAIL (worker file missing: $WORKER)"; exit 1; }

perl -e '
use strict; use warnings; use POSIX ":sys_wait_h";
my $child;
$SIG{ALRM} = sub {
  kill "INT", -$child; kill "INT", $child; sleep 2;
  kill "TERM", -$child; kill "TERM", $child; sleep 2;
  kill "KILL", -$child; kill "KILL", $child;
  waitpid($child, 0); exit 124;
};
$child = fork(); exit 125 unless defined $child;
if (!$child) { setpgrp(0,0); exec @ARGV; exit 127; }
setpgrp(0, $child); alarm 270; waitpid($child, 0); my $r = $?; alarm 0;
exit((($r & 127) != 0) ? 1 : ($r >> 8));
' bash "$WORKER"
rc=$?
case "$rc" in
  0) echo 'RESULT: PASS';;
  124) echo 'RESULT: TIMEOUT (270s inner watchdog; process group terminated)';;
  *) echo "RESULT: FAIL (exit $rc)";;
esac
exit "$rc"
