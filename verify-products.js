const { chromium } = require('C:/Users/l1531/AppData/Roaming/npm/node_modules/playwright');
const fs = require('fs');
const BASE = 'http://127.0.0.1:8788';
const SHOTS = 'C:/Users/l1531/AppData/Local/Temp/products-verify';
fs.mkdirSync(SHOTS, { recursive: true });
const log = s => console.log(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));

const grabCards = () => page => page.$$eval('button[data-cat][data-pid]', btns =>
  btns.slice(0, 4).map(b => ({
    cat: b.dataset.cat, pid: b.dataset.pid,
    label: (b.querySelector('.text-xs.font-black')||{}).textContent?.trim() || '',
    sub: (b.querySelector('.text-\\[11px\\]')||{}).textContent?.trim() || '',
    detail: (b.querySelector('.text-\\[11px\\].text-slate-600')||{}).textContent?.trim() || ''
  }))
);

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  await page.goto(BASE + '/products.html#welding', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(2500);
  log('loaded errors=' + errors.length);

  // Hero grayscale luminance: render hero to a small crop and compute average
  await page.screenshot({ path: SHOTS + '/hero.png', clip: { x: 0, y: 0, width: 1440, height: 240 } });
  const heroLum = await page.$eval('.hero-bg', e => {
    const cs = getComputedStyle(e);
    const hasGradient = (cs.backgroundImage || '').indexOf('gradient') > -1;
    return { hasGradient, bg: cs.background.slice(0, 60) };
  });
  log('HERO hasGrad=' + heroLum.hasGradient + ' bg="' + heroLum.bg + '..."');

  const langBefore = await page.evaluate(() => window.__I18N__ && window.__I18N__.lang);
  const before = await grabCards()(page);
  log('langBefore=' + langBefore + ' :: ' + before.length + ' product buttons');
  log('BEFORE: ' + JSON.stringify(before, null, 1));

  await page.screenshot({ path: SHOTS + '/before.png', fullPage: true });

  // Switch to English
  await page.evaluate(() => window.__I18N__ && window.__I18N__.set('en'));
  await sleep(700);
  const langAfter = await page.evaluate(() => window.__I18N__ && window.__I18N__.lang);
  const afterEn = await grabCards()(page);
  log('langAfter=' + langAfter + ' :: en buttons: ' + afterEn.length);
  log('AFTER-EN: ' + JSON.stringify(afterEn, null, 1));
  const changedEn = JSON.stringify(before) !== JSON.stringify(afterEn);
  log('★ Product cards updated after EN switch (no reload): ' + changedEn);
  await page.screenshot({ path: SHOTS + '/after-en.png', fullPage: true });

  // Switch back to kh
  await page.evaluate(() => window.__I18N__ && window.__I18N__.set('km'));
  await sleep(700);
  const langKh = await page.evaluate(() => window.__I18N__ && window.__I18N__.lang);
  const afterKh = await grabCards()(page);
  log('langKh=' + langKh + ' :: kh buttons: ' + afterKh.length);
  log('AFTER-KM: ' + JSON.stringify(afterKh, null, 1));
  const backToKm = JSON.stringify(afterKh) !== JSON.stringify(afterEn);
  log('★ Product cards switched again to KM: ' + backToKm);
  await page.screenshot({ path: SHOTS + '/after-km.png', fullPage: true });

  log('console errors (' + errors.length + '): ' + (errors.length ? JSON.stringify(errors) : 'none'));
  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
