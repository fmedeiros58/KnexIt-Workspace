import type { KnexPdfTextBlock } from "../../native-pdf-reader/knex-pdf-engine";
import { normalizePdfTextRunMetrics } from "./PdfTextStyleNormalizer";

export type PdfVisualTextRun = {
  type: "text";
  id: string;
  text: string;
  pageNumber: number;
  x: number;
  y: number;
  left: number;
  top: number;
  width: number;
  height: number;
  fontFamily: string;
  fontName?: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: "normal" | "italic";
  color: string;
  lineHeight: number;
  letterSpacing: number;
  wordSpacing: number;
  baseline: number;
  opacity: number;
  sourceBackend: string;
  textSource: "native" | "ocr" | "hybrid";
  geometrySource: string;
  styleSource: "pdf" | "pdf-fallback" | "ocr" | "unknown";
  confidence: number;
  missingFontFamily: boolean;
  usedUiFontFamily: boolean;
  transform?: [number, number, number, number, number, number];
};

export type PdfVisualTextModel = {
  pageNumber: number;
  runs: PdfVisualTextRun[];
  source: "native" | "ocr" | "hybrid" | "empty";
};

export function buildPdfVisualTextModel(input: {
  pageNumber: number;
  blocks: KnexPdfTextBlock[];
  source?: "native" | "ocr" | "hybrid" | "empty";
}): PdfVisualTextModel {
  return {
    pageNumber: input.pageNumber,
    source: input.source ?? (input.blocks.length > 0 ? "native" : "empty"),
    runs: input.blocks.map((block) => {
      const normalized = normalizePdfTextRunMetrics(block);
      const textSource =
        block.rasterized || input.source === "ocr"
          ? "ocr"
          : input.source === "hybrid"
            ? "hybrid"
            : "native";

      return {
        type: "text",
        id: block.id,
        text: block.text,
        pageNumber: block.pageNumber,
        x: block.x,
        y: block.y,
        left: block.x,
        top: block.y,
        width: block.width,
        height: block.height,
        fontFamily: normalized.fontFamily,
        fontName: block.fontName,
        fontSize: normalized.fontSize,
        fontWeight: normalized.fontWeight,
        fontStyle: normalized.fontStyle,
        color: block.color || "rgb(0, 0, 0)",
        lineHeight: normalized.lineHeight,
        letterSpacing: normalized.letterSpacing,
        wordSpacing: normalized.wordSpacing,
        baseline: normalized.baseline,
        opacity: block.opacity ?? 1,
        sourceBackend: block.sourceBackend ?? "unknown",
        textSource,
        geometrySource: block.sourceBackend ?? "unknown",
        styleSource: block.rasterized ? "ocr" : normalized.styleSource,
        confidence: block.confidence ?? 0.85,
        missingFontFamily: normalized.missingFontFamily,
        usedUiFontFamily: normalized.usedUiFontFamily,
        transform: block.transform,
      };
    }),
  };
}
