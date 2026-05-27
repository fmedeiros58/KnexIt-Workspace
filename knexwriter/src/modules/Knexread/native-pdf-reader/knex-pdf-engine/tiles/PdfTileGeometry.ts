import type { KnexPdfPageGeometry } from "../core/engineTypes";
import type { KnexPdfRenderPhase } from "../rendering/RenderQualityController";
import type { KnexPdfPageTile } from "../rendering/TileGridCalculator";
import type { KnexPdfTileGeometry, KnexPdfTileRect } from "./TileRenderTypes";

export function toKnexPdfTileRect(tile: KnexPdfPageTile): KnexPdfTileRect {
  return {
    tileId: tile.id,
    pageNumber: tile.pageNumber,
    row: tile.row,
    column: tile.column,
    cssLeft: tile.cssX,
    cssTop: tile.cssY,
    cssWidth: tile.cssWidth,
    cssHeight: tile.cssHeight,
    overlapPx: tile.overlapPx,
  };
}

export function createKnexPdfTileGeometry(input: {
  documentId: string;
  geometry: KnexPdfPageGeometry;
  tiles: KnexPdfPageTile[];
  tileCssSize: number;
  overlapPx: number;
  renderPhase: KnexPdfRenderPhase;
  renderVersion: number;
  finalRenderVersion: number;
  dpi?: number;
}): KnexPdfTileGeometry {
  return {
    documentId: input.documentId,
    pageNumber: input.geometry.pageNumber,
    pageWidthPt: input.geometry.baseWidth,
    pageHeightPt: input.geometry.baseHeight,
    pageCssWidth: input.geometry.cssWidth,
    pageCssHeight: input.geometry.cssHeight,
    zoom: input.geometry.zoom,
    rotation: input.geometry.rotation,
    outputScale: input.geometry.outputScale,
    dpi: input.dpi,
    tileCssSize: input.tileCssSize,
    overlapPx: input.overlapPx,
    renderPhase: input.renderPhase,
    renderVersion: input.renderVersion,
    finalRenderVersion: input.finalRenderVersion,
    tiles: input.tiles.map(toKnexPdfTileRect),
  };
}
