#!/usr/bin/env bash
# CGP v2 acceptance pack runner — e2e_acceptance_test
# Portable outer watchdog: GNU coreutils `timeout` does NOT exist on macOS
# (verified: `timeout …` → 127 command not found), so fall back to
# gtimeout (coreutils) and finally a perl alarm watchdog (always present).
set -uo pipefail
cd "$(dirname "$0")"

echo "=== Test Pack: e2e_acceptance_test ==="

WPID=""
run_with_watchdog() {
  if command -v timeout >/dev/null 2>&1; then
    timeout 270 npx playwright test --reporter=list & WPID=$!
  elif command -v gtimeout >/dev/null 2>&1; then
    gtimeout 270 npx playwright test --reporter=list & WPID=$!
  else
    # perl alarm watchdog: SIGKILL the runner at 270s; the killed runner's
    # exit status is mapped to 124 below, matching GNU timeout semantics.
    perl -e 'alarm 270; $SIG{ALRM}=sub{kill q(KILL), getppid(); exit 124}; exec @ARGV' \
      npx playwright test --reporter=list & WPID=$!
  fi
}

run_with_watchdog
rc=0
wait "$WPID" || rc=$?

if [ "$rc" -eq 124 ] || [ "$rc" -eq 137 ]; then
  echo "RESULT: TIMEOUT"
  rc=124
elif [ "$rc" -eq 0 ]; then
  echo "RESULT: PASS"
else
  echo "RESULT: FAIL"
fi
exit "$rc"
