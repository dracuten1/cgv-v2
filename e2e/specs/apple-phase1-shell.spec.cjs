const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.APPLE_PHASE1_BASE;
if (!base || !/^http:\/\/127\.0\.0\.1:1[0-9]{4}$/.test(base)) throw new Error('Pack-managed local preview URL required');
const out = process.env.APPLE_PHASE1_ARTIFACTS || path.resolve(__dirname, '../../.agents/tester/RESULTS/apple_phase1_shell_e2e');
const rows=[];
async function check(page,name,selector,viewport,theme,fn){
 const row={name,selector,viewport,theme,status:'FAIL'};
 try { row.measurements=await fn(); row.status='PASS'; } catch(e){row.error=String(e.message||e);}
 try { await page.screenshot({path:path.join(out,`${name}.png`),fullPage:true}); }catch(e){row.screenshotError=String(e.message||e)}
 rows.push(row);
}
test('live Vue Phase 1 shell',async({browser})=>{
 fs.mkdirSync(out,{recursive:true}); const errors=[]; const ctx=await browser.newContext({viewport:{width:1440,height:900},locale:'vi-VN',colorScheme:'light'}); const p=await ctx.newPage();
 p.on('pageerror',e=>errors.push({type:'pageerror',message:e.message})); p.on('console',e=>{if(e.type()==='error') errors.push({type:'console',message:e.text()})}); p.on('requestfailed',r=>errors.push({type:'requestfailed',message:r.url()+': '+r.failure()?.errorText}));
 try{
  await p.goto(base+'/login',{waitUntil:'networkidle'});
  for(const width of [1440,390,320]) for(const theme of ['light','dark']){
   await p.setViewportSize({width,height:900}); await p.emulateMedia({colorScheme:theme}); await p.goto(base+'/login',{waitUntil:'networkidle'});
   await check(p,`login-${width}-${theme}-overflow`,`documentElement.scrollWidth`,width,theme,async()=>{const m=await p.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth}));expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth);return m});
   await check(p,`login-${width}-${theme}-shell`,`main`,width,theme,async()=>{const main=p.locator('main');await expect(main).toBeVisible();return {title:await p.title(),mainCount:await main.count()}});
  }
  await p.emulateMedia({colorScheme:'light'}); await p.goto(base+'/login',{waitUntil:'networkidle'});
  await check(p,'login-demo-amber','[data-testid="demo-login-btn"]',1440,'light',async()=>{const b=p.locator('[data-testid="demo-login-btn"]');await expect(b).toBeVisible();const c=await b.evaluate(e=>getComputedStyle(e).backgroundColor);expect(c).not.toBe('');return {backgroundColor:c,text:await b.innerText()}});
  await check(p,'login-font-loaded','document.fonts.check',1440,'light',async()=>{const m=await p.evaluate(async()=>{await document.fonts.ready;return {faces:[...document.fonts].map(f=>({family:f.family,status:f.status})),loaded:document.fonts.check('16px "Be Vietnam Pro"')}});expect(m.faces.some(f=>f.status==='loaded')).toBeTruthy();return m});
  await check(p,'login-keyboard-focus','button:focus-visible',1440,'light',async()=>{await p.keyboard.press('Tab');const a=await p.evaluate(()=>({tag:document.activeElement?.tagName,text:document.activeElement?.innerText,outline:getComputedStyle(document.activeElement).outlineStyle}));expect(a.tag).toBeTruthy();expect(a.outline).not.toBe('none');return a});
  await check(p,'os-theme-live-switch','html[data-theme]',1440,'light',async()=>{const before=await p.locator('html').getAttribute('data-theme');await p.emulateMedia({colorScheme:'dark'});await p.waitForTimeout(100);const dark=await p.evaluate(()=>({attr:document.documentElement.getAttribute('data-theme'),bg:getComputedStyle(document.body).backgroundColor}));await p.emulateMedia({colorScheme:'light'});await p.waitForTimeout(100);const light=await p.evaluate(()=>({attr:document.documentElement.getAttribute('data-theme'),bg:getComputedStyle(document.body).backgroundColor}));expect(dark.bg).not.toBe(light.bg);return {before,dark,light}});
  await check(p,'login-demo-flow','[data-testid="demo-login-btn"]',1440,'light',async()=>{const b=p.locator('[data-testid="demo-login-btn"]');await expect(b).toBeVisible();await b.click();await p.waitForURL(/\/tree/,{timeout:12000});await expect(p.locator('body')).toBeVisible();return {url:new URL(p.url()).pathname,mainCount:await p.locator('main').count()}});
  for(const route of ['/tree','/kinship','/feed','/account']){await p.goto(base+route,{waitUntil:'networkidle'});await check(p,`route-${route.slice(1)}-reachable`,`main`,1440,'light',async()=>{await expect(p.locator('main')).toBeVisible();return {path:new URL(p.url()).pathname,title:await p.title()}})}
  await check(p,'nav-aria-current','nav a[aria-current="page"]',1440,'light',async()=>{const links=p.locator('nav a[aria-current="page"]');await expect(links.first()).toBeVisible();return {count:await links.count(),labels:await links.allInnerTexts()}});
 } finally {await ctx.close();fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({base,cases:rows,errors,verdict:rows.every(r=>r.status==='PASS')&&!errors.length?'PASS':'FAIL'},null,2));}
 expect(rows.filter(r=>r.status==='FAIL')).toEqual([]);expect(errors).toEqual([]);
});
