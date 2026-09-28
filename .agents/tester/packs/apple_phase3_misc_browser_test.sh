#!/bin/bash
# Phase 3 misc browser verification pack: serve existing dist, proxy API to Docker.
set -uo pipefail
export PATH="/usr/local/bin:/opt/homebrew/bin:/usr/local/go/bin:$PATH"
ROOT="$(git rev-parse --show-toplevel 2>/dev/null)" || exit 1
cd "$ROOT"
[[ -f web/dist/index.html ]] || { echo 'FAIL: web/dist/index.html absent'; exit 1; }
PORT=""; START=$((10000+RANDOM%10000)); for i in {0..9999}; do C=$((10000+(START-10000+i)%10000)); if node -e 'const n=require("net"),s=n.createServer();s.once("error",()=>process.exit(1));s.listen(+process.argv[1],"127.0.0.1",()=>s.close(()=>process.exit(0)))' "$C" >/dev/null 2>&1; then PORT=$C; break; fi; done
[[ -n "$PORT" ]] || exit 1
node - "$ROOT/web/dist" "$PORT" <<'NODE' &
const fs=require('fs'),http=require('http'),path=require('path'),root=process.argv[2];http.createServer((q,s)=>{const u=new URL(q.url,'http://x');if(u.pathname.startsWith('/api/')){const headers={...q.headers,host:'127.0.0.1:3456'};const p=http.request({hostname:'127.0.0.1',port:3456,path:q.url,method:q.method,headers},r=>{s.writeHead(r.statusCode,r.headers);r.pipe(s)});p.on('error',()=>{s.writeHead(502);s.end()});q.pipe(p);return}let f=path.resolve(root,"."+decodeURIComponent(u.pathname));if(!f.startsWith(path.resolve(root)+path.sep)&&f!==path.resolve(root))f=path.join(root,'index.html');fs.readFile(f,(e,b)=>{if(e){f=path.join(root,'index.html');b=fs.readFileSync(f)}s.setHeader('Content-Type',f.endsWith('.html')?'text/html':f.endsWith('.js')?'text/javascript':f.endsWith('.css')?'text/css':'application/octet-stream');s.end(b)})}).listen(+process.argv[3],'127.0.0.1');
NODE
SERVER=$!; cleanup(){ kill "$SERVER" 2>/dev/null||true;wait "$SERVER" 2>/dev/null||true; };trap cleanup EXIT INT TERM
BASE="http://127.0.0.1:$PORT";ready=0;for _ in {1..120};do curl -fsS "$BASE/" >/dev/null 2>&1&&curl -fsS http://127.0.0.1:3456/api/v1/health >/dev/null 2>&1&&{ ready=1;break; };sleep .25;done;[[ $ready == 1 ]]||exit 1
export APPLE_PHASE3_MISC_BASE="$BASE" APPLE_PHASE3_MISC_ARTIFACTS="$ROOT/.agents/tester/RESULTS/apple_phase3_misc_browser";mkdir -p "$APPLE_PHASE3_MISC_ARTIFACTS/test-results";cd "$ROOT/e2e";npx playwright test specs/apple-phase3-misc.spec.cjs --config=playwright.config.ts --reporter=list --output="$APPLE_PHASE3_MISC_ARTIFACTS/test-results"
rc=$?
case "$rc" in 0) echo 'RESULT: PASS';; 124) echo 'RESULT: TIMEOUT';; *) echo "RESULT: FAIL (exit $rc)";; esac
exit "$rc"
