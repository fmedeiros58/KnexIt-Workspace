import type { KnexPdfSemanticTextBlock } from "../core/engineTypes";

export function extractSelectedText(blocks: KnexPdfSemanticTextBlock[]) {
  return [...blocks]
    .sort((a, b) => a.readingOrder - b.readingOrder)
    .map((block) => block.text)
    .join("\n");
}
