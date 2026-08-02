const { chromium } = require('C:/Users/l1531/AppData/Roaming/npm/node_modules/playwright');
const fs = require('fs');
const BASE = 'http://127.0.0.1:8788';
const SHOTS = 'C:/Users/l1531/AppData/Local/Temp/admin-verify';
fs.mkdirSync(SHOTS, { recursive: true });
const log = s => console.log(s);

(async () => {
  const browser = await chromium.launch({ args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));

  await page.goto(BASE + '/admin.html', { waitUntil: 'domcontentloaded' });
  await page.fill('#login-password', 'BwCable2026!');
  await page.click('#btn-login');
  await page.waitForSelector('#app-wrapper:not(.hidden)', { state: 'visible', timeout: 10000 });
  await page.waitForTimeout(1800);
  log('✓ Logged in');

  const switchView = async v => { await page.evaluate(n => switchView(n), v); await page.waitForTimeout(700); };

  // ===== STEP 1: Category modal =====
  await switchView('categories');
  log('view-title: ' + await page.textContent('#view-title'));
  // Fresh-login path doesn't bind toolbar listeners (savedToken guard); call openers directly.
  await page.evaluate(() => openNewCategory());
  await page.waitForSelector('#category-modal:not(.hidden)', { state: 'visible', timeout: 5000 });
  await page.waitForTimeout(500);

  const catGroups = await page.$$eval('#category-modal-body .bg-slate-900\\/40', els => els.map(e => {
    const label = (e.querySelector('.font-bold.text-slate-200')||{}).textContent || '';
    const inputs = Array.from(e.querySelectorAll('input, textarea'));
    return { label: label.trim(), inputCount: inputs.length, ids: inputs.map(i => i.id) };
  }));
  log('CATEGORY grouped cards: ' + JSON.stringify(catGroups));

  const catSingleIds = await page.$$eval('#category-modal-body .grid.grid-cols-2 [id^="cat-field-"]', els => els.map(e => e.id));
  log('CATEGORY single-value ids: ' + JSON.stringify(catSingleIds));

  const catMW = await page.$eval('#category-modal > div', e => e.className.match(/max-w-\w+/)?.[0] || '?');
  log('Category modal width: ' + catMW);
  await page.screenshot({ path: SHOTS + '/1-category-new.png' });
  log('✓ shot 1');

  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // ===== STEP 2: Product modal (new) =====
  await switchView('products');
  await page.evaluate(() => openNewProduct());
  await page.waitForSelector('#product-modal-editor:not(.hidden)', { state: 'visible', timeout: 5000 });
  await page.waitForTimeout(500);

  const prodGroups = await page.$$eval('#product-modal-body .bg-slate-900\\/40', els => els.map(e => {
    const t = (e.querySelector('.font-bold.text-slate-200')||{}).textContent || '';
    const inputs = Array.from(e.querySelectorAll('input, textarea'));
    return { label: t.trim(), inputCount: inputs.length, ids: inputs.map(i => i.id) };
  }));
  log('PRODUCT grouped cards (' + prodGroups.length + '):');
  prodGroups.forEach(g => log('  - ' + g.label + ' [' + g.inputCount + ' inputs] ids=' + JSON.stringify(g.ids)));

  const prodSingleIds = await page.$$eval('#product-modal-body .grid.grid-cols-1.sm\\:grid-cols-2 [id^="prod-field-"]', els => els.map(e => e.id));
  log('PRODUCT single-value ids: ' + JSON.stringify(prodSingleIds));

  const varIds = await page.$$eval('#product-modal-body textarea[id^="prod-field-variants"]', els => els.map(e => e.id));
  log('PRODUCT variants textarea ids: ' + JSON.stringify(varIds));

  const specRows = await page.$$eval('#spec-rows [data-spec-row]', els => els.length);
  log('PRODUCT spec rows rendered: ' + specRows);

  await page.screenshot({ path: SHOTS + '/2-product-new.png' });
  log('✓ shot 2');

  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  // ===== STEP 3: Edit bvr =====
  await page.evaluate(() => editProduct('bvr'));
  await page.waitForSelector('#product-modal-editor:not(.hidden)', { state: 'visible', timeout: 5000 });
  await page.waitForTimeout(500);

  const fv = async id => { try { return await page.$eval('#' + id, e => e.value); } catch { return 'MISSING'; } };
  const filled = {
    label:    await fv('prod-field-label'),
    label_km: await fv('prod-field-label_km'),
    label_en: await fv('prod-field-label_en'),
    usage:    await fv('prod-field-usage'),
    usage_km: await fv('prod-field-usage_km'),
    name:     await fv('prod-field-name'),
    voltage:  await fv('prod-field-voltage'),
    variants: await fv('prod-field-variants'),
  };
  log('BVR autofill: ' + JSON.stringify(filled, null, 2));
  await page.screenshot({ path: SHOTS + '/3-product-edit-bvr.png' });
  log('✓ shot 3');

  log('CONSOLE ERRORS (' + errors.length + '): ' + (errors.length ? JSON.stringify(errors) : 'none'));
  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
