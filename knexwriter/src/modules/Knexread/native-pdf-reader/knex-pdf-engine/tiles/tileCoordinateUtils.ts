import type {
  KnexPdfTileIdentity,
  KnexPdfTileRect,
} from "./TileRenderTypes";

function safeNumber(value: number | null | undefined, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function normalizeNumber(value: number, precision = 4): string {
  const factor = 10 ** precision;
  return String(Math.round(safeNumber(value, 0) * factor) / factor);
}

export function createKnexPdfZoomBucket(zoom: number): string {
  return `z${Math.round(Math.max(0.01, safeNumber(zoom, 1)) * 100)}`;
}

export function createKnexPdfTileId(input: {
  pageNumber: number;
  zoom: number;
  row: number;
  column: number;
  outputScale: number;
}): string {
  return [
    `p${Math.max(1, Math.trunc(safeNumber(input.pageNumber, 1)))}`,
    createKnexPdfZoomBucket(input.zoom),
    `r${Math.max(0, Math.trunc(safeNumber(input.row, 0)))}`,
    `c${Math.max(0, Math.trunc(safeNumber(input.column, 0)))}`,
    `s${normalizeNumber(input.outputScale, 2)}`,
  ].join("_");
}

export function createKnexPdfTileCacheKey(identity: KnexPdfTileIdentity) {
  return [
    `doc=${identity.documentId}`,
    `pdf=${identity.pdfFileId ?? ""}`,
    `p=${identity.pageNumber}`,
    `r=${identity.row}`,
    `c=${identity.column}`,
    `left=${normalizeNumber(identity.cssLeft)}`,
    `top=${normalizeNumber(identity.cssTop)}`,
    `size=${normalizeNumber(identity.cssWidth)}x${normalizeNumber(
      identity.cssHeight,
    )}`,
    `z=${identity.zoomBucket}`,
    `os=${normalizeNumber(identity.outputScale)}`,
    `dpi=${identity.dpi ?? ""}`,
    `phase=${identity.renderPhase}`,
    `rv=${identity.renderVersion}`,
    `fv=${identity.finalRenderVersion}`,
    `be=${identity.backend}`,
    `rot=${identity.rotation}`,
  ].join("|");
}

export function normalizeKnexPdfTileRect(input: KnexPdfTileRect): KnexPdfTileRect {
  return {
    ...input,
    cssLeft: safeNumber(input.cssLeft, 0),
    cssTop: safeNumber(input.cssTop, 0),
    cssWidth: Math.max(1, safeNumber(input.cssWidth, 1)),
    cssHeight: Math.max(1, safeNumber(input.cssHeight, 1)),
    overlapPx: Math.max(0, safeNumber(input.overlapPx, 0)),
  };
}
