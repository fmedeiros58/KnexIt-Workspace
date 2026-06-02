export type BlankTranslationPageLayerModel = {
  pageNumber: number;
  width: number;
  height: number;
  status: "blank";
};

export function createBlankTranslationPageLayer(input: {
  pageNumber: number;
  width: number;
  height: number;
}): BlankTranslationPageLayerModel {
  return {
    pageNumber: input.pageNumber,
    width: input.width,
    height: input.height,
    status: "blank",
  };
}
