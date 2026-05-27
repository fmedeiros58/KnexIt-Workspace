import type { KnexPdfRenderPhase } from "../rendering/RenderQualityController";

export type KnexPdfVisualRenderMode =
  | "page-canvas"
  | "tiled-canvas"
  | "server-tiled"
  | "auto-professional";

export type KnexPdfTileStatus =
  | "idle"
  | "queued"
  | "rendering"
  | "ready"
  | "error"
  | "cancelled"
  | "stale";

export type KnexPdfTileRect = {
  tileId: string;
  pageNumber: number;
  row: number;
  column: number;
  cssLeft: number;
  cssTop: number;
  cssWidth: number;
  cssHeight: number;
  overlapPx: number;
};

export type KnexPdfTileGeometry = {
  documentId: string;
  pageNumber: number;
  pageWidthPt: number;
  pageHeightPt: number;
  pageCssWidth: number;
  pageCssHeight: number;
  zoom: number;
  rotation: number;
  outputScale: number;
  dpi?: number;
  tileCssSize: number;
  overlapPx: number;
  renderPhase: KnexPdfRenderPhase;
  renderVersion: number;
  finalRenderVersion: number;
  tiles: KnexPdfTileRect[];
};

export type KnexPdfTileIdentity = {
  documentId: string;
  pdfFileId?: string;
  pageNumber: number;
  row: number;
  column: number;
  cssLeft: number;
  cssTop: number;
  cssWidth: number;
  cssHeight: number;
  zoomBucket: string;
  outputScale: number;
  dpi?: number;
  renderPhase: KnexPdfRenderPhase;
  renderVersion: number;
  finalRenderVersion: number;
  backend: string;
  rotation: number;
};

export type KnexPdfResolvedTileRenderMode =
  | "page-canvas"
  | "tiled-canvas"
  | "server-tiled";

export type KnexPdfServerTileFallbackReason =
  | "server-disabled"
  | "server-timeout"
  | "server-error"
  | "invalid-response"
  | "identity-mismatch"
  | "storage-error"
  | "native-renderer-unavailable"
  | "unknown";
