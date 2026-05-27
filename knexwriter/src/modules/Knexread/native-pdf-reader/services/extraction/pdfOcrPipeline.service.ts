import { toNormalizedPageRect, type PdfNormalizedRect } from "../rendering/pdfCoordinateSystem.service";

export type PdfOcrWord = {
  text: string;
  confidence: number;
  rect: PdfNormalizedRect;
};

export type PdfOcrPageResult = {
  pageNumber: number;
  words: PdfOcrWord[];
  language?: string;
  source: "mock";
};

export async function runOcrOnPageImage(input: {
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  languageHint?: string;
}) {
  // Placeholder pipeline: keeps OCR layer isolated and non-visual by default.
  const mockWord = {
    text: "",
    confidence: 0,
    rect: toNormalizedPageRect({
      x: 0,
      y: 0,
      width: 1,
      height: 1,
      pageWidth: input.pageWidth,
      pageHeight: input.pageHeight,
    }),
  };

  return {
    pageNumber: input.pageNumber,
    words: [mockWord],
    language: input.languageHint,
    source: "mock",
  } satisfies PdfOcrPageResult;
}
