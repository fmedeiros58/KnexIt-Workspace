import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();

const checks = [
  {
    file: "src/modules/Knexread/native-pdf-reader/components/PdfPageView.tsx",
    patterns: [
      "blueprint-default-002-no-canvas-text",
      "shouldUseBlueprintPagePipeline",
      "KNEX_PDF_DISABLE_BLUEPRINT_MODE",
      "data-knexread-page-render-mode",
      "data-knexread-page-blueprint-pipeline",
      "PdfModularPageStage",
    ],
  },
  {
    file: "src/modules/Knexread/rendering/composition/PdfModularPageStage.tsx",
    patterns: [
      "PdfBlueprintStage",
      "shouldUseBlueprintStage",
      "KNEX_PDF_DISABLE_BLUEPRINT_MODE",
      "KNEX_PDF_FORCE_LEGACY_MODULAR_STAGE",
    ],
  },
  {
    file: "src/modules/Knexread/rendering/composition/PdfBlueprintStage.tsx",
    patterns: [
      "buildKnexPdfPageBlueprintFromSession",
      "PdfPagePresentationSurface",
      "data-knexread-blueprint-stage",
      "data-knexread-blueprint-canvas-text-render",
      "renderText={false}",
    ],
  },
  {
    file: "src/modules/Knexread/rendering/blueprint/PdfPagePresentationSurface.tsx",
    patterns: [
      "data-knexread-presentation-surface=\"blueprint\"",
      "shouldMountHtmlText = hasText",
      "shouldMountHtmlText ? \"html\"",
      "data-knexread-presentation-html-text-surface",
      "PdfHtmlTextRenderer",
      "PdfNonTextElementRenderer",
    ],
  },
  {
    file: "src/modules/Knexread/rendering/blueprint/PdfHtmlTextRenderer.tsx",
    patterns: [
      "data-knexread-blueprint-html-text-renderer",
      "data-knexread-blueprint-html-generic-ui-font-runs",
      "getBlueprintTextElements",
      "KnexPdfBlueprintElementRenderer",
      "logPdfBlueprintTextDiagnostics",
      "userSelect: \"text\"",
    ],
  },
  {
    file: "src/modules/Knexread/rendering/text/PdfTextFontResolver.ts",
    patterns: [
      "resolvePdfFontFamily",
      "isUiFontFamily",
      "\"Times New Roman\", Times, serif",
      "Arial, Helvetica, sans-serif",
    ],
  },
  {
    file: "src/modules/Knexread/rendering/text/PdfTextStyleNormalizer.ts",
    patterns: [
      "normalizePdfTextRunMetrics",
      "missingFontFamily",
      "usedUiFontFamily",
      "styleSource",
    ],
  },
  {
    file: "src/modules/Knexread/rendering/text/PdfTextLayerDiagnostics.ts",
    patterns: [
      "KNEX_PDF_DEBUG_BLUEPRINT_TEXT",
      "[KnexPDF Blueprint Text]",
      "genericUiFontRuns",
    ],
  },
  {
    file: "src/modules/Knexread/extraction/blueprint/KnexPdfBlueprintBuilder.ts",
    patterns: [
      "extractPdfNativeText",
      "runPdfOcrPipeline",
      "detectPdfOcrNeed",
      "buildPdfVisualTextModel",
      "extractImages: false",
      "extractShapes: false",
    ],
  },
  {
    file: "src/modules/Knexread/rendering/canvas/PdfCanvasLayer.tsx",
    patterns: [
      "renderPdfiumPageToCanvas",
      "renderText",
      "data-knex-pdf-render-source",
      "knexPdfTextSuppressionStatus",
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
  console.error("[KnexPDF blueprint render pipeline guard] Regression detected:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("[KnexPDF blueprint render pipeline guard] OK");
