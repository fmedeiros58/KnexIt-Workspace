import type { KnexPdfPageRenderNature } from "../core/engineTypes";

export type PdfPageModel = {
  pageNumber: number;
  widthPt: number;
  heightPt: number;
  renderNature: KnexPdfPageRenderNature;
};

export function createPdfPageModel(input: {
  pageNumber: number;
  widthPt: number;
  heightPt: number;
  renderNature?: KnexPdfPageRenderNature;
}): PdfPageModel {
  return {
    pageNumber: input.pageNumber,
    widthPt: input.widthPt,
    heightPt: input.heightPt,
    renderNature: input.renderNature ?? "unknown",
  };
}
