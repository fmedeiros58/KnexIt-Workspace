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
import { resolveServerTileFallbackPolicy } from "../../knex-pdf-engine/server-tiles/serverTileFallbackPolicy";
import type {
  PdfCanvasTextRenderState,
  PdfPageCanvasProps,
} from "../PdfPageCanvas";
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
  backendVersion: number;
  finalRenderVersion: number;
  tileSizeCss: number;
  overlapPx: number;
};

export type PdfTiledPageCanvasProps = PdfPageCanvasProps & {
  visualRenderMode?: KnexPdfVisualRenderMode;
  pdfFileId?: string;
};

const FALLBACK_PAGE_WIDTH_PT = 612;
const FALLBACK_PAGE_HEIGHT_PT = 792;
const MIN_LAYOUT_SCALE = 0.01;
const TILE_OVERLAP_PX = 2;
const TILE_GEOMETRY_MAX_BITMAP_PIXELS = 1_000_000_000;
const TILE_GEOMETRY_MAX_BITMAP_SIDE = 1_000_000;
const TILE_GEOMETRY_PREVIEW_MAX_OUTPUT_SCALE = 4;
const TILE_GEOMETRY_WARMUP_MAX_OUTPUT_SCALE = 4.5;
const TILE_GEOMETRY_FINAL_MAX_OUTPUT_SCALE = 6;
const TILE_GEOMETRY_PREVIEW_MIN_OUTPUT_SCALE = 3.75;
const TILE_GEOMETRY_WARMUP_MIN_OUTPUT_SCALE = 4;
const TILE_GEOMETRY_FINAL_MIN_OUTPUT_SCALE = 4.5;
const INTERACTION_TILE_LAYER_DEBOUNCE_MS = 48;

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

function resolveTileCssSize(renderPhase: KnexPdfRenderPhase): number {
  if (renderPhase === "settled-final") return 512;
  if (renderPhase === "interactive-preview") return 1024;
  return 768;
}

function resolveTileGeometryMaxOutputScale(
  renderPhase: KnexPdfRenderPhase,
): number {
  if (renderPhase === "settled-final") {
    return TILE_GEOMETRY_FINAL_MAX_OUTPUT_SCALE;
  }

  if (renderPhase === "warmup-preview") {
    return TILE_GEOMETRY_WARMUP_MAX_OUTPUT_SCALE;
  }

  return TILE_GEOMETRY_PREVIEW_MAX_OUTPUT_SCALE;
}

