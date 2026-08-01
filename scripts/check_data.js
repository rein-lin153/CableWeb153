const fs = require('fs');
const products = JSON.parse(fs.readFileSync('data/products.json','utf8'));
const cats = JSON.parse(fs.readFileSync('data/categories.json','utf8'));
const catMap = {};
cats.forEach(c => catMap[c.id] = c);
products.forEach(p => {
  const c = catMap[p.categoryId] || {};
  console.log(p.id, '|', p.name, '|', p.categoryId, '|', c.label || 'NO CAT');
});
console.log('---ARTICLES---');
const articles = JSON.parse(fs.readFileSync('data/articles.json','utf8'));
articles.forEach(a => console.log(a.id, '|', a.title, '|', a.category));
