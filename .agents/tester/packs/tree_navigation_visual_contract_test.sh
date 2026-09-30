#!/usr/bin/env bash
set -uo pipefail
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 1
cd "$ROOT"
[[ -f web/dist/index.html ]] || { echo 'RESULT: FAIL (web/dist absent; build separately)'; exit 1; }
PORT=""; START=$((10000 + RANDOM % 10000)); for _attempt in {0..9999}; do CANDIDATE=$((10000 + (START - 10000 + _attempt) % 10000)); if node -e 'const n=require("net"),s=n.createServer();s.unref();s.once("error",()=>process.exit(1));s.listen({host:"127.0.0.1",port:+process.argv[1],exclusive:true},()=>s.close(()=>process.exit(0)))' "$CANDIDATE" >/dev/null 2>&1; then PORT="$CANDIDATE"; break; fi; done
[[ -n "$PORT" ]] || { echo 'RESULT: FAIL (no free port)'; exit 1; }
perl -e 'use strict;use warnings;use POSIX ":sys_wait_h";my $child;$SIG{ALRM}=sub{kill "INT",-$child;sleep 2;kill "TERM",-$child;sleep 2;kill "KILL",-$child;waitpid($child,0);exit 124};$child=fork();exit 125 unless defined $child;if(!$child){setpgrp(0,0);exec @ARGV;exit 127}setpgrp(0,$child);alarm 270;waitpid($child,0);my $r=$?;alarm 0;exit((($r&127)!=0)?1:($r>>8));' bash "$ROOT/.agents/tester/packs/tree_navigation_visual_contract_test.sh.worker" "$ROOT" "$PORT"
rc=$?; case "$rc" in 0) echo 'RESULT: PASS';;124) echo 'RESULT: TIMEOUT';;*) echo "RESULT: FAIL (exit $rc)";;esac; exit "$rc"
