"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { NativePdfSession } from "../../services";
import {
  createKnexPdfTileCacheKey,
  createKnexPdfZoomBucket,
  renderKnexPdfTileToCanvas,
  requestServerRenderedTile,
  TileBitmapCache,
  TileRenderScheduler,
  type KnexReadServerTileFallbackResponse,
  type KnexReadServerTileRequest,
  type KnexReadServerTileResponse,
  type KnexReadServerTileReadyResponse,
  type KnexPdfPageGeometry,
  type KnexPdfPageTile,
  type KnexPdfRenderPhase,
} from "../../knex-pdf-engine";

type TileStatus = "idle" | "rendering" | "ready" | "error" | "cancelled";
type TileCacheStatus = "hit" | "miss" | "stored" | "discarded";
type TileRenderMode = "server-tiled" | "tiled-canvas";
type TileRenderSource =
  | "pdfjs"
  | "pdfium"
  | "server"
  | "native-server"
  | "cache"
  | "unknown";

type CachedTileBitmap = {
  bitmap: ImageBitmap;
  renderDurationMs: number;
  backend: string;
  renderSource: Exclude<TileRenderSource, "cache">;
  renderer: string;
  dpi?: number | null;
  storageHit?: boolean;
  key: string;
};

const TILE_BITMAP_CACHE_MAX_ENTRIES = 96;
const TILE_BITMAP_CACHE_MAX_BYTES = 96 * 1024 * 1024;
const TILE_VISIBLE_CANVAS_MAX_PIXELS = 6_000_000;
const TILE_VISIBLE_CANVAS_MAX_SIDE = 8_192;
const TILE_CACHEABLE_BITMAP_MAX_BYTES = 10 * 1024 * 1024;
const STABLE_TILE_CACHE_RENDER_VERSION = 1;

/*
 * Em zoom elevado, dois tiles renderizando ao mesmo tempo podem ser suficientes
 * para estourar memória, principalmente quando há activeLayer + pendingLayer.
 * Mantemos uma fila global conservadora; a fluidez passa a vir da camada ativa
 * escalada por transform e da montagem progressiva.
 */
const tileRenderScheduler = new TileRenderScheduler({ maxConcurrency: 1 });

const tileBitmapCache = new TileBitmapCache<CachedTileBitmap>({
  maxTiles: TILE_BITMAP_CACHE_MAX_ENTRIES,
  maxBytes: TILE_BITMAP_CACHE_MAX_BYTES,
  estimateBytes: (value) => value.bitmap.width * value.bitmap.height * 4,
  dispose: (value) => {
    try {
      value.bitmap.close();
    } catch {
      // ImageBitmap.close() is best-effort and can throw after prior disposal.
    }
  },
});

function isTileDebugEnabled(): boolean {
  const record = globalThis as unknown as Record<string, unknown>;
  const value =
    record.KNEX_PDF_TILE_DEBUG_BORDERS ?? record.KNEX_PDF_TILE_DEBUG;

  return value === true || value === "true" || value === "1";
}

function getTileRenderMode(_renderText: boolean): string {
  return "bitmap-only";
}

function normalizeBackendName(value: string | null | undefined): string {
  return value && value.trim().length > 0 ? value : "unknown";
}

function getRequestedRenderSource(
  tileRenderMode: TileRenderMode,
): Exclude<TileRenderSource, "cache"> {
  return tileRenderMode === "server-tiled" ? "server" : "pdfjs";
}

function getRequestedRenderer(tileRenderMode: TileRenderMode): string {
  return tileRenderMode === "server-tiled"
    ? "server-tile-renderer"
    : "pdfjs-tile-canvas";
}

function isServerBackedRenderSource(
  value: TileRenderSource | null | undefined,
): boolean {
  return value === "server" || value === "native-server";
}

function shouldAcceptCachedTileForMode(input: {
  tileRenderMode: TileRenderMode;
  cachedTile: CachedTileBitmap;
}): boolean {
  /*
   * Regra crítica:
   * Um cache gerado por fallback local PDF.js não pode satisfazer uma camada
   * server-tiled. Caso contrário o frame declara "server", mas os canvases
   * reais continuam "pdfjs/cache", gerando diagnóstico falso e qualidade
   * irregular.
   */
  if (input.tileRenderMode !== "server-tiled") {
    return true;
  }

  return isServerBackedRenderSource(input.cachedTile.renderSource);
}

function getServerTileFailureReason(
  response: KnexReadServerTileFallbackResponse,
): string {
  return response.reason || "server-tile-fallback-required";
}

function getServerRenderSource(
  backend: string | null | undefined,
): Exclude<TileRenderSource, "cache"> {
  const normalized = normalizeBackendName(backend).toLowerCase();

  if (normalized.includes("native")) return "native-server";
  return "server";
}

function resolveServerTileDpi(input: {
  renderPhase: KnexPdfRenderPhase;
  zoom: number;
}): number {
  /*
   * DPI fixo em 300 era perigoso em zoom alto. O tile já carrega zoom e
   * outputScale; manter DPI alto acima de 800% pode criar imagens grandes
   * demais no servidor e no canvas do cliente.
   */
  if (input.zoom >= 16) return 90;
  if (input.zoom >= 12) return 110;
  if (input.zoom >= 8) return 130;
  if (input.zoom >= 4) return 180;

  if (input.renderPhase === "settled-final") return 260;
  if (input.renderPhase === "warmup-preview") return 180;

  return 140;
}

function isServerTileReadyResponse(
  response: KnexReadServerTileResponse,
): response is KnexReadServerTileReadyResponse {
  return response.ok === true;
}

function asServerTileFallbackResponse(
  response: KnexReadServerTileResponse,
): KnexReadServerTileFallbackResponse {
  return response as KnexReadServerTileFallbackResponse;
}

