const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const base = process.env.APPLE_PHASE1_BASE;
const root = path.resolve(__dirname, '../..');
if (!base || !/^http:\/\/127\.0\.0\.1:1[0-9]{4}$/.test(base)) throw new Error('Pack-managed local preview URL required');
const out = process.env.APPLE_PHASE1_ARTIFACTS || path.resolve(__dirname, '../../.agents/tester/RESULTS/apple_phase1_shell_e2e');
const rows = [];
async function check(page, name, selector, width, theme, fn) {
  const row = { name, selector, viewport: width, theme, status: 'FAIL' };
  try { row.measurements = await fn(); row.status = 'PASS'; } catch (e) { row.error = String(e.message || e); }
  const screenshot = `${name}-vp${width}-${theme}.png`;
  try { await page.screenshot({ path: path.join(out, screenshot), fullPage: true }); row.screenshot = screenshot; } catch (e) { row.screenshotError = String(e.message || e); }
  rows.push(row);
}
function luminance(color) {
  const c = color.match(/[\d.]+/g);
  if (!c || c.length < 3) return NaN;
  const [r,g,b] = c.slice(0,3).map(v => +v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4);
  return .2126*r + .7152*g + .0722*b;
}
function contrast(a,b) { const x=luminance(a), y=luminance(b); return (Math.max(x,y)+.05)/(Math.min(x,y)+.05); }
async function shell(page,width,theme) {
  await check(page,`shell-${width}-${theme}-overflow`,'documentElement',width,theme,async()=>{
    const m=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,clientWidth:document.documentElement.clientWidth}));
    expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth); return m;
  });
  await check(page,`shell-${width}-${theme}-route-dom`,'#app + route content',width,theme,async()=>{
    await expect(page.locator('#app')).toBeVisible(); await expect(page.locator('main')).toBeVisible();
    await expect(page.getByRole('heading',{name:'Cây Gia Phả'})).toBeVisible();
    return {appCount:await page.locator('#app').count(),mainCount:await page.locator('main').count(),heading:'Cây Gia Phả'};
  });
  await check(page,`shell-${width}-${theme}-aria-current`,'visible navigation current link',width,theme,async()=>{
    const nav=page.locator('nav[aria-label="Điều hướng chính"],nav[aria-label="Điều hướng di động"]:visible'); await expect(nav.first()).toBeVisible();
    const a=nav.locator('a[aria-current="page"]'); await expect(a).toHaveCount(1); return {label:await a.innerText(),href:await a.getAttribute('href')};
  });
  await check(page,`shell-${width}-${theme}-keyboard-focus`,':focus-visible',width,theme,async()=>{
    await page.evaluate(()=>document.activeElement.blur()); await page.keyboard.press('Tab'); const f=page.locator(':focus-visible'); await expect(f).toHaveCount(1);
    const m=await f.evaluate(e=>({tag:e.tagName,outline:getComputedStyle(e).outlineStyle,outlineWidth:getComputedStyle(e).outlineWidth,shadow:getComputedStyle(e).boxShadow}));
    expect(m.outline!=='none'||m.shadow!=='none').toBeTruthy(); return m;
  });
  await check(page,`shell-${width}-${theme}-text-contrast`,'visible rendered text nodes',width,theme,async()=>{
    const samples=await page.evaluate(()=>{const all=[];const walk=document.createTreeWalker(document.querySelector('main'),NodeFilter.SHOW_TEXT);while(walk.nextNode()){const n=walk.currentNode,e=n.parentElement;if(!n.textContent.trim()||!e.getClientRects().length)continue;const s=getComputedStyle(e);if(s.visibility==='hidden'||+s.opacity===0)continue;let a=e;while(a&&getComputedStyle(a).backgroundColor==='rgba(0, 0, 0, 0)')a=a.parentElement;all.push({text:n.textContent.trim().slice(0,70),fg:s.color,bg:a?getComputedStyle(a).backgroundColor:getComputedStyle(document.body).backgroundColor});}return all;});
    expect(samples.length).toBeGreaterThan(0);const measured=samples.map(x=>({...x,ratio:contrast(x.fg,x.bg)}));const failures=measured.filter(x=>!Number.isFinite(x.ratio)||x.ratio<4.5);expect(failures,JSON.stringify(failures)).toEqual([]);return {count:measured.length,minimum:Math.min(...measured.map(x=>x.ratio))};
  });
  await check(page,`shell-${width}-${theme}-functional-nontext`,'visible controls and boundaries',width,theme,async()=>{
    const samples=await page.evaluate(()=>[...document.querySelectorAll('main button,main a,nav a,main input,main select,main textarea')].filter(e=>e.getClientRects().length&&getComputedStyle(e).visibility!=='hidden').map(e=>{const s=getComputedStyle(e);let a=e;while(a&&getComputedStyle(a).backgroundColor==='rgba(0, 0, 0, 0)')a=a.parentElement;return{tag:e.tagName,fg:s.color,bg:a?getComputedStyle(a).backgroundColor:getComputedStyle(document.body).backgroundColor,border:s.borderTopColor}}));
    expect(samples.length).toBeGreaterThan(0);const failures=samples.map(x=>({...x,ratio:contrast(x.fg,x.bg)})).filter(x=>!Number.isFinite(x.ratio)||x.ratio<3);expect(failures,JSON.stringify(failures)).toEqual([]);return{count:samples.length,minimum:Math.min(...samples.map(x=>contrast(x.fg,x.bg)))};
  });
}
test('live Vue Phase 1 shell',async({browser})=>{
  fs.mkdirSync(out,{recursive:true}); const errors=[],fontResponses=[],externalFonts=[]; const context=await browser.newContext({viewport:{width:1440,height:900},locale:'vi-VN',colorScheme:'light'}); const page=await context.newPage();
  page.on('pageerror',e=>errors.push({type:'pageerror',message:e.message})); page.on('console',e=>{if(e.type()==='error')errors.push({type:'console',message:e.text()})});
  page.on('requestfailed',r=>errors.push({type:'requestfailed',message:`${r.url()}: ${r.failure()?.errorText}`}));
  page.on('request',r=>{if(/\.(woff2?|ttf|otf)(\?|$)/i.test(r.url())&&!r.url().startsWith(base+'/'))externalFonts.push(r.url())});
  page.on('response',r=>{if(/\.(woff2?|ttf|otf)(\?|$)/i.test(r.url()))fontResponses.push({url:r.url(),status:r.status()})});
  try {
    const dist=path.join(root,'web/dist/index.html'); const source=path.join(root,'web/src/assets/main.css');
    const distMtime=fs.statSync(dist).mtimeMs, sourceMtime=fs.statSync(source).mtimeMs;
    await check(page,'fresh-dist-proof','web/dist/index.html newer than Phase 1 stylesheet',1440,'light',async()=>{expect(distMtime).toBeGreaterThan(sourceMtime);return{distMtime:new Date(distMtime).toISOString(),phase1SourceMtime:new Date(sourceMtime).toISOString()}});
    for(const width of [1440,390,320]) for(const theme of ['light','dark']) { await page.setViewportSize({width,height:900}); await page.emulateMedia({colorScheme:theme}); await page.goto(base+'/login',{waitUntil:'networkidle'}); await shell(page,width,theme); }
    await page.setViewportSize({width:1440,height:900}); await page.emulateMedia({colorScheme:'dark'}); await page.goto(base+'/login',{waitUntil:'networkidle'});
    await check(page,'demo-amber','[data-testid=demo-login-btn]',1440,'dark',async()=>{const b=page.locator('[data-testid="demo-login-btn"]');await expect(b).toHaveCount(1);const x=await b.evaluate(e=>({bg:getComputedStyle(e).backgroundColor,token:getComputedStyle(document.documentElement).getPropertyValue('--demo-button').trim(),fg:getComputedStyle(e).color}));expect(x.bg).toBe(x.token);expect(contrast(x.fg,x.bg)).toBeGreaterThanOrEqual(4.5);return x});
    await check(page,'fraunces-self-hosted','loaded Fraunces + successful same-origin font request',1440,'dark',async()=>{const faces=await page.evaluate(async()=>{await document.fonts.load('600 32px Fraunces','Phả');return[...document.fonts].filter(x=>x.family.includes('Fraunces')).map(x=>({family:x.family,status:x.status}))});const own=fontResponses.filter(x=>x.url.startsWith(base+'/')&&x.status<400);expect(faces.some(x=>x.status==='loaded')).toBeTruthy();expect(own.length).toBeGreaterThan(0);expect(externalFonts).toEqual([]);return{faces,own,externalFonts}});
    for(const variant of ['gen1','gen2','gen3','gen4']) rows.push({name:`dark-${variant}-chip-contrast`,selector:`AppChip variant ${variant}`,viewport:1440,theme:'dark',status:'NOT OBSERVED',reason:'No reachable route guarantees this generation variant; absent component is not a pass.'});
    await page.goto(base+'/auth/email/verify',{waitUntil:'networkidle'});
    await check(page,'dark-authinterstitial-hover-contrast','AuthInterstitial link:hover',1440,'dark',async()=>{const a=page.locator('main a');await expect(a).toHaveCount(1);await a.hover();const x=await a.evaluate(e=>({fg:getComputedStyle(e).color,bg:getComputedStyle(e.parentElement.parentElement).backgroundColor,text:e.innerText}));expect(contrast(x.fg,x.bg)).toBeGreaterThanOrEqual(4.5);return{...x,ratio:contrast(x.fg,x.bg)}});
    await page.goto(base+'/login',{waitUntil:'networkidle'}); await check(page,'theme-live-switch','prefers-color-scheme light↔dark',1440,'light',async()=>{const bg=()=>page.evaluate(()=>getComputedStyle(document.body).backgroundColor),light=await bg();await page.emulateMedia({colorScheme:'dark'});const dark=await bg();await page.emulateMedia({colorScheme:'light'});const again=await bg();expect(dark).not.toBe(light);expect(again).toBe(light);return{light,dark,again}});
    for(const route of ['/tree','/kinship','/feed']) {await page.goto(base+route,{waitUntil:'networkidle'});await check(page,`route-${route.slice(1)}`,`#app main ${route}`,1440,'light',async()=>{await expect(page.locator('#app')).toBeVisible();await expect(page.locator('main')).toBeVisible();expect(new URL(page.url()).pathname).toBe(route);return{path:new URL(page.url()).pathname,title:await page.title()}})}
    await page.goto(base+'/login',{waitUntil:'networkidle'});await check(page,'demo-flow','demo login button→tree route',1440,'light',async()=>{const b=page.locator('[data-testid="demo-login-btn"]');await expect(b).toHaveCount(1);await b.click();await page.waitForURL(/\/tree/,{timeout:12000});const a=page.locator('nav a[aria-current="page"]');await expect(a).toHaveCount(1);return{path:new URL(page.url()).pathname,current:await a.innerText()}});
  } finally {await context.close();fs.writeFileSync(path.join(out,'summary.json'),JSON.stringify({base,cases:rows,errors,fontResponses,externalFonts,preFixBaseline:{genLabels:'1.81–2.14:1',authInterstitialHover:'~1.8:1'},verdict:rows.some(r=>r.status==='FAIL')||errors.length?'FAIL':'INCOMPLETE: NOT OBSERVED cases remain; do not treat as full phase pass'},null,2))}
  expect(rows.filter(x=>x.status==='FAIL')).toEqual([]); expect(rows.filter(x=>x.status==='NOT OBSERVED').map(x=>({name:x.name,reason:x.reason})), 'Coverage incomplete; NOT OBSERVED checks are not a pass').toEqual([]); expect(errors).toEqual([]);
});
