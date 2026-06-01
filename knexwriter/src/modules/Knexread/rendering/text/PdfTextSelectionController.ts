import type {
  PdfTextCssRect,
  PdfTextSelectionMapper,
  PdfTextSelectionSnapshot,
} from "./PdfTextSelectionGeometry";
import { mapPdfTextSelectionToPdfRects } from "./PdfTextSelectionGeometry";

export interface PdfTextSelectionControllerInput {
  documentId: string;
  pageIndex: number;
  mapper: PdfTextSelectionMapper;
}

export class PdfTextSelectionController {
  constructor(private readonly input: PdfTextSelectionControllerInput) {}

  createSnapshot(input: {
    text: string;
    cssRects: PdfTextCssRect[];
    selectedAt?: number;
  }): PdfTextSelectionSnapshot {
    return {
      documentId: this.input.documentId,
      pageIndex: this.input.pageIndex,
      text: input.text,
      cssRects: input.cssRects,
      pdfRects: mapPdfTextSelectionToPdfRects(
        input.cssRects,
        this.input.mapper,
      ),
      selectedAt: input.selectedAt ?? Date.now(),
    };
  }
}
