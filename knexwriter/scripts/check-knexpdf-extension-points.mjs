import { existsSync } from "node:fs";
import { join } from "node:path";

const protectedFiles = [
  "src/modules/Knexread/native-pdf-reader/knex-pdf-engine/backends/future-mupdf/MuPdfBackend.placeholder.ts",
  "src/modules/Knexread/native-pdf-reader/knex-pdf-engine/backends/future-mupdf/README.md",
  "src/modules/Knexread/native-pdf-reader/knex-pdf-engine/backends/future-pdfium/PdfiumBackend.placeholder.ts",
  "src/modules/Knexread/native-pdf-reader/knex-pdf-engine/backends/future-pdfium/README.md",
  "src/modules/Knexread/native-pdf-reader/knex-pdf-engine/translation/TranslationReconstructionEngine.placeholder.ts",
  "src/modules/Knexread/native-pdf-reader/knex-pdf-engine/core/ProtectedExtensionPointWatchdog.ts",
];

const bannedFiles = [
  "src/modules/Knexread/native-pdf-reader/knex-pdf-engine/integration/LegacyCanvasRenderAdapter.ts",
];

const missing = protectedFiles.filter((file) => !existsSync(join(process.cwd(), file)));
const banned = bannedFiles.filter((file) => existsSync(join(process.cwd(), file)));

if (missing.length || banned.length) {
  if (missing.length) {
    console.error("KnexPDF protected extension points are missing:");
    missing.forEach((file) => console.error(`- ${file}`));
  }
  if (banned.length) {
    console.error("KnexPDF banned legacy files are still present:");
    banned.forEach((file) => console.error(`- ${file}`));
  }
  process.exit(1);
}
