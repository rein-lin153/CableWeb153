import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Per plan: blue -> amber (Emerald stays untouched as its own category color)
const map = [
  ['focus:ring-blue-200', 'focus:ring-amber-200'],
  ['focus:border-blue-500', 'focus:border-amber-500'],
  ['from-blue-500 to-blue-700', 'from-amber-500 to-amber-600'],
  ['from-blue-400 hover:to-blue-600', 'from-amber-400 hover:to-amber-500'],
  ['bg-blue-600 hover:bg-blue-700', 'bg-amber-500 hover:bg-amber-600'],
  ['hover:bg-blue-700', 'hover:bg-amber-600'],
  ['bg-blue-600', 'bg-amber-500'],
  ['border-blue-700', 'border-amber-600'],
  ['border-blue-600', 'border-amber-500'],
  ['border-blue-500/25', 'border-amber-500/25'],
  ['border-blue-500', 'border-amber-400'],
  ['border-blue-300', 'border-amber-300'],
  ['text-blue-600', 'text-amber-600'],
  ['text-blue-800', 'text-amber-800'],
  ['text-blue-400', 'text-amber-400'],
  ['bg-blue-500/10', 'bg-amber-500/10'],
  ['bg-blue-500/15', 'bg-amber-500/15'],
  ['bg-blue-50', 'bg-amber-50'],
  ['hover:from-blue-400', 'hover:from-amber-400'],
  ['hover:to-blue-600', 'hover:to-amber-600'],
];

const recolor = (str) => { for (const [f, t] of map) str = str.split(f).join(t); return str; };

const domPath = join(__dirname, 'calc_dom.txt');
const dom = recolor(readFileSync(domPath, 'utf8'));
writeFileSync(join(__dirname, 'calc_dom_amber.txt'), dom);

const iife = readFileSync(join(__dirname, '..', 'calculator.html'), 'utf8')
  .split('\n').slice(350, 428).join('\n');
const iifeAmber = recolor(iife);
writeFileSync(join(__dirname, 'calc_iife_amber.txt'), iifeAmber);

const cnt = (s) => (s.match(/blue-[0-9]/g) || []).length;
console.log('blue remaining: DOM=', cnt(dom), 'IIFE(after)=', cnt(iifeAmber));
