const fs = require('fs');

const input = 'app/(no-nav)/upconect/drive/page.bkp.tsx'; // arquivo zoado (backup)
const output = 'app/(no-nav)/upconect/drive/page.tsx';    // arquivo que vamos sobrescrever

const s = fs.readFileSync(input, 'utf8');                 // lê o texto mojibake
const fixed = Buffer.from(s, 'latin1').toString('utf8');  // tentativa de "desmojibake"

fs.writeFileSync(output, fixed, 'utf8');                  // grava corrigido em UTF-8
console.log('Tentativa de correção concluída em', output);
