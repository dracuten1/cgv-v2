// tree-fetch-race.spec.cjs — browser pack for tree fetch arbitration, spinner
// ownership and route canonicalization (b71b66d / f2b5d2e / 86e7411 lifecycle).
//
// Re-audit 2026-10-01 (trace-cited evidence in
// .agents/tester/RESULTS/tree-fetch-race-playwright/*/trace.zip):
//  * goTree() used to wait for [data-testid="tree-world"] even when THIS
//    spec's own p.route() gates held the initial response. TreeView.vue
//    renders tree-world only when !store.loading (tree-loading is the
//    v-if="store.loading" branch), so a held fetch can never produce
//    tree-world — tests 1-3 timed out on a state the spec itself prevented
//    (trace: GET .../families/A/tree status -1 in-flight, 33x locator=0).
//    When the target fetch is gated we wait for tree-loading (spinner up =
//    fetch dispatched) instead, and only expect tree-world after a release
//    that should let the current request commit.
//  * Tests 2-3 injected the store via page.evaluate(import('/src/stores/tree.ts')).
//    The pack harness (tree_fetch_race_test.sh.worker) serves the BUILT
//    web/dist (hashed /assets/*.js) — that URL 404s, so store-handle
//    injection is impossible here. Supersedence / spinner ownership /
//    orphaning are therefore driven through real route and family-selector
//    flows; the store-level invalidate()/reset() seq-guard contracts stay
//    covered by unit tests (web/src/test/stores-tree-member.spec.ts —
//    :223 invalidate-owns-loading, :253 superseded-invalidate,
//    :299 reset-orphans-in-flight).
//  * Route canonicalization lands on families[0] resolved at runtime; the
//    harness list order is not guaranteed (11111111-… was first in the
//    2026-10-01 run and rendered fine — prior "11111111 not in seed" audit
//    claim is false: api/internal/seed/fixture.go Family1ID/2ID/3ID). The
//    expected id is read from GET /api/v1/families, mirroring the fail-closed
//    literal-ID pinning of tree-orientation-navigation.spec.cjs (7b20aaa).
//  * tree-world exposes no data-family-id attribute, so family identity is
//    asserted via the family <select> value, the tree-family-name heading
//    and per-family request counts.
const {test,expect}=require('@playwright/test');
const BASE=process.env.TREE_RACE_BASE||'http://127.0.0.1:14180';
const A='22222222-2222-4222-8222-000000000002',B='33333333-3333-4333-8333-000000000003';
async function login(browser){
 const c=await browser.newContext({viewport:{width:1440,height:900},locale:'vi-VN',serviceWorkers:'block'});
 const origin=new URL(BASE).origin;
 const auth=await c.request.post(BASE+'/api/v1/auth/demo',{headers:{Origin:'http://localhost:3456'},data:''});
 if(!auth.ok()) throw Error(`demo auth POST ${BASE}/api/v1/auth/demo → HTTP ${auth.status()}: ${(await auth.text()).slice(0,500)}`);
 for(const id of [A,B]){
  const url=`${BASE}/api/v1/families/${id}/tree`;
  const check=await c.request.get(url,{headers:{Origin:origin}});
  if(!check.ok()) throw Error(`required seeded family unavailable: GET ${url} → HTTP ${check.status()}: ${(await check.text()).slice(0,500)}; verify seed IDs, demo auth, and harness API proxy`);
 }
 const fl=await c.request.get(`${BASE}/api/v1/families`,{headers:{Origin:origin}});
 if(!fl.ok()) throw Error(`families list GET ${BASE}/api/v1/families → HTTP ${fl.status()}: ${(await fl.text()).slice(0,500)}`);
 const fams=(await fl.json()).families||[];
 const byId=Object.fromEntries(fams.map(f=>[f.id,f.name]));
 for(const [name,id] of [['A',A],['B',B]]) if(!byId[id]) throw new Error(`FAIL CLOSED: family ${name}=${id} absent from /api/v1/families; API IDs=${JSON.stringify(Object.keys(byId))}`);
 const firstId=fams[0]&&fams[0].id;
 if(!firstId) throw new Error('FAIL CLOSED: /api/v1/families returned no families');
 return {c,byId,firstId};
}
async function treeRequests(page){const calls=[];page.on('request',r=>{if(new URL(r.url()).pathname.match(/\/families\/[^/]+\/tree$/))calls.push(new URL(r.url()).pathname)});return calls}
// gated=true → the initial /tree fetch is held by a p.route() gate, so the app
// correctly stays on tree-loading and tree-world cannot exist yet.
async function goTree(page,url='/tree',gated=false){
 await page.goto(BASE+url);
 if(gated) await expect(page.getByTestId('tree-loading')).toBeVisible({timeout:15000});
 else await expect(page.getByTestId('tree-world')).toHaveCount(1,{timeout:15000});
}
const callsFor=(calls,id)=>calls.filter(x=>x.endsWith(`/${id}/tree`)).length;
const switchFamily=async(p,id)=>{await p.evaluate(id=>history.replaceState({},'',`/tree?family=${id}`),id);await p.evaluate(()=>dispatchEvent(new PopStateEvent('popstate')))};
const pickFamily=async(p,id)=>{await p.locator('select').first().selectOption(id)};

