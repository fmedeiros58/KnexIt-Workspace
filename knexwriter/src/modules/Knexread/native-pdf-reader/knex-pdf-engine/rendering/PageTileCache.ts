import type {
  PageBitmapCacheEntryRequirements,
  PageBitmapCacheKeyInput,
} from "../cache/PageBitmapCache";
import type { KnexPdfPageGeometry } from "../core/engineTypes";
import type { KnexPdfRenderPhase } from "./RenderQualityController";
import type { KnexPdfPageTile } from "./TileGridCalculator";

export type BuildKnexPdfTileCacheInputParams = {
  documentId: string;
  backend: string;
  geometry: KnexPdfPageGeometry;
  tile: KnexPdfPageTile;
  quality: string;
  renderPhase: KnexPdfRenderPhase;
  renderMode: string;
  backendVersion: number;
};

export function buildKnexPdfTileCacheInput(
  input: BuildKnexPdfTileCacheInputParams,
): PageBitmapCacheKeyInput {
  return {
    documentId: input.documentId,
    backend: input.backend,
    pageNumber: input.geometry.pageNumber,
    region: "tile",
    tileId: input.tile.id,
    tileX: input.tile.tileX,
    tileY: input.tile.tileY,
    renderScale: input.geometry.zoom,
    zoomBucket: input.geometry.zoom,
    devicePixelRatio: input.geometry.devicePixelRatio,
    renderMode: input.renderMode,
    outputScale: Math.min(input.tile.outputScaleX, input.tile.outputScaleY),
    cssWidth: input.tile.cssWidth,
    cssHeight: input.tile.cssHeight,
    width: input.tile.bitmapWidth,
    height: input.tile.bitmapHeight,
    quality: input.quality,
    renderPhase: input.renderPhase,
    rotation: input.geometry.rotation,
    backendVersion: input.backendVersion,
  };
}

export function buildKnexPdfTileCacheRequirements(
  input: PageBitmapCacheKeyInput,
  usage: "final" | "preview",
): PageBitmapCacheEntryRequirements {
  const base: PageBitmapCacheEntryRequirements = {
    documentId: input.documentId,
    backend: input.backend,
    pageNumber: input.pageNumber,
    region: "tile",
    tileId: input.tileId,
    tileX: input.tileX,
    tileY: input.tileY,
    renderMode: input.renderMode,
    rotation: input.rotation,
    backendVersion: input.backendVersion,
    exactBackendVersion: true,
    numericTolerance: 0.01,
  };

  if (usage === "preview") {
    return {
      ...base,
      minRenderPhase: "interactive-preview",
    };
  }

  return {
    ...base,
    renderScale: input.renderScale,
    zoomBucket: input.zoomBucket,
    devicePixelRatio: input.devicePixelRatio,
    cssWidth: input.cssWidth,
    cssHeight: input.cssHeight,
    width: input.width,
    height: input.height,
    minOutputScale: input.outputScale,
    minBitmapCssRatio: input.outputScale,
    minQuality: input.quality,
    minRenderPhase: input.renderPhase,
    exactRenderPhase: true,
  };
}