function createTileCacheKey(input: {
  documentId: string;
  geometry: KnexPdfPageGeometry;
  tile: KnexPdfPageTile;
  renderQuality: string;
  renderPhase: KnexPdfRenderPhase;
  renderText: boolean;
  backend: string;
  activeBackend: string;
  renderSource: TileRenderSource;
  renderer: string;
  backendVersion: number;
  tileRows: number;
  tileColumns: number;
}) {
  const outputScale = Math.min(input.tile.outputScaleX, input.tile.outputScaleY);
  const renderCssX = input.tile.renderCssX;
  const renderCssY = input.tile.renderCssY;
  const renderCssWidth = input.tile.renderCssWidth;
  const renderCssHeight = input.tile.renderCssHeight;

  return [
    createKnexPdfTileCacheKey({
      documentId: input.documentId,
      pageNumber: input.geometry.pageNumber,
      row: input.tile.row,
      column: input.tile.column,
      cssLeft: renderCssX,
      cssTop: renderCssY,
      cssWidth: renderCssWidth,
      cssHeight: renderCssHeight,
      zoomBucket: createKnexPdfZoomBucket(input.geometry.zoom),
      outputScale,
      renderPhase: input.renderPhase,
      renderVersion: STABLE_TILE_CACHE_RENDER_VERSION,
      finalRenderVersion: STABLE_TILE_CACHE_RENDER_VERSION,
      backend: input.backend,
      rotation: input.geometry.rotation,
    }),
    `q=${input.renderQuality}`,
    `mode=${getTileRenderMode(input.renderText)}`,
    `text=${input.renderText ? "1" : "0"}`,
    `backend=${input.backend}`,
    `activeBackend=${input.activeBackend}`,
    `source=${input.renderSource}`,
    `renderer=${input.renderer}`,
    `bv=${input.backendVersion}`,
    `grid=${input.tileRows}x${input.tileColumns}`,
    `tileId=${input.tile.id}`,
    `cell=${input.tile.cssX},${input.tile.cssY},${input.tile.cssWidth},${input.tile.cssHeight}`,
    `render=${renderCssX},${renderCssY},${renderCssWidth},${renderCssHeight}`,
    `bleed=${input.tile.bleedPx}`,
    `out=${outputScale}`,
  ].join("|");
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function clampRoundedNumber(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function resolveSafeTileBitmapSize(input: {
  width: number;
  height: number;
}): {
  width: number;
  height: number;
  scale: number;
  capped: boolean;
} {
  const width = Math.max(1, Math.round(input.width));
  const height = Math.max(1, Math.round(input.height));
  const maxByPixels = Math.sqrt(
    TILE_VISIBLE_CANVAS_MAX_PIXELS / Math.max(1, width * height),
  );
  const maxBySide = Math.min(
    TILE_VISIBLE_CANVAS_MAX_SIDE / width,
    TILE_VISIBLE_CANVAS_MAX_SIDE / height,
  );
  const scale = Math.min(1, maxByPixels, maxBySide);

  if (scale >= 0.999) {
    return {
      width,
      height,
      scale: 1,
      capped: false,
    };
  }

  return {
    width: Math.max(1, Math.floor(width * scale)),
    height: Math.max(1, Math.floor(height * scale)),
    scale,
    capped: true,
  };
}

function getCanvasBitmapBytes(canvas: HTMLCanvasElement): number {
  return Math.max(0, canvas.width * canvas.height * 4);
}

function canCacheCanvasBitmap(canvas: HTMLCanvasElement): boolean {
  return getCanvasBitmapBytes(canvas) <= TILE_CACHEABLE_BITMAP_MAX_BYTES;
}

function releaseCanvasBitmap(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;

  try {
    const context = canvas.getContext("2d");
    context?.clearRect(0, 0, canvas.width, canvas.height);
  } catch {
    // Best-effort cleanup.
  }

  /*
   * Redimensionar o canvas libera o buffer de bitmap do navegador.
   * Usamos 1x1 em vez de 0x0 para evitar inconsistências entre engines.
   */
  canvas.width = 1;
  canvas.height = 1;
}

function safeRevokeObjectUrl(value: string | null | undefined) {
  if (!value || !value.startsWith("blob:")) return;

  try {
    URL.revokeObjectURL(value);
  } catch {
    // Best-effort cleanup.
  }
}

function drawTileSourceToCanvas(input: {
  source: CanvasImageSource;
  sourceWidth: number;
  sourceHeight: number;
  canvas: HTMLCanvasElement;
  tile?: KnexPdfPageTile;
  cropToVisibleCell?: boolean;
}) {
  const {
    source,
    sourceWidth,
    sourceHeight,
    canvas,
    tile,
    cropToVisibleCell = false,
  } = input;

  /*
   * Regra importante de nitidez:
   * - O workerCanvas vem em alta densidade.
   * - A cópia para o canvas visível não pode usar crop fracionário.
   * - Crop fracionário força reamostragem do navegador e deixa texto pequeno
   *   borrado/serrilhado mesmo com outputScale 6.
   *
   * Por isso, quando recortamos o bleed/overscan, arredondamos sourceX,
   * sourceY, sourceCropWidth e sourceCropHeight para pixels inteiros do
   * bitmap real e copiamos 1:1 para o canvas final.
   */
  let sourceX = 0;
  let sourceY = 0;
  let sourceCropWidth = Math.max(1, Math.round(sourceWidth));
  let sourceCropHeight = Math.max(1, Math.round(sourceHeight));
  let targetWidth = sourceCropWidth;
  let targetHeight = sourceCropHeight;

  if (cropToVisibleCell && tile) {
    const safeSourceWidth = Math.max(1, Math.round(sourceWidth));
    const safeSourceHeight = Math.max(1, Math.round(sourceHeight));
    const sourceScaleX = safeSourceWidth / Math.max(1, tile.renderCssWidth);
    const sourceScaleY = safeSourceHeight / Math.max(1, tile.renderCssHeight);

    sourceX = clampRoundedNumber(
      (tile.cssX - tile.renderCssX) * sourceScaleX,
      0,
      Math.max(0, safeSourceWidth - 1),
    );
    sourceY = clampRoundedNumber(
      (tile.cssY - tile.renderCssY) * sourceScaleY,
      0,
      Math.max(0, safeSourceHeight - 1),
    );

    sourceCropWidth = clampRoundedNumber(
      tile.cssWidth * sourceScaleX,
      1,
      Math.max(1, safeSourceWidth - sourceX),
    );
    sourceCropHeight = clampRoundedNumber(
      tile.cssHeight * sourceScaleY,
      1,
      Math.max(1, safeSourceHeight - sourceY),
    );

    targetWidth = sourceCropWidth;
    targetHeight = sourceCropHeight;
  }

  const safeTarget = resolveSafeTileBitmapSize({
    width: targetWidth,
    height: targetHeight,
  });

  targetWidth = safeTarget.width;
  targetHeight = safeTarget.height;

  canvas.width = targetWidth;
  canvas.height = targetHeight;
  canvas.dataset.knexPdfTileMemoryCapped = safeTarget.capped ? "true" : "false";
  canvas.dataset.knexPdfTileMemoryScale = String(
    Math.round(safeTarget.scale * 1000) / 1000,
  );
  canvas.dataset.knexPdfTileMaxPixels = String(TILE_VISIBLE_CANVAS_MAX_PIXELS);
  canvas.dataset.knexPdfTileMaxSide = String(TILE_VISIBLE_CANVAS_MAX_SIDE);
  canvas.style.imageRendering = "auto";

  const context = canvas.getContext("2d", {
    alpha: false,
    desynchronized: false,
  });

  if (!context) {
    throw new Error("Could not initialize KnexPDF tile canvas.");
  }

  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);

  /*
   * A cópia é 1:1 em pixels de bitmap. Desligar smoothing evita que o
   * navegador tente suavizar bordas de letras durante a transferência do
   * workerCanvas para o canvas visível.
   */
  context.imageSmoothingEnabled = false;
  context.drawImage(
    source,
    sourceX,
    sourceY,
    sourceCropWidth,
    sourceCropHeight,
    0,
    0,
    targetWidth,
    targetHeight,
  );
  context.restore();
}

async function createImageBitmapFromCanvas(
  canvas: HTMLCanvasElement,
): Promise<ImageBitmap | null> {
  if (typeof globalThis.createImageBitmap !== "function") {
    return null;
  }

  /*
   * Cachear bitmap grande demais duplica memória: canvas visível + ImageBitmap.
   * Em zoom alto, preferimos não cachear e deixar o componente liberar o canvas
   * no unmount.
   */
  if (!canCacheCanvasBitmap(canvas)) {
    canvas.dataset.knexPdfTileCacheSkipped = "bitmap-too-large";
    return null;
  }

  return globalThis.createImageBitmap(canvas);
}

function copyWorkerRenderDiagnostics(input: {
  from: HTMLCanvasElement;
  to: HTMLCanvasElement;
}) {
  /*
   * O PdfJsTileRenderer escreve os diagnósticos no workerCanvas.
   * O usuário, porém, inspeciona o canvas final visível.
   * Sem copiar estes campos, renderText/textFilter aparecem como undefined
   * mesmo quando o renderer experimental está ativo.
   */
  const keys = [
    "knexPdfRenderText",
    "knexPdfCanvasTextFilter",
    "knexPdfCanvasTextFilteredOps",
    "knexPdfCanvasTextTotalOps",
    "knexPdfRequestedOutputScaleX",
    "knexPdfRequestedOutputScaleY",
    "knexPdfOutputScaleX",
    "knexPdfOutputScaleY",
    "knexPdfTileBitmapWidth",
    "knexPdfTileBitmapHeight",
  ] as const;

  for (const key of keys) {
    const value = input.from.dataset[key];

    if (value !== undefined) {
      input.to.dataset[key] = value;
    }
  }
}

function loadImageSource(input: {
  imageUrl: string;
  signal: AbortSignal;
}): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (input.signal.aborted) {
      reject(new DOMException("Server tile request aborted.", "AbortError"));
      return;
    }

    const image = new Image();
    const cleanup = () => {
      input.signal.removeEventListener("abort", handleAbort);
      image.onload = null;
      image.onerror = null;
    };
    const handleAbort = () => {
      cleanup();
      image.src = "";
      reject(new DOMException("Server tile request aborted.", "AbortError"));
    };

    image.decoding = "async";
    image.onload = () => {
      cleanup();
      resolve(image);
    };
    image.onerror = () => {
      cleanup();
      reject(new Error("Server tile image failed to load."));
    };

    input.signal.addEventListener("abort", handleAbort, { once: true });
    image.src = input.imageUrl;
  });
}

