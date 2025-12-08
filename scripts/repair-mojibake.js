#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

if (!process.argv[2]) {
  console.error('Usage: node repair-mojibake.js <file-path>');
  process.exit(2);
}
const file = path.resolve(process.argv[2]);
if (!fs.existsSync(file)) {
  console.error('File not found:', file);
  process.exit(2);
}
const bak = file + '.mojibake.bak';
fs.copyFileSync(file, bak);
let txt = fs.readFileSync(file, 'utf8');

// Mapping table: common mojibake sequences -> correct characters (Portuguese-focused)
const map = {
  'Ã¡': 'á', 'Ã©': 'é', 'Ã­': 'í', 'Ã³': 'ó', 'Ãº': 'ú', 'Ã¨': 'è', 'Ãª': 'ê', 'Ã´': 'ô', 'Ãµ': 'õ',
  'Ã£': 'ã', 'Ã§': 'ç', 'Ã€': 'À', 'Ã‰': 'É', 'Ãš': 'Ú', 'Ã‘': 'Ñ',
  'â€“': '–', 'â€”': '—', 'â€˜': '‘', 'â€™': '’', 'â€œ': '“', 'â€�': '”', 'â€¦': '…',
  'Â©': '©', 'Â®': '®', 'Â°': '°', 'Â´': '´', 'Â¹': '¹', 'Â²': '²', 'Â³': '³',
  'Ã‚': 'Â', 'Ãƒ': 'Ã', 'Ã†': 'Æ', 'Ã‡': 'Ç', 'Ã‰': 'É', 'Ã‹': 'Ë'
};

// Additional known sequences from the repo search
const extra = {
  'ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢': "'",
  'ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡': 'º',
  'Ãƒâ€šÃ‚Â ': 'à',
  'Ãƒâ€šÃ‚Â¡': 'á',
  'Ãƒâ€šÃ‚Â©': 'é',
  'Ãƒâ€šÃ‚Âª': 'ê',
  'Ãƒâ€šÃ‚Â§': 'ç',
  'Ãƒâ€šÃ‚Â£': 'ã',
  'Ãƒâ€šÃ‚Âµ': 'µ'
};

// Merge maps
const allMap = Object.assign({}, map, extra);

// Build regex
const keys = Object.keys(allMap).sort((a,b)=>b.length-a.length).map(k=>escapeRegExp(k));
const re = new RegExp(keys.join('|'), 'g');

function escapeRegExp(s){ return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }

let replaced = 0;
const newTxt = txt.replace(re, (m) => { replaced++; return allMap[m] || m; });

fs.writeFileSync(file, newTxt, 'utf8');
console.log('Replacements applied:', replaced);
console.log('Backup at:', bak);
