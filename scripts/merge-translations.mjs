// ============================================================
// 把 translations_{km,en}.json 合并进
//  - data/categories.json   (加 label_en/desc_km/desc_en)
//  - data/products.json     (加 label_km/label_en/usage_km/usage_en/...)
// 并同步 products.html 内联 /*BW_INLINE_CATEGORIES*/.../*BW_INLINE_PRODUCTS*/...
//
// 用法: node scripts/merge-translations.mjs   (幂等)
// ============================================================
import { readFile, writeFile } from 'node:fs/promises';

const ROOT = new URL('../', import.meta.url).pathname;
const enc = s => new TextEncoder().encode(s);

async function read(p) { return JSON.parse(await readFile(ROOT + p, 'utf8')); }

// —— 把 km / en 产物按 id 合并进现有数组 ——
function mergeCats(cats, kmCats, enCats) {
  const kmById = new Map(kmCats.map(c => [c.id, c]));
  const enById = new Map(enCats.map(c => [c.id, c]));
  return cats.map(c => {
    const k = kmById.get(c.id) || {};
    const e = enById.get(c.id) || {};
    const out = { ...c };
    if (k.label_km) out.label_km = k.label_km;
    if (e.label_en) out.label_en = e.label_en;
    if (k.desc_km) out.desc_km = k.desc_km;
    if (e.desc_en) out.desc_en = e.desc_en;
    return out;
  });
}

// product 的本地化文本字段名
const PROD_TEXT = ['label', 'usage', 'features', 'installation', 'selection', 'note'];
// 与 products.json 字段 key 一致 (label 已是中文基准)
function mergeProds(prods, kmProds, enProds) {
  const kmById = new Map(kmProds.map(p => [p.id, p]));
  const enById = new Map(enProds.map(p => [p.id, p]));
  return prods.map(p => {
    const k = kmById.get(p.id) || {};
    const e = enById.get(p.id) || {};
    const out = { ...p };
    for (const f of PROD_TEXT) {
      if (k[f + '_km']) out[f + '_km'] = k[f + '_km'];
      if (e[f + '_en']) out[f + '_en'] = e[f + '_en'];
    }
    // packaging (text)
    if (k.packaging_km) out.packaging_km = k.packaging_km;
    if (e.packaging_en) out.packaging_en = e.packaging_en;
    // variants (array)
    if (Array.isArray(k.variants_km) && k.variants_km.length) out.variants_km = k.variants_km;
    if (Array.isArray(e.variants_en) && e.variants_en.length) out.variants_en = e.variants_en;
    // 标量技术字段保持不变 (voltage/conductor/...),目前 km/en 给了 *_km/*_en 但我们暂不进产品数据,
    // 因为现实中型号规格/单位本就中英混用,模态框也只展示中文原值。需要时取消下行注释即可启用:
    // ['voltage','conductor','insulation','sheath','temp','install','radius'].forEach(f=>{
    //   if (k[f+'_km']) out[f+'_km']=k[f+'_km'];
    //   if (e[f+'_en']) out[f+'_en']=e[f+'_en'];
    // });
    return out;
  });
}

// —— 同步 products.html 内联 BW_INLINE_* 段 ——
function inlineMarker(name) { return '/*' + name + '*/'; }

function updateInline(html, markerName, newText) {
  const open = inlineMarker(markerName);
  const idx = html.indexOf(open);
  if (idx === -1) throw new Error('inline marker not found: ' + markerName);
  // 找到匹配结束的下一个 inline 标记或 ';
  // 对 INLINE_CATEGORIES 找 '/*BW_INLINE_PRODUCTS*/' 或 ';\n    var CATEGORIES'
  // 对 INLINE_PRODUCTS 找 ';\n    var CATEGORIES' 或 ';\n\n    var CATEGORIES'
  // 通用:从 idx 之后找下一个 '/*BW_INLINE_' 起。若无,则到 ';'
  let end;
  const nextMarker = html.indexOf('/*BW_INLINE_', idx + open.length);
  if (nextMarker !== -1) {
    end = html.lastIndexOf(';', nextMarker) + 1; // marker 前的 ';' 结束本句
  } else {
    // 末尾:找 'var CATEGORIES = [];' 之前
    const cIdx = html.indexOf('var CATEGORIES = []', idx);
    if (cIdx !== -1) end = html.lastIndexOf(';', cIdx) + 1;
    else throw new Error('cannot find end for ' + markerName);
  }
  return html.slice(0, idx) + open + newText + html.slice(end);
}

async function main() {
  const cats = await read('data/categories.json');
  const prods = await read('data/products.json');
  let km = { categories: [], products: [] }, en = { categories: [], products: [] };
  try { km = await read('translations_km.json'); } catch { console.warn('translations_km.json not found — skipping'); }
  try { en = await read('translations_en.json'); } catch { console.warn('translations_en.json not found — skipping'); }

  const newCats = mergeCats(cats, km.categories || [], en.categories || []);
  const newProds = mergeProds(prods, km.products || [], en.products || []);

  // 写 data/*.json (2 空格缩进, 与现有一致)
  await writeFile(ROOT + 'data/categories.json', enc(JSON.stringify(newCats, null, 2) + '\n'));
  await writeFile(ROOT + 'data/products.json', enc(JSON.stringify(newProds, null, 2) + '\n'));
  console.log('Updated data/categories.json (', newCats.length, 'cats )');
  console.log('Updated data/products.json (', newProds.length, 'products )');

  // 同步 products.html 内联
  let html = await readFile(ROOT + 'products.html', 'utf8');
  // 内联块就是 data/ 数据**未含** km/en 时的"首屏免等待"快照;
  // 但 L() 需要 label_km/usage_km 才能本地化,所以也把新字段并入内联。
  const inlineCatsJS = 'var INLINE_CATEGORIES = ' + JSON.stringify(newCats) + ';';
  const inlineProdsJS = 'var INLINE_PRODUCTS = ' + JSON.stringify(newProds) + ';';
  // 顺序:CATEGORIES marker → products marker (按 products.html 中的实际次序)
  html = updateInline(html, 'BW_INLINE_CATEGORIES', inlineCatsJS);
  html = updateInline(html, 'BW_INLINE_PRODUCTS', inlineProdsJS);
  await writeFile(ROOT + 'products.html', enc(html));
  console.log('Updated products.html inline INLINE_CATEGORIES / INLINE_PRODUCTS');
}
main().catch(e => { console.error(e); process.exit(1); });
