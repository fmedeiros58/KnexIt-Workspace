const fs = require('fs');

const input = 'supadrive/web/page.bkp.tsx'; // backup file with mojibake
const output = 'supadrive/web/page.tsx';    // target file to overwrite

const s = fs.readFileSync(input, 'utf8');
const fixed = Buffer.from(s, 'latin1').toString('utf8');

fs.writeFileSync(output, fixed, 'utf8');
console.log('Attempted mojibake fix at', output);
