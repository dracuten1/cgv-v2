#!/bin/bash
# Phase 2 auth browser pack: serve existing web/dist, proxy API to live Docker backend.
set -uo pipefail
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo 'RESULT: FAIL'; exit 1; }
cd "$ROOT"
perl -e '
use strict; use warnings; use POSIX ":sys_wait_h";
my $child; $SIG{ALRM}=sub { kill "INT",-$child; sleep 2; kill "TERM",-$child; sleep 2; kill "KILL",-$child; waitpid($child,0); exit 124 };
$child=fork(); exit 125 unless defined $child;
if (!$child) { setpgrp(0,0); exec @ARGV; exit 127 }
setpgrp(0,$child); alarm 270; waitpid($child,0); my $r=$?; alarm 0; exit((($r&127)!=0)?1:($r>>8));
' bash -c '
set -uo pipefail
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
ROOT="$1"; cd "$ROOT"
[[ -f web/dist/index.html ]] || { echo "FAIL: web/dist/index.html absent"; exit 1; }
PORT=""; START=$((10000 + RANDOM % 10000)); for _attempt in {0..9999}; do CANDIDATE=$((10000 + (START - 10000 + _attempt) % 10000)); if node -e '\''const net=require("net");const s=net.createServer();s.unref();s.once("error",()=>process.exit(1));s.listen({host:"127.0.0.1",port:+process.argv[1],exclusive:true},()=>s.close(()=>process.exit(0)))'\'' "$CANDIDATE" >/dev/null 2>&1; then PORT="$CANDIDATE"; break; fi; done
[[ -n "$PORT" ]] || { echo "FAIL: no free loopback port in 10000-19999"; exit 1; }
LOG="$(mktemp)"; node - "$ROOT/web/dist" "$PORT" >"$LOG" 2>&1 <<'\''NODE'\'' &
const fs=require("fs"),http=require("http"),path=require("path"),root=process.argv[2],port=+process.argv[3];
const server=http.createServer((req,res)=>{const u=new URL(req.url,"http://127.0.0.1");if(u.pathname.startsWith("/api/")){const headers={...req.headers,host:"127.0.0.1:3456"};if(headers.origin)headers.origin="http://localhost:3456";const p=http.request({hostname:"127.0.0.1",port:3456,path:req.url,method:req.method,headers},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res)});p.on("error",e=>{res.writeHead(502);res.end(String(e))});req.pipe(p);return;}let f=path.resolve(root,"."+decodeURIComponent(u.pathname));if(!f.startsWith(path.resolve(root)+path.sep)&&f!==path.resolve(root))f=path.join(root,"index.html");fs.stat(f,(e,s)=>{if(e||!s.isFile())f=path.join(root,"index.html");fs.readFile(f,(err,b)=>{if(err){res.writeHead(404);res.end();return}res.setHeader("Content-Type",({".html":"text/html",".js":"text/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml"})[path.extname(f)]||"application/octet-stream");res.end(b)})})});server.listen(port,"127.0.0.1");
NODE
SERVER=$!
cleanup(){ kill "$SERVER" 2>/dev/null || true; wait "$SERVER" 2>/dev/null || true; rm -f "$LOG"; }; trap cleanup EXIT INT TERM
BASE="http://127.0.0.1:$PORT"; ready=0; for _ in {1..120}; do curl -fsS "$BASE/" >/dev/null 2>&1 && curl -fsS http://127.0.0.1:3456/api/v1/health >/dev/null 2>&1 && { ready=1; break; }; sleep .25; done
[[ $ready == 1 ]] || { echo "FAIL: preview/backend readiness failed"; cat "$LOG"; exit 1; }
export APPLE_PHASE2_BASE="$BASE" APPLE_PHASE2_ARTIFACTS="$ROOT/.agents/tester/RESULTS/apple_phase2_email_verify_browser"
mkdir -p "$APPLE_PHASE2_ARTIFACTS"
cd "$ROOT/e2e"; npx playwright test specs/apple-phase2-email-verify.spec.cjs --config=playwright.config.ts --output "$APPLE_PHASE2_ARTIFACTS/test-results" --reporter=list
' _ "$ROOT"
rc=$?; case "$rc" in 0) echo 'RESULT: PASS';; 124) echo 'RESULT: TIMEOUT (270s inner watchdog; process group terminated)';; *) echo "RESULT: FAIL (exit $rc)";; esac; exit "$rc"
