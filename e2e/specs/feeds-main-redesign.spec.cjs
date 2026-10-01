const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const base = process.env.FEEDS_MAIN_BASE;
const shots = path.join(process.env.FEEDS_MAIN_ARTIFACTS, 'screenshots');
fs.mkdirSync(shots, { recursive: true });
const evidence = {};
test.beforeEach(async ({ page }) => { page.on('console', m => { if (m.type()==='error') (evidence.console ||= []).push(m.text()); }); page.on('pageerror', e => (evidence.page ||= []).push(String(e))); });
test('feeds-main landing, guest, navigation, tree, 404 and auth probe', async ({ page, request }) => {
 const api = []; page.on('response', r => { if (r.url().includes('/api/')) api.push({url:r.url(),status:r.status()}); });
 await page.goto(base + '/'); await expect(page).toHaveURL(/\/feed(?:[?#].*)?$/);
 const cards = page.locator('article'); await expect(cards.first()).toBeVisible({timeout:20000});
 await page.screenshot({path:path.join(shots,'feed-landing.png'),fullPage:true});
 const postCount = await cards.count(); evidence.a={url:page.url(),postCount,api:api.filter(x=>x.status===200)};
 const composer = page.locator('textarea').first(); evidence.b1={composerCount:await composer.count(),visible:await composer.isVisible().catch(()=>false),loginCTA:await page.getByRole('link',{name:/đăng nhập|đăng nh?p/i}).count()};
 const more=page.getByRole('button',{name:/xem thêm|tải thêm|load more/i}); if(await more.count()){await more.first().click();await page.waitForTimeout(1200);evidence.b2={before:postCount,after:await cards.count(),buttonVisible:await more.first().isVisible().catch(()=>false)};}else evidence.b2={before:postCount,after:postCount,button:'absent/exhausted'};
 const nav=page.locator('nav').first(); evidence.c1=await nav.locator('a').allTextContents(); evidence.c2={brandLinks:await page.locator('a').evaluateAll(as=>as.filter(a=>a.querySelector('img,svg')||/cây gia phả/i.test(a.innerText)).map(a=>({text:a.innerText,href:a.getAttribute('href')})))};
 const feed=page.getByRole('link',{name:/bảng tin/i}).first();evidence.c3={exists:await feed.count(),ariaCurrent:await feed.getAttribute('aria-current').catch(()=>null),class:await feed.getAttribute('class').catch(()=>null)};
 await page.goto(base+'/tree'); await page.waitForTimeout(1500); const canv=page.locator('canvas'); evidence.d={url:page.url(),canvases:await canv.count(),cards:await page.locator('[class*=tree] [class*=card], [data-testid*=tree]').count()}; await page.screenshot({path:path.join(shots,'tree.png'),fullPage:true});
 await page.goto(base+'/no-such-page'); const body=await page.locator('body').innerText(); evidence.e={url:page.url(),feed:await page.locator('a[href="/feed"]').count(),tree:await page.locator('a[href="/tree"]').count(),kinship:await page.locator('a[href="/kinship"]').count(),text:body};await page.screenshot({path:path.join(shots,'404.png'),fullPage:true});
 await page.goto(base+'/signin'); const signText=await page.locator('body').innerText(); let auth=null;
 if(/dùng thử ngay/i.test(signText)){await page.getByText(/dùng thử ngay/i).click();if(await page.getByText(/vào bản dùng thử/i).count()) await page.getByText(/vào bản dùng thử/i).click();await page.waitForTimeout(1500);auth={url:page.url(),body:(await page.locator('body').innerText()).slice(0,1500)};}
 else {const resp=await request.post(base+'/api/v1/auth/demo');auth={status:resp.status(),body:await resp.text()};}
 evidence.f={auth}; evidence.console=evidence.console||[]; evidence.page=evidence.page||[];
 fs.writeFileSync(path.join(process.env.FEEDS_MAIN_ARTIFACTS,'evidence.json'),JSON.stringify(evidence,null,2));
 expect(postCount,'feed has real post cards').toBeGreaterThan(0);
 expect(evidence.a.api.length,'API proxy returns successful response').toBeGreaterThan(0);
 expect(await page.locator('body').count()).toBeGreaterThan(0);
});
