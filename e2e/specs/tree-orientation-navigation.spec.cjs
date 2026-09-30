const { test, expect } = require('@playwright/test');
const BASE = process.env.TREE_ORIENT_BASE || 'http://127.0.0.1:14180';
async function ready(page){
 const diagnostics={url:null,dom:'',pageErrors:[],consoleErrors:[],failedRequests:[],apiResponses:[]};
 page.on('pageerror',e=>diagnostics.pageErrors.push(e.message));
 page.on('console',m=>{if(m.type()==='error')diagnostics.consoleErrors.push(m.text());});
 page.on('requestfailed',r=>diagnostics.failedRequests.push({url:r.url(),error:r.failure()?.errorText}));
 page.on('response',r=>{if(r.url().includes('/api/'))diagnostics.apiResponses.push({url:r.url(),status:r.status(),contentType:r.headers()['content-type']||''});});
 await page.goto(BASE+'/tree');
 try {
  await expect(page.locator('[data-testid="tree-world"]')).toHaveCount(1,{timeout:10000});
  await expect(page.locator('[data-testid="orientation-vertical"]')).toBeVisible();
 } catch(error) {
  diagnostics.url=page.url();
  diagnostics.dom=await page.locator('body').innerText().catch(()=>'<body unavailable>');
  diagnostics.dom=diagnostics.dom.slice(0,3000);
  diagnostics.states=await page.evaluate(()=>({title:document.title,html:document.body?.innerHTML.slice(0,5000),families:document.querySelector('select')?.innerHTML,world:!!document.querySelector('[data-testid="tree-world"]')})).catch(e=>({evaluateError:e.message}));
  console.error('TREE_READY_DIAGNOSTICS '+JSON.stringify(diagnostics));
  throw new Error(`tree readiness failed; diagnostics=${JSON.stringify(diagnostics)}; cause=${error.message}`);
 }
}
async function login(browser, theme='light', viewport={width:1440,height:900}) {
 const context=await browser.newContext({colorScheme:theme,viewport,locale:'vi-VN',serviceWorkers:'block'});
 const response=await context.request.post(BASE+'/api/v1/auth/demo',{headers:{Origin:'http://localhost:3456'},data:''});
 if(!response.ok()) throw new Error(`demo auth ${response.status()} body=${await response.text().catch(()=>'<unavailable>')}`);
 return context;
}
test('orientation toggles, keyboard/focus and per-family persistence',async({browser})=>{
 const c=await login(browser);try{const p=await c.newPage();await ready(p);
 const dọc=p.getByTestId('orientation-vertical'),ngang=p.getByTestId('orientation-horizontal');
 const familySelect=p.locator('select').first();
 const families=await p.request.get(BASE+'/api/v1/families');
 if(!families.ok()) throw new Error(`families API ${families.status()}: ${await families.text()}`);
 const body=await families.json();
 const realFamilies=(body.families||[]).filter(f=>f.id && f.id!=='11111111-1111-4111-8111-000000000001');
 const ids=[...new Set(realFamilies.map(f=>f.id))];
 const selectorIds=await familySelect.locator('option').evaluateAll(os=>os.map(o=>o.value).filter(Boolean));
 const usable=ids.filter(id=>selectorIds.includes(id));
 if(usable.length<2) throw new Error(`FAIL CLOSED: need 2 distinct real family IDs; API IDs=${JSON.stringify(ids)} selector IDs=${JSON.stringify(selectorIds)} usable=${JSON.stringify(usable)}`);
 const [familyA,familyB]=usable;
 const choose=async id=>{await familySelect.selectOption(id);await expect.poll(()=>familySelect.inputValue()).toBe(id);await expect(p.getByTestId('tree-family-name')).toBeVisible();};
 await choose(familyA);
 await expect(dọc).toHaveAttribute('aria-pressed','true');await expect(ngang).toHaveAttribute('aria-pressed','false');
 await dọc.focus();await expect(dọc).toBeFocused();await p.keyboard.press('Tab');await expect(ngang).toBeFocused();await p.keyboard.press('Enter');await expect(ngang).toHaveAttribute('aria-pressed','true');
 await expect(p.locator('[data-testid^="band-gen-"]')).not.toHaveCount(0);await expect(p.locator('[data-testid="tree-world"] canvas')).toHaveCount(1);
 await p.reload();await expect(ngang).toHaveAttribute('aria-pressed','true');
 await choose(familyB);await expect(dọc).toHaveAttribute('aria-pressed','true');await expect(ngang).toHaveAttribute('aria-pressed','false');
 await ngang.click();await expect(ngang).toHaveAttribute('aria-pressed','true');
 await choose(familyA);await expect(ngang).toHaveAttribute('aria-pressed','true');
 await choose(familyB);await expect(ngang).toHaveAttribute('aria-pressed','true');
 }finally{await c.close();}
});
test('generation rail, minimap geometry and controls; mobile hides minimap',async({browser})=>{
 for(const width of [1440,390,320]){const c=await login(browser,'light',{width,height:844});try{const p=await c.newPage();await ready(p);
 const rail=p.getByTestId('generation-rail');await expect(rail).toBeVisible();const buttons=rail.locator('button');await expect(buttons.first()).toBeVisible();await buttons.last().click();await expect(buttons.last()).toHaveAttribute('aria-current','true');
 const mm=p.getByTestId('tree-minimap');if(width<=767){await expect(mm).toBeHidden();}else{await expect(mm).toBeVisible();const rect=p.getByTestId('minimap-viewport-rect');const before=await rect.boundingBox();await p.getByTestId('minimap-map').click({position:{x:120,y:25}});await expect.poll(async()=>JSON.stringify(await rect.boundingBox())).not.toBe(JSON.stringify(before));await p.getByTestId('minimap-map').focus();await p.keyboard.press('ArrowRight');}
 const fit=p.getByTestId('fit-view');await fit.focus();await expect(fit).toBeFocused();await p.keyboard.press('Enter');await expect(p.locator('[data-testid="tree-world"] canvas')).toHaveCount(1);
 const controls=await p.locator('.tree-viewport button').count();expect(controls).toBeLessThanOrEqual(300);
 }finally{await c.close();}}
});
