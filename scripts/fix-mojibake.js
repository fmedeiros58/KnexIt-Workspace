#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

if (!process.argv[2]) {
  console.error('Usage: node fix-mojibake.js <file-path>');
  process.exit(2);
}

const file = process.argv[2];
if (!fs.existsSync(file)) {
  console.error('File not found:', file);
  process.exit(2);
}

try {
  const abs = path.resolve(file);
  const bak = abs + '.bak';
  // copy raw bytes for backup
  fs.copyFileSync(abs, bak);
  const raw = fs.readFileSync(abs);
  // Interpret the raw bytes as latin1, then convert to utf8
  const latin1 = raw.toString('latin1');
  const fixed = Buffer.from(latin1, 'latin1').toString('utf8');
  fs.writeFileSync(abs, fixed, 'utf8');
  console.log('Fixed file:', abs);
  console.log('Backup created at:', bak);
} catch (e) {
  console.error('Erro ao processar arquivo:', e);
  process.exit(1);
}
