import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const checks = [
  {
    file: "src/modules/Knexread/native-pdf-reader/components/PdfReaderShell.tsx",
    patterns: [
      "markViewportInteracting",
      "finalRenderVersion",
      "interactive-preview",
      "warmup-preview",
      "settled-final",
      "createPdfRenderWindow",
    ],
  },
  {
    file: "src/modules/Knexread/native-pdf-reader/components/PdfPageView.tsx",
    patterns: [
      "renderPhase",
      "data-knexread-page-render-phase",
      "finalRenderVersion",
      "isWarmupPage",
      "renderPriority",
      "rootMargin: nearViewportRootMargin",
      "\"800px 0px 800px 0px\"",
    ],
  },
  {
    file: "src/modules/Knexread/native-pdf-reader/components/PdfPageCanvas.tsx",
    patterns: [
      "shouldDeferNonPdfJsRender",
      "runKnexPdfRenderTask",
      "data-knex-pdf-render-phase",
      "knexPdfRenderQuality",
      "canReplaceCurrentRender",
      "createRenderIdentityKey",
      "knexPdfRenderIdentity",
      "knexPdfRenderAppliedAt",
      "knexPdfiumRenderProfile",
      "knexPdfiumColorConversion",
    ],
  },
  {
    file: "src/modules/Knexread/native-pdf-reader/knex-pdf-engine/rendering/RenderScheduler.ts",
    patterns: [
      "PDFIUM_MAX_CONCURRENT_RENDERS = 1",
      "requestIdleCallback",
      "runKnexPdfRenderTask",
    ],
  },
  {
    file: "src/modules/Knexread/native-pdf-reader/knex-pdf-engine/rendering/RenderQualityController.ts",
    patterns: [
      "KnexPdfRenderPhase",
      "resolveRenderQualityForPhase",
      "PDFIUM_INTERACTIVE_RENDER_BUDGET_MS",
      "PDFIUM_INTERACTIVE_MAX_OUTPUT_SCALE",
      "PDFIUM_FINAL_MAX_OUTPUT_SCALE",
      "\"warmup-preview\"",
    ],
  },
  {
    file: "src/modules/Knexread/native-pdf-reader/knex-pdf-engine/backends/future-pdfium/PdfiumEmbedPdfRuntime.ts",
    patterns: [
      "PdfiumRenderProfile",
      "resolvePdfiumRenderProfile",
      "resolvePdfiumRenderFlags",
      "PdfiumColorConversionMode",
      "resolvePdfiumColorConversionMode",
      "KNEX_PDFIUM_MAX_OUTPUT_SCALE",
      "knexPdfiumRenderProfile",
      "knexPdfiumColorConversion",
    ],
  },
];

const failures = [];

for (const check of checks) {
  const absolutePath = path.join(repoRoot, check.file);
  const source = fs.existsSync(absolutePath)
    ? fs.readFileSync(absolutePath, "utf8")
    : "";

  if (!source) {
    failures.push(`${check.file}: file is missing or empty`);
    continue;
  }

  for (const pattern of check.patterns) {
    if (!source.includes(pattern)) {
      failures.push(`${check.file}: missing "${pattern}"`);
    }
  }
}

if (failures.length > 0) {
  console.error("[KnexPDF render pipeline guard] Regression detected:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("[KnexPDF render pipeline guard] OK");
