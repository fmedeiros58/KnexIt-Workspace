#!/usr/bin/env node
// Normalize mojibake (Windows-1252/Latin1 mis-decoded as UTF-8) across repo
// Usage: node scripts/normalize-encoding.mjs

import fs from 'fs';
import path from 'path';

const exts = new Set(['.ts', '.tsx', '.js', '.jsx', '.json', '.md', '.css', '.scss', '.html', '.txt']);
const ignoreDirs = new Set(['node_modules', '.git', '.next', 'dist', 'build', 'out']);

const root = process.cwd();
let changed = 0;

function hasMojibake(s) {
  return /[ÃÂ�ǟ]/.test(s);
}

function normalizeEol(s) {
  return s.replace(/\r\n/g, '\n');
}

function stripBom(s) {
  return s.charCodeAt(0) === 0xFEFF ? s.slice(1) : s;
}

function fixMojibake(s) {
  // Convert the current (mojibake) string as if it were CP1252/latin1 bytes into proper UTF-8
  const bytes = Buffer.from(s, 'latin1');
  return bytes.toString('utf8');
}

function processFile(fp) {
  let content = fs.readFileSync(fp, 'utf8');
  const original = content;
  content = stripBom(normalizeEol(content));
  if (hasMojibake(content)) {
    const fixed = fixMojibake(content);
    // Only accept if it meaningfully improved (reduced mojibake markers)
    if ((content.match(/[ÃÂ�ǟ]/g)?.length || 0) > (fixed.match(/[ÃÂ�ǟ]/g)?.length || 0)) {
      content = fixed;
    }
  }
  if (content !== original) {
    fs.writeFileSync(fp, content, { encoding: 'utf8' });
    changed++;
    console.log('fixed:', path.relative(root, fp));
  }
}

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.')) {
      if (ignoreDirs.has(entry.name)) continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (ignoreDirs.has(entry.name)) continue;
      walk(full);
    } else {
      const ext = path.extname(entry.name).toLowerCase();
      if (exts.has(ext)) processFile(full);
    }
  }
}

walk(root);
console.log(`Done. Files changed: ${changed}`);

