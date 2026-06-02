export interface PdfTextCssRect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface PdfTextPdfRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfTextSelectionSnapshot {
  documentId: string;
  pageIndex: number;
  text: string;
  cssRects: PdfTextCssRect[];
  pdfRects: PdfTextPdfRect[];
  selectedAt: number;
}

export interface PdfTextSelectionMapper {
  cssRectToPdfRect(rect: PdfTextCssRect): PdfTextPdfRect;
}

export function mapPdfTextSelectionToPdfRects(
  cssRects: PdfTextCssRect[],
  mapper: PdfTextSelectionMapper,
): PdfTextPdfRect[] {
  return cssRects.map((rect) => mapper.cssRectToPdfRect(rect));
}
