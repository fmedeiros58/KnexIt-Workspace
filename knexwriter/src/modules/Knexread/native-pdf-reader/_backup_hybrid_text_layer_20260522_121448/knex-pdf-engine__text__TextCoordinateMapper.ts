import type { KnexPdfSemanticTextBlock } from "../core/engineTypes";

export function findTextBlocksAtPoint(input: {
  blocks: KnexPdfSemanticTextBlock[];
  x: number;
  y: number;
}) {
  return input.blocks.filter(
    (block) =>
      input.x >= block.x &&
      input.x <= block.x + block.width &&
      input.y >= block.y &&
      input.y <= block.y + block.height,
  );
}
