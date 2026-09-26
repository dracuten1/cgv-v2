const { test, expect } = require('@playwright/test');
const path = require('path');
const fs = require('fs');
const base = process.env.APPLE_MOCKUP_BASE;
if (!base || !/^http:\/\/127\.0\.0\.1:1[0-9]{4}$/.test(base)) throw new Error('Set APPLE_MOCKUP_BASE to pack-managed loopback port 10000–19999');
const pages=['login','dashboard','person-detail','persons','settings','tree'];
const viewports=[{name:'desktop',width:1440,height:900},{name:'mobile',width:390,height:844}];
const themes=['light','dark'];
const findings=[];
const artifactDir=path.resolve(process.env.APPLE_QA_ARTIFACT_DIR||'test-results');
function report(file,viewport,theme,category,detail,evidence={}) { findings.push({file,viewport,theme,category,detail:String(detail).slice(0,2000),...evidence}); }
test('six standalone mockups: responsive visual, navigation, interaction and accessibility smoke',async({browser})=>{
 test.setTimeout(230000); fs.mkdirSync(artifactDir,{recursive:true});
 for(const file of pages) for(const viewport of viewports) for(const theme of themes){
  const context=await browser.newContext({viewport:{width:viewport.width,height:viewport.height},colorScheme:theme==='dark'?'dark':'light',locale:'vi-VN'}); const page=await context.newPage();
  const errors=[]; page.on('pageerror',e=>errors.push(e.message)); page.on('console',m=>{if(m.type()==='error')errors.push(m.text())}); page.on('requestfailed',r=>errors.push(`requestfailed ${r.url()}: ${r.failure()?.errorText}`)); page.on('response',r=>{if(r.status()>=400)errors.push(`HTTP ${r.status()} ${r.url()}`)});
  try {
   const response=await page.goto(`${base}/${file}.html?theme=${theme}`,{waitUntil:'networkidle',timeout:15000});
   if(!response||!response.ok())report(file,viewport.name,theme,'navigation',`response ${response?.status()}`);
   const screenshot=path.join(artifactDir,`apple-${file}-${viewport.name}-${theme}.png`); await page.screenshot({path:screenshot,fullPage:true,animations:'disabled'}).catch(e=>report(file,viewport.name,theme,'screenshot',e.message));
   const state=await page.evaluate(()=>({title:document.title,scrollWidth:document.documentElement.scrollWidth,innerWidth,links:[...document.querySelectorAll('a[href]')].map(a=>({text:a.innerText.trim(),href:a.getAttribute('href')})),elements:[...document.querySelectorAll('button,input,select,textarea,[role=button]')].map(e=>({tag:e.tagName,text:(e.innerText||e.getAttribute('aria-label')||e.getAttribute('placeholder')||'').trim(),type:e.getAttribute('type'),disabled:e.disabled,selector:e.id?`#${e.id}`:e.className?`${e.tagName.toLowerCase()}.${String(e.className).trim().split(/\\s+/).join('.')}`:e.tagName.toLowerCase()})),focusables:[...document.querySelectorAll('a[href],button,input,select,textarea,[tabindex]:not([tabindex="-1"])')].length}));
   if(!state.title)report(file,viewport.name,theme,'document','missing title');
   if(state.scrollWidth>viewport.width+1)report(file,viewport.name,theme,'document overflow',`scrollWidth=${state.scrollWidth}; viewport=${viewport.width}`,{observed:{scrollWidth:state.scrollWidth,viewportWidth:viewport.width,screenshot}});
   for(const l of state.links){try{const u=new URL(l.href,page.url()); if(u.origin===new URL(base).origin){const r=await context.request.get(u.href);if(!r.ok())report(file,viewport.name,theme,'link target',`${l.text} -> ${l.href} ${r.status()}`,{element:l})} else if(!/^(mailto:|tel:|#)/.test(l.href))report(file,viewport.name,theme,'external link',`${l.text} -> ${l.href}`,{element:l})}catch(e){report(file,viewport.name,theme,'link target',e.message,{element:l})}}
   if(!state.focusables)report(file,viewport.name,theme,'keyboard','no focusable controls');
   await page.keyboard.press('Tab'); const focus=await page.evaluate(()=>({tag:document.activeElement?.tagName,text:(document.activeElement?.innerText||document.activeElement?.getAttribute('aria-label')||'').trim(),selector:document.activeElement?.id?`#${document.activeElement.id}`:document.activeElement?.className?`${document.activeElement.tagName.toLowerCase()}.${String(document.activeElement.className).trim().split(/\\s+/).join('.')}`:document.activeElement?.tagName,outline:getComputedStyle(document.activeElement).outlineStyle,outlineWidth:getComputedStyle(document.activeElement).outlineWidth,outlineColor:getComputedStyle(document.activeElement).outlineColor}));
   if(focus.tag==='BODY'||focus.outline==='none'&&focus.outlineWidth==='0px')report(file,viewport.name,theme,'keyboard focus',`no apparent first-tab focus`,{element:focus,action:'press Tab',observed:focus,screenshot});
   for(let i=0;i<state.elements.length;i++){const el=state.elements[i];if(el.disabled)continue;const locator=page.locator('button,input,select,textarea,[role=button]').nth(i);const before=await page.evaluate(()=>document.body.innerText);let clickError=null;await locator.click({timeout:1200}).catch(e=>clickError=e.message);const after=await page.evaluate(()=>document.body.innerText);if(clickError)report(file,viewport.name,theme,'mock control','click failed',{element:el,action:'click',observed:clickError,screenshot});else if(before===after&&!el.type?.includes('submit'))report(file,viewport.name,theme,'mock control','click produced no visible body-text change; static-prototype semantics unverified',{element:el,action:'click',observed:{textUnchanged:true,url:page.url()},screenshot,classification:'heuristic-unverified'});}
   for(const err of [...new Set(errors)])report(file,viewport.name,theme,'browser error',err,{screenshot});
  }catch(e){report(file,viewport.name,theme,'page inspection',e.stack||e.message)} await context.close();
 }
 const summary={states:pages.length*viewports.length*themes.length,findings,artifacts:{directory:artifactDir,screenshots:24}};fs.writeFileSync(path.join(artifactDir,'apple-redesign-qa-findings.json'),JSON.stringify(summary,null,2));console.log(`APPLE MOCKUP QA ARTIFACT: ${path.join(artifactDir,'apple-redesign-qa-findings.json')}\nAPPLE MOCKUP QA FINDINGS (${findings.length})\n${JSON.stringify(findings,null,2)}`);expect(findings.filter(f=>f.classification!=='heuristic-unverified'),`${findings.length} findings recorded; static controls are adjudication-required heuristics`).toHaveLength(0);
});
