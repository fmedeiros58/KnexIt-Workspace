import type { PdfTranslationBlockRecord } from "../../types";

export type ReconstructedTranslationBlock = {
  blockId: string;
  translationBlockId: string;
  pageNumber: number;
  text: string;
  mask: {
    x: number;
    y: number;
    width: number;
    height: number;
    opacity: number;
  };
  fit: {
    fontSize: number;
    lineHeight: number;
    lines: string[];
    overflow: boolean;
  };
};

export type ReconstructionResult = {
  blocks: ReconstructedTranslationBlock[];
  overflowCount: number;
};

function estimateTextWidth(text: string, fontSize: number) {
  return Math.max(0, text.length * fontSize * 0.56);
}

function wrapText(text: string, width: number, fontSize: number) {
  if (!text.trim()) return [""];
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (estimateTextWidth(candidate, fontSize) <= width || !current) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function fitBlock(input: { text: string; width: number; height: number; baseFontSize: number }) {
  const minFontSize = Math.max(8, Math.floor(input.baseFontSize * 0.72));
  let fontSize = input.baseFontSize;
  let lines = wrapText(input.text, input.width, fontSize);
  let lineHeight = Math.max(fontSize * 1.2, 12);
  let totalHeight = lines.length * lineHeight;

  while (totalHeight > input.height && fontSize > minFontSize) {
    fontSize -= 0.5;
    lines = wrapText(input.text, input.width, fontSize);
    lineHeight = Math.max(fontSize * 1.2, 11);
    totalHeight = lines.length * lineHeight;
  }

  return {
    fontSize,
    lineHeight,
    lines,
    overflow: totalHeight > input.height,
  };
}

export function reconstructTranslationBlocks(input: {
  blocks: PdfTranslationBlockRecord[];
  maskOpacity?: number;
}): ReconstructionResult {
  const opacity = Math.min(1, Math.max(0, input.maskOpacity ?? 0.92));
  const reconstructed = input.blocks.map((block) => {
    const baseFont = block.style.fontSize ?? 12;
    const fit = fitBlock({
      text: block.translatedText,
      width: block.bbox.width,
      height: block.bbox.height,
      baseFontSize: baseFont,
    });
    return {
      blockId: block.blockId,
      translationBlockId: block.id,
      pageNumber: block.pageNumber,
      text: block.translatedText,
      mask: {
        x: block.bbox.x,
        y: block.bbox.y,
        width: block.bbox.width,
        height: block.bbox.height,
        opacity,
      },
      fit,
    } satisfies ReconstructedTranslationBlock;
  });

  return {
    blocks: reconstructed,
    overflowCount: reconstructed.filter((item) => item.fit.overflow).length,
  };
}
