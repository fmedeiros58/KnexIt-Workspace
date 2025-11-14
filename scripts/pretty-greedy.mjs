#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const file = process.argv[2];
if (!file) {
  console.error('Usage: node scripts/pretty-greedy.mjs <file>');
  process.exit(1);
}
const fp = path.resolve(process.cwd(), file);
let s = fs.readFileSync(fp, 'utf8');

// Normalize EOL
s = s.replace(/\r\n/g, '\n');

// Heuristic line breaks to expand single-line TSX into readable form
const rules = [
  [/></g, '>\n<'],
  [/}>/g, '}\n<'],
  [/>\s*\{/g, '>\n{'],
  [/\}\s*</g, '}\n<'],
  [/;\s*</g, ';\n<'],
  [/;\s*\}/g, ';\n}'],
  [/\)\s*</g, ')\n<'],
  [/\)\s*\{/g, ')\n{'],
  [/\}\s*\)/g, '}\n)'],
  [/,(?=\s*<)/g, ',\n'],
  [/\n{2,}/g, '\n'],
];
for (const [re, rep] of rules) s = s.replace(re, rep);

// Insert newlines after some keywords
s = s.replace(/\b(return|export default function|function|const|let|type|interface)\b/g, '\n$1');

fs.writeFileSync(fp, s, { encoding: 'utf8' });
console.log('Formatted:', file);