function createServerTileRequest(input: {
  documentId: string;
  pdfFileId?: string;
  session: NativePdfSession;
  geometry: KnexPdfPageGeometry;
  tile: KnexPdfPageTile;
  renderPhase: KnexPdfRenderPhase;
}): KnexReadServerTileRequest {
  const dpi = resolveServerTileDpi({
    renderPhase: input.renderPhase,
    zoom: input.geometry.zoom,
  });

  return {
    documentId: input.documentId,
    pdfFileId: input.pdfFileId ?? input.session.id,
    pageNumber: input.geometry.pageNumber,
    zoom: input.geometry.zoom,
    dpi,
    outputScale: Math.min(input.tile.outputScaleX, input.tile.outputScaleY),
    tile: {
      row: input.tile.row,
      column: input.tile.column,
      cssLeft: input.tile.renderCssX,
      cssTop: input.tile.renderCssY,
      cssWidth: input.tile.renderCssWidth,
      cssHeight: input.tile.renderCssHeight,
      overlapPx: input.tile.overlapPx,
    },
    page: {
      cssWidth: input.geometry.cssWidth,
      cssHeight: input.geometry.cssHeight,
      widthPt: input.geometry.baseWidth,
      heightPt: input.geometry.baseHeight,
      rotation: input.geometry.rotation,
    },
    renderPhase: input.renderPhase,
    format: "png",
    quality: 100,
    cachePolicy: "prefer-cache",
  };
}

