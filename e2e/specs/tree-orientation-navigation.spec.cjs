const { test, expect } = require('@playwright/test');
const BASE = process.env.TREE_ORIENT_BASE || 'http://127.0.0.1:14180';
async function login(browser, theme='light', viewport={width:1440,height:900}) {
 const context=await browser.newContext({colorScheme:theme,viewport,locale:'vi-VN',serviceWorkers:'block'});
 const response=await context.request.post(BASE+'/api/v1/auth/demo',{headers:{Origin:new URL(BASE).origin},data:''});
 if(!response.ok()) throw new Error(`demo auth ${response.status()}`);
 return context;
}
async function ready(page){await page.goto(BASE+'/tree');await expect(page.locator('[data-testid="tree-world"]')).toHaveCount(1,{timeout:10000});await expect(page.locator('[data-testid="orientation-vertical"]')).toBeVisible();}
test('orientation toggles, keyboard/focus and per-family persistence',async({browser})=>{
 const c=await login(browser);try{const p=await c.newPage();await ready(p);
 const dọc=p.getByTestId('orientation-vertical'),ngang=p.getByTestId('orientation-horizontal');
 await expect(dọc).toHaveAttribute('aria-pressed','true');await expect(ngang).toHaveAttribute('aria-pressed','false');
 await dọc.focus();await expect(dọc).toBeFocused();await p.keyboard.press('Tab');await expect(ngang).toBeFocused();await p.keyboard.press('Enter');await expect(ngang).toHaveAttribute('aria-pressed','true');
 await expect(p.locator('[data-testid^="band-gen-"]')).not.toHaveCount(0);await expect(p.locator('[data-testid="tree-world"] canvas')).toHaveCount(1);
 await p.reload();await expect(ngang).toHaveAttribute('aria-pressed','true');
 const familySelect=p.locator('select').filter({has: p.locator('option')}).first();
 const options=await familySelect.locator('option').evaluateAll(os=>os.map(o=>o.value).filter(Boolean));
 if(options.length>1){const currentFamily=await familySelect.inputValue();await familySelect.selectOption(options.find(x=>x!==currentFamily));await expect(p.getByTestId('orientation-vertical')).toHaveAttribute('aria-pressed','true');await familySelect.selectOption(options[0]);await expect(ngang).toHaveAttribute('aria-pressed','true');}
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
