import type { PdfRect } from "./PdfPageLocation";
import type { PdfTextAnchor } from "./PdfTextSelection";

export type PdfHighlightColor =
  | "yellow"
  | "green"
  | "blue"
  | "pink"
  | "purple"
  | "gray";

export type PdfHighlightRecord = {
  id: string;
  pdfFileId: string;
  projectId: string;
  documentId?: string;
  pageNumber: number;
  selectedText: string;
  normalizedText?: string;
  color: PdfHighlightColor;
  note?: string;
  rects: PdfRect[];
  anchor?: PdfTextAnchor;
  createdAt: string;
  updatedAt: string;
};