function writeTileDataset(input: {
  canvas: HTMLCanvasElement;
  geometry: KnexPdfPageGeometry;
  tile: KnexPdfPageTile;
  renderPhase: KnexPdfRenderPhase;
  status: TileStatus;
  cacheStatus: TileCacheStatus;
  backend?: string;
  activeBackend?: string;
  preferredBackend?: string;
  backendVersion?: number;
  renderSource?: TileRenderSource;
  cachedRenderSource?: TileRenderSource;
  renderer?: string;
  generationId?: string;
  renderVersion?: number;
  finalRenderVersion?: number;
  tileRows?: number;
  tileColumns?: number;
  layerSurface?: "active" | "pending";
  layerVisible?: boolean;
  dpi?: number | null;
  storageHit?: boolean;
  fallbackReason?: string;
  renderDurationMs?: number | null;
}) {
  const { canvas, geometry, tile } = input;
  const backend = normalizeBackendName(input.backend);
  const renderSource = input.renderSource ?? "unknown";

  canvas.dataset.knexPdfTile = "true";
  canvas.dataset.knexPdfPageNumber = String(tile.pageNumber);
  canvas.dataset.knexPdfTileId = tile.id;
  canvas.dataset.knexPdfTileRow = String(tile.row);
  canvas.dataset.knexPdfTileColumn = String(tile.column);
  canvas.dataset.knexPdfBackend = backend;
  canvas.dataset.knexPdfActiveBackend = normalizeBackendName(
    input.activeBackend,
  );
  canvas.dataset.knexPdfPreferredBackend = normalizeBackendName(
    input.preferredBackend,
  );
  canvas.dataset.knexPdfBackendVersion =
    typeof input.backendVersion === "number"
      ? String(input.backendVersion)
      : "";
  canvas.dataset.knexPdfRenderSource = renderSource;
  canvas.dataset.knexPdfCachedRenderSource =
    input.cachedRenderSource ?? "";
  canvas.dataset.knexPdfRenderer =
    input.renderer ?? (renderSource === "cache" ? "cache" : backend);
  canvas.dataset.knexPdfRenderPhase = input.renderPhase;
  canvas.dataset.knexPdfOutputScale = String(geometry.outputScale);
  canvas.dataset.knexPdfOutputScaleX = String(tile.outputScaleX);
  canvas.dataset.knexPdfOutputScaleY = String(tile.outputScaleY);
  canvas.dataset.knexPdfTileCssLeft = String(tile.cssX);
  canvas.dataset.knexPdfTileCssTop = String(tile.cssY);
  canvas.dataset.knexPdfTileCssWidth = String(tile.cssWidth);
  canvas.dataset.knexPdfTileCssHeight = String(tile.cssHeight);
  canvas.dataset.knexPdfTileRenderCssLeft = String(tile.renderCssX);
  canvas.dataset.knexPdfTileRenderCssTop = String(tile.renderCssY);
  canvas.dataset.knexPdfTileRenderCssWidth = String(tile.renderCssWidth);
  canvas.dataset.knexPdfTileRenderCssHeight = String(tile.renderCssHeight);
  canvas.dataset.knexPdfTileCellCssLeft = String(tile.cellCssX);
  canvas.dataset.knexPdfTileCellCssTop = String(tile.cellCssY);
  canvas.dataset.knexPdfTileCellCssWidth = String(tile.cellCssWidth);
  canvas.dataset.knexPdfTileCellCssHeight = String(tile.cellCssHeight);
  canvas.dataset.knexPdfTileBleedPx = String(tile.bleedPx);
  canvas.dataset.knexPdfTileBitmapWidth = String(canvas.width || tile.bitmapWidth);
  canvas.dataset.knexPdfTileBitmapHeight = String(
    canvas.height || tile.bitmapHeight,
  );
  canvas.dataset.knexPdfTileStatus = input.status;
  canvas.dataset.knexPdfTileCache = input.cacheStatus;
  canvas.dataset.knexPdfCacheStatus = input.cacheStatus;
  canvas.dataset.knexPdfCache = input.cacheStatus;
  canvas.dataset.knexPdfGenerationId = input.generationId ?? "";
  canvas.dataset.knexPdfTileGenerationId = input.generationId ?? "";
  canvas.dataset.knexPdfRenderVersion =
    typeof input.renderVersion === "number" ? String(input.renderVersion) : "";
  canvas.dataset.knexPdfFinalRenderVersion =
    typeof input.finalRenderVersion === "number"
      ? String(input.finalRenderVersion)
      : "";
  canvas.dataset.knexPdfTileRows =
    typeof input.tileRows === "number" ? String(input.tileRows) : String(tile.tileRows);
  canvas.dataset.knexPdfTileColumns =
    typeof input.tileColumns === "number"
      ? String(input.tileColumns)
      : String(tile.tileColumns);
  canvas.dataset.knexPdfLayerSurface = input.layerSurface ?? "";
  canvas.dataset.knexPdfLayerVisible =
    input.layerVisible === undefined
      ? ""
      : input.layerVisible
        ? "true"
        : "false";
  canvas.dataset.knexPdfTileCacheSize = String(tileBitmapCache.size);
  canvas.dataset.knexPdfTileCacheBytes = String(tileBitmapCache.bytes);
  canvas.dataset.knexPdfTileBitmapBytes = String(canvas.width * canvas.height * 4);
  canvas.dataset.knexPdfTileCacheMaxBytes = String(TILE_BITMAP_CACHE_MAX_BYTES);
  canvas.dataset.knexPdfTileCacheableMaxBytes = String(
    TILE_CACHEABLE_BITMAP_MAX_BYTES,
  );
  canvas.dataset.knexPdfTileRenderDurationMs =
    typeof input.renderDurationMs === "number" &&
    Number.isFinite(input.renderDurationMs)
      ? String(Math.round(input.renderDurationMs))
      : "";
  canvas.dataset.knexPdfRenderDurationMs =
    canvas.dataset.knexPdfTileRenderDurationMs;
  canvas.dataset.knexPdfDpi =
    typeof input.dpi === "number" && Number.isFinite(input.dpi)
      ? String(input.dpi)
      : "";
  canvas.dataset.knexPdfStorageHit = input.storageHit ? "true" : "false";
  canvas.dataset.knexPdfServerTileFallbackReason =
    input.fallbackReason ?? "";
}

