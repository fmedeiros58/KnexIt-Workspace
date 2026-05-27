import type { KnexPdfPageGeometry } from "../core/engineTypes";

export type TileGridCell = {
  tileX: number;
  tileY: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type KnexPdfTilePriority = "visible" | "nearby" | "background";

export type KnexPdfPageTile = {
  id: string;
  pageNumber: number;
  tileX: number;
  tileY: number;
  column: number;
  row: number;
  cssX: number;
  cssY: number;
  cssWidth: number;
  cssHeight: number;
  bitmapX: number;
  bitmapY: number;
  bitmapWidth: number;
  bitmapHeight: number;
  outputScaleX: number;
  outputScaleY: number;
  overlapPx: number;
  priority: KnexPdfTilePriority;
};

export type KnexPdfTileRenderPlan = {
  pageNumber: number;
  cssWidth: number;
  cssHeight: number;
  bitmapWidth: number;
  bitmapHeight: number;
  outputScale: number;
  outputScaleX: number;
  outputScaleY: number;
  tileSizeCss: number;
  overlapPx: number;
  totalTiles: number;
  visibleTiles: number;
  estimatedBytes: number;
  reason: "not-needed" | "bitmap-too-large" | "output-scale-clamped";
  tiles: KnexPdfPageTile[];
};

export type KnexPdfVisibleTileRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const DEFAULT_TILE_SIZE_CSS = 1024;
const DEFAULT_TILE_MAX_BITMAP_PIXELS = 96_000_000;

function safeNumber(
  value: number | null | undefined,
  fallback = 0,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function normalizePositiveInteger(value: number, fallback = 1): number {
  return Math.max(1, Math.ceil(safeNumber(value, fallback)));
}

function intersects(a: KnexPdfVisibleTileRect, b: KnexPdfVisibleTileRect) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function expandRect(
  rect: KnexPdfVisibleTileRect | undefined,
  margin: number,
): KnexPdfVisibleTileRect | undefined {
  if (!rect) return undefined;

  return {
    x: rect.x - margin,
    y: rect.y - margin,
    width: rect.width + margin * 2,
    height: rect.height + margin * 2,
  };
}

export function calculateTileGrid(input: {
  pageWidth: number;
  pageHeight: number;
  tileSize?: number;
}): TileGridCell[] {
  const tileSize = input.tileSize ?? 1024;
  const columns = Math.max(1, Math.ceil(input.pageWidth / tileSize));
  const rows = Math.max(1, Math.ceil(input.pageHeight / tileSize));
  const cells: TileGridCell[] = [];

  for (let tileY = 0; tileY < rows; tileY += 1) {
    for (let tileX = 0; tileX < columns; tileX += 1) {
      const x = tileX * tileSize;
      const y = tileY * tileSize;
      cells.push({
        tileX,
        tileY,
        x,
        y,
        width: Math.min(tileSize, input.pageWidth - x),
        height: Math.min(tileSize, input.pageHeight - y),
      });
    }
  }

  return cells;
}

export function shouldUseKnexPdfTileRendering(input: {
  geometry: KnexPdfPageGeometry;
  maxBitmapPixels?: number;
}): boolean {
  const maxBitmapPixels = normalizePositiveInteger(
    input.maxBitmapPixels ?? DEFAULT_TILE_MAX_BITMAP_PIXELS,
    DEFAULT_TILE_MAX_BITMAP_PIXELS,
  );

  return (
    input.geometry.bitmapPixels > maxBitmapPixels ||
    input.geometry.wasOutputScaleClamped
  );
}

export function buildKnexPdfTileRenderPlan(input: {
  geometry: KnexPdfPageGeometry;
  tileSizeCss?: number;
  overlapPx?: number;
  visibleRect?: KnexPdfVisibleTileRect;
  preloadMarginCss?: number;
  maxBitmapPixels?: number;
}): KnexPdfTileRenderPlan {
  const { geometry } = input;
  const tileSizeCss = normalizePositiveInteger(
    input.tileSizeCss ?? DEFAULT_TILE_SIZE_CSS,
    DEFAULT_TILE_SIZE_CSS,
  );
  const overlapPx = Math.max(0, Math.ceil(safeNumber(input.overlapPx, 0)));
  const visibleRect = input.visibleRect;
  const nearbyRect = expandRect(
    visibleRect,
    Math.max(0, safeNumber(input.preloadMarginCss, tileSizeCss)),
  );

  const cells = calculateTileGrid({
    pageWidth: geometry.cssWidth,
    pageHeight: geometry.cssHeight,
    tileSize: tileSizeCss,
  });

  const zoomBucket = Math.round(geometry.zoom * 100) / 100;
  const scaleBucket = Math.round(geometry.outputScale * 100) / 100;

  const tiles: KnexPdfPageTile[] = cells.map((cell) => {
    const cssWidth = Math.min(
      cell.width + overlapPx,
      Math.max(1, geometry.cssWidth - cell.x),
    );
    const cssHeight = Math.min(
      cell.height + overlapPx,
      Math.max(1, geometry.cssHeight - cell.y),
    );
    const rect = {
      x: cell.x,
      y: cell.y,
      width: cssWidth,
      height: cssHeight,
    };
    const priority: KnexPdfTilePriority =
      visibleRect && intersects(rect, visibleRect)
        ? "visible"
        : nearbyRect && intersects(rect, nearbyRect)
          ? "nearby"
          : "background";

    return {
      id: `p${geometry.pageNumber}_z${zoomBucket}_r${cell.tileY}_c${cell.tileX}_s${scaleBucket}`,
      pageNumber: geometry.pageNumber,
      tileX: cell.tileX,
      tileY: cell.tileY,
      column: cell.tileX,
      row: cell.tileY,
      cssX: cell.x,
      cssY: cell.y,
      cssWidth,
      cssHeight,
      bitmapX: Math.floor(cell.x * geometry.outputScaleX),
      bitmapY: Math.floor(cell.y * geometry.outputScaleY),
      bitmapWidth: normalizePositiveInteger(
        cssWidth * geometry.outputScaleX,
      ),
      bitmapHeight: normalizePositiveInteger(
        cssHeight * geometry.outputScaleY,
      ),
      outputScaleX: geometry.outputScaleX,
      outputScaleY: geometry.outputScaleY,
      overlapPx,
      priority,
    };
  });

  const priorityRank: Record<KnexPdfTilePriority, number> = {
    visible: 0,
    nearby: 1,
    background: 2,
  };

  tiles.sort((a, b) => {
    const priorityDiff = priorityRank[a.priority] - priorityRank[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    if (a.tileY !== b.tileY) return a.tileY - b.tileY;
    return a.tileX - b.tileX;
  });

  const reason = geometry.wasOutputScaleClamped
    ? "output-scale-clamped"
    : shouldUseKnexPdfTileRendering({
        geometry,
        maxBitmapPixels: input.maxBitmapPixels,
      })
      ? "bitmap-too-large"
      : "not-needed";

  return {
    pageNumber: geometry.pageNumber,
    cssWidth: geometry.cssWidth,
    cssHeight: geometry.cssHeight,
    bitmapWidth: geometry.bitmapWidth,
    bitmapHeight: geometry.bitmapHeight,
    outputScale: geometry.outputScale,
    outputScaleX: geometry.outputScaleX,
    outputScaleY: geometry.outputScaleY,
    tileSizeCss,
    overlapPx,
    totalTiles: tiles.length,
    visibleTiles: tiles.filter((tile) => tile.priority === "visible").length,
    estimatedBytes: geometry.bitmapPixels * 4,
    reason,
    tiles,
  };
}
