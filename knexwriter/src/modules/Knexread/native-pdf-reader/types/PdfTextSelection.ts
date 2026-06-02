import type { PdfRect } from "./PdfPageLocation";

export type PdfTextAnchor = {
  pageNumber: number;
  textBefore?: string;
  exactText: string;
  textAfter?: string;
  startOffset?: number;
  endOffset?: number;
  confidence?: "high" | "medium" | "low";
};

export type PdfTextSelection = {
  pageNumber: number;
  selectedText: string;
  rects: PdfRect[];
  anchor: PdfTextAnchor;
};

