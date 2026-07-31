import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const root = dirname(fileURLToPath(import.meta.url));
const rootUp = join(root, '..');

const domInner = readFileSync(join(root, 'calc_dom_amber.txt'), 'utf8')
  // strip the outer <section>..wrapper indentation lines: it currently starts with a bare <section class="max-w-7xl..."> and ends </section>. We want to keep the inner <div class="bg-white ..."> but give the section a new id & hero.
  .replace(/^\s*<section class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8">\n/, '')
  .replace(/\n\s*<\/section>\s*$/, '');

const iifeScript = readFileSync(join(root, 'calc_iife_amber.txt'), 'utf8');

const section = `
    <!-- ==================== CALCULATORS (内嵌工程计算器, 琥珀色) ==================== -->
    <section id="calculators" class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-12 scroll-mt-24">
        <div class="flex items-center gap-3 mb-6">
            <div class="p-2 bg-amber-500/10 rounded-lg"><i class="fa-solid fa-toolbox text-amber-600 text-lg"></i></div>
            <div>
                <h2 class="text-xl sm:text-2xl font-black text-slate-900">គណនាករ 13 合 1 · 工程计算器</h2>
                <span class="text-xs text-slate-500">电力 · 土木 · 装饰 · 价格范围 — 免费在线工具</span>
            </div>
        </div>
` + domInner + `
    </section>

    <!-- Calculator sub-pill switching logic -->
` + iifeScript + `

    <!-- Calculator computation logic (结果区 DOM id 不变) -->
    <script src="/js/calculators.js"></script>
`;

const idxPath = join(rootUp, 'index.html');
let idx = readFileSync(idxPath, 'utf8');

// Insert after the products section closer and before the CONTACT comment.
// Anchor: the CONTACT comment block. We splice exactly before it.
const contactMarker = '    <!-- ==================== CONTACT ==================== -->';
if (!idx.includes(contactMarker)) throw new Error('CONTACT marker not found');

if (idx.includes('id="calculators"')) {
  console.error('calc section already present — aborting to avoid dup');
  process.exit(1);
}
if (idx.includes('calculators.js')) {
  console.error('calculators.js script already present — aborting');
  process.exit(1);
}

idx = idx.replace(contactMarker, section.trimStart() + '\n\n' + contactMarker);
writeFileSync(idxPath, idx);
console.log('Inserted #calculators section + IIFE script + calculators.js into index.html');
console.log('blue-600 count now:', (idx.match(/blue-600/g)||[]).length, 'blue-700:', (idx.match(/blue-700/g)||[]).length);
console.log('id="calculators" present:', idx.includes('id="calculators"'));
console.log('calculators.js src present:', idx.includes('calculators.js'));
