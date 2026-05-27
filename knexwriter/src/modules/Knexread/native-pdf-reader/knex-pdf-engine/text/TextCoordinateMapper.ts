import type { KnexPdfSemanticTextBlock } from "../core/engineTypes";

export type KnexPdfPoint = {
  x: number;
  y: number;
};

export type KnexPdfRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type KnexPdfTextCoordinateSpace =
  | "page-css"
  | "page-points"
  | "bitmap";

export type KnexPdfTextCoordinateMapperInput = {
  pageWidth: number;
  pageHeight: number;
  pageWidthPt?: number;
  pageHeightPt?: number;
  renderScale?: number;
  outputScale?: number;
};

function safeNumber(value: number | null | undefined, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function positiveLength(
  value: number | null | undefined,
  fallback = 1,
): number {
  return Math.max(1, safeNumber(value, fallback));
}

function positiveScale(
  value: number | null | undefined,
  fallback = 1,
): number {
  return Math.max(0.01, safeNumber(value, fallback));
}

function positiveSize(
  value: number | null | undefined,
  fallback = 1,
): number {
  return Math.max(0.01, safeNumber(value, fallback));
}

function clamp(value: number, min: number, max: number): number {
  const safeMin = safeNumber(min, 0);
  const safeMax = Math.max(safeMin, safeNumber(max, safeMin));
  const safeValue = safeNumber(value, safeMin);

  return Math.max(safeMin, Math.min(safeMax, safeValue));
}

function normalizeRect(rect: KnexPdfRect): KnexPdfRect {
  const x = safeNumber(rect.x, 0);
  const y = safeNumber(rect.y, 0);
  const width = positiveSize(rect.width, 1);
  const height = positiveSize(rect.height, 1);

  return {
    x,
    y,
    width,
    height,
  };
}

function rectContainsPoint(rect: KnexPdfRect, point: KnexPdfPoint): boolean {
  const normalized = normalizeRect(rect);

  return (
    point.x >= normalized.x &&
    point.x <= normalized.x + normalized.width &&
    point.y >= normalized.y &&
    point.y <= normalized.y + normalized.height
  );
}

function inflateRect(rect: KnexPdfRect, amount: number): KnexPdfRect {
  const normalized = normalizeRect(rect);
  const safeAmount = Math.max(0, safeNumber(amount, 0));

  return {
    x: normalized.x - safeAmount,
    y: normalized.y - safeAmount,
    width: normalized.width + safeAmount * 2,
    height: normalized.height + safeAmount * 2,
  };
}

function getBlockRect(block: KnexPdfSemanticTextBlock): KnexPdfRect {
  return {
    x: block.x,
    y: block.y,
    width: block.width,
    height: block.height,
  };
}

export function mapPointFromBitmapToPageCss(input: {
  point: KnexPdfPoint;
  outputScale?: number;
}): KnexPdfPoint {
  const outputScale = positiveScale(input.outputScale, 1);

  return {
    x: safeNumber(input.point.x, 0) / outputScale,
    y: safeNumber(input.point.y, 0) / outputScale,
  };
}

export function mapRectFromBitmapToPageCss(input: {
  rect: KnexPdfRect;
  outputScale?: number;
}): KnexPdfRect {
  const outputScale = positiveScale(input.outputScale, 1);
  const rect = normalizeRect(input.rect);

  return {
    x: rect.x / outputScale,
    y: rect.y / outputScale,
    width: rect.width / outputScale,
    height: rect.height / outputScale,
  };
}

export function mapPointFromPagePointsToPageCss(input: {
  point: KnexPdfPoint;
  renderScale?: number;
}): KnexPdfPoint {
  const renderScale = positiveScale(input.renderScale, 1);

  return {
    x: safeNumber(input.point.x, 0) * renderScale,
    y: safeNumber(input.point.y, 0) * renderScale,
  };
}

export function mapRectFromPagePointsToPageCss(input: {
  rect: KnexPdfRect;
  renderScale?: number;
}): KnexPdfRect {
  const renderScale = positiveScale(input.renderScale, 1);
  const rect = normalizeRect(input.rect);

  return {
    x: rect.x * renderScale,
    y: rect.y * renderScale,
    width: rect.width * renderScale,
    height: rect.height * renderScale,
  };
}

export function clampRectToPage(input: {
  rect: KnexPdfRect;
  pageWidth: number;
  pageHeight: number;
}): KnexPdfRect {
  const rect = normalizeRect(input.rect);
  const pageWidth = positiveLength(input.pageWidth, 1);
  const pageHeight = positiveLength(input.pageHeight, 1);

  const x = clamp(rect.x, 0, pageWidth);
  const y = clamp(rect.y, 0, pageHeight);
  const right = clamp(rect.x + rect.width, 0, pageWidth);
  const bottom = clamp(rect.y + rect.height, 0, pageHeight);

  return {
    x,
    y,
    width: Math.max(0.01, right - x),
    height: Math.max(0.01, bottom - y),
  };
}

export function normalizeTextBlockCoordinates(input: {
  block: KnexPdfSemanticTextBlock;
  pageWidth: number;
  pageHeight: number;
}): KnexPdfSemanticTextBlock {
  const rect = clampRectToPage({
    rect: getBlockRect(input.block),
    pageWidth: input.pageWidth,
    pageHeight: input.pageHeight,
  });

  return {
    ...input.block,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
  };
}

export function normalizeTextBlocksCoordinates(input: {
  blocks: KnexPdfSemanticTextBlock[];
  pageWidth: number;
  pageHeight: number;
}): KnexPdfSemanticTextBlock[] {
  return input.blocks.map((block) =>
    normalizeTextBlockCoordinates({
      block,
      pageWidth: input.pageWidth,
      pageHeight: input.pageHeight,
    }),
  );
}

export function findTextBlocksAtPoint(input: {
  blocks: KnexPdfSemanticTextBlock[];
  x: number;
  y: number;
  tolerance?: number;
}): KnexPdfSemanticTextBlock[] {
  const point = {
    x: safeNumber(input.x, 0),
    y: safeNumber(input.y, 0),
  };

  const tolerance = Math.max(0, safeNumber(input.tolerance, 0));

  return input.blocks.filter((block) =>
    rectContainsPoint(inflateRect(getBlockRect(block), tolerance), point),
  );
}

export function findNearestTextBlockAtPoint(input: {
  blocks: KnexPdfSemanticTextBlock[];
  x: number;
  y: number;
  maxDistance?: number;
}): KnexPdfSemanticTextBlock | null {
  const point = {
    x: safeNumber(input.x, 0),
    y: safeNumber(input.y, 0),
  };

  const maxDistance = Math.max(0, safeNumber(input.maxDistance, 24));

  let nearest: KnexPdfSemanticTextBlock | null = null;
  let nearestDistance = Number.POSITIVE_INFINITY;

  for (const block of input.blocks) {
    const rect = normalizeRect(getBlockRect(block));
    const centerX = rect.x + rect.width / 2;
    const centerY = rect.y + rect.height / 2;
    const dx = centerX - point.x;
    const dy = centerY - point.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    if (distance < nearestDistance) {
      nearest = block;
      nearestDistance = distance;
    }
  }

  return nearestDistance <= maxDistance ? nearest : null;
}

export function sortTextBlocksByReadingOrder(
  blocks: KnexPdfSemanticTextBlock[],
): KnexPdfSemanticTextBlock[] {
  return [...blocks].sort((a, b) => {
    const readingOrderDelta =
      safeNumber(a.readingOrder, Number.MAX_SAFE_INTEGER) -
      safeNumber(b.readingOrder, Number.MAX_SAFE_INTEGER);
    if (readingOrderDelta !== 0) return readingOrderDelta;

    const lineDelta =
      safeNumber(a.lineIndex, Number.MAX_SAFE_INTEGER) -
      safeNumber(b.lineIndex, Number.MAX_SAFE_INTEGER);
    if (lineDelta !== 0) return lineDelta;

    const yDelta = safeNumber(a.y, 0) - safeNumber(b.y, 0);
    if (Math.abs(yDelta) > 1) return yDelta;

    return safeNumber(a.x, 0) - safeNumber(b.x, 0);
  });
}

export function createTextCoordinateMapper(
  input: KnexPdfTextCoordinateMapperInput,
) {
  const pageWidth = positiveLength(input.pageWidth, 1);
  const pageHeight = positiveLength(input.pageHeight, 1);
  const renderScale = positiveScale(input.renderScale, 1);
  const outputScale = positiveScale(input.outputScale, 1);

  return {
    pageWidth,
    pageHeight,
    renderScale,
    outputScale,

    fromBitmapPoint(point: KnexPdfPoint): KnexPdfPoint {
      return mapPointFromBitmapToPageCss({
        point,
        outputScale,
      });
    },

    fromBitmapRect(rect: KnexPdfRect): KnexPdfRect {
      return mapRectFromBitmapToPageCss({
        rect,
        outputScale,
      });
    },

    fromPagePoint(point: KnexPdfPoint): KnexPdfPoint {
      return mapPointFromPagePointsToPageCss({
        point,
        renderScale,
      });
    },

    fromPageRect(rect: KnexPdfRect): KnexPdfRect {
      return mapRectFromPagePointsToPageCss({
        rect,
        renderScale,
      });
    },

    clampRect(rect: KnexPdfRect): KnexPdfRect {
      return clampRectToPage({
        rect,
        pageWidth,
        pageHeight,
      });
    },

    normalizeBlock(block: KnexPdfSemanticTextBlock): KnexPdfSemanticTextBlock {
      return normalizeTextBlockCoordinates({
        block,
        pageWidth,
        pageHeight,
      });
    },

    normalizeBlocks(
      blocks: KnexPdfSemanticTextBlock[],
    ): KnexPdfSemanticTextBlock[] {
      return normalizeTextBlocksCoordinates({
        blocks,
        pageWidth,
        pageHeight,
      });
    },
  };
}


/**
 * Escala um bloco textual de uma escala de origem para uma escala de destino.
 *
 * Útil para a estratégia visual por palavra:
 * - extração textual em escala base;
 * - exibição em zoom atual;
 * - preservação das proporções x/y/width/height/fontSize/lineHeight.
 */
export function scaleTextBlockCoordinates(input: {
  block: KnexPdfSemanticTextBlock;
  fromScale?: number;
  toScale?: number;
}): KnexPdfSemanticTextBlock {
  const fromScale = positiveScale(input.fromScale, 1);
  const toScale = positiveScale(input.toScale, 1);
  const factor = toScale / fromScale;

  return {
    ...input.block,
    x: safeNumber(input.block.x, 0) * factor,
    y: safeNumber(input.block.y, 0) * factor,
    width: positiveSize(input.block.width, 1) * factor,
    height: positiveSize(input.block.height, 1) * factor,
    fontSize: positiveSize(input.block.fontSize, 1) * factor,
    lineHeight: positiveSize(input.block.lineHeight, input.block.fontSize) * factor,
    letterSpacing: safeNumber(input.block.letterSpacing, 0) * factor,
  };
}

export function scaleTextBlocksCoordinates(input: {
  blocks: KnexPdfSemanticTextBlock[];
  fromScale?: number;
  toScale?: number;
}): KnexPdfSemanticTextBlock[] {
  return input.blocks.map((block) =>
    scaleTextBlockCoordinates({
      block,
      fromScale: input.fromScale,
      toScale: input.toScale,
    }),
  );
}
