"use client";

import { useEffect, useRef, useState } from "react";
import type { NativePdfSession } from "../../services";
import {
  createKnexPdfTileCacheKey,
  createKnexPdfZoomBucket,
  renderKnexPdfTileToCanvas,
  requestServerRenderedTile,
  runKnexPdfRenderTask,
  TileBitmapCache,
  type KnexReadServerTileFallbackResponse,
  type KnexReadServerTileRequest,
  type KnexReadServerTileResponse,
  type KnexReadServerTileReadyResponse,
  type KnexPdfPageGeometry,
  type KnexPdfPageTile,
  type KnexPdfRenderedTile,
  type KnexPdfRenderPhase,
} from "../../knex-pdf-engine";

type TileStatus = "idle" | "rendering" | "ready" | "error" | "cancelled";
type TileCacheStatus = "hit" | "miss" | "stored" | "discarded";
type TileRenderMode = "server-tiled" | "tiled-canvas" | "page-canvas";

type CachedTileBitmap = {
  bitmap: ImageBitmap;
  renderedTile: KnexPdfRenderedTile;
  key: string;
};

const TILE_BITMAP_CACHE_MAX_ENTRIES = 256;
const TILE_BITMAP_CACHE_MAX_BYTES = 256 * 1024 * 1024;

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

function getTileRenderMode(renderText: boolean): string {
  return renderText ? "bitmap-only" : "hybrid-visual";
}

function resolveServerTileDpi(renderPhase: KnexPdfRenderPhase): number {
  if (renderPhase === "settled-final") return 240;
  if (renderPhase === "warmup-preview") return 180;
  return 150;
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
  backendVersion: number;
  finalRenderVersion: number;
}) {
  return [
    createKnexPdfTileCacheKey({
      documentId: input.documentId,
      pageNumber: input.geometry.pageNumber,
      row: input.tile.row,
      column: input.tile.column,
      cssLeft: input.tile.cssX,
      cssTop: input.tile.cssY,
      cssWidth: input.tile.cssWidth,
      cssHeight: input.tile.cssHeight,
      zoomBucket: createKnexPdfZoomBucket(input.geometry.zoom),
      outputScale: Math.min(input.tile.outputScaleX, input.tile.outputScaleY),
      renderPhase: input.renderPhase,
      renderVersion: input.finalRenderVersion,
      finalRenderVersion: input.finalRenderVersion,
      backend: "pdfjs",
      rotation: input.geometry.rotation,
    }),
    `q=${input.renderQuality}`,
    `mode=${getTileRenderMode(input.renderText)}`,
    `backend=${input.backend}`,
    `bv=${input.backendVersion}`,
  ].join("|");
}

function drawTileSourceToCanvas(input: {
  source: CanvasImageSource;
  sourceWidth: number;
  sourceHeight: number;
  canvas: HTMLCanvasElement;
}) {
  const { source, sourceWidth, sourceHeight, canvas } = input;

  canvas.width = Math.max(1, Math.ceil(sourceWidth));
  canvas.height = Math.max(1, Math.ceil(sourceHeight));
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
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(source, 0, 0);
  context.restore();
}

