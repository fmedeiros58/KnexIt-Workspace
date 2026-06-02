import { KNEX_PDF_DEFAULT_PAGE_GAP } from "../core/engineConfig";
import type { PagePairFrameModel } from "./PageFrameModel";

export function createPagePairFrame(input: {
  pageNumber: number;
  left: number;
  top: number;
  sourceWidth: number;
  sourceHeight: number;
  translationWidth?: number;
  translationHeight?: number;
  gap?: number;
}): PagePairFrameModel {
  const gap = input.gap ?? KNEX_PDF_DEFAULT_PAGE_GAP;
  const translationWidth = input.translationWidth ?? input.sourceWidth;
  const translationHeight = input.translationHeight ?? input.sourceHeight;
  const height = Math.max(input.sourceHeight, translationHeight);

  return {
    pageNumber: input.pageNumber,
    left: input.left,
    top: input.top,
    width: input.sourceWidth + gap + translationWidth,
    height,
    source: {
      pageNumber: input.pageNumber,
      left: input.left,
      top: input.top,
      width: input.sourceWidth,
      height: input.sourceHeight,
    },
    translation: {
      pageNumber: input.pageNumber,
      left: input.left + input.sourceWidth + gap,
      top: input.top,
      width: translationWidth,
      height: translationHeight,
    },
  };
}
