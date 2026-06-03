"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PdfRenderQualityMode } from "../../types";
import type { NativePdfSession } from "../../services";
import {
  buildKnexPdfPageGeometry,
  buildKnexPdfTileRenderPlan,
  resolveRenderQualityForPhase,
  useKnexPdfEngineState,
  type KnexPdfVisualRenderMode,
  type KnexPdfPageGeometry,
  type KnexPdfPageTile,
  type KnexPdfRenderPhase,
  type KnexPdfRenderedPage as RenderedPdfPage,
} from "../../knex-pdf-engine";
import {
  SERVER_TILE_CIRCUIT_BREAKER_EVENT,
  getServerTileCircuitBreakerState,
  getServerTileCircuitOpenReason,
  isServerTileCircuitBreakerOpen,
} from "../../knex-pdf-engine/server-tiles/requestServerRenderedTile";
import { resolveServerTileFallbackPolicy } from "../../knex-pdf-engine/server-tiles/serverTileFallbackPolicy";
import type {
  PdfTiledVisualPageProps,
  PdfTileRenderState,
} from "./PdfTileCanvasTypes";
import { TileRenderDiagnostics } from "./TileRenderDiagnostics";
import {
  TileViewportObserver,
  type TileViewportSnapshot,
} from "./TileViewportObserver";
import { PdfTileLayer } from "./PdfTileLayer";

type PdfPageBaseSize = {
  width: number;
  height: number;
};

type PdfPageWithViewport = {
  getViewport: (params: { scale: number }) => {
    width: number;
    height: number;
    scale: number;
  };
};

type TileLayerSnapshot = {
  id: string;
  geometry: KnexPdfPageGeometry;
  tiles: KnexPdfPageTile[];
  renderQuality: PdfRenderQualityMode;
  renderPhase: KnexPdfRenderPhase;
  tileRenderMode: "server-tiled" | "tiled-canvas";
  backendVersion: number;
  finalRenderVersion: number;
  renderVersion: number;
  activeBackend: string;
  preferredBackend: string;
  tileSizeCss: number;
  tileRows: number;
  tileColumns: number;
  overlapPx: number;
  bleedPx: number;
};

export type PdfTiledPageCanvasProps = PdfTiledVisualPageProps & {
  /**
   * Zoom visual/interativo.
   *
   * Muda imediatamente durante wheel/zoom e serve apenas para escala visual da
   * camada já ativa e para o tamanho externo do frame.
   */
  visualZoom?: number;

  /**
   * Zoom de renderização pesada.
   *
   * Só deve mudar depois que o gesto estabiliza. É usado para geometria real,
   * tiles, cacheKey, generationId e bitmap.
   */
  renderZoom?: number;

  /**
   * Razão visual/render já calculada pelo PdfPageView.
   * Quando ausente, é recalculada localmente.
   */
  visualToRenderScaleRatio?: number;

  visualRenderMode?: KnexPdfVisualRenderMode;
  pdfFileId?: string;
};

const FALLBACK_PAGE_WIDTH_PT = 612;
const FALLBACK_PAGE_HEIGHT_PT = 792;
const MIN_LAYOUT_SCALE = 0.01;
const TILE_GRID_ROWS = 16;
const TILE_GRID_COLUMNS = 2;
const TILE_OVERLAP_PX = 2;
const TILE_BLEED_CSS_PX = 10;
const TILE_TARGET_EFFECTIVE_BITMAP_SCALE = 4;
const TILE_MIN_EFFECTIVE_BITMAP_SCALE = 1;
const TILE_MAX_EFFECTIVE_BITMAP_SCALE = 4.5;
const TILE_GEOMETRY_MAX_BITMAP_PIXELS = 96_000_000;
const TILE_GEOMETRY_MAX_BITMAP_SIDE = 32_768;
const TILE_GEOMETRY_PREVIEW_MAX_OUTPUT_SCALE = 2;
const TILE_GEOMETRY_WARMUP_MAX_OUTPUT_SCALE = 3;
const TILE_GEOMETRY_FINAL_MAX_OUTPUT_SCALE = TILE_MAX_EFFECTIVE_BITMAP_SCALE;
const TILE_GEOMETRY_PREVIEW_MIN_OUTPUT_SCALE = 1;
const TILE_GEOMETRY_WARMUP_MIN_OUTPUT_SCALE = 1.25;
const TILE_GEOMETRY_FINAL_MIN_OUTPUT_SCALE = 1.5;
const INTERACTION_TILE_LAYER_DEBOUNCE_MS = 12;
const ZOOM_TILE_LAYER_DEBOUNCE_MS = 40;

/**
 * Promoção conservadora de camadas.
 *
 * Durante zoom/scroll, a camada ativa permanece totalmente opaca e transformada
 * para acompanhar a geometria atual. A nova camada é renderizada em background,
 * mas só substitui a ativa quando a interação estabiliza.
 *
 * Isso reduz a "piscada" no zoom-in e também evita microtrocas perceptíveis no
 * zoom-out. O valor pode ser ajustado entre 180 e 300ms.
 */
const TILE_LAYER_PROMOTION_IDLE_DELAY_MS = 150;

/**
 * Em zoom alto, renderizar novas tiles enquanto o wheel ainda está ativo
 * deixa o zoom pesado. A camada ativa já acompanha o gesto por transform;
 * portanto, acima deste limite congelamos a criação da pendingLayer durante
 * o gesto e só renderizamos a camada nítida quando o wheel estabiliza.
 */
const HIGH_ZOOM_INTERACTION_RENDER_FREEZE_SCALE = 8;
const EXTREME_ZOOM_INTERACTION_RENDER_FREEZE_SCALE = 12;
const STABLE_TILE_RENDER_VERSION = 0;

