export type PdfCoordinateSystem = "pdf-page-normalized" | "viewport";

export type PdfRect = {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  coordinateSystem: PdfCoordinateSystem;
};

export type PdfPageLocation = {
  pageNumber: number;
  pageLabel?: string;
  rects: PdfRect[];
};

