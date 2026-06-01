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
    renderCssLeft: tile.renderCssX,
    renderCssTop: tile.renderCssY,
    renderCssWidth: tile.renderCssWidth,
    renderCssHeight: tile.renderCssHeight,
    cellCssLeft: tile.cellCssX,
    cellCssTop: tile.cellCssY,
    cellCssWidth: tile.cellCssWidth,
    cellCssHeight: tile.cellCssHeight,
    overlapPx: tile.overlapPx,
    bleedPx: tile.bleedPx,
  };
}

export function createKnexPdfTileGeometry(input: {
  documentId: string;
  geometry: KnexPdfPageGeometry;
  tiles: KnexPdfPageTile[];
  tileCssSize: number;
  tileRows?: number;
  tileColumns?: number;
  overlapPx: number;
  bleedPx?: number;
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
    tileRows:
      input.tileRows ??
      input.tiles.reduce((maxRow, tile) => Math.max(maxRow, tile.row), 0) + 1,
    tileColumns:
      input.tileColumns ??
      input.tiles.reduce(
        (maxColumn, tile) => Math.max(maxColumn, tile.column),
        0,
      ) +
        1,
    overlapPx: input.overlapPx,
    bleedPx: input.bleedPx,
    renderPhase: input.renderPhase,
    renderVersion: input.renderVersion,
    finalRenderVersion: input.finalRenderVersion,
    tiles: input.tiles.map(toKnexPdfTileRect),
  };
}