function safeNumber(
  value: number | null | undefined,
  fallback = 0,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function zoomPercentToScale(zoom: number): number {
  return Math.max(MIN_LAYOUT_SCALE, safeNumber(zoom, 100) / 100);
}

function getRenderDocumentId(session: NativePdfSession): string {
  return (
    session.id ??
    session.fileName ??
    session.file?.name ??
    "knex-pdf-document"
  );
}

function resolveTileCssSize(input: {
  renderPhase: KnexPdfRenderPhase;
  renderScale: number;
}): number {
  /*
   * Em zoom alto, tiles menores reduzem o pico de memória por canvas.
   * O número de tiles aumenta, mas cada tile fica muito menos perigoso para
   * GPU/RAM e evita tela preta por bitmap grande demais.
   */
  if (input.renderScale >= 12) return 384;
  if (input.renderScale >= 8) return 448;
  if (input.renderScale >= 4) return 512;

  if (input.renderPhase === "settled-final") return 768;
  if (input.renderPhase === "interactive-preview") return 1024;

  return 1024;
}

function resolveTileGridRows(renderScale: number): number {
  /*
   * Mais linhas em zoom alto diminuem a altura real de cada tile.
   */
  if (renderScale >= 16) return 48;
  if (renderScale >= 12) return 40;
  if (renderScale >= 8) return 32;
  if (renderScale >= 4) return 24;

  return TILE_GRID_ROWS;
}

function resolveTileGridColumns(renderScale: number): number {
  /*
   * O antigo grid 16x2 gerava tiles largos demais em 800%+.
   * Em zoom alto, aumentar colunas é essencial para não estourar memória.
   */
  if (renderScale >= 16) return 10;
  if (renderScale >= 12) return 8;
  if (renderScale >= 8) return 6;
  if (renderScale >= 4) return 4;

  return TILE_GRID_COLUMNS;
}

function resolveTileGeometryMaxOutputScale(input: {
  renderPhase: KnexPdfRenderPhase;
  renderScale: number;
}): number {
  /*
   * Quanto maior o zoom CSS, menor precisa ser o outputScale.
   * Em 100%/200%, outputScale alto melhora nitidez.
   * Em 800%/2000%, outputScale alto explode bitmap e memória.
   */
  if (input.renderScale >= 16) return 1.15;
  if (input.renderScale >= 12) return 1.25;
  if (input.renderScale >= 8) return 1.5;
  if (input.renderScale >= 4) return 2;
  if (input.renderScale >= 2) return 3;

  if (input.renderPhase === "settled-final") {
    return TILE_GEOMETRY_FINAL_MAX_OUTPUT_SCALE;
  }

  if (input.renderPhase === "warmup-preview") {
    return TILE_GEOMETRY_WARMUP_MAX_OUTPUT_SCALE;
  }

  return TILE_GEOMETRY_PREVIEW_MAX_OUTPUT_SCALE;
}

function resolveTileGeometryMinOutputScale(input: {
  renderPhase: KnexPdfRenderPhase;
  renderScale: number;
}): number {
  if (input.renderScale >= 8) return 1;
  if (input.renderScale >= 4) return 1.15;
  if (input.renderScale >= 2) return 1.5;

  if (input.renderPhase === "settled-final") {
    return TILE_GEOMETRY_FINAL_MIN_OUTPUT_SCALE;
  }

  if (input.renderPhase === "warmup-preview") {
    return TILE_GEOMETRY_WARMUP_MIN_OUTPUT_SCALE;
  }

  return TILE_GEOMETRY_PREVIEW_MIN_OUTPUT_SCALE;
}

const pdfPageBaseSizeCache = new WeakMap<
  NativePdfSession,
  Map<number, PdfPageBaseSize>
>();
const serverPdfSourceUploads = new Map<string, Promise<void>>();

function arePageBaseSizesEquivalent(
  a: PdfPageBaseSize | null,
  b: PdfPageBaseSize,
): boolean {
  return (
    Boolean(a) &&
    Math.abs((a?.width ?? 0) - b.width) < 0.5 &&
    Math.abs((a?.height ?? 0) - b.height) < 0.5
  );
}

function readCachedPageBaseSize(
  session: NativePdfSession,
  pageNumber: number,
): PdfPageBaseSize | null {
  return pdfPageBaseSizeCache.get(session)?.get(pageNumber) ?? null;
}

function writeCachedPageBaseSize(input: {
  session: NativePdfSession;
  pageNumber: number;
  size: PdfPageBaseSize;
}) {
  const current =
    pdfPageBaseSizeCache.get(input.session) ?? new Map<number, PdfPageBaseSize>();

  current.set(input.pageNumber, input.size);
  pdfPageBaseSizeCache.set(input.session, current);
}

function canUseServerTileMode(mode: KnexPdfVisualRenderMode): boolean {
  return mode === "server-tiled" || mode === "auto-professional";
}

function getGlobalBoolean(key: string): boolean {
  const value = (globalThis as unknown as Record<string, unknown>)[key];

  return value === true || value === "true" || value === "1";
}

function resolveEffectiveVisualRenderMode(input: {
  visualRenderMode: KnexPdfVisualRenderMode;
  renderPhase: KnexPdfRenderPhase;
  isActivePage: boolean;
  isPageVisible: boolean;
  isWarmupPage: boolean;
  forceServerTiles: boolean;
  forceLocalTiles: boolean;
}): KnexPdfVisualRenderMode {
  /*
   * Para avaliar a nitidez real, precisamos conseguir forçar o pipeline
   * server/native sem alterar o resto do reader.
   *
   * No console:
   * globalThis.KNEX_PDF_FORCE_SERVER_TILES = true
   *
   * Para voltar ao modo local PDF.js:
   * globalThis.KNEX_PDF_FORCE_LOCAL_TILES = true
   *
   * Importante:
   * os valores globais são lidos por estado React sincronizado abaixo.
   * Assim, mudar a flag no console passa a surtir efeito sem depender de
   * Fast Refresh ou de remount manual do componente.
   */
  if (input.forceLocalTiles) {
    return "tiled-canvas";
  }

  const canForceServer =
    input.renderPhase === "settled-final" &&
    (input.isActivePage || input.isPageVisible || input.isWarmupPage);

  if (canForceServer && input.forceServerTiles) {
    return "server-tiled";
  }

  return input.visualRenderMode;
}

function readTileOverrideFlags() {
  return {
    forceServerTiles: getGlobalBoolean("KNEX_PDF_FORCE_SERVER_TILES"),
    forceLocalTiles: getGlobalBoolean("KNEX_PDF_FORCE_LOCAL_TILES"),
  };
}

async function ensureServerPdfSourceUploaded(input: {
  pdfFileId: string;
  documentId: string;
  file: File;
}) {
  const uploadKey = `${input.documentId}:${input.pdfFileId}:${input.file.size}:${input.file.lastModified}`;
  const existing = serverPdfSourceUploads.get(uploadKey);

  if (existing) {
    await existing;
    return;
  }

  const upload = (async () => {
    const formData = new FormData();
    formData.set("pdfFileId", input.pdfFileId);
    formData.set("documentId", input.documentId);
    formData.set("file", input.file, input.file.name || `${input.pdfFileId}.pdf`);

    const response = await fetch("/api/knexread/render/pdf-source", {
      method: "POST",
      body: formData,
    });
    const body = (await response.json().catch(() => null)) as {
      ok?: boolean;
      documentId?: string;
      pdfFileId?: string;
      reason?: string;
    } | null;

    if (!response.ok || !body?.ok) {
      throw new Error(
        body?.reason ?? `server-pdf-source-upload-failed-${response.status}`,
      );
    }

    if (
      body.pdfFileId !== input.pdfFileId ||
      body.documentId !== input.documentId
    ) {
      throw new Error("server-pdf-source-upload-id-mismatch");
    }
  })();

  serverPdfSourceUploads.set(uploadKey, upload);

  try {
    await upload;
  } catch (error) {
    serverPdfSourceUploads.delete(uploadKey);
    throw error;
  }
}

function normalizeLayerNumber(value: number): number {
  return Math.round(safeNumber(value, 0) * 1000) / 1000;
}

function createTileLayerGenerationId(input: {
  documentId: string;
  pageNumber: number;
  geometry: KnexPdfPageGeometry;
  renderQuality: PdfRenderQualityMode;
  renderPhase: KnexPdfRenderPhase;
  backendVersion: number;
  activeBackend: string;
  preferredBackend: string;
  tileSizeCss: number;
  tileRows: number;
  tileColumns: number;
  overlapPx: number;
  bleedPx: number;
  tileRenderMode: string;
  tileCount: number;
}): string {
  return [
    "tiles",
    `doc=${input.documentId}`,
    `p=${input.pageNumber}`,
    `z=${normalizeLayerNumber(input.geometry.zoom)}`,
    `os=${normalizeLayerNumber(input.geometry.outputScale)}`,
    `css=${normalizeLayerNumber(input.geometry.cssWidth)}x${normalizeLayerNumber(
      input.geometry.cssHeight,
    )}`,
    `bmp=${input.geometry.bitmapWidth}x${input.geometry.bitmapHeight}`,
    `q=${input.renderQuality}`,
    `phase=${input.renderPhase}`,
    `bv=${input.backendVersion}`,
    `activeBackend=${input.activeBackend}`,
    `preferredBackend=${input.preferredBackend}`,
    `tile=${input.tileSizeCss}`,
    `grid=${input.tileRows}x${input.tileColumns}`,
    `overlap=${input.overlapPx}`,
    `bleed=${input.bleedPx}`,
    `mode=${input.tileRenderMode}`,
    `count=${input.tileCount}`,
  ].join("|");
}

function createTileLayerSnapshot(input: {
  id: string;
  geometry: KnexPdfPageGeometry;
  tiles: KnexPdfPageTile[];
  renderQuality: PdfRenderQualityMode;
  renderPhase: KnexPdfRenderPhase;
  tileRenderMode: "server-tiled" | "tiled-canvas";
  backendVersion: number;
  finalRenderVersion: number;
  renderVersion: number;
  activeBackend: string;
  preferredBackend: string;
  tileSizeCss: number;
  tileRows: number;
  tileColumns: number;
  overlapPx: number;
  bleedPx: number;
}): TileLayerSnapshot {
  return {
    ...input,
    tiles: input.tiles,
  };
}

function getLayerTransform(input: {
  targetZoom: number;
  layerGeometry: KnexPdfPageGeometry;
}): string {
  const scale =
    Math.max(MIN_LAYOUT_SCALE, input.targetZoom) /
    Math.max(MIN_LAYOUT_SCALE, input.layerGeometry.zoom);

  if (Math.abs(scale - 1) <= 0.0001) {
    return "none";
  }

  return `matrix(${scale}, 0, 0, ${scale}, 0, 0)`;
}

function getDefaultRenderPriority(input: {
  isActivePage: boolean;
  isPageVisible: boolean;
  isWarmupPage: boolean;
}) {
  if (input.isActivePage) return 100;
  if (input.isPageVisible) return 90;
  if (input.isWarmupPage) return 70;
  return 10;
}

function createTiledCanvasTextState(input: {
  documentId: string;
  pageNumber: number;
  renderPhase: KnexPdfRenderPhase;
  renderQuality: PdfRenderQualityMode;
  renderScale: number;
  outputScale: number;
  zoom: number;
  renderText: boolean;
  backendVersion: number;
  finalRenderVersion: number;
  activeBackend: string;
  renderSource: string;
}): PdfTileRenderState {
  const renderIdentity = [
    "tiled-canvas",
    `doc=${input.documentId}`,
    `p=${input.pageNumber}`,
    `phase=${input.renderPhase}`,
    `q=${input.renderQuality}`,
    `rs=${input.renderScale}`,
    `os=${input.outputScale}`,
    `z=${input.zoom}`,
    `text=${input.renderText ? "1" : "0"}`,
    `bv=${input.backendVersion}`,
    `active=${input.activeBackend}`,
    `source=${input.renderSource}`,
    `fv=${input.finalRenderVersion}`,
  ].join("|");

  return {
    documentId: input.documentId,
    pageNumber: input.pageNumber,
    backend: input.renderSource,
    renderPhase: input.renderPhase,
    renderQuality: input.renderQuality,
    renderScale: input.renderScale,
    outputScale: input.outputScale,
    zoom: input.zoom,
    renderText: input.renderText,
    canvasTextMode: input.renderText ? "normal" : "without-text",
    filteredTextOperationCount: 0,
    renderIdentity,
    renderVersion: input.finalRenderVersion,
    backendVersion: input.backendVersion,
    finalRenderVersion: input.finalRenderVersion,
  };
}

function areTileViewportSnapshotsEquivalent(
  a: TileViewportSnapshot | null,
  b: TileViewportSnapshot | null,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;

  if (a.centralTileId !== b.centralTileId) return false;
  if (a.visibleTileIds.length !== b.visibleTileIds.length) return false;

  for (let index = 0; index < a.visibleTileIds.length; index += 1) {
    if (a.visibleTileIds[index] !== b.visibleTileIds[index]) {
      return false;
    }
  }

  return true;
}

function createRenderedPage(input: {
  pageNumber: number;
  pageWidthPt: number;
  pageHeightPt: number;
  cssWidth: number;
  cssHeight: number;
  bitmapWidth: number;
  bitmapHeight: number;
  renderScale: number;
  outputScale: number;
  zoom: number;
  renderText: boolean;
}): RenderedPdfPage {
  return {
    pageNumber: input.pageNumber,
    width: input.bitmapWidth,
    height: input.bitmapHeight,
    cssWidth: input.cssWidth,
    cssHeight: input.cssHeight,
    pageWidthPt: input.pageWidthPt,
    pageHeightPt: input.pageHeightPt,
    renderScale: input.renderScale,
    outputScale: input.outputScale,
    backgroundColor: "#ffffff",
    zoom: input.zoom,
    devicePixelRatio:
      typeof globalThis.devicePixelRatio === "number"
        ? globalThis.devicePixelRatio
        : 1,
    renderMode: "hybrid-semantic",
    textLayerMode: "semantic",
    hasTextLayer: true,
    canvasActsAsBackground: true,
    bitmapPixels: input.bitmapWidth * input.bitmapHeight,
    bitmap: {
      width: input.bitmapWidth,
      height: input.bitmapHeight,
      cssWidth: input.cssWidth,
      cssHeight: input.cssHeight,
      outputScale: input.outputScale,
      devicePixelRatio:
        typeof globalThis.devicePixelRatio === "number"
          ? globalThis.devicePixelRatio
          : 1,
      zoom: input.renderScale,
    },
  };
}

export function PdfTiledPageCanvas({
  session,
  pageNumber,
  zoom,
  visualZoom,
  renderZoom,
  visualToRenderScaleRatio,
  renderQuality,
  onRendered,
  isZooming = false,
  isScrolling = false,
  renderPhase = "settled-final",
  finalRenderVersion = 0,
  isActivePage = false,
  isPageVisible = false,
  isWarmupPage = false,
  renderPriority,
  renderText = true,
  onCanvasTextRenderStateChange,
  visualRenderMode = "tiled-canvas",
  pdfFileId,
}: PdfTiledPageCanvasProps) {
  const engineState = useKnexPdfEngineState();
  const activeBackend = engineState.activeBackend || "unknown";
  const preferredBackend = engineState.preferredBackend || "unknown";
  const frameRef = useRef<HTMLDivElement | null>(null);
  const documentId = useMemo(() => getRenderDocumentId(session), [session]);
  const [tileOverrideFlags, setTileOverrideFlags] = useState(
    readTileOverrideFlags,
  );
  const [serverTileCircuitState, setServerTileCircuitState] = useState(
    getServerTileCircuitBreakerState,
  );

  useEffect(() => {
    const syncServerTileCircuitState = () => {
      setServerTileCircuitState(getServerTileCircuitBreakerState());
    };

    syncServerTileCircuitState();

    const intervalId = window.setInterval(syncServerTileCircuitState, 1_000);

    window.addEventListener(
      SERVER_TILE_CIRCUIT_BREAKER_EVENT,
      syncServerTileCircuitState,
    );

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener(
        SERVER_TILE_CIRCUIT_BREAKER_EVENT,
        syncServerTileCircuitState,
      );
    };
  }, []);

  const serverTileCircuitOpen = isServerTileCircuitBreakerOpen();
  const serverTileCircuitReason = serverTileCircuitOpen
    ? getServerTileCircuitOpenReason() ||
      serverTileCircuitState.lastReason ||
      "server-tile-circuit-open"
    : "";

  useEffect(() => {
    const syncTileOverrideFlags = () => {
      const next = readTileOverrideFlags();

      setTileOverrideFlags((current) =>
        current.forceServerTiles === next.forceServerTiles &&
        current.forceLocalTiles === next.forceLocalTiles
          ? current
          : next,
      );
    };

    syncTileOverrideFlags();

    const intervalId = window.setInterval(syncTileOverrideFlags, 1_500);

    window.addEventListener("focus", syncTileOverrideFlags);
    window.addEventListener("keydown", syncTileOverrideFlags);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", syncTileOverrideFlags);
      window.removeEventListener("keydown", syncTileOverrideFlags);
    };
  }, []);

  const effectiveVisualRenderMode = useMemo(
    () =>
      resolveEffectiveVisualRenderMode({
        visualRenderMode,
        renderPhase,
        isActivePage,
        isPageVisible,
        isWarmupPage,
        forceServerTiles: tileOverrideFlags.forceServerTiles,
        forceLocalTiles: tileOverrideFlags.forceLocalTiles,
      }),
    [
      isActivePage,
      isPageVisible,
      isWarmupPage,
      renderPhase,
      tileOverrideFlags.forceLocalTiles,
      tileOverrideFlags.forceServerTiles,
      visualRenderMode,
    ],
  );
  const [pageBaseSize, setPageBaseSize] = useState<PdfPageBaseSize>(() => {
    return (
      readCachedPageBaseSize(session, pageNumber) ?? {
        width: FALLBACK_PAGE_WIDTH_PT,
        height: FALLBACK_PAGE_HEIGHT_PT,
      }
    );
  });
  const [hasResolvedPageBaseSize, setHasResolvedPageBaseSize] = useState(() =>
    Boolean(readCachedPageBaseSize(session, pageNumber)),
  );
  const [error, setError] = useState<string | null>(null);
  const [serverPdfSourceReady, setServerPdfSourceReady] = useState(false);

  useEffect(() => {
    if (
      serverTileCircuitOpen ||
      !canUseServerTileMode(effectiveVisualRenderMode)
    ) {
      setServerPdfSourceReady(false);
      return;
    }

    const sourcePdfFileId = pdfFileId ?? session.id;
    let cancelled = false;

    setServerPdfSourceReady(false);

    ensureServerPdfSourceUploaded({
      pdfFileId: sourcePdfFileId,
      documentId,
      file: session.file,
    })
      .then(() => {
        if (!cancelled) {
          setServerPdfSourceReady(true);
        }
      })
      .catch(() => {
        if (cancelled) return;

        setServerPdfSourceReady(false);
      });

    return () => {
      cancelled = true;
    };
  }, [
    documentId,
    pdfFileId,
    session.file,
    session.id,
    effectiveVisualRenderMode,
    serverTileCircuitOpen,
  ]);

  useEffect(() => {
    const cachedSize = readCachedPageBaseSize(session, pageNumber);

    if (cachedSize) {
      setHasResolvedPageBaseSize(true);
      setPageBaseSize((current) =>
        arePageBaseSizesEquivalent(current, cachedSize)
          ? current
          : cachedSize,
      );
      return;
    }

    setHasResolvedPageBaseSize(false);
  }, [pageNumber, session]);

  useEffect(() => {
    let cancelled = false;

    session.pdf
      .getPage(pageNumber)
      .then((page) => {
        if (cancelled) return;

        const viewport = (page as PdfPageWithViewport).getViewport({
          scale: 1,
        });
        const nextSize = {
          width: Math.max(
            1,
            Math.ceil(safeNumber(viewport.width, FALLBACK_PAGE_WIDTH_PT)),
          ),
          height: Math.max(
            1,
            Math.ceil(safeNumber(viewport.height, FALLBACK_PAGE_HEIGHT_PT)),
          ),
        };

        setError(null);
        setHasResolvedPageBaseSize(true);
        writeCachedPageBaseSize({
          session,
          pageNumber,
          size: nextSize,
        });
        setPageBaseSize((current) =>
          arePageBaseSizesEquivalent(current, nextSize)
            ? current
            : nextSize,
        );
      })
      .catch((pageError) => {
        if (cancelled) return;

        setError(
          pageError instanceof Error
            ? pageError.message
            : "Failed to read PDF page size.",
        );
      });

    return () => {
      cancelled = true;
    };
  }, [pageNumber, session]);

  const effectiveRenderZoom = useMemo(
    () => Math.max(MIN_LAYOUT_SCALE * 100, safeNumber(renderZoom, zoom)),
    [renderZoom, zoom],
  );
  const effectiveVisualZoom = useMemo(
    () => Math.max(MIN_LAYOUT_SCALE * 100, safeNumber(visualZoom, effectiveRenderZoom)),
    [effectiveRenderZoom, visualZoom],
  );

  const renderScale = useMemo(
    () => zoomPercentToScale(effectiveRenderZoom),
    [effectiveRenderZoom],
  );
  const visualScale = useMemo(
    () => zoomPercentToScale(effectiveVisualZoom),
    [effectiveVisualZoom],
  );
  const effectiveVisualToRenderScaleRatio = useMemo(() => {
    const fallbackRatio = visualScale / Math.max(MIN_LAYOUT_SCALE, renderScale);
    const ratio = safeNumber(visualToRenderScaleRatio, fallbackRatio);

    return Math.max(MIN_LAYOUT_SCALE, ratio);
  }, [renderScale, visualScale, visualToRenderScaleRatio]);

  const visualCssWidth = useMemo(
    () => Math.max(1, pageBaseSize.width * visualScale),
    [pageBaseSize.width, visualScale],
  );
  const visualCssHeight = useMemo(
    () => Math.max(1, pageBaseSize.height * visualScale),
    [pageBaseSize.height, visualScale],
  );

  const tileGridRows = useMemo(
    () => resolveTileGridRows(renderScale),
    [renderScale],
  );
  const tileGridColumns = useMemo(
    () => resolveTileGridColumns(renderScale),
    [renderScale],
  );
  const effectiveRenderQuality = useMemo(
    () =>
      resolveRenderQualityForPhase({
        backend: "pdfjs",
        phase: renderPhase,
        requestedQuality: renderQuality,
        zoom: effectiveRenderZoom,
      }),
    [effectiveRenderZoom, renderPhase, renderQuality],
  );
  const geometry = useMemo(
    () =>
      buildKnexPdfPageGeometry({
        pageNumber,
        baseWidth: pageBaseSize.width,
        baseHeight: pageBaseSize.height,
        zoom: renderScale,
        quality: effectiveRenderQuality,
        backend: "pdfjs",
        renderPhase,
        maxBitmapPixels: TILE_GEOMETRY_MAX_BITMAP_PIXELS,
        maxBitmapSide: TILE_GEOMETRY_MAX_BITMAP_SIDE,
        minimumOutputScale: resolveTileGeometryMinOutputScale({
          renderPhase,
          renderScale,
        }),
        maxOutputScale: resolveTileGeometryMaxOutputScale({
          renderPhase,
          renderScale,
        }),
      }),
    [
      effectiveRenderQuality,
      pageBaseSize.height,
      pageBaseSize.width,
      pageNumber,
      renderPhase,
      renderScale,
    ],
  );
  const tilePlan = useMemo(
    () =>
      buildKnexPdfTileRenderPlan({
        geometry,
        tileSizeCss: resolveTileCssSize({
          renderPhase,
          renderScale,
        }),
        tileRows: tileGridRows,
        tileColumns: tileGridColumns,
        overlapPx: TILE_OVERLAP_PX,
        bleedPx: TILE_BLEED_CSS_PX,
      }),
    [geometry, renderPhase, renderScale, tileGridColumns, tileGridRows],
  );
  const pagePriority =
    renderPriority ??
    getDefaultRenderPriority({
      isActivePage,
      isPageVisible,
      isWarmupPage,
    });
  const serverTileDecision = useMemo(
    () =>
      resolveServerTileFallbackPolicy({
        visualRenderMode: effectiveVisualRenderMode,
        serverAvailable:
          canUseServerTileMode(effectiveVisualRenderMode) &&
          serverPdfSourceReady &&
          !serverTileCircuitOpen,
        localTilesAvailable: true,
        reason: serverTileCircuitOpen
          ? serverTileCircuitReason || "server-tile-circuit-open"
          : serverPdfSourceReady
            ? "server-tile-client-fallback"
            : "server-pdf-source-upload-pending",
      }),
    [
      effectiveVisualRenderMode,
      serverPdfSourceReady,
      serverTileCircuitOpen,
      serverTileCircuitReason,
    ],
  );
  const tilesToRender = useMemo(() => {
    return tilePlan.tiles;
  }, [tilePlan.tiles]);
  const currentLayer = useMemo(
    () =>
      createTileLayerSnapshot({
        id: createTileLayerGenerationId({
          documentId,
          pageNumber,
          geometry,
          renderQuality: effectiveRenderQuality,
          renderPhase,
          backendVersion: engineState.backendVersion,
          activeBackend,
          preferredBackend,
          tileSizeCss: tilePlan.tileSizeCss,
          tileRows: tilePlan.tileRows,
          tileColumns: tilePlan.tileColumns,
          overlapPx: tilePlan.overlapPx,
          bleedPx: tilePlan.bleedPx,
          tileRenderMode: serverTileDecision.renderMode,
          tileCount: tilesToRender.length,
        }),
        geometry,
        tiles: tilesToRender,
        renderQuality: effectiveRenderQuality,
        renderPhase,
        tileRenderMode: serverTileDecision.renderMode,
        backendVersion: engineState.backendVersion,
        finalRenderVersion: STABLE_TILE_RENDER_VERSION,
        renderVersion: STABLE_TILE_RENDER_VERSION,
        activeBackend,
        preferredBackend,
        tileSizeCss: tilePlan.tileSizeCss,
        tileRows: tilePlan.tileRows,
        tileColumns: tilePlan.tileColumns,
        overlapPx: tilePlan.overlapPx,
        bleedPx: tilePlan.bleedPx,
      }),
    [
      activeBackend,
      documentId,
      effectiveRenderQuality,
      engineState.backendVersion,
      geometry,
      pageNumber,
      preferredBackend,
      renderPhase,
      serverTileDecision.renderMode,
      tilePlan.bleedPx,
      tilePlan.overlapPx,
      tilePlan.tileColumns,
      tilePlan.tileRows,
      tilePlan.tileSizeCss,
      tilesToRender,
    ],
  );
  const [activeLayer, setActiveLayer] = useState<TileLayerSnapshot | null>(
    null,
  );
  const [pendingLayer, setPendingLayer] =
    useState<TileLayerSnapshot | null>(null);
  const [pendingReadyCount, setPendingReadyCount] = useState(0);
  const [viewportSnapshot, setViewportSnapshot] =
    useState<TileViewportSnapshot | null>(null);
  const latestViewportSnapshotRef = useRef<TileViewportSnapshot | null>(null);
  const pendingReadyTilesRef = useRef<Set<string>>(new Set());
  const [promotablePendingLayerId, setPromotablePendingLayerId] =
    useState<string | null>(null);
  const isInteractionActive =
    isZooming || isScrolling || renderPhase !== "settled-final";

  const shouldFreezeTileRefreshDuringScroll =
    isScrolling && activeLayer !== null;

  const shouldFreezeTileRefreshDuringHighZoom =
    isZooming &&
    visualScale >= HIGH_ZOOM_INTERACTION_RENDER_FREEZE_SCALE;

  const shouldFreezeTileRefreshDuringExtremeZoom =
    isZooming &&
    visualScale >= EXTREME_ZOOM_INTERACTION_RENDER_FREEZE_SCALE;

  /*
   * Regra estrutural para fluidez:
   *
   * Durante scroll comum, a página não deve tentar criar/prometer uma nova
   * pendingLayer. A rolagem deve apenas mover a camada ativa já pronta.
   *
   * Se o renderPhase muda para interactive-preview durante scroll e isso muda
   * o generationId, não criamos nova camada naquele momento. A camada final
   * será atualizada depois do settle, evitando saltos de renderização enquanto
   * o palco está descendo/subindo.
   */
  const shouldRefreshTilesDuringInteraction =
    isInteractionActive &&
    !shouldFreezeTileRefreshDuringScroll &&
    !shouldFreezeTileRefreshDuringHighZoom &&
    (isActivePage || isPageVisible || isWarmupPage);

  useEffect(() => {
    if (!activeLayer) {
      if (pendingLayer?.id === currentLayer.id) {
        return;
      }

      pendingReadyTilesRef.current = new Set();
      setPendingReadyCount(0);
      setPromotablePendingLayerId(null);
      setPendingLayer(currentLayer);
      return;
    }

    if (currentLayer.id === activeLayer.id) {
      if (pendingLayer && pendingLayer.id !== activeLayer.id) {
        pendingReadyTilesRef.current = new Set();
        setPendingReadyCount(0);
        setPromotablePendingLayerId(null);
        setPendingLayer(null);
      }

      return;
    }

    if (isInteractionActive && !shouldRefreshTilesDuringInteraction) {
      return;
    }

    if (pendingLayer?.id === currentLayer.id) {
      return;
    }

    const queuePendingLayer = () => {
      pendingReadyTilesRef.current = new Set();
      setPendingReadyCount(0);
      setPromotablePendingLayerId(null);
      setPendingLayer(currentLayer);
    };

    if (shouldRefreshTilesDuringInteraction) {
      const timerId = window.setTimeout(
        queuePendingLayer,
        isZooming
          ? ZOOM_TILE_LAYER_DEBOUNCE_MS
          : INTERACTION_TILE_LAYER_DEBOUNCE_MS,
      );

      return () => {
        window.clearTimeout(timerId);
      };
    }

    queuePendingLayer();
  }, [
    activeLayer,
    currentLayer,
    isInteractionActive,
    isZooming,
    pendingLayer,
    shouldFreezeTileRefreshDuringScroll,
    shouldRefreshTilesDuringInteraction,
  ]);

  const handlePendingTileReady = useCallback(
    (tileId: string, generationId: string) => {
      setPendingReadyCount((current) => {
        if (!pendingLayer || pendingLayer.id !== generationId) {
          return current;
        }

        if (pendingReadyTilesRef.current.has(tileId)) {
          return current;
        }

        pendingReadyTilesRef.current.add(tileId);

        return pendingReadyTilesRef.current.size;
      });
    },
    [pendingLayer],
  );

  const pendingLayerReady = Boolean(
    pendingLayer && pendingReadyCount >= pendingLayer.tiles.length,
  );
  const pendingLayerMatchesCurrent = pendingLayer?.id === currentLayer.id;

  /*
   * Só promovemos a camada nova quando a interação estabiliza.
   *
   * Enquanto o usuário está aplicando zoom ou rolagem, a activeLayer continua
   * sendo a única camada visível. A pendingLayer renderiza em background e fica
   * pronta, mas não entra visualmente no palco. Isso evita a troca de opacidade
   * e o "salto" de nitidez durante zoom-in/zoom-out.
   */
  const canPromotePendingLayer =
    !isZooming && !isScrolling && renderPhase === "settled-final";

  useEffect(() => {
    if (!pendingLayer || !pendingLayerReady || !pendingLayerMatchesCurrent) {
      setPromotablePendingLayerId((current) =>
        current === pendingLayer?.id ? null : current,
      );
      return;
    }

    /*
     * Primeira renderização da página: não há activeLayer para preservar.
     * Nesse caso, promovemos imediatamente para não deixar a página vazia.
     */
    if (!activeLayer) {
      setPromotablePendingLayerId(pendingLayer.id);
      return;
    }

    if (!canPromotePendingLayer) {
      setPromotablePendingLayerId((current) =>
        current === pendingLayer.id ? null : current,
      );
      return;
    }

    const timerId = window.setTimeout(() => {
      setPromotablePendingLayerId((current) =>
        current === null || current === pendingLayer.id ? pendingLayer.id : current,
      );
    }, TILE_LAYER_PROMOTION_IDLE_DELAY_MS);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [
    activeLayer,
    canPromotePendingLayer,
    pendingLayer,
    pendingLayerMatchesCurrent,
    pendingLayerReady,
  ]);

  const pendingLayerPromotable = Boolean(
    pendingLayer &&
      pendingLayerReady &&
      pendingLayerMatchesCurrent &&
      promotablePendingLayerId === pendingLayer.id,
  );

  useEffect(() => {
    if (!pendingLayer || !pendingLayerPromotable) {
      return;
    }

    const promoteFrameId = window.requestAnimationFrame(() => {
      /*
       * Atualização atômica:
       * em vez de mostrar pendingLayer por cima e esconder a activeLayer,
       * trocamos a referência ativa e limpamos a pending no mesmo frame.
       * Isso reduz a impressão de crossfade/piscada.
       */
      setActiveLayer(pendingLayer);
      setPendingLayer((current) =>
        current?.id === pendingLayer.id ? null : current,
      );
      pendingReadyTilesRef.current = new Set();
      setPendingReadyCount(0);
      setPromotablePendingLayerId((current) =>
        current === pendingLayer.id ? null : current,
      );
    });

    return () => {
      window.cancelAnimationFrame(promoteFrameId);
    };
  }, [pendingLayer, pendingLayerPromotable]);

  useEffect(() => {
    /*
     * Durante scroll/zoom, não publicar metadados de renderização a cada
     * microvariação de fase/camada. Isso empurra estado para o Shell e pode
     * reabrir a janela de renderização enquanto o usuário só quer rolar.
     *
     * Exceção: primeira camada, quando ainda não existe activeLayer. Nesse caso
     * precisamos avisar o Shell para a página aparecer corretamente.
     */
    if (isInteractionActive && activeLayer) {
      return;
    }

    const renderedPage = createRenderedPage({
      pageNumber,
      pageWidthPt: geometry.baseWidth,
      pageHeightPt: geometry.baseHeight,
      cssWidth: geometry.cssWidth,
      cssHeight: geometry.cssHeight,
      bitmapWidth: geometry.bitmapWidth,
      bitmapHeight: geometry.bitmapHeight,
      renderScale: geometry.zoom,
      outputScale: geometry.outputScale,
      zoom: effectiveRenderZoom,
      renderText,
    });

    if (hasResolvedPageBaseSize) {
      onRendered(renderedPage);
    }

    onCanvasTextRenderStateChange?.(
      createTiledCanvasTextState({
        documentId,
        pageNumber,
        renderPhase,
        renderQuality: effectiveRenderQuality,
        renderScale: geometry.zoom,
        outputScale: geometry.outputScale,
        zoom: effectiveRenderZoom,
        renderText,
        backendVersion: engineState.backendVersion,
        finalRenderVersion,
        activeBackend,
        renderSource:
          serverTileDecision.renderMode === "server-tiled"
            ? "server"
            : "pdfjs",
      }),
    );
  }, [
    activeBackend,
    activeLayer,
    documentId,
    effectiveRenderQuality,
    engineState.backendVersion,
    finalRenderVersion,
    geometry.baseHeight,
    geometry.baseWidth,
    geometry.bitmapHeight,
    geometry.bitmapWidth,
    geometry.cssHeight,
    geometry.cssWidth,
    geometry.outputScale,
    geometry.zoom,
    hasResolvedPageBaseSize,
    isInteractionActive,
    onCanvasTextRenderStateChange,
    onRendered,
    pageNumber,
    renderPhase,
    renderText,
    serverTileDecision.renderMode,
    effectiveRenderZoom,
  ]);

  const handleViewportSnapshot = useCallback(
    (snapshot: TileViewportSnapshot) => {
      /*
       * TileViewportObserver pode disparar em todo micro-scroll. Esses snapshots
       * são úteis para diagnóstico/prioridade, mas atualizar estado React por
       * página durante a rolagem fragmenta a fluidez do palco.
       */
      latestViewportSnapshotRef.current = snapshot;

      if (
        isInteractionActive &&
        !getGlobalBoolean("KNEX_PDF_DEBUG_TILE_VIEWPORT")
      ) {
        return;
      }

      setViewportSnapshot((current) =>
        areTileViewportSnapshotsEquivalent(current, snapshot)
          ? current
          : snapshot,
      );
    },
    [isInteractionActive],
  );

  const visibleLayer = activeLayer;
  const visibleLayerTransform = visibleLayer
    ? getLayerTransform({
        targetZoom: visualScale,
        layerGeometry: visibleLayer.geometry,
      })
    : "none";
  const pendingLayerTransform = pendingLayer
    ? getLayerTransform({
        targetZoom: visualScale,
        layerGeometry: pendingLayer.geometry,
      })
    : "none";
  /*
   * A pending layer só fica visível quando ainda não existe camada ativa.
   * Depois da primeira camada, a pending renderiza em background e nunca entra
   * por opacidade. A troca visual acontece apenas pela promoção atômica da
   * activeLayer.
   */
  const pendingLayerVisible = Boolean(pendingLayer && !activeLayer);
  const activeLayerVisible = Boolean(visibleLayer);
  const visibleGenerationId =
    (visibleLayer?.id ?? (pendingLayerVisible ? pendingLayer?.id : "")) ?? "";

  return (
    <div
      ref={frameRef}
      className="relative shrink-0 overflow-hidden bg-white"
      data-knexread-page-tile-frame="true"
      data-knex-pdf-visual-render-mode={visualRenderMode}
      data-knex-pdf-requested-visual-render-mode={visualRenderMode}
      data-knex-pdf-effective-visual-render-mode={effectiveVisualRenderMode}
      data-knex-pdf-effective-tile-render-mode={
        serverTileDecision.renderMode
      }
      data-knex-pdf-force-server-tiles={
        tileOverrideFlags.forceServerTiles ? "true" : "false"
      }
      data-knex-pdf-force-local-tiles={
        tileOverrideFlags.forceLocalTiles ? "true" : "false"
      }
      data-knex-pdf-active-backend={activeBackend}
      data-knex-pdf-preferred-backend={preferredBackend}
      data-knex-pdf-backend-version={engineState.backendVersion}
      data-knex-pdf-render-source={
        serverTileDecision.renderMode === "server-tiled" ? "server" : "pdfjs"
      }
      data-knex-pdf-renderer={
        serverTileDecision.renderMode === "server-tiled"
          ? "server-tile-renderer"
          : "pdfjs-tile-canvas"
      }
      data-knex-pdf-generation-id={visibleGenerationId}
      data-knex-pdf-render-version={STABLE_TILE_RENDER_VERSION}
      data-knex-pdf-final-render-version={
        (pendingLayerVisible
          ? pendingLayer?.finalRenderVersion
          : visibleLayer?.finalRenderVersion) ?? STABLE_TILE_RENDER_VERSION
      }
      data-knex-pdf-server-tile-fallback-used={
        serverTileDecision.fallbackUsed ? "true" : "false"
      }
      data-knex-pdf-server-tile-fallback-reason={
        serverTileDecision.reason ?? ""
      }
      data-knex-pdf-server-pdf-source-ready={
        serverPdfSourceReady ? "true" : "false"
      }
      data-knex-pdf-server-circuit-open={
        serverTileCircuitOpen ? "true" : "false"
      }
      data-knex-pdf-server-circuit-reason={serverTileCircuitReason}
      data-knex-pdf-tiled-page="true"
      data-page-number={pageNumber}
      data-knex-pdf-css-width={geometry.cssWidth}
      data-knex-pdf-css-height={geometry.cssHeight}
      data-knex-pdf-visual-css-width={visualCssWidth}
      data-knex-pdf-visual-css-height={visualCssHeight}
      data-knex-pdf-render-zoom={effectiveRenderZoom}
      data-knex-pdf-visual-zoom={effectiveVisualZoom}
      data-knex-pdf-render-scale={renderScale}
      data-knex-pdf-visual-scale={visualScale}
      data-knex-pdf-visual-to-render-scale-ratio={
        effectiveVisualToRenderScaleRatio
      }
      data-knex-pdf-output-scale={geometry.outputScale}
      data-knex-pdf-tile-size-css={tilePlan.tileSizeCss}
      data-knex-pdf-tile-rows={tilePlan.tileRows}
      data-knex-pdf-tile-columns={tilePlan.tileColumns}
      data-knex-pdf-adaptive-tile-grid-rows={tileGridRows}
      data-knex-pdf-adaptive-tile-grid-columns={tileGridColumns}
      data-knex-pdf-tile-overlap-px={tilePlan.overlapPx}
      data-knex-pdf-tile-bleed-css-px={tilePlan.bleedPx}
      data-knex-pdf-tile-count={tilePlan.totalTiles}
      data-knex-pdf-target-effective-bitmap-scale={
        TILE_TARGET_EFFECTIVE_BITMAP_SCALE
      }
      data-knex-pdf-min-effective-bitmap-scale={
        TILE_MIN_EFFECTIVE_BITMAP_SCALE
      }
      data-knex-pdf-max-effective-bitmap-scale={
        TILE_MAX_EFFECTIVE_BITMAP_SCALE
      }
      data-knex-pdf-max-bitmap-pixels={TILE_GEOMETRY_MAX_BITMAP_PIXELS}
      data-knex-pdf-max-bitmap-side={TILE_GEOMETRY_MAX_BITMAP_SIDE}
      data-knex-pdf-active-tile-count={tilesToRender.length}
      data-knex-pdf-active-tile-layer-id={visibleLayer?.id ?? ""}
      data-knex-pdf-visible-tile-layer-id={visibleGenerationId}
      data-knex-pdf-pending-tile-layer-id={pendingLayer?.id ?? ""}
      data-knex-pdf-pending-tile-ready-count={pendingReadyCount}
      data-knex-pdf-pending-tile-ready={pendingLayerReady ? "true" : "false"}
      data-knex-pdf-pending-tile-promotable={
        pendingLayerPromotable ? "true" : "false"
      }
      data-knex-pdf-can-promote-pending-layer={
        canPromotePendingLayer ? "true" : "false"
      }
      data-knex-pdf-promotable-pending-layer-id={
        promotablePendingLayerId ?? ""
      }
      data-knex-pdf-interaction-tile-refresh={
        shouldRefreshTilesDuringInteraction ? "true" : "false"
      }
      data-knex-pdf-scroll-tile-refresh-frozen={
        shouldFreezeTileRefreshDuringScroll ? "true" : "false"
      }
      data-knex-pdf-high-zoom-tile-refresh-frozen={
        shouldFreezeTileRefreshDuringHighZoom ? "true" : "false"
      }
      data-knex-pdf-extreme-zoom-tile-refresh-frozen={
        shouldFreezeTileRefreshDuringExtremeZoom ? "true" : "false"
      }
      data-knex-pdf-high-zoom-freeze-scale={
        HIGH_ZOOM_INTERACTION_RENDER_FREEZE_SCALE
      }
      data-knex-pdf-extreme-zoom-freeze-scale={
        EXTREME_ZOOM_INTERACTION_RENDER_FREEZE_SCALE
      }
      data-knex-pdf-zoom-tile-debounce-ms={ZOOM_TILE_LAYER_DEBOUNCE_MS}
      data-knex-pdf-layer-promotion-idle-delay-ms={
        TILE_LAYER_PROMOTION_IDLE_DELAY_MS
      }
      data-knex-pdf-visible-tile-count={
        (viewportSnapshot ?? latestViewportSnapshotRef.current)?.visibleTileIds.length ?? 0
      }
      data-knex-pdf-central-tile-id={(viewportSnapshot ?? latestViewportSnapshotRef.current)?.centralTileId ?? ""}
      data-knex-pdf-render-phase={renderPhase}
      data-knex-pdf-render-quality={effectiveRenderQuality}
      data-knex-pdf-zooming={isZooming ? "true" : "false"}
      data-knex-pdf-scrolling={isScrolling ? "true" : "false"}
      style={{
        boxSizing: "content-box",
        width: `${visualCssWidth}px`,
        height: `${visualCssHeight}px`,
        minWidth: `${visualCssWidth}px`,
        minHeight: `${visualCssHeight}px`,
        contain: "layout paint size style",
        isolation: "isolate",
        backgroundColor: "#ffffff",
        boxShadow: "0 0 0 1px rgb(212 212 216)",
      }}
    >
      <TileRenderDiagnostics visualRenderMode={effectiveVisualRenderMode} />
      <TileViewportObserver
        containerRef={frameRef}
        pageNumber={pageNumber}
        zoomPercent={effectiveVisualZoom}
        interactionActive={isInteractionActive}
        maxVisibleTileIds={12}
        publishThrottleMs={120}
        interactionPublishThrottleMs={280}
        writeViewportAttributes={false}
        onSnapshot={handleViewportSnapshot}
      />

      {visibleLayer ? (
        <div
          className="absolute left-0 top-0"
          data-knex-pdf-tile-page-surface="active"
          data-knex-pdf-tile-generation-id={visibleLayer.id}
          data-knex-pdf-generation-id={visibleLayer.id}
          data-knex-pdf-layer-visible={activeLayerVisible ? "true" : "false"}
          data-knex-pdf-active-backend={visibleLayer.activeBackend}
          data-knex-pdf-preferred-backend={visibleLayer.preferredBackend}
          data-knex-pdf-backend-version={visibleLayer.backendVersion}
          data-knex-pdf-render-version={visibleLayer.renderVersion}
          data-knex-pdf-final-render-version={visibleLayer.finalRenderVersion}
          data-knex-pdf-tile-layer-transform={visibleLayerTransform}
          data-knex-pdf-tile-layer-render-zoom={visibleLayer.geometry.zoom}
          data-knex-pdf-tile-layer-visual-zoom={visualScale}
          data-knex-pdf-tile-layer-visual-ratio={
            visualScale / Math.max(MIN_LAYOUT_SCALE, visibleLayer.geometry.zoom)
          }
          style={{
            width: `${visibleLayer.geometry.cssWidth}px`,
            height: `${visibleLayer.geometry.cssHeight}px`,
            opacity: activeLayerVisible ? 1 : 0,
            pointerEvents: "none",
            transform: visibleLayerTransform,
            transformOrigin: "0 0",
            willChange: isInteractionActive ? "transform" : "auto",
            zIndex: activeLayerVisible ? 2 : 0,
          }}
        >
          <PdfTileLayer
            documentId={documentId}
            pdfFileId={pdfFileId}
            session={session}
            geometry={visibleLayer.geometry}
            tiles={visibleLayer.tiles}
            renderQuality={visibleLayer.renderQuality}
            renderPhase={visibleLayer.renderPhase}
            renderText={renderText}
            tileRenderMode={visibleLayer.tileRenderMode}
            pagePriority={pagePriority}
            isActivePage={isActivePage}
            backendVersion={visibleLayer.backendVersion}
            finalRenderVersion={visibleLayer.finalRenderVersion}
            renderVersion={visibleLayer.renderVersion}
            generationId={visibleLayer.id}
            activeBackend={visibleLayer.activeBackend}
            preferredBackend={visibleLayer.preferredBackend}
            tileRows={visibleLayer.tileRows}
            tileColumns={visibleLayer.tileColumns}
            layerSurface="active"
            layerVisible={activeLayerVisible}
            interactionActive={isInteractionActive}
            suspendMountingDuringInteraction={true}
          />
        </div>
      ) : null}

      {pendingLayer ? (
        <div
          className="absolute left-0 top-0"
          data-knex-pdf-tile-page-surface="pending"
          data-knex-pdf-tile-generation-id={pendingLayer.id}
          data-knex-pdf-generation-id={pendingLayer.id}
          data-knex-pdf-layer-visible={pendingLayerVisible ? "true" : "false"}
          data-knex-pdf-active-backend={pendingLayer.activeBackend}
          data-knex-pdf-preferred-backend={pendingLayer.preferredBackend}
          data-knex-pdf-backend-version={pendingLayer.backendVersion}
          data-knex-pdf-render-version={pendingLayer.renderVersion}
          data-knex-pdf-final-render-version={pendingLayer.finalRenderVersion}
          data-knex-pdf-tile-ready-count={pendingReadyCount}
          data-knex-pdf-tile-layer-transform={pendingLayerTransform}
          data-knex-pdf-tile-layer-render-zoom={pendingLayer.geometry.zoom}
          data-knex-pdf-tile-layer-visual-zoom={visualScale}
          data-knex-pdf-tile-layer-visual-ratio={
            visualScale / Math.max(MIN_LAYOUT_SCALE, pendingLayer.geometry.zoom)
          }
          aria-hidden={pendingLayerVisible ? "false" : "true"}
          style={{
            width: `${pendingLayer.geometry.cssWidth}px`,
            height: `${pendingLayer.geometry.cssHeight}px`,
            opacity: pendingLayerVisible ? 1 : 0,
            pointerEvents: "none",
            transform: pendingLayerTransform,
            transformOrigin: "0 0",
            willChange: isInteractionActive ? "transform" : "auto",
            zIndex: pendingLayerVisible ? 3 : 0,
          }}
        >
          <PdfTileLayer
            documentId={documentId}
            pdfFileId={pdfFileId}
            session={session}
            geometry={pendingLayer.geometry}
            tiles={pendingLayer.tiles}
            renderQuality={pendingLayer.renderQuality}
            renderPhase={pendingLayer.renderPhase}
            renderText={renderText}
            tileRenderMode={pendingLayer.tileRenderMode}
            pagePriority={pagePriority}
            isActivePage={isActivePage}
            backendVersion={pendingLayer.backendVersion}
            finalRenderVersion={pendingLayer.finalRenderVersion}
            renderVersion={pendingLayer.renderVersion}
            generationId={pendingLayer.id}
            activeBackend={pendingLayer.activeBackend}
            preferredBackend={pendingLayer.preferredBackend}
            tileRows={pendingLayer.tileRows}
            tileColumns={pendingLayer.tileColumns}
            layerSurface="pending"
            layerVisible={pendingLayerVisible}
            onTileReady={handlePendingTileReady}
            interactionActive={isInteractionActive}
            suspendMountingDuringInteraction={true}
          />
        </div>
      ) : null}

      {error ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-rose-50/90 p-4 text-center text-xs text-rose-700">
          {error}
        </div>
      ) : null}
    </div>
  );
}
