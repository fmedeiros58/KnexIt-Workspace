import type { PdfVisualTextRun } from "./PdfVisualTextModelBuilder";
import { isUiFontFamily } from "./PdfTextFontResolver";

function getGlobalBoolean(key: string): boolean {
  if (typeof globalThis === "undefined") return false;

  const value = (globalThis as unknown as Record<string, unknown>)[key];
  return value === true || value === "true" || value === "1";
}

export function isPdfBlueprintTextDiagnosticsEnabled(): boolean {
  return getGlobalBoolean("KNEX_PDF_DEBUG_BLUEPRINT_TEXT");
}

export function createPdfBlueprintTextDiagnostics(input: {
  pageNumber: number;
  renderMode: "blueprint" | "legacy-canvas" | "fallback-raster";
  runs: PdfVisualTextRun[];
}) {
  const fontFamilies = Array.from(
    new Set(input.runs.map((run) => run.fontFamily).filter(Boolean)),
  );
  const missingFontFamilyRuns = input.runs.filter(
    (run) => run.missingFontFamily,
  ).length;
  const genericUiFontRuns = input.runs.filter((run) =>
    isUiFontFamily(run.fontFamily),
  ).length;
  const averageFontSize =
    input.runs.length > 0
      ? input.runs.reduce((sum, run) => sum + run.fontSize, 0) /
        input.runs.length
      : 0;

  return {
    pageNumber: input.pageNumber,
    renderMode: input.renderMode,
    textRuns: input.runs.length,
    visibleHtmlRuns: input.runs.length,
    nativeRuns: input.runs.filter((run) => run.textSource === "native").length,
    ocrRuns: input.runs.filter((run) => run.textSource === "ocr").length,
    fusedRuns: input.runs.filter((run) => run.textSource === "hybrid").length,
    fontFamilies,
    missingFontFamilyRuns,
    genericUiFontRuns,
    averageFontSize,
  };
}

export function logPdfBlueprintTextDiagnostics(input: {
  pageNumber: number;
  runs: PdfVisualTextRun[];
}) {
  if (!isPdfBlueprintTextDiagnosticsEnabled()) return;

  const diagnostics = createPdfBlueprintTextDiagnostics({
    pageNumber: input.pageNumber,
    renderMode: "blueprint",
    runs: input.runs,
  });

  console.debug("[KnexPDF Blueprint Text]", diagnostics);

  for (const run of input.runs) {
    if (isUiFontFamily(run.fontFamily)) {
      console.warn(
        "[KnexPDF Blueprint Text] textRun is using UI font instead of PDF font",
        run,
      );
    }
  }
}
