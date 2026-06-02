import { readdir, readFile } from "node:fs/promises";
import { join, relative } from "node:path";

const roots = [
  "knexwriter/src/modules/Knexread/native-pdf-reader",
  "app/api/knexread/render",
];

const forbidden = [
  "page-canvas",
  "PdfPageCanvas",
  "PdfRasterLayer",
  "PdfExperimentalVisualTextLayer",
  "PdfVisualTextLayer",
  "hybrid-visual",
  "SemanticTextLayer",
  "renderPolicy",
];

const allowedFiles = new Set([
  "knexwriter/src/modules/Knexread/native-pdf-reader/TILE_RENDERER_STATUS.md",
]);

const scannedExtensions = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".md",
]);

function hasScannedExtension(path) {
  return [...scannedExtensions].some((extension) => path.endsWith(extension));
}

async function collectFiles(root) {
  const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
  const files = [];

  for (const entry of entries) {
    const path = join(root, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(path)));
      continue;
    }

    if (entry.isFile() && hasScannedExtension(path)) {
      files.push(path);
    }
  }

  return files;
}

const violations = [];

for (const root of roots) {
  for (const file of await collectFiles(root)) {
    const normalized = relative(process.cwd(), file).replaceAll("\\", "/");
    if (allowedFiles.has(normalized)) continue;

    const text = await readFile(file, "utf8");
    for (const token of forbidden) {
      if (text.includes(token)) {
        violations.push(`${normalized}: forbidden token "${token}"`);
      }
    }
  }
}

if (violations.length > 0) {
  console.error("KnexRead tile renderer guard failed:");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("KnexRead tile renderer guard passed.");
