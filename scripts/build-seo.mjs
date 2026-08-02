/**
 * B·W CABLE — SEO 构建脚本
 *
 * 从 data/articles.json、data/products.json 读取内容，在两个 HTML 页面的占位标记位
 * 注入 JSON-LD 结构化数据（Article / Product ItemList），并重新生成 sitemap.xml（含 lastmod）。
 *
 * 用法：  node scripts/build-seo.mjs
 *
 * 设计要点：
 *  - 基于 HTML 注释占位标记位注入；重复运行会先清除旧块再注入新块，幂等。
 *  - 注入的 JSON-LD 中包含 </script> 风险序列时已转义为 <\/script>，防止 HTML 解析中断。
 *  - 爬虫拿到的初始 HTML 使用构建期数据快照，与 inline 数据源一致（参见 INLINE_* 注入机制）。
 *  - 不修改运行时 KV；KV 更新后需重新跑此脚本并部署（与现有 inline 数据同步策略一致）。
 *
 * 占位标记位（HTML 中）：
 *   <!--SEO_SCHEMA_ARTICLES--> ... <!--/SEO_SCHEMA_ARTICLES-->   (articles.html)
 *   <!--SEO_SCHEMA_PRODUCTS-->  ... <!--/SEO_SCHEMA_PRODUCTS-->  (products.html)
 */

import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const SITE = 'https://bw-cable.com';
const BRAND = 'B·W CABLE';
const LOGO_URL = `${SITE}/logo.png`;

// 各分类的中文标签（用于 Product.category 显示，与 categories.json 的 label 一致）
const CATEGORY_LABEL = {
  household: '家装布电线',
  power: '电力主干电缆',
  welding: '电焊机专用电缆',
  flexible: '设备软线与花线',
};

// 高棉语 → 中文 category 映射（文章的 category 字段是高棉语，schema 用中文 articleSection 更友好）
const ARTICLE_CATEGORY_LABEL = {
  'អគ្គិសនី': '电气',
  'សំណង់': '土木工程',
  'តុបតែង': '装饰',
  'វ៉ាយតម្លៃ': '造价',
  'សុវត្ថិភាព': '安全',
};

const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

// ---------- 读取数据 ----------
async function readJSON(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

// 转义 JSON-LD 文本里可能让 HTML 解析器提前结束 </script> 的序列
function safeJson(obj) {
  return JSON.stringify(obj, null, 2).replace(/<\/script/gi, '<\\/script');
}

function scriptBlock(jsonObj) {
  return `<script type="application/ld+json">\n${safeJson(jsonObj)}\n</script>`;
}

// ---------- 文章 schema ----------
function buildArticlesSchema(articles) {
  const published = articles.filter((a) => (a.status || 'published') === 'published');
  const items = published.map((a, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: {
      '@type': 'Article',
      headline: a.title,
      description: a.excerpt || '',
      datePublished: a.date || today,
      inLanguage: ['km', 'zh'],
      articleSection: ARTICLE_CATEGORY_LABEL[a.category] || a.category || '',
      image: a.coverImage ? [a.coverImage] : undefined,
      author: { '@type': 'Organization', name: BRAND },
      publisher: {
        '@type': 'Organization',
        name: BRAND,
        logo: { '@type': 'ImageObject', url: LOGO_URL },
      },
      // 文章以 modal 形式展示，无独立 URL；指向文章列表页
      mainEntityOfPage: { '@type': 'WebPage', '@id': `${SITE}/articles.html` },
    },
  }));

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${BRAND} 文章知识库`,
    inLanguage: ['km', 'zh'],
    itemListElement: items,
  };
}

// ---------- 产品 schema ----------
function productDescription(p) {
  // products.json 无独立 description 字段，由 label + usage + features 组装
  const parts = [p.label, p.usage, p.features].filter(Boolean);
  return parts.join('；');
}

function buildProductsSchema(products) {
  const items = products.map((p, i) => ({
    '@type': 'ListItem',
    position: i + 1,
    item: {
      '@type': 'Product',
      name: `${p.name} — ${p.label}`,
      description: productDescription(p),
      category: CATEGORY_LABEL[p.categoryId] || p.categoryId || '',
      brand: { '@type': 'Brand', name: BRAND },
      // 电缆执行标准作为 additionalType 提示；产品以 modal 展示无独立 URL
      additionalType: p.standard || undefined,
      url: `${SITE}/products.html#${p.categoryId || ''}`,
    },
  }));

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: `${BRAND} 电缆产品目录`,
    inLanguage: ['km', 'zh'],
    itemListElement: items,
  };
}

// ---------- 占位注入（幂等）----------
function inject(html, marker, content) {
  const open = `<!--${marker}-->`;
  const close = `<!--/${marker}-->`;
  const pattern = new RegExp(`${escapeRegExp(open)}[\\s\\S]*?${escapeRegExp(close)}`, 'g');
  const block = `${open}\n${content}\n${close}`;
  if (pattern.test(html)) {
    return html.replace(pattern, block);
  }
  // 占位标记位不存在时不强行插入，避免误改文件（应由 HTML 端先加标记位）
  return html;
}

function escapeRegExp(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------- sitemap ----------
function buildSitemap() {
  const urls = [
    { loc: `${SITE}/`, priority: '1.0' },
    { loc: `${SITE}/products.html`, priority: '0.9' },
    { loc: `${SITE}/articles.html`, priority: '0.8' },
  ];
  const body = urls
    .map(
      (u) => `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

// ---------- 主流程 ----------
async function main() {
  const articles = await readJSON(join(ROOT, 'data/articles.json'));
  const products = await readJSON(join(ROOT, 'data/products.json'));

  const articlesSchema = buildArticlesSchema(articles);
  const productsSchema = buildProductsSchema(products);

  const articlesHtmlPath = join(ROOT, 'articles.html');
  const productsHtmlPath = join(ROOT, 'products.html');
  const articlesHtml = await readFile(articlesHtmlPath, 'utf8');
  const productsHtml = await readFile(productsHtmlPath, 'utf8');

  const newArticlesHtml = inject(articlesHtml, 'SEO_SCHEMA_ARTICLES', scriptBlock(articlesSchema));
  const newProductsHtml = inject(productsHtml, 'SEO_SCHEMA_PRODUCTS', scriptBlock(productsSchema));

  let changed = 0;
  if (newArticlesHtml !== articlesHtml) {
    await writeFile(articlesHtmlPath, newArticlesHtml, 'utf8');
    console.log(`✓ articles.html  注入 Article schema（${articles.filter((a) => a.status === 'published').length} 篇）`);
    changed++;
  } else {
    console.log('· articles.html  无变化（已是最新）');
  }
  if (newProductsHtml !== productsHtml) {
    await writeFile(productsHtmlPath, newProductsHtml, 'utf8');
    console.log(`✓ products.html  注入 Product schema（${products.length} 个产品）`);
    changed++;
  } else {
    console.log('· products.html  无变化（已是最新）');
  }

  const sitemapPath = join(ROOT, 'sitemap.xml');
  const oldSitemap = await readFile(sitemapPath, 'utf8');
  const newSitemap = buildSitemap();
  if (newSitemap !== oldSitemap) {
    await writeFile(sitemapPath, newSitemap, 'utf8');
    console.log(`✓ sitemap.xml     重生成（lastmod ${today}）`);
    changed++;
  } else {
    console.log('· sitemap.xml     无变化');
  }

  console.log(changed ? `\n完成，${changed} 个文件更新。` : '\n完成，无文件变更。');
}

main().catch((err) => {
  console.error('✗ SEO 构建失败：', err);
  process.exit(1);
});
