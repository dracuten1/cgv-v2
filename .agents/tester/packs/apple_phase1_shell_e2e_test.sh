#!/bin/bash
# Targeted live Vue shell test pack. Does not build, mutate app sources, or touch Docker.
set -uo pipefail
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || { echo 'RESULT: FAIL'; exit 1; }
cd "$ROOT"
# Process-group watchdog; outer dispatcher should additionally apply its 300s guard.
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
[[ -f web/dist/index.html ]] || { echo "FAIL: web/dist absent; build must finish before invocation"; exit 1; }
PORT=""; START=$((10000 + RANDOM % 10000)); for _attempt in {0..9999}; do CANDIDATE=$((10000 + (START - 10000 + _attempt) % 10000)); if node -e '\''const net=require("net");const s=net.createServer();s.unref();s.once("error",()=>process.exit(1));s.listen({host:"127.0.0.1",port:+process.argv[1],exclusive:true},()=>{s.close(()=>process.exit(0))})'\'' "$CANDIDATE" >/dev/null 2>&1; then PORT="$CANDIDATE"; break; fi; done
[[ -n "$PORT" ]] || { echo "FAIL: no free loopback port in 10000-19999 after bounded full-range scan"; exit 1; }
FPORT=""; FSTART=$((10000 + RANDOM % 10000)); for _fattempt in {0..9999}; do FCAND=$((10000 + (FSTART - 10000 + _fattempt) % 10000)); if [ "$FCAND" != "$PORT" ] && node -e '\''const net=require("net");const s=net.createServer();s.unref();s.once("error",()=>process.exit(1));s.listen({host:"127.0.0.1",port:+process.argv[1],exclusive:true},()=>{s.close(()=>process.exit(0))})'\'' "$FCAND" >/dev/null 2>&1; then FPORT="$FCAND"; break; fi; done
[[ -n "$FPORT" ]] || { echo "FAIL: no free fixture port in 10000-19999"; exit 1; }
DEVLOG="$(mktemp)"; ( cd "$ROOT/web" && exec npm run dev -- --host 127.0.0.1 --port "$FPORT" --strictPort ) >"$DEVLOG" 2>&1 &
DEVSERVER=$!
LOG="$(mktemp)"; node - "$ROOT/web/dist" "$PORT" >"$LOG" 2>&1 <<'\''NODE'\'' &
const fs=require("fs"),http=require("http"),path=require("path"); const root=process.argv[2],port=+process.argv[3];
const server=http.createServer((req,res)=>{const u=new URL(req.url,"http://127.0.0.1"); if(u.pathname.startsWith("/api/")){const fwd={hostname:"127.0.0.1",port:3456,path:req.url,method:req.method,headers:{...req.headers,host:"127.0.0.1:3456"}}; if(fwd.headers.origin) fwd.headers.origin="http://localhost:3456"; const p=http.request(fwd,r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res)});p.on("error",e=>{res.writeHead(502);res.end(String(e))});req.pipe(p);return;} let f=path.resolve(root,"."+decodeURIComponent(u.pathname));if(!f.startsWith(path.resolve(root)+path.sep)&&f!==path.resolve(root))f=path.join(root,"index.html");fs.stat(f,(e,s)=>{if(e||!s.isFile())f=path.join(root,"index.html");fs.readFile(f,(err,b)=>{if(err){res.writeHead(404);res.end();return}const ext=path.extname(f);res.setHeader("Content-Type",({".html":"text/html",".js":"text/javascript",".css":"text/css",".woff2":"font/woff2",".svg":"image/svg+xml"})[ext]||"application/octet-stream");res.end(b)})})});server.listen(port,"127.0.0.1");
NODE
SERVER=$!
cleanup(){ kill "$SERVER" "$DEVSERVER" 2>/dev/null || true; pkill -P "$DEVSERVER" 2>/dev/null || true; wait "$SERVER" "$DEVSERVER" 2>/dev/null || true; rm -f "$LOG" "$DEVLOG"; }; trap cleanup EXIT INT TERM
BASE="http://127.0.0.1:$PORT"; FBASE="http://127.0.0.1:$FPORT"; ready=0; for _ in {1..120}; do curl -fsS "$BASE/" >/dev/null 2>&1 && curl -fsS "$FBASE/gen-chip-contrast.html" >/dev/null 2>&1 && curl -fsS http://127.0.0.1:3456/api/v1/health >/dev/null 2>&1 && { ready=1; break; }; sleep .25; done
[[ $ready == 1 ]] || { echo "FAIL: preview/backend readiness failed"; cat "$LOG"; cat "$DEVLOG"; exit 1; }
export APPLE_PHASE1_BASE="$BASE" APPLE_PHASE1_FIXTURE_BASE="$FBASE" APPLE_PHASE1_ARTIFACTS="$ROOT/.agents/tester/RESULTS/apple_phase1_shell_e2e"
cd "$ROOT/e2e"; npx playwright test specs/apple-phase1-shell.spec.cjs --config=playwright.config.ts --reporter=list
' _ "$ROOT"
rc=$?; case "$rc" in 0) echo 'RESULT: PASS';; 124) echo 'RESULT: TIMEOUT (270s inner watchdog; process group terminated)';; *) echo "RESULT: FAIL (exit $rc)";; esac; exit "$rc"