function resolveTileGeometryMinOutputScale(
  renderPhase: KnexPdfRenderPhase,
): number {
  if (renderPhase === "settled-final") {
    return TILE_GEOMETRY_FINAL_MIN_OUTPUT_SCALE;
  }

  if (renderPhase === "warmup-preview") {
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

    if (!response.ok) {
      throw new Error(`server-pdf-source-upload-failed-${response.status}`);
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
  finalRenderVersion: number;
  tileSizeCss: number;
  overlapPx: number;
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
    `fv=${input.finalRenderVersion}`,
    `tile=${input.tileSizeCss}`,
    `overlap=${input.overlapPx}`,
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
  backendVersion: number;
  finalRenderVersion: number;
  tileSizeCss: number;
  overlapPx: number;
}): TileLayerSnapshot {
  return {
    ...input,
    tiles: input.tiles,
  };
}

function getLayerTransform(input: {
  currentGeometry: KnexPdfPageGeometry;
  layerGeometry: KnexPdfPageGeometry;
}): string {
  const scale =
    input.currentGeometry.zoom / Math.max(0.0001, input.layerGeometry.zoom);

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
}): PdfCanvasTextRenderState {
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
    `fv=${input.finalRenderVersion}`,
  ].join("|");

  return {
    documentId: input.documentId,
    pageNumber: input.pageNumber,
    backend: "pdfjs",
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
    renderMode: input.renderText ? "hybrid-semantic" : "hybrid-visual",
    textLayerMode: input.renderText ? "semantic" : "visual",
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
  const frameRef = useRef<HTMLDivElement | null>(null);
  const documentId = useMemo(() => getRenderDocumentId(session), [session]);
  const [pageBaseSize, setPageBaseSize] = useState<PdfPageBaseSize>(() => {
    return (
      readCachedPageBaseSize(session, pageNumber) ?? {
        width: FALLBACK_PAGE_WIDTH_PT,
        height: FALLBACK_PAGE_HEIGHT_PT,
      }
    );
  });
  const [error, setError] = useState<string | null>(null);
  const [serverPdfSourceReady, setServerPdfSourceReady] = useState(false);

  useEffect(() => {
    if (!canUseServerTileMode(visualRenderMode)) {
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
    visualRenderMode,
  ]);

  useEffect(() => {
    const cachedSize = readCachedPageBaseSize(session, pageNumber);

    if (cachedSize) {
      setPageBaseSize((current) =>
        arePageBaseSizesEquivalent(current, cachedSize)
          ? current
          : cachedSize,
      );
    }
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

  const renderScale = useMemo(() => zoomPercentToScale(zoom), [zoom]);
  const effectiveRenderQuality = useMemo(
    () =>
      resolveRenderQualityForPhase({
        backend: "pdfjs",
        phase: renderPhase,
        requestedQuality: renderQuality,
        zoom,
      }),
    [renderPhase, renderQuality, zoom],
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
        minimumOutputScale: resolveTileGeometryMinOutputScale(renderPhase),
        maxOutputScale: resolveTileGeometryMaxOutputScale(renderPhase),
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
        tileSizeCss: resolveTileCssSize(renderPhase),
        overlapPx: TILE_OVERLAP_PX,
      }),
    [geometry, renderPhase],
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
        visualRenderMode,
        serverAvailable:
          canUseServerTileMode(visualRenderMode) && serverPdfSourceReady,
        localTilesAvailable: true,
        reason: serverPdfSourceReady
          ? "server-tile-client-fallback"
          : "server-pdf-source-upload-pending",
      }),
    [serverPdfSourceReady, visualRenderMode],
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
          finalRenderVersion,
          tileSizeCss: tilePlan.tileSizeCss,
          overlapPx: tilePlan.overlapPx,
          tileRenderMode: serverTileDecision.renderMode,
          tileCount: tilesToRender.length,
        }),
        geometry,
        tiles: tilesToRender,
        renderQuality: effectiveRenderQuality,
        renderPhase,
        backendVersion: engineState.backendVersion,
        finalRenderVersion,
        tileSizeCss: tilePlan.tileSizeCss,
        overlapPx: tilePlan.overlapPx,
      }),
    [
      documentId,
      effectiveRenderQuality,
      engineState.backendVersion,
      finalRenderVersion,
      geometry,
      pageNumber,
      renderPhase,
      serverTileDecision.renderMode,
      tilePlan.overlapPx,
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
  const pendingReadyTilesRef = useRef<Set<string>>(new Set());
  const isInteractionActive =
    isZooming || isScrolling || renderPhase !== "settled-final";
  const shouldRefreshTilesDuringInteraction =
    isInteractionActive &&
    !isZooming &&
    (isActivePage || isPageVisible || isWarmupPage);

  useEffect(() => {
    if (!activeLayer) {
      if (pendingLayer?.id === currentLayer.id) {
        return;
      }

      pendingReadyTilesRef.current = new Set();
      setPendingReadyCount(0);
      setPendingLayer(currentLayer);
      return;
    }

    if (currentLayer.id === activeLayer.id) {
      if (pendingLayer && pendingLayer.id !== activeLayer.id) {
        pendingReadyTilesRef.current = new Set();
        setPendingReadyCount(0);
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
      setPendingLayer(currentLayer);
    };

    if (shouldRefreshTilesDuringInteraction) {
      const timerId = window.setTimeout(
        queuePendingLayer,
        INTERACTION_TILE_LAYER_DEBOUNCE_MS,
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
    pendingLayer,
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

  useEffect(() => {
    if (!pendingLayer || !pendingLayerReady || !pendingLayerMatchesCurrent) {
      return;
    }

    let settleFrameId: number | null = null;

    const promoteFrameId = window.requestAnimationFrame(() => {
      setActiveLayer(pendingLayer);

      settleFrameId = window.requestAnimationFrame(() => {
        setPendingLayer((current) =>
          current?.id === pendingLayer.id ? null : current,
        );
        pendingReadyTilesRef.current = new Set();
        setPendingReadyCount(0);
      });
    });

    return () => {
      window.cancelAnimationFrame(promoteFrameId);

      if (settleFrameId !== null) {
        window.cancelAnimationFrame(settleFrameId);
      }
    };
  }, [pendingLayer, pendingLayerMatchesCurrent, pendingLayerReady]);

  useEffect(() => {
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
      zoom,
      renderText,
    });

    onRendered(renderedPage);
    onCanvasTextRenderStateChange?.(
      createTiledCanvasTextState({
        documentId,
        pageNumber,
        renderPhase,
        renderQuality: effectiveRenderQuality,
        renderScale: geometry.zoom,
        outputScale: geometry.outputScale,
        zoom,
        renderText,
        backendVersion: engineState.backendVersion,
        finalRenderVersion,
      }),
    );
  }, [
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
    onCanvasTextRenderStateChange,
    onRendered,
    pageNumber,
    renderPhase,
    renderText,
    zoom,
  ]);

  const visibleLayer = activeLayer;
  const visibleLayerTransform = visibleLayer
    ? getLayerTransform({
        currentGeometry: geometry,
        layerGeometry: visibleLayer.geometry,
      })
    : "none";

  return (
    <div
      ref={frameRef}
      className="relative shrink-0 overflow-hidden rounded bg-white"
      data-knexread-page-canvas-frame="true"
      data-knex-pdf-visual-render-mode={visualRenderMode}
      data-knex-pdf-effective-visual-render-mode={
        serverTileDecision.renderMode
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
      data-knex-pdf-tiled-page="true"
      data-page-number={pageNumber}
      data-knex-pdf-css-width={geometry.cssWidth}
      data-knex-pdf-css-height={geometry.cssHeight}
      data-knex-pdf-output-scale={geometry.outputScale}
      data-knex-pdf-tile-size-css={tilePlan.tileSizeCss}
      data-knex-pdf-tile-overlap-px={tilePlan.overlapPx}
      data-knex-pdf-tile-count={tilePlan.totalTiles}
      data-knex-pdf-active-tile-count={tilesToRender.length}
      data-knex-pdf-active-tile-layer-id={visibleLayer?.id ?? ""}
      data-knex-pdf-pending-tile-layer-id={pendingLayer?.id ?? ""}
      data-knex-pdf-pending-tile-ready-count={pendingReadyCount}
      data-knex-pdf-pending-tile-ready={pendingLayerReady ? "true" : "false"}
      data-knex-pdf-interaction-tile-refresh={
        shouldRefreshTilesDuringInteraction ? "true" : "false"
      }
      data-knex-pdf-visible-tile-count={
        viewportSnapshot?.visibleTileIds.length ?? 0
      }
      data-knex-pdf-central-tile-id={viewportSnapshot?.centralTileId ?? ""}
      data-knex-pdf-render-phase={renderPhase}
      data-knex-pdf-render-quality={effectiveRenderQuality}
      data-knex-pdf-zooming={isZooming ? "true" : "false"}
      data-knex-pdf-scrolling={isScrolling ? "true" : "false"}
      style={{
        boxSizing: "content-box",
        width: `${geometry.cssWidth}px`,
        height: `${geometry.cssHeight}px`,
        minWidth: `${geometry.cssWidth}px`,
        minHeight: `${geometry.cssHeight}px`,
        contain: "layout paint size style",
        isolation: "isolate",
        backgroundColor: "#ffffff",
        boxShadow: "0 0 0 1px rgb(212 212 216)",
      }}
    >
      <TileRenderDiagnostics visualRenderMode={visualRenderMode} />
      <TileViewportObserver
        containerRef={frameRef}
        pageNumber={pageNumber}
        onSnapshot={setViewportSnapshot}
      />

      {visibleLayer ? (
        <div
          className="absolute left-0 top-0"
          data-knex-pdf-tile-page-surface="active"
          data-knex-pdf-tile-generation-id={visibleLayer.id}
          data-knex-pdf-tile-layer-transform={visibleLayerTransform}
          style={{
            width: `${visibleLayer.geometry.cssWidth}px`,
            height: `${visibleLayer.geometry.cssHeight}px`,
            opacity: pendingLayerReady && pendingLayerMatchesCurrent ? 0 : 1,
            pointerEvents: "none",
            transform: visibleLayerTransform,
            transformOrigin: "0 0",
            willChange: isInteractionActive ? "transform" : "auto",
            zIndex: pendingLayerReady && pendingLayerMatchesCurrent ? 1 : 2,
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
            tileRenderMode={serverTileDecision.renderMode}
            pagePriority={pagePriority}
            isActivePage={isActivePage}
            backendVersion={visibleLayer.backendVersion}
            finalRenderVersion={visibleLayer.finalRenderVersion}
            generationId={visibleLayer.id}
          />
        </div>
      ) : null}

      {pendingLayer ? (
        <div
          className="absolute left-0 top-0"
          data-knex-pdf-tile-page-surface="pending"
          data-knex-pdf-tile-generation-id={pendingLayer.id}
          data-knex-pdf-tile-ready-count={pendingReadyCount}
          aria-hidden={pendingLayerReady ? "false" : "true"}
          style={{
            width: `${pendingLayer.geometry.cssWidth}px`,
            height: `${pendingLayer.geometry.cssHeight}px`,
            opacity: pendingLayerReady && pendingLayerMatchesCurrent ? 1 : 0,
            pointerEvents: "none",
            transform: "none",
            transformOrigin: "0 0",
            zIndex: pendingLayerReady && pendingLayerMatchesCurrent ? 3 : 0,
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
            tileRenderMode={serverTileDecision.renderMode}
            pagePriority={pagePriority}
            isActivePage={isActivePage}
            backendVersion={pendingLayer.backendVersion}
            finalRenderVersion={pendingLayer.finalRenderVersion}
            generationId={pendingLayer.id}
            onTileReady={handlePendingTileReady}
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
