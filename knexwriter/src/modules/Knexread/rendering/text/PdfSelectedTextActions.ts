import type { KnexPdfAnnotationDraft } from "../../annotations/domain";
import type { PdfTextSelectionSnapshot } from "./PdfTextSelectionGeometry";

export function createHighlightDraftFromSelection(
  selection: PdfTextSelectionSnapshot,
  input: { color?: string; authorId?: string } = {},
): KnexPdfAnnotationDraft {
  return {
    documentId: selection.documentId,
    pageIndex: selection.pageIndex,
    type: "highlight",
    pdfRects: selection.pdfRects,
    authorId: input.authorId,
    style: {
      color: input.color ?? "#f8d94a",
      opacity: 0.35,
    },
    metadata: {
      source: "selection",
      textQuote: selection.text,
    },
  };
}
