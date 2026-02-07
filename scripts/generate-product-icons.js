const fs = require('fs');
const path = require('path');

const outDir = path.join('public', 'knexit-workspace', 'product-icons');
fs.mkdirSync(outDir, { recursive: true });

const icons = {
  play: {
    color: '#4338ca',
    markup: `
<rect x="2.8" y="2.8" width="18.4" height="18.4" rx="5.2" fill="white" />
<rect x="5.2" y="5.8" width="13.6" height="8.6" rx="1.4" fill="none" stroke="currentColor" stroke-width="1.7" />
<circle cx="12" cy="9.9" r="1.7" fill="currentColor" />
<rect x="10.4" y="11.7" width="3.2" height="2.8" rx="0.8" fill="currentColor" />
<rect x="5.2" y="16.1" width="13.6" height="1.7" rx="0.7" fill="currentColor" />
<rect x="6.1" y="17.9" width="1.6" height="1.3" rx="0.3" fill="currentColor" />
<rect x="9.3" y="17.9" width="1.6" height="1.3" rx="0.3" fill="currentColor" />
<rect x="12.5" y="17.9" width="1.6" height="1.3" rx="0.3" fill="currentColor" />
<rect x="15.7" y="17.9" width="1.6" height="1.3" rx="0.3" fill="currentColor" />
`.trim(),
  },
  analytics: {
    color: '#0e7490',
    markup: `
<path fill="currentColor" d="M6.5 5h11a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 5 17.5v-11A1.5 1.5 0 0 1 6.5 5Z" />
<rect x="7.5" y="12.8" width="1.8" height="4.2" rx="0.6" fill="white" />
<rect x="10.1" y="11.2" width="1.8" height="5.8" rx="0.6" fill="white" fill-opacity="0.85" />
<rect x="12.7" y="9.7" width="1.8" height="7.3" rx="0.6" fill="white" fill-opacity="0.7" />
<rect x="15.3" y="8.5" width="1.8" height="8.5" rx="0.6" fill="white" fill-opacity="0.55" />
`.trim(),
  },
  live: {
    color: '#be123c',
    markup: `
<rect x="2.4" y="2.4" width="19.2" height="19.2" rx="5.6" fill="white" />
<rect x="4.6" y="10.1" width="11.8" height="8.2" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.8" />
<circle cx="7.2" cy="6.1" r="1.9" fill="none" stroke="currentColor" stroke-width="1.8" />
<circle cx="13.1" cy="5.5" r="2.4" fill="none" stroke="currentColor" stroke-width="1.8" />
<path d="M19.8 12.2 16.4 13.0v1.6l3.4 0.8Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
`.trim(),
  },
  record: {
    color: '#b91c1c',
    markup: `
<rect x="5.5" y="5.5" width="13" height="13" rx="3" fill="none" stroke="currentColor" stroke-width="2" />
<circle cx="12" cy="12" r="3.4" fill="currentColor" />
`.trim(),
  },
  edit: {
    color: '#b91c1c',
    markup: `
<g fill="currentColor">
<path d="M5 5h9v2H5v10h10v-5h2v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
<path d="M19.7 5.3 17.2 2.8a1 1 0 0 0-1.4 0L13 5.6V9h3.4l2.9-2.9a1 1 0 0 0 0-1.4Z" />
</g>
`.trim(),
  },
  folder: {
    color: '#b45309',
    markup: `<path fill="currentColor" d="M4 6h5l2 2h9v10H4V6Z" />`,
  },
  supadrive: {
    color: '#1d4ed8',
    markup: `
<path fill="currentColor" d="M4 6h5l2 2h9v10H4V6Z" />
<path d="M8.5 13.5c0-.9.7-1.6 1.6-1.6.6 0 1.1.3 1.8 1l.2.2.2-.2c.7-.7 1.2-1 1.8-1 1 0 1.7.7 1.7 1.6s-.7 1.6-1.7 1.6c-.6 0-1.1-.3-1.8-1l-.2-.2-.2.2c-.7.7-1.2 1-1.8 1-.9 0-1.6-.7-1.6-1.6Z" fill="none" stroke="white" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" />
`.trim(),
  },
  doc: {
    color: '#0369a1',
    markup: `
<path fill="currentColor" d="M6.5 4h7l3.5 3.5V18a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm7 0v3.5H17L13.5 4Z" />
<rect x="8" y="9" width="6.5" height="1.2" rx="0.6" fill="white" fill-opacity="0.85" />
<rect x="8" y="11" width="5.2" height="1.2" rx="0.6" fill="white" fill-opacity="0.75" />
<rect x="8" y="13" width="4.2" height="1.2" rx="0.6" fill="white" fill-opacity="0.65" />
<circle cx="15.5" cy="15.5" r="1.4" fill="white" fill-opacity="0.9" />
<circle cx="17.6" cy="14.9" r="1.4" fill="white" fill-opacity="0.75" />
`.trim(),
  },
  kanban: {
    color: '#047857',
    markup: `<path fill="currentColor" d="M5 5h14v14H5V5Zm2 2.5v9h2v-9H7Zm4 0v4h2v-4h-2Zm4 0v6.5h2v-6.5h-2Z" />`,
  },
  chat: {
    color: '#0f766e',
    markup: `<path fill="currentColor" d="M5 5h14v9H9l-4 4V5Zm2.5 3.5v1.5h9V8.5h-9Zm0 3v1.5h6V11.5h-6Z" />`,
  },
  search: {
    color: '#7e22ce',
    markup: `<path fill="currentColor" d="M11 4a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm0 2a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm5.5 11.1 3.4 3.4-1.4 1.4-3.4-3.4 1.4-1.4Z" />`,
  },
  review: {
    color: '#047857',
    markup: `
<path fill="currentColor" d="M7 4h7l4 4v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm7 0v4h4l-4-4Z" />
<rect x="8.2" y="10" width="6" height="1.1" rx="0.55" fill="white" fill-opacity="0.85" />
<rect x="8.2" y="12" width="4.5" height="1.1" rx="0.55" fill="white" fill-opacity="0.7" />
<circle cx="16.8" cy="16.2" r="1.8" fill="white" fill-opacity="0.95" />
<path d="m16.1 16.2 0.8 0.8 1.6-1.6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" />
`.trim(),
  },
  read: {
    color: '#4338ca',
    markup: `
<path fill="currentColor" d="M7 4h7l4 4v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm7 0v4h4l-4-4Z" />
<rect x="7.2" y="9.3" width="6.3" height="1.1" rx="0.55" fill="white" fill-opacity="0.85" />
<rect x="7.2" y="11.3" width="4.9" height="1.1" rx="0.55" fill="white" fill-opacity="0.7" />
<path fill="white" fill-opacity="0.9" d="M7.2 14.3h3.3c.3 0 .58.26.58.58v2.5c0 .32-.28.58-.58.58H7.2c-.32 0-.58-.26-.58-.58v-2.5c0-.32.26-.58.58-.58Z" />
<path fill="white" d="M11.4 15.1 13.3 16.1 11.4 17.2Z" />
<path d="M13.6 14.8c.55.28.85.74.85 1.35s-.3 1.07-.85 1.35" stroke="white" stroke-width="1" stroke-linecap="round" />
<path d="M15.0 14.4c.75.36 1.1.93 1.1 1.77 0 .84-.35 1.41-1.1 1.77" stroke="white" stroke-width="1" stroke-linecap="round" />
`.trim(),
  },
  owl: {
    color: '#a21caf',
    markup: `
<rect x="3" y="3" width="18" height="18" rx="5" fill="white" />
<g fill="currentColor">
<path d="M7.5 9.5c0-1.7 1.4-3 3-3s3 1.3 3 3c0 .6-.2 1.1-.5 1.5-.3.4-.8.7-1.3.7s-1-.3-1.3-.7c-.3-.4-.5-.9-.5-1.5z" />
<path d="M6 13c0-1.9 3-2.8 6-2.8s6 .9 6 2.8c0 .9-1 2-3 2s-3-1-3-1-1.3 1-3 1-3-1.1-3-2z" />
<circle cx="9.5" cy="9.3" r="1" fill="currentColor" />
<circle cx="14.5" cy="9.3" r="1" fill="currentColor" />
<path d="M12 11.2c.4.5.6 1 0 1.6-.6.6-1.4.6-2 0-.6-.6-.4-1.1 0-1.6.4-.5 1.2-.5 2 0z" fill="currentColor" />
</g>
`.trim(),
  },
  mail: {
    color: '#1d4ed8',
    markup: `<path fill="currentColor" d="M5 6h14a1 1 0 0 1 1 1v10H4V7a1 1 0 0 1 1-1Zm13 2.24-6 3.51-6-3.5V8l6 3.5 6-3.5v.24Z" />`,
  },
  credit: {
    color: '#334155',
    markup: `<path fill="currentColor" d="M4 6h16a1 1 0 0 1 1 1v10H3V7a1 1 0 0 1 1-1Zm1.5 4.5v1.5h5v-1.5h-5Zm0 3v1.5h3v-1.5h-3Z" />`,
  },
  hub: {
    color: '#c2410c',
    markup: `
<circle cx="12" cy="6.2" r="2.1" fill="currentColor" />
<circle cx="6.2" cy="13.8" r="1.9" fill="currentColor" />
<circle cx="17.8" cy="13.8" r="1.9" fill="currentColor" />
<circle cx="12" cy="18.2" r="1.4" fill="currentColor" />
<path d="M7.8 12.6 10.6 9M16.2 12.6 13.4 9M10.2 13.7l3.7.2M8 14.6l2.7 1.6m5.3-1.6-2.7 1.6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" />
`.trim(),
  },
};

for (const [name, cfg] of Object.entries(icons)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" color="${cfg.color}">\n${cfg.markup}\n</svg>\n`;
  fs.writeFileSync(path.join(outDir, `${name}.svg`), svg, 'utf8');
}

console.log(`Wrote ${Object.keys(icons).length} svg files to ${outDir}`);
