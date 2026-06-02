import { createBlankTranslationPageLayer } from "./BlankTranslationPageLayer";

export function createTranslationWorkspacePage(input: {
  pageNumber: number;
  sourceWidth: number;
  sourceHeight: number;
}) {
  return {
    pageNumber: input.pageNumber,
    sourceIsPreserved: true,
    translationPage: createBlankTranslationPageLayer({
      pageNumber: input.pageNumber,
      width: input.sourceWidth,
      height: input.sourceHeight,
    }),
  };
}
