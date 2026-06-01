import type { KnexPdfRenderPhase } from "../rendering/RenderQualityController";

export type KnexReadServerTileFormat = "webp" | "png" | "jpeg";

export type KnexReadServerTileCachePolicy =
  | "prefer-cache"
  | "refresh"
  | "no-store";

export type KnexReadServerTileRectRequest = {
  row: number;
  column: number;
  cssLeft: number;
  cssTop: number;
  cssWidth: number;
  cssHeight: number;
  overlapPx: number;
};

export type KnexReadServerTilePageRequest = {
  cssWidth: number;
  cssHeight: number;
  widthPt: number;
  heightPt: number;
  rotation: number;
};

export type KnexReadServerTileRequest = {
  documentId: string;
  projectId?: string;
  pdfFileId?: string;
  pdfUrl?: string;
  pdfBytesBase64?: string;
  pageNumber: number;
  zoom: number;
  dpi?: number;
  outputScale: number;
  tile: KnexReadServerTileRectRequest;
  page: KnexReadServerTilePageRequest;
  renderPhase: KnexPdfRenderPhase;
  format?: KnexReadServerTileFormat;
  quality?: number;
  cachePolicy?: KnexReadServerTileCachePolicy;
  requestHash?: string;
};

export type KnexReadServerTileReadyResponse = {
  ok: true;
  tileId: string;
  cacheKey: string;
  status: "ready";
  imageUrl: string;
  width: number;
  height: number;
  cssLeft: number;
  cssTop: number;
  cssWidth: number;
  cssHeight: number;
  outputScale: number;
  dpi?: number;
  renderDurationMs: number;
  fromCache: boolean;
  backend: string;
  storageHit?: boolean;
};

export type KnexReadServerTileFallbackResponse = {
  ok: false;
  status: "fallback-required" | "error";
  fallback: "tiled-canvas";
  reason: string;
  retryable: boolean;
};

export type KnexReadServerTileResponse =
  | KnexReadServerTileReadyResponse
  | KnexReadServerTileFallbackResponse;

export type KnexReadServerTileBatchRequest = {
  tiles: KnexReadServerTileRequest[];
};

export type KnexReadServerTileBatchResponse = {
  ok: boolean;
  tiles: KnexReadServerTileResponse[];
  fallback?: "tiled-canvas";
  reason?: string;
};

export type NativePdfTileRendererPageInfo = {
  pageNumber: number;
  widthPt: number;
  heightPt: number;
  rotation: number;
};

export type NativePdfTileRendererRenderedTile = {
  imageBytes: Uint8Array;
  width: number;
  height: number;
  format: KnexReadServerTileFormat;
  renderDurationMs: number;
};

export interface NativePdfTileRenderer {
  id: "pdfium-native" | "poppler" | string;
  getPageInfo(input: {
    pdfFileId?: string;
    documentId: string;
    pageNumber: number;
  }): Promise<NativePdfTileRendererPageInfo>;
  renderTile(
    input: KnexReadServerTileRequest,
  ): Promise<NativePdfTileRendererRenderedTile>;
}
