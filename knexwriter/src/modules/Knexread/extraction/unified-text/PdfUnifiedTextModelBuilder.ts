import type { KnexPdfTextBlock } from "../../core/KnexPdfTypes";

export type PdfUnifiedTextSource = "native" | "ocr" | "hybrid";

export interface PdfUnifiedTextBlock extends KnexPdfTextBlock {
  source: PdfUnifiedTextSource;
}

export interface PdfUnifiedTextModel {
  documentId: string;
  pageIndex: number;
  blocks: PdfUnifiedTextBlock[];
  sources: PdfUnifiedTextSource[];
}

function confidence(block: KnexPdfTextBlock): number {
  return typeof block.confidence === "number" ? block.confidence : 1;
}

export function buildPdfUnifiedTextModel(input: {
  documentId: string;
  pageIndex: number;
  nativeBlocks?: KnexPdfTextBlock[];
  ocrBlocks?: KnexPdfTextBlock[];
}): PdfUnifiedTextModel {
  const nativeBlocks = input.nativeBlocks ?? [];
  const ocrBlocks = input.ocrBlocks ?? [];
  const useNative = nativeBlocks.length > 0;
  const sourceBlocks = useNative ? nativeBlocks : ocrBlocks;
  const sources: PdfUnifiedTextSource[] = [];

  if (nativeBlocks.length > 0) sources.push("native");
  if (ocrBlocks.length > 0) sources.push("ocr");

  return {
    documentId: input.documentId,
    pageIndex: input.pageIndex,
    blocks: sourceBlocks
      .slice()
      .sort((left, right) => right.y - left.y || left.x - right.x)
      .map((block) => ({
        ...block,
        confidence: confidence(block),
        source: useNative ? "native" : "ocr",
      })),
    sources,
  };
}
