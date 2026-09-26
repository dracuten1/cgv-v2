const { test, expect } = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');

const base = process.env.APPLE_REGRESSION_BASE;
if (!base || !/^http:\/\/127\.0\.0\.1:1[0-9]{4}$/.test(base)) throw new Error('Pack-managed APPLE_REGRESSION_BASE on loopback port 10000–19999 required');
const mockups = path.resolve(__dirname, '../../.agents/shared/planning/apple-redesign/mockups');
const out = path.resolve(process.env.APPLE_REGRESSION_ARTIFACT_DIR || '../.agents/tester/RESULTS/apple-redesign-focused-regression');
const results = [];

async function record(page, name, check, fn) {
  const row = { case: name, check, status: 'FAIL', measurements: null, error: null };
  try { row.measurements = await fn(); row.status = 'PASS'; }
  catch (e) { row.error = String(e.message || e); }
  try { await page.screenshot({ path: path.join(out, `${name.replace(/[^a-z0-9-]/gi, '-')}.png`), fullPage: true }); }
  catch (e) { row.screenshotError = String(e.message || e); }
  results.push(row);
}

test('focused Apple mockup browser regression', async ({ browser }) => {
  fs.mkdirSync(out, { recursive: true });
  const errors = [];
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light', locale: 'vi-VN' });
  const page = await context.newPage();
  for (const kind of ['pageerror', 'console']) page.on(kind, e => errors.push({ type: kind, message: kind === 'console' ? e.text() : e.message }));
  page.on('requestfailed', r => errors.push({ type: 'requestfailed', message: `${r.url()} ${r.failure()?.errorText}` }));
  page.on('response', r => { if (r.status() >= 400) errors.push({ type: 'http', message: `${r.status()} ${r.url()}` }); });
  const url = file => `${base}/${file}.html?theme=light`;
  try {
    await page.goto(url('tree'), { waitUntil: 'networkidle' });
    await record(page, 'tree-desktop-inspector-destination', 'CTA label, real destination navigation, hero identity and name field match selected person', async () => {
      const cta = page.locator('.tree-panel--right a[href]');
      const label = (await cta.innerText()).trim(); const href = await cta.getAttribute('href');
      const current = (await page.locator('.tree-panel--right .tree-person__name').innerText()).trim();
      expect(label).toContain(current);
      expect(href).toBe('person-detail.html');
      await cta.click();
      await page.waitForURL(url => new URL(url).pathname === '/person-detail.html');
      const landedUrl = new URL(page.url());
      expect(landedUrl.pathname).toBe('/person-detail.html');
      const hero = (await page.locator('.person-hero h2').innerText()).trim();
      const nameField = (await page.locator('.kv').filter({ hasText: 'Họ và tên' }).locator('.kv__value').innerText()).trim();
      expect(hero).toBe(current); expect(nameField).toBe(current);
      return { selectedIdentity: current, ctaLabel: label, href, landedUrl: landedUrl.href, destinationHeroIdentity: hero, destinationNameField: nameField };
    });
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ colorScheme: theme }); await page.goto(`${base}/tree.html?theme=${theme}`, { waitUntil: 'networkidle' });
      await record(page, `tree-mobile-${theme}-navigation`, 'click opens panel, aria state, Escape closes, focus returns', async () => {
        const trigger = page.getByRole('button', { name: 'Hiện bảng điều hướng' }); await trigger.click();
        const panel = page.locator('#tree-navigation'); await expect(panel).toBeVisible(); await expect(trigger).toHaveAttribute('aria-expanded', 'true');
        const afterOpen = await page.evaluate(() => ({ active: document.activeElement?.getAttribute('aria-label'), expanded: document.querySelector('.tree-open-navigation').getAttribute('aria-expanded'), controls: document.querySelector('.tree-open-navigation').getAttribute('aria-controls'), visible: getComputedStyle(document.querySelector('#tree-navigation')).display }));
        await page.keyboard.press('Escape'); await expect(panel).toBeHidden(); await expect(trigger).toHaveAttribute('aria-expanded', 'false'); await expect(trigger).toBeFocused();
        return { ...afterOpen, afterEscape: { active: await page.evaluate(() => document.activeElement?.getAttribute('aria-label')), expanded: await trigger.getAttribute('aria-expanded'), hidden: !(await panel.isVisible()) } };
      });
      await record(page, `tree-mobile-${theme}-search`, 'search button focuses search; Enter submits native search; Escape closes and restores focus', async () => {
        const trigger = page.getByRole('button', { name: 'Tìm kiếm thành viên' }); await trigger.click(); const panel = page.locator('#tree-navigation'); const input = page.locator('#tree-search');
        await expect(panel).toBeVisible(); await expect(input).toBeFocused(); await expect(trigger).toHaveAttribute('aria-expanded', 'true');
        await input.fill('Nguyễn Minh'); await input.press('Enter');
        const submitted = await page.evaluate(() => ({ value: document.querySelector('#tree-search').value, activeTag: document.activeElement.tagName, expanded: document.querySelector('.tree-open-search').getAttribute('aria-expanded'), controls: document.querySelector('.tree-open-search').getAttribute('aria-controls') }));
        expect(submitted.value).toBe('Nguyễn Minh'); await page.keyboard.press('Escape'); await expect(panel).toBeHidden(); await expect(trigger).toBeFocused();
        return { ...submitted, closed: !(await panel.isVisible()), focusReturned: await trigger.evaluate(el => document.activeElement === el), finalExpanded: await trigger.getAttribute('aria-expanded') };
      });
    }
    for (const theme of ['light', 'dark']) {
      await page.setViewportSize({ width: 320, height: 800 }); await page.emulateMedia({ colorScheme: theme }); await page.goto(`${base}/login.html?theme=${theme}`, { waitUntil: 'networkidle' });
      await record(page, `login-320-${theme}-overflow-panel`, 'document width and login panel geometry fit 320px viewport', async () => {
        const m = await page.evaluate(() => { const p = document.querySelector('.login__panel'), r = p.getBoundingClientRect(); return { viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth, panel: { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, scrollWidth: p.scrollWidth, clientWidth: p.clientWidth } }; });
        expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth); expect(m.panel.right).toBeLessThanOrEqual(m.clientWidth + 1); expect(m.panel.width).toBeLessThanOrEqual(m.clientWidth + 1); return m;
      });
    }
    await page.setViewportSize({ width: 390, height: 844 }); await page.emulateMedia({ colorScheme: 'light' }); await page.goto(url('login'), { waitUntil: 'networkidle' });
    await record(page, 'login-390-overflow', 'no horizontal document overflow at 390px', async () => { const m = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth })); expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth); return m; });
    await page.setViewportSize({ width: 1440, height: 900 }); await page.goto(url('tree'), { waitUntil: 'networkidle' });
    await record(page, 'tree-desktop-overflow', 'no horizontal document overflow at desktop', async () => { const m = await page.evaluate(() => ({ viewport: innerWidth, scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth })); expect(m.scrollWidth).toBeLessThanOrEqual(m.clientWidth); return m; });
  } finally {
    await context.close();
    fs.writeFileSync(path.join(out, 'summary.json'), JSON.stringify({ generatedAt: new Date().toISOString(), base, cases: results, browserErrors: errors, verdict: results.every(r => r.status === 'PASS') && errors.length === 0 ? 'PASS' : 'FAIL' }, null, 2));
  }
  expect(results.filter(r => r.status === 'FAIL'), 'Regression cases recorded in summary.json').toEqual([]);
  expect(errors, 'Browser console/page/request errors recorded in summary.json').toEqual([]);
});
