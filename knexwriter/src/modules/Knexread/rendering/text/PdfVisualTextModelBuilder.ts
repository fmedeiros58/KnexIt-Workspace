import type { KnexPdfTextBlock } from "../../native-pdf-reader/knex-pdf-engine";

export type PdfVisualTextRun = {
  id: string;
  text: string;
  pageNumber: number;
  left: number;
  top: number;
  width: number;
  height: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: "normal" | "italic";
  color: string;
  lineHeight: number;
  letterSpacing: number;
  opacity: number;
  sourceBackend: string;
  confidence: number;
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
    runs: input.blocks.map((block) => ({
      id: block.id,
      text: block.text,
      pageNumber: block.pageNumber,
      left: block.x,
      top: block.y,
      width: block.width,
      height: block.height,
      fontFamily: block.fontFamily,
      fontSize: block.fontSize,
      fontWeight: block.fontWeight,
      fontStyle: block.fontStyle,
      color: block.color,
      lineHeight: block.lineHeight,
      letterSpacing: block.letterSpacing,
      opacity: block.opacity ?? 0.96,
      sourceBackend: block.sourceBackend ?? "unknown",
      confidence: block.confidence ?? 0.85,
      transform: block.transform,
    })),
  };
}