test('latest family fetch wins and stale response cannot release newer spinner',async({browser})=>{
 const {c,byId}=await login(browser);
 try{
  const p=await c.newPage(),calls=await treeRequests(p);
  let release;const gate=new Promise(r=>release=r);
  await p.route(`**/api/v1/families/${A}/tree`,async route=>{await gate;await route.continue()});
  await goTree(p,`/tree?family=${A}`,true);
  await expect.poll(()=>callsFor(calls,A)).toBe(1,{timeout:10000});
  await pickFamily(p,B);
  await expect.poll(()=>callsFor(calls,B)).toBe(1,{timeout:10000});
  await expect(p.locator('select').first()).toHaveValue(B);
  await expect(p.getByTestId('tree-world')).toBeVisible();
  await expect(p.getByTestId('tree-family-name')).toHaveText(byId[B]);
  release();
  await p.waitForTimeout(350);
  await expect(p.getByTestId('tree-world')).toBeVisible();
  await expect(p.getByTestId('tree-family-name')).toHaveText(byId[B]);
  await expect(p.locator('select').first()).toHaveValue(B);
  expect(callsFor(calls,A)).toBe(1);
  expect(callsFor(calls,B)).toBe(1);
 }finally{await c.close()}
});

test('a newer family fetch owns loading; the superseded response can neither release the spinner nor render',async({browser})=>{
 const {c,byId}=await login(browser);
 try{
  const p=await c.newPage(),calls=await treeRequests(p);
  let releaseA,releaseB;
  const gateA=new Promise(r=>releaseA=r),gateB=new Promise(r=>releaseB=r);
  await p.route(`**/api/v1/families/${A}/tree`,async route=>{await gateA;await route.continue()});
  await p.route(`**/api/v1/families/${B}/tree`,async route=>{await gateB;await route.continue()});
  await goTree(p,`/tree?family=${A}`,true);
  await expect.poll(()=>callsFor(calls,A)).toBe(1,{timeout:10000});
  await pickFamily(p,B);
  await expect.poll(()=>callsFor(calls,B)).toBe(1,{timeout:10000});
  await expect(p.locator('select').first()).toHaveValue(B);
  await expect(p.getByTestId('tree-world')).toHaveCount(0);
  await expect(p.getByTestId('tree-loading')).toBeVisible();
  releaseA();
  await p.waitForTimeout(350);
  await expect(p.getByTestId('tree-loading')).toBeVisible();
  await expect(p.getByTestId('tree-world')).toHaveCount(0);
  await expect(p.locator('select').first()).toHaveValue(B);
  releaseB();
  await expect(p.getByTestId('tree-world')).toHaveCount(1,{timeout:15000});
  await expect(p.getByTestId('tree-loading')).toHaveCount(0);
  await expect(p.getByTestId('tree-family-name')).toHaveText(byId[B]);
  expect(callsFor(calls,A)).toBe(1);
  expect(callsFor(calls,B)).toBe(1);
 }finally{await c.close()}
});

test('rapid family switching orphans every superseded response; only the final fetch populates the world',async({browser})=>{
 const {c,byId,firstId}=await login(browser);
 const ids=[...new Set([A,B,firstId])];
 if(ids.length<3) throw new Error(`FAIL CLOSED: need 3 distinct families for the arbitration sweep; A=${A} B=${B} first=${firstId}`);
 try{
  const p=await c.newPage(),calls=await treeRequests(p);
  const release={};
  for(const id of ids){
   const gate=new Promise(r=>{release[id]=r});
   await p.route(`**/api/v1/families/${id}/tree`,async route=>{await gate;await route.continue()});
  }
  await goTree(p,`/tree?family=${A}`,true);
  await expect.poll(()=>callsFor(calls,A)).toBe(1,{timeout:10000});
  await pickFamily(p,B);
  await expect.poll(()=>callsFor(calls,B)).toBe(1,{timeout:10000});
  await pickFamily(p,firstId);
  await expect.poll(()=>callsFor(calls,firstId)).toBe(1,{timeout:10000});
  await expect(p.locator('select').first()).toHaveValue(firstId);
  await expect(p.getByTestId('tree-world')).toHaveCount(0);
  await expect(p.getByTestId('tree-loading')).toBeVisible();
  release[A]();
  await p.waitForTimeout(300);
  await expect(p.getByTestId('tree-loading')).toBeVisible();
  await expect(p.getByTestId('tree-world')).toHaveCount(0);
  release[B]();
  await p.waitForTimeout(300);
  await expect(p.getByTestId('tree-loading')).toBeVisible();
  await expect(p.getByTestId('tree-world')).toHaveCount(0);
  release[firstId]();
  await expect(p.getByTestId('tree-world')).toHaveCount(1,{timeout:15000});
  await expect(p.getByTestId('tree-loading')).toHaveCount(0);
  await expect(p.locator('select').first()).toHaveValue(firstId);
  await expect(p.getByTestId('tree-family-name')).toHaveText(byId[firstId]);
  for(const id of ids) expect(callsFor(calls,id)).toBe(1);
 }finally{await c.close()}
});

test('invalid and stale route family canonicalize to first available family with one fetch and no loop',async({browser})=>{
 const {c,firstId}=await login(browser);
 try{
  for(const requested of ['bogus','99999999-9999-4999-8999-999999999999']){
   const p=await c.newPage(),calls=await treeRequests(p);
   await goTree(p,`/tree?family=${requested}`);
   await expect(p).toHaveURL(new RegExp(`[?&]family=${firstId}`));
   await expect(p.locator('select').first()).toHaveValue(firstId);
   await expect.poll(()=>callsFor(calls,firstId)).toBe(1,{timeout:10000});
   await p.waitForTimeout(500);
   expect(callsFor(calls,firstId)).toBe(1);
   expect(callsFor(calls,requested)).toBe(0);
   await p.close();
  }
 }finally{await c.close()}
});
