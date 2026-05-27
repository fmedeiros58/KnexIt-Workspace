import type { KnexPdfSelectionRectangle, KnexPdfSemanticTextBlock } from "../core/engineTypes";

export function calculateSelectionRectangles(input: {
  selectedBlocks: KnexPdfSemanticTextBlock[];
}): KnexPdfSelectionRectangle[] {
  return input.selectedBlocks.map((block) => ({
    pageNumber: block.pageNumber,
    x: block.x,
    y: block.y,
    width: block.width,
    height: block.height,
  }));
}