async function createImageBitmapFromCanvas(
  canvas: HTMLCanvasElement,
): Promise<ImageBitmap | null> {
  if (typeof globalThis.createImageBitmap !== "function") {
    return null;
  }

  return globalThis.createImageBitmap(canvas);
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
  const dpi = resolveServerTileDpi(input.renderPhase);

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
      cssLeft: input.tile.cssX,
      cssTop: input.tile.cssY,
      cssWidth: input.tile.cssWidth,
      cssHeight: input.tile.cssHeight,
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
    format: "webp",
    quality: 92,
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
  dpi?: number | null;
  storageHit?: boolean;
  fallbackReason?: string;
  renderDurationMs?: number | null;
}) {
  const { canvas, geometry, tile } = input;

  canvas.dataset.knexPdfTile = "true";
  canvas.dataset.knexPdfPageNumber = String(tile.pageNumber);
  canvas.dataset.knexPdfTileId = tile.id;
  canvas.dataset.knexPdfTileRow = String(tile.row);
  canvas.dataset.knexPdfTileColumn = String(tile.column);
  canvas.dataset.knexPdfBackend = input.backend ?? "pdfjs";
  canvas.dataset.knexPdfRenderPhase = input.renderPhase;
  canvas.dataset.knexPdfOutputScale = String(geometry.outputScale);
  canvas.dataset.knexPdfOutputScaleX = String(tile.outputScaleX);
  canvas.dataset.knexPdfOutputScaleY = String(tile.outputScaleY);
  canvas.dataset.knexPdfTileCssLeft = String(tile.cssX);
  canvas.dataset.knexPdfTileCssTop = String(tile.cssY);
  canvas.dataset.knexPdfTileCssWidth = String(tile.cssWidth);
  canvas.dataset.knexPdfTileCssHeight = String(tile.cssHeight);
  canvas.dataset.knexPdfTileBitmapWidth = String(canvas.width || tile.bitmapWidth);
  canvas.dataset.knexPdfTileBitmapHeight = String(
    canvas.height || tile.bitmapHeight,
  );
  canvas.dataset.knexPdfTileStatus = input.status;
  canvas.dataset.knexPdfTileCache = input.cacheStatus;
  canvas.dataset.knexPdfCache = input.cacheStatus;
  canvas.dataset.knexPdfTileCacheSize = String(tileBitmapCache.size);
  canvas.dataset.knexPdfTileCacheBytes = String(tileBitmapCache.bytes);
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
  generationId: string;
  onTileReady?: (tileId: string, generationId: string) => void;
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
  generationId,
  onTileReady,
}: PdfTileCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<TileStatus>("idle");
  const [cacheStatus, setCacheStatus] = useState<TileCacheStatus>("miss");
  const [renderDurationMs, setRenderDurationMs] = useState<number | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    const abortController = new AbortController();
    const cacheKey = createTileCacheKey({
      documentId,
      geometry,
      tile,
      renderQuality,
      renderPhase,
      renderText,
      backend: "pdfjs",
      backendVersion,
      finalRenderVersion,
    });
    const cachedTile =
      tileRenderMode === "server-tiled" ? undefined : tileBitmapCache.get(cacheKey);

    writeTileDataset({
      canvas,
      geometry,
      tile,
      renderPhase,
      status: cachedTile ? "ready" : "rendering",
      cacheStatus: cachedTile ? "hit" : "miss",
      backend: tileRenderMode === "server-tiled" ? "server-tiled" : "pdfjs",
      renderDurationMs: cachedTile?.renderedTile.renderDurationMs,
    });

    if (cachedTile) {
      try {
        drawTileSourceToCanvas({
          source: cachedTile.bitmap,
          sourceWidth: cachedTile.bitmap.width,
          sourceHeight: cachedTile.bitmap.height,
          canvas,
        });

        setRenderDurationMs(cachedTile.renderedTile.renderDurationMs);
        setCacheStatus("hit");
        setStatus("ready");

        writeTileDataset({
          canvas,
          geometry,
          tile,
          renderPhase,
          status: "ready",
          cacheStatus: "hit",
          backend: "pdfjs",
          renderDurationMs: cachedTile.renderedTile.renderDurationMs,
        });
        onTileReady?.(tile.id, generationId);

        return () => {
          cancelled = true;
          abortController.abort();
        };
      } catch {
        tileBitmapCache.delete(cachedTile.key);
        setCacheStatus("discarded");
      }
    }

    setCacheStatus("miss");
    setStatus("rendering");

    const renderLocalTile = async (fallbackReason?: string) => {
      const workerCanvas = document.createElement("canvas");

      try {
        const renderedTile = await runKnexPdfRenderTask({
          backend: "pdfjs",
          priority,
          signal: abortController.signal,
          task: () =>
            renderKnexPdfTileToCanvas({
              documentId,
              session,
              pageNumber: geometry.pageNumber,
              canvas: workerCanvas,
              geometry,
              tile,
              renderPhase,
              signal: abortController.signal,
            }),
        });

        if (cancelled || abortController.signal.aborted) return;

        const bitmapForCache = await createImageBitmapFromCanvas(workerCanvas);

        if (cancelled || abortController.signal.aborted) {
          try {
            bitmapForCache?.close();
          } catch {
            // Ignore cleanup failures after cancellation.
          }
          return;
        }

        if (bitmapForCache) {
          drawTileSourceToCanvas({
            source: bitmapForCache,
            sourceWidth: bitmapForCache.width,
            sourceHeight: bitmapForCache.height,
            canvas,
          });

          tileBitmapCache.set(
            cacheKey,
            {
              bitmap: bitmapForCache,
              renderedTile,
              key: cacheKey,
            },
            bitmapForCache.width * bitmapForCache.height * 4,
          );

          setCacheStatus("stored");
          canvas.dataset.knexPdfTileCacheKey = cacheKey;
        } else {
          drawTileSourceToCanvas({
            source: workerCanvas,
            sourceWidth: workerCanvas.width,
            sourceHeight: workerCanvas.height,
            canvas,
          });

          setCacheStatus("miss");
        }

        setRenderDurationMs(renderedTile.renderDurationMs);
        setStatus("ready");

        writeTileDataset({
          canvas,
          geometry,
          tile,
          renderPhase,
          status: "ready",
          cacheStatus: bitmapForCache ? "stored" : "miss",
          backend: "pdfjs",
          fallbackReason,
          renderDurationMs: renderedTile.renderDurationMs,
        });
        onTileReady?.(tile.id, generationId);

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
        workerCanvas.width = 0;
        workerCanvas.height = 0;
      }
    };

    const renderServerTile = async (): Promise<string | null> => {
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
        canvas.dataset.knexPdfServerTileFallbackReason =
          fallbackResponse.reason;
        canvas.dataset.knexPdfServerTileFallback =
          fallbackResponse.fallback;
        return fallbackResponse.reason;
      }

      const image = await loadImageSource({
        imageUrl: response.imageUrl,
        signal: abortController.signal,
      });

      if (cancelled || abortController.signal.aborted) return null;

      drawTileSourceToCanvas({
        source: image,
        sourceWidth: response.width || image.naturalWidth,
        sourceHeight: response.height || image.naturalHeight,
        canvas,
      });

      setRenderDurationMs(response.renderDurationMs);
      setCacheStatus(response.fromCache ? "hit" : "stored");
      setStatus("ready");

      writeTileDataset({
        canvas,
        geometry,
        tile,
        renderPhase,
        status: "ready",
        cacheStatus: response.fromCache ? "hit" : "stored",
        backend: response.backend,
        dpi: response.dpi,
        storageHit: response.storageHit ?? response.fromCache,
        renderDurationMs: response.renderDurationMs,
      });
      canvas.dataset.knexPdfTileCacheKey = response.cacheKey;
      canvas.dataset.knexPdfTileImageUrl = response.imageUrl;
      onTileReady?.(tile.id, generationId);

      return null;
    };

    (async () => {
      try {
        if (tileRenderMode === "server-tiled") {
          const fallbackReason = await renderServerTile();

          if (fallbackReason === null) {
            return;
          }

          if (cancelled || abortController.signal.aborted) {
            return;
          }

          await renderLocalTile(fallbackReason);
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
            backend: tileRenderMode === "server-tiled" ? "server-tiled" : "pdfjs",
            renderDurationMs: null,
          });
          setStatus("cancelled");
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
          backend: tileRenderMode === "server-tiled" ? "server-tiled" : "pdfjs",
          renderDurationMs: null,
        });
        setStatus("error");
      }
    })();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [
    backendVersion,
    documentId,
    pdfFileId,
    finalRenderVersion,
    generationId,
    geometry,
    onTileReady,
    priority,
    renderPhase,
    renderQuality,
    renderText,
    session,
    tile,
    tileRenderMode,
  ]);

  return (
    <canvas
      ref={canvasRef}
      className="absolute block bg-white"
      data-knex-pdf-tile="true"
      data-knex-pdf-page-number={tile.pageNumber}
      data-knex-pdf-tile-id={tile.id}
      data-knex-pdf-tile-row={tile.row}
      data-knex-pdf-tile-column={tile.column}
      data-knex-pdf-backend={
        tileRenderMode === "server-tiled" ? "server-tiled" : "pdfjs"
      }
      data-knex-pdf-render-phase={renderPhase}
      data-knex-pdf-output-scale={geometry.outputScale}
      data-knex-pdf-dpi=""
      data-knex-pdf-tile-status={status}
      data-knex-pdf-tile-cache={cacheStatus}
      data-knex-pdf-cache={cacheStatus}
      data-knex-pdf-storage-hit="false"
      data-knex-pdf-tile-generation-id={generationId}
      data-knex-pdf-tile-render-duration-ms={
        renderDurationMs !== null ? Math.round(renderDurationMs) : ""
      }
      data-knex-pdf-render-duration-ms={
        renderDurationMs !== null ? Math.round(renderDurationMs) : ""
      }
      style={{
        left: `${tile.cssX}px`,
        top: `${tile.cssY}px`,
        width: `${tile.cssWidth}px`,
        height: `${tile.cssHeight}px`,
        backgroundColor: "#ffffff",
        imageRendering: "auto",
        pointerEvents: "none",
        transform: "none",
        transformOrigin: "0 0",
        willChange: "auto",
        visibility: status === "ready" ? "visible" : "hidden",
        zIndex: 2,
        outline: isTileDebugEnabled() ? "1px solid rgb(244 63 94)" : "none",
      }}
      aria-hidden="true"
    />
  );
}