export type PdfTileCanvasProps = {
  documentId: string;
  pdfFileId?: string;
  session: NativePdfSession;
  geometry: KnexPdfPageGeometry;
  tile: KnexPdfPageTile;
  renderQuality: string;
  renderPhase: KnexPdfRenderPhase;
  renderText: boolean;
  tileRenderMode: TileRenderMode;
  priority: number;
  backendVersion: number;
  finalRenderVersion: number;
  renderVersion: number;
  generationId: string;
  activeBackend: string;
  preferredBackend: string;
  tileRows: number;
  tileColumns: number;
  layerSurface: "active" | "pending";
  layerVisible: boolean;
  onTileReady?: (tileId: string, generationId: string) => void;

  /**
   * Sinaliza scroll/zoom ativo.
   *
   * Durante interação, este componente deve preservar o bitmap já desenhado
   * e evitar renderizações que concorram com o movimento do palco.
   */
  interactionActive?: boolean;

  /**
   * Quando true, renderizações não essenciais são adiadas durante interação.
   */
  suspendRenderDuringInteraction?: boolean;
};

export function PdfTileCanvas({
  documentId,
  pdfFileId,
  session,
  geometry,
  tile,
  renderQuality,
  renderPhase,
  renderText,
  tileRenderMode,
  priority,
  backendVersion,
  finalRenderVersion,
  renderVersion,
  generationId,
  activeBackend,
  preferredBackend,
  tileRows,
  tileColumns,
  layerSurface,
  layerVisible,
  onTileReady,
  interactionActive = false,
  suspendRenderDuringInteraction = true,
}: PdfTileCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const hasDrawnBitmapRef = useRef(false);
  const [status, setStatus] = useState<TileStatus>("idle");
  const [cacheStatus, setCacheStatus] = useState<TileCacheStatus>("miss");
  const [renderDurationMs, setRenderDurationMs] = useState<number | null>(null);
  const requestedRenderSource = getRequestedRenderSource(tileRenderMode);
  const requestedRenderer = getRequestedRenderer(tileRenderMode);
  const requestedBackend =
    tileRenderMode === "server-tiled" ? "server-tiled" : "pdfjs";

  const statusRef = useRef<TileStatus>("idle");
  const cacheStatusRef = useRef<TileCacheStatus>("miss");
  const renderDurationMsRef = useRef<number | null>(null);
  const lastReadyGenerationRef = useRef<string | null>(null);

  const tileCacheKey = useMemo(
    () =>
      createTileCacheKey({
        documentId,
        geometry,
        tile,
        renderQuality,
        renderPhase,
        renderText,
        backend: requestedBackend,
        activeBackend,
        renderSource: requestedRenderSource,
        renderer: requestedRenderer,
        backendVersion,
        tileRows,
        tileColumns,
      }),
    [
      activeBackend,
      backendVersion,
      documentId,
      geometry,
      renderPhase,
      renderQuality,
      renderText,
      requestedBackend,
      requestedRenderer,
      requestedRenderSource,
      tile,
      tileColumns,
      tileRows,
    ],
  );

  const setTileStatus = (next: TileStatus) => {
    if (statusRef.current === next) return;

    statusRef.current = next;
    setStatus(next);
  };

  const setTileCacheStatus = (next: TileCacheStatus) => {
    if (cacheStatusRef.current === next) return;

    cacheStatusRef.current = next;
    setCacheStatus(next);
  };

  const setTileRenderDurationMs = (next: number | null) => {
    if (renderDurationMsRef.current === next) return;

    renderDurationMsRef.current = next;
    setRenderDurationMs(next);
  };

  /*
   * Liberação de bitmap apenas no unmount real.
   *
   * Antes, o cleanup do efeito principal chamava releaseCanvasBitmap(canvas).
   * Como o efeito depende de geração/renderPhase/layerVisible, isso podia
   * apagar o bitmap antigo durante scroll/zoom antes do novo tile ficar pronto,
   * gerando a percepção de renderização saltada.
   */
  useEffect(() => {
    return () => {
      releaseCanvasBitmap(canvasRef.current);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    const abortController = new AbortController();
    const cacheKey = tileCacheKey;
    const rawCachedTile = tileBitmapCache.get(cacheKey);
    const cachedTile =
      rawCachedTile &&
      shouldAcceptCachedTileForMode({
        tileRenderMode,
        cachedTile: rawCachedTile,
      })
        ? rawCachedTile
        : null;

    if (rawCachedTile && !cachedTile) {
      tileBitmapCache.delete(rawCachedTile.key);
    }

    const shouldDeferRenderDuringInteraction =
      interactionActive &&
      suspendRenderDuringInteraction &&
      !cachedTile &&
      (
        layerSurface === "pending" ||
        !layerVisible ||
        hasDrawnBitmapRef.current
      );

    if (shouldDeferRenderDuringInteraction) {
      writeTileDataset({
        canvas,
        geometry,
        tile,
        renderPhase,
        status: hasDrawnBitmapRef.current ? "ready" : "idle",
        cacheStatus: rawCachedTile ? "discarded" : "miss",
        backend: requestedBackend,
        activeBackend,
        preferredBackend,
        backendVersion,
        renderSource: requestedRenderSource,
        renderer: requestedRenderer,
        generationId,
        renderVersion,
        finalRenderVersion,
        tileRows,
        tileColumns,
        layerSurface,
        layerVisible,
        fallbackReason: "deferred-during-scroll-zoom-interaction",
        renderDurationMs: renderDurationMsRef.current,
      });

      /*
       * Não iniciar renderização nova durante o movimento. Se já existe bitmap,
       * ele permanece visível; se for pending invisível, renderiza só no settle.
       */
      return () => {
        cancelled = true;
        abortController.abort();
      };
    }

    writeTileDataset({
      canvas,
      geometry,
      tile,
      renderPhase,
      status: cachedTile ? "ready" : "rendering",
      cacheStatus: cachedTile ? "hit" : rawCachedTile ? "discarded" : "miss",
      backend: cachedTile?.backend ?? requestedBackend,
      activeBackend,
      preferredBackend,
      backendVersion,
      renderSource: cachedTile ? "cache" : requestedRenderSource,
      cachedRenderSource: cachedTile?.renderSource,
      renderer: cachedTile?.renderer ?? requestedRenderer,
      generationId,
      renderVersion,
      finalRenderVersion,
      tileRows,
      tileColumns,
      layerSurface,
      layerVisible,
      dpi: cachedTile?.dpi,
      storageHit: cachedTile?.storageHit,
      renderDurationMs: cachedTile?.renderDurationMs,
      fallbackReason: rawCachedTile && !cachedTile
        ? "discarded-non-server-cache-for-server-layer"
        : undefined,
    });

    if (cachedTile) {
      try {
        drawTileSourceToCanvas({
          source: cachedTile.bitmap,
          sourceWidth: cachedTile.bitmap.width,
          sourceHeight: cachedTile.bitmap.height,
          canvas,
        });
        hasDrawnBitmapRef.current = true;

        setTileRenderDurationMs(cachedTile.renderDurationMs);
        setTileCacheStatus("hit");
        setTileStatus("ready");

        writeTileDataset({
          canvas,
          geometry,
          tile,
          renderPhase,
          status: "ready",
          cacheStatus: "hit",
          backend: cachedTile.backend,
          activeBackend,
          preferredBackend,
          backendVersion,
          renderSource: "cache",
          cachedRenderSource: cachedTile.renderSource,
          renderer: cachedTile.renderer,
          generationId,
          renderVersion,
          finalRenderVersion,
          tileRows,
          tileColumns,
          layerSurface,
          layerVisible,
          dpi: cachedTile.dpi,
          storageHit: cachedTile.storageHit,
          renderDurationMs: cachedTile.renderDurationMs,
        });
        if (lastReadyGenerationRef.current !== generationId) {
          lastReadyGenerationRef.current = generationId;
          onTileReady?.(tile.id, generationId);
        }

        return () => {
          cancelled = true;
          abortController.abort();
        };
      } catch {
        tileBitmapCache.delete(cachedTile.key);
        setTileCacheStatus("discarded");
      }
    }

    setTileCacheStatus("miss");
    setTileStatus("rendering");

    const renderLocalTile = async (fallbackReason?: string) => {
      const workerCanvas = document.createElement("canvas");

      try {
        const renderedTile = await tileRenderScheduler.enqueue({
          priority,
          signal: abortController.signal,
          run: () =>
            renderKnexPdfTileToCanvas({
              documentId,
              session,
              pageNumber: geometry.pageNumber,
              canvas: workerCanvas,
              geometry,
              tile,
              renderPhase,
              renderText,
              signal: abortController.signal,
            }),
        });

        if (cancelled || abortController.signal.aborted) return;

        /*
         * O workerCanvas contém a região renderizada, que pode incluir
         * bleed/overscan. O canvas visível deve receber apenas a célula
         * visual do tile. Isso evita sobreposição, desalinhamento e texto
         * truncado nas emendas.
         */
        drawTileSourceToCanvas({
          source: workerCanvas,
          sourceWidth: workerCanvas.width,
          sourceHeight: workerCanvas.height,
          canvas,
          tile,
          cropToVisibleCell: true,
        });
        copyWorkerRenderDiagnostics({
          from: workerCanvas,
          to: canvas,
        });
        hasDrawnBitmapRef.current = true;

        const bitmapForCache = await createImageBitmapFromCanvas(canvas);

        if (cancelled || abortController.signal.aborted) {
          try {
            bitmapForCache?.close();
          } catch {
            // Ignore cleanup failures after cancellation.
          }
          return;
        }

        if (bitmapForCache) {
          tileBitmapCache.set(
            cacheKey,
            {
              bitmap: bitmapForCache,
              renderDurationMs: renderedTile.renderDurationMs,
              backend: "pdfjs",
              renderSource: "pdfjs",
              renderer: "pdfjs-tile-canvas",
              key: cacheKey,
            },
            bitmapForCache.width * bitmapForCache.height * 4,
          );

          setTileCacheStatus("stored");
          canvas.dataset.knexPdfTileCacheKey = cacheKey;
        } else {
          setTileCacheStatus("miss");
        }

        setTileRenderDurationMs(renderedTile.renderDurationMs);
        setTileStatus("ready");

        writeTileDataset({
          canvas,
          geometry,
          tile,
          renderPhase,
          status: "ready",
          cacheStatus: bitmapForCache ? "stored" : "miss",
          backend: "pdfjs",
          activeBackend,
          preferredBackend,
          backendVersion,
          renderSource: "pdfjs",
          renderer: "pdfjs-tile-canvas",
          generationId,
          renderVersion,
          finalRenderVersion,
          tileRows,
          tileColumns,
          layerSurface,
          layerVisible,
          fallbackReason,
          renderDurationMs: renderedTile.renderDurationMs,
        });
        if (lastReadyGenerationRef.current !== generationId) {
          lastReadyGenerationRef.current = generationId;
          onTileReady?.(tile.id, generationId);
        }

        if (isTileDebugEnabled()) {
          // eslint-disable-next-line no-console
          console.debug("[KnexPDF][TileCanvas]", {
            tileId: tile.id,
            status: "ready",
            cache: canvas.dataset.knexPdfTileCache,
            bitmapWidth: canvas.width,
            bitmapHeight: canvas.height,
            backend: canvas.dataset.knexPdfBackend,
          });
        }
      } finally {
        releaseCanvasBitmap(workerCanvas);
      }
    };

    const renderServerTile = async (): Promise<boolean> => {
      const response = await requestServerRenderedTile({
        request: createServerTileRequest({
          documentId,
          pdfFileId,
          session,
          geometry,
          tile,
          renderPhase,
        }),
        signal: abortController.signal,
      });

      if (!isServerTileReadyResponse(response)) {
        const fallbackResponse = asServerTileFallbackResponse(response);
        const fallbackReason = getServerTileFailureReason(fallbackResponse);

        /*
         * Regra crítica:
         * Não renderizar fallback local dentro de uma geração server-tiled.
         *
         * Antes, quando um tile server falhava, este componente renderizava
         * PDF.js local e chamava onTileReady. Isso fazia a camada server ser
         * promovida como se estivesse pronta, embora os canvases reais fossem
         * pdfjs/cache. Resultado: frameSource=server, mas filhos pdfjs/cache,
         * visibleCanvasCount=64 e qualidade irregular.
         *
         * Agora o tile server falho fica em erro e NÃO chama onTileReady.
         * O parent/circuit breaker deve invalidar a geração server e montar
         * uma geração local tiled-canvas inteira, sem mistura por tile.
         */
        canvas.dataset.knexPdfServerTileFallbackReason = fallbackReason;
        canvas.dataset.knexPdfServerTileFallback = fallbackResponse.fallback;

        writeTileDataset({
          canvas,
          geometry,
          tile,
          renderPhase,
          status: "error",
          cacheStatus: "miss",
          backend: requestedBackend,
          activeBackend,
          preferredBackend,
          backendVersion,
          renderSource: "server",
          renderer: requestedRenderer,
          generationId,
          renderVersion,
          finalRenderVersion,
          tileRows,
          tileColumns,
          layerSurface,
          layerVisible,
          fallbackReason,
          renderDurationMs: null,
        });

        setTileCacheStatus("miss");
        setTileStatus("error");

        return false;
      }

      const image = await loadImageSource({
        imageUrl: response.imageUrl,
        signal: abortController.signal,
      });

      if (cancelled || abortController.signal.aborted) return false;

      const serverRenderSource = getServerRenderSource(response.backend);
      const serverRenderer = normalizeBackendName(response.backend);

      drawTileSourceToCanvas({
        source: image,
        sourceWidth: response.width || image.naturalWidth,
        sourceHeight: response.height || image.naturalHeight,
        canvas,
        tile,
        cropToVisibleCell: true,
      });
      hasDrawnBitmapRef.current = true;

      const bitmapForCache = await createImageBitmapFromCanvas(canvas);

      /*
       * Depois de desenhar no canvas, a referência do HTMLImageElement não
       * precisa manter o recurso vivo.
       */
      image.src = "";
      safeRevokeObjectUrl(response.imageUrl);

      if (bitmapForCache && !cancelled && !abortController.signal.aborted) {
        tileBitmapCache.set(
          cacheKey,
          {
            bitmap: bitmapForCache,
            renderDurationMs: response.renderDurationMs,
            backend: response.backend,
            renderSource: serverRenderSource,
            renderer: serverRenderer,
            dpi: response.dpi,
            storageHit: response.storageHit ?? response.fromCache,
            key: cacheKey,
          },
          bitmapForCache.width * bitmapForCache.height * 4,
        );
      } else if (bitmapForCache) {
        try {
          bitmapForCache.close();
        } catch {
          // Ignore cleanup failures after cancellation.
        }
      }

      setTileRenderDurationMs(response.renderDurationMs);
      setCacheStatus(response.fromCache ? "hit" : "stored");
      setTileStatus("ready");

      writeTileDataset({
        canvas,
        geometry,
        tile,
        renderPhase,
        status: "ready",
        cacheStatus: response.fromCache ? "hit" : "stored",
        backend: response.backend,
        activeBackend,
        preferredBackend,
        backendVersion,
        renderSource: serverRenderSource,
        renderer: serverRenderer,
        generationId,
        renderVersion,
        finalRenderVersion,
        tileRows,
        tileColumns,
        layerSurface,
        layerVisible,
        dpi: response.dpi,
        storageHit: response.storageHit ?? response.fromCache,
        renderDurationMs: response.renderDurationMs,
      });
      canvas.dataset.knexPdfTileCacheKey = response.cacheKey;
      canvas.dataset.knexPdfTileImageUrl = response.imageUrl;
      onTileReady?.(tile.id, generationId);

      return true;
    };

    (async () => {
      try {
        if (tileRenderMode === "server-tiled") {
          await renderServerTile();
          return;
        }

        await renderLocalTile();
      } catch (error) {
        if (cancelled || abortController.signal.aborted) {
          writeTileDataset({
            canvas,
            geometry,
            tile,
            renderPhase,
            status: "cancelled",
            cacheStatus: "miss",
            backend: requestedBackend,
            activeBackend,
            preferredBackend,
            backendVersion,
            renderSource: requestedRenderSource,
            renderer: requestedRenderer,
            generationId,
            renderVersion,
            finalRenderVersion,
            tileRows,
            tileColumns,
            layerSurface,
            layerVisible,
            renderDurationMs: null,
          });
          setTileStatus("cancelled");
          return;
        }

        canvas.dataset.knexPdfTileError =
          error instanceof Error ? error.message : "Tile render failed.";

        writeTileDataset({
          canvas,
          geometry,
          tile,
          renderPhase,
          status: "error",
          cacheStatus: "miss",
          backend: requestedBackend,
          activeBackend,
          preferredBackend,
          backendVersion,
          renderSource: requestedRenderSource,
          renderer: requestedRenderer,
          generationId,
          renderVersion,
          finalRenderVersion,
          tileRows,
          tileColumns,
          layerSurface,
          layerVisible,
          renderDurationMs: null,
        });
        setTileStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [
    activeBackend,
    backendVersion,
    finalRenderVersion,
    generationId,
    geometry,
    interactionActive,
    layerSurface,
    layerVisible,
    onTileReady,
    pdfFileId,
    preferredBackend,
    priority,
    renderPhase,
    renderVersion,
    requestedBackend,
    requestedRenderer,
    requestedRenderSource,
    session,
    suspendRenderDuringInteraction,
    tile,
    tileCacheKey,
    tileColumns,
    tileRenderMode,
    tileRows,
  ]);

  return (
    <div
      className="absolute block overflow-hidden bg-white"
      data-knex-pdf-tile-wrapper="true"
      data-knex-pdf-page-number={tile.pageNumber}
      data-knex-pdf-tile-row={tile.row}
      data-knex-pdf-tile-column={tile.column}
      data-knex-pdf-generation-id={generationId}
      data-knex-pdf-layer-surface={layerSurface}
      data-knex-pdf-layer-visible={layerVisible ? "true" : "false"}
      data-knex-pdf-tile-interaction-active={
        interactionActive ? "true" : "false"
      }
      data-knex-pdf-tile-suspend-during-interaction={
        suspendRenderDuringInteraction ? "true" : "false"
      }
      style={{
        left: `${tile.cellCssX}px`,
        top: `${tile.cellCssY}px`,
        width: `${tile.cellCssWidth}px`,
        height: `${tile.cellCssHeight}px`,
        pointerEvents: "none",
        visibility: layerVisible ? "visible" : "hidden",
        zIndex: layerVisible ? 2 : 0,
        outline: isTileDebugEnabled() ? "1px solid rgb(244 63 94)" : "none",
      }}
      aria-hidden="true"
    >
      <canvas
        ref={canvasRef}
        className="absolute block bg-white"
        data-knex-pdf-tile="true"
        data-knex-pdf-page-number={tile.pageNumber}
        data-knex-pdf-tile-id={tile.id}
        data-knex-pdf-tile-row={tile.row}
        data-knex-pdf-tile-column={tile.column}
        data-knex-pdf-backend={requestedBackend}
        data-knex-pdf-active-backend={activeBackend || "unknown"}
        data-knex-pdf-preferred-backend={preferredBackend || "unknown"}
        data-knex-pdf-backend-version={backendVersion}
        data-knex-pdf-render-source={requestedRenderSource}
        data-knex-pdf-renderer={requestedRenderer}
        data-knex-pdf-render-phase={renderPhase}
        data-knex-pdf-render-text={renderText ? "true" : "false"}
        data-knex-pdf-output-scale={geometry.outputScale}
        data-knex-pdf-output-scale-x={tile.outputScaleX}
        data-knex-pdf-output-scale-y={tile.outputScaleY}
        data-knex-pdf-dpi=""
        data-knex-pdf-tile-status={status}
        data-knex-pdf-tile-cache={cacheStatus}
        data-knex-pdf-cache-status={cacheStatus}
        data-knex-pdf-cache={cacheStatus}
        data-knex-pdf-storage-hit="false"
        data-knex-pdf-generation-id={generationId}
        data-knex-pdf-tile-generation-id={generationId}
        data-knex-pdf-render-version={renderVersion}
        data-knex-pdf-final-render-version={finalRenderVersion}
        data-knex-pdf-tile-rows={tileRows}
        data-knex-pdf-tile-columns={tileColumns}
        data-knex-pdf-layer-surface={layerSurface}
        data-knex-pdf-layer-visible={layerVisible ? "true" : "false"}
        data-knex-pdf-tile-interaction-active={
          interactionActive ? "true" : "false"
        }
        data-knex-pdf-tile-suspend-during-interaction={
          suspendRenderDuringInteraction ? "true" : "false"
        }
        data-knex-pdf-tile-css-left={tile.cssX}
        data-knex-pdf-tile-css-top={tile.cssY}
        data-knex-pdf-tile-css-width={tile.cssWidth}
        data-knex-pdf-tile-css-height={tile.cssHeight}
        data-knex-pdf-tile-render-css-left={tile.renderCssX}
        data-knex-pdf-tile-render-css-top={tile.renderCssY}
        data-knex-pdf-tile-render-css-width={tile.renderCssWidth}
        data-knex-pdf-tile-render-css-height={tile.renderCssHeight}
        data-knex-pdf-tile-cell-css-left={tile.cellCssX}
        data-knex-pdf-tile-cell-css-top={tile.cellCssY}
        data-knex-pdf-tile-cell-css-width={tile.cellCssWidth}
        data-knex-pdf-tile-cell-css-height={tile.cellCssHeight}
        data-knex-pdf-tile-bleed-px={tile.bleedPx}
        data-knex-pdf-tile-bitmap-width={tile.bitmapWidth}
        data-knex-pdf-tile-bitmap-height={tile.bitmapHeight}
        data-knex-pdf-tile-visible-max-pixels={TILE_VISIBLE_CANVAS_MAX_PIXELS}
        data-knex-pdf-tile-visible-max-side={TILE_VISIBLE_CANVAS_MAX_SIDE}
        data-knex-pdf-tile-cacheable-max-bytes={TILE_CACHEABLE_BITMAP_MAX_BYTES}
        data-knex-pdf-tile-render-duration-ms={
          renderDurationMs !== null ? Math.round(renderDurationMs) : ""
        }
        data-knex-pdf-render-duration-ms={
          renderDurationMs !== null ? Math.round(renderDurationMs) : ""
        }
        style={{
          left: "0px",
          top: "0px",
          width: `${tile.cellCssWidth}px`,
          height: `${tile.cellCssHeight}px`,
          backgroundColor: "#ffffff",
          imageRendering: "auto",
          pointerEvents: "none",
          transform: "none",
          transformOrigin: "0 0",
          willChange: "auto",
          visibility:
            status === "ready" || hasDrawnBitmapRef.current
              ? "visible"
              : "hidden",
        }}
      />
    </div>
  );
}
