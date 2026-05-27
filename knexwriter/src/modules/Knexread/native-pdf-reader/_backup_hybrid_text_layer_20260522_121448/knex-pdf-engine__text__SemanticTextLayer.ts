import type { KnexPdfSemanticTextBlock } from "../core/engineTypes";

export type SemanticTextLayerModel = {
  pageNumber: number;
  blocks: KnexPdfSemanticTextBlock[];
  visible: false;
};

export function createSemanticTextLayerModel(input: {
  pageNumber: number;
  blocks: KnexPdfSemanticTextBlock[];
}): SemanticTextLayerModel {
  return {
    pageNumber: input.pageNumber,
    blocks: input.blocks,
    visible: false,
  };
}
