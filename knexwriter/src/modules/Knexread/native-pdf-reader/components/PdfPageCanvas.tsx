"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PdfRenderQualityMode } from "../types";
import type { NativePdfSession } from "../services";
import {
  cancelRenderTaskToken,
  buildKnexPdfPageGeometry,
  createRenderTaskToken,
  getKnexPdfDocumentHandleWithBackend,
  isRenderCancellation,
  isRenderTaskTokenCurrent,
  PageBitmapCache,
  renderKnexPdfPageWithBackend,
  renderKnexPdfPageToCanvas,
  resolveRenderQualityForPhase,
  runKnexPdfRenderTask,
  type KnexPdfRenderPhase,
  type KnexPdfPageGeometry,
  type PageBitmapCacheEntryRequirements,
  type PageBitmapCacheKeyInput,
  type KnexPdfRenderedPage as RenderedPdfPage,
  useKnexPdfEngine,
  useKnexPdfEngineState,
} from "../knex-pdf-engine";
import {
  getKnexPdfRenderInteractionState,
  subscribeKnexPdfRenderInteractionIdle,
} from "./PdfInteractionRenderGuard";

type StablePageBox = {
  cssWidth: number;
  cssHeight: number;
  pageWidthPt: number;
  pageHeightPt: number;
  renderScale: number;
  outputScale?: number;
  bitmapWidth?: number;
  bitmapHeight?: number;
  rotation?: number;
  geometry?: KnexPdfPageGeometry;
};

type CanvasBufferIndex = 0 | 1;

type CanvasTextMode = "normal" | "without-text" | "unknown";

type RenderIdentity = {
  documentId: string;
  pageNumber: number;
  backend: string;
  renderPhase: KnexPdfRenderPhase;
  renderQuality: PdfRenderQualityMode;
  renderScale: number;
  outputScale: number;
  cssWidth: number;
  cssHeight: number;
  bitmapWidth: number;
  bitmapHeight: number;
  rotation: number;
  zoom: number;
  renderText: boolean;
  canvasTextMode: CanvasTextMode;
  renderVersion: number;
  backendVersion: number;
  finalRenderVersion: number;
};

type RenderedPageWithBackendDiagnostics = RenderedPdfPage & {
  activeBackend?: string;
  requestedBackend?: string;
  fallbackUsed?: boolean;
  failedBackend?: string;
  fallbackReason?: string;
  renderDurationMs?: number;
  renderPhase?: KnexPdfRenderPhase;
  renderQuality?: PdfRenderQualityMode;
};

type CachedPageBitmap = {
  bitmap: ImageBitmap;
  page: RenderedPageWithBackendDiagnostics;
  box: StablePageBox;
  key: string;
};

export type PdfCanvasTextRenderState = {
  documentId: string;
  pageNumber: number;
  backend: string;
  renderPhase: KnexPdfRenderPhase;
  renderQuality: string;
  renderScale: number;
  outputScale: number;
  zoom: number;
  renderText: boolean;
  canvasTextMode: CanvasTextMode;
  filteredTextOperationCount: number;
  renderIdentity: string;
  renderVersion: number;
  backendVersion: number;
  finalRenderVersion: number;
  cacheLookup?: string;
  cacheKey?: string;
  cacheSize?: number;
  cacheBytes?: number;
};

const FALLBACK_PAGE_WIDTH_PT = 612;
const FALLBACK_PAGE_HEIGHT_PT = 792;
const MIN_PAGE_SIDE_PX = 1;
const MIN_LAYOUT_SCALE = 0.01;
const RENDER_IDENTITY_NUMBER_PRECISION = 4;
const DEFERRED_RENDER_WAKEUP_MS = 140;
const PAGE_BITMAP_CACHE_MAX_ENTRIES = 48;
const PAGE_BITMAP_CACHE_MAX_BYTES = 384 * 1024 * 1024;

const pageBitmapCache = new PageBitmapCache<CachedPageBitmap>({
  maxEntries: PAGE_BITMAP_CACHE_MAX_ENTRIES,
  maxBytes: PAGE_BITMAP_CACHE_MAX_BYTES,
  estimateBytes: (value) => value.bitmap.width * value.bitmap.height * 4,
  dispose: (value) => {
    try {
      value.bitmap.close();
    } catch {
      // ImageBitmap.close() is best-effort and may throw after prior disposal.
    }
  },
});

function safeNumber(
  value: number | null | undefined,
  fallback = 0,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function normalizeIdentityNumber(value: number): number {
  const factor = 10 ** RENDER_IDENTITY_NUMBER_PRECISION;
  return Math.round(safeNumber(value, 0) * factor) / factor;
}

function zoomPercentToScale(zoom: number): number {
  return Math.max(MIN_LAYOUT_SCALE, safeNumber(zoom, 100) / 100);
}

function normalizeCssSide(value: number, fallback = 1): number {
  return Math.max(
    MIN_PAGE_SIDE_PX,
    Math.ceil(safeNumber(value, fallback)),
  );
}

function clampPositive(value: number, fallback = 1): number {
  return Math.max(MIN_PAGE_SIDE_PX, safeNumber(value, fallback));
}

function nowMs(): number {
  return typeof performance !== "undefined" &&
    typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function requestNextAnimationFrame(callback: () => void): number {
  if (typeof globalThis.requestAnimationFrame === "function") {
    return globalThis.requestAnimationFrame(callback);
  }

  return globalThis.setTimeout(callback, 0) as unknown as number;
}

function cancelNextAnimationFrame(frameId: number) {
  if (typeof globalThis.cancelAnimationFrame === "function") {
    globalThis.cancelAnimationFrame(frameId);
    return;
  }

  globalThis.clearTimeout(
    frameId as unknown as ReturnType<typeof globalThis.setTimeout>,
  );
}

function getRenderDocumentId(session: NativePdfSession): string {
  return (
    session.id ??
    session.fileName ??
    session.file?.name ??
    "knex-pdf-document"
  );
}

function resolveCanvasTextMode(renderText: boolean): CanvasTextMode {
  return renderText ? "normal" : "without-text";
}

function createRenderIdentityKey(identity: RenderIdentity): string {
  return [
    `doc=${identity.documentId}`,
    `p=${identity.pageNumber}`,
    `be=${identity.backend}`,
    `phase=${identity.renderPhase}`,
    `q=${identity.renderQuality}`,
    `rs=${normalizeIdentityNumber(identity.renderScale)}`,
    `os=${normalizeIdentityNumber(identity.outputScale)}`,
    `css=${normalizeIdentityNumber(identity.cssWidth)}x${normalizeIdentityNumber(
      identity.cssHeight,
    )}`,
    `bmp=${normalizeIdentityNumber(identity.bitmapWidth)}x${normalizeIdentityNumber(
      identity.bitmapHeight,
    )}`,
    `rot=${normalizeIdentityNumber(identity.rotation)}`,
    `z=${normalizeIdentityNumber(identity.zoom)}`,
    `text=${identity.renderText ? "1" : "0"}`,
    `textMode=${identity.canvasTextMode}`,
    `rv=${identity.renderVersion}`,
    `bv=${identity.backendVersion}`,
    `fv=${identity.finalRenderVersion}`,
  ].join("|");
}

function parseDatasetInteger(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);

  return Number.isFinite(parsed) ? Math.max(0, parsed) : 0;
}

function createFallbackPageBox(zoom: number): StablePageBox {
  const scale = zoomPercentToScale(zoom);

  return {
    cssWidth: normalizeCssSide(FALLBACK_PAGE_WIDTH_PT * scale),
    cssHeight: normalizeCssSide(FALLBACK_PAGE_HEIGHT_PT * scale),
    pageWidthPt: FALLBACK_PAGE_WIDTH_PT,
    pageHeightPt: FALLBACK_PAGE_HEIGHT_PT,
    renderScale: scale,
    outputScale: 1,
    bitmapWidth: normalizeCssSide(FALLBACK_PAGE_WIDTH_PT * scale),
    bitmapHeight: normalizeCssSide(FALLBACK_PAGE_HEIGHT_PT * scale),
    rotation: 0,
  };
}

function arePageBoxesVisuallyEquivalent(
  a: StablePageBox,
  b: StablePageBox,
): boolean {
  return (
    Math.abs(a.cssWidth - b.cssWidth) < 0.5 &&
    Math.abs(a.cssHeight - b.cssHeight) < 0.5 &&
    Math.abs(a.pageWidthPt - b.pageWidthPt) < 0.01 &&
    Math.abs(a.pageHeightPt - b.pageHeightPt) < 0.01 &&
    Math.abs(a.renderScale - b.renderScale) < 0.0001
  );
}

function pageBoxFromRenderedPage(page: RenderedPdfPage): StablePageBox {
  if (page.geometry) {
    return {
      cssWidth: normalizeCssSide(page.geometry.cssWidth),
      cssHeight: normalizeCssSide(page.geometry.cssHeight),
      pageWidthPt: clampPositive(page.pageWidthPt, page.geometry.baseWidth),
      pageHeightPt: clampPositive(page.pageHeightPt, page.geometry.baseHeight),
      renderScale: Math.max(MIN_LAYOUT_SCALE, page.geometry.zoom),
      outputScale: Math.max(1, page.geometry.outputScale),
      bitmapWidth: Math.max(1, page.geometry.bitmapWidth),
      bitmapHeight: Math.max(1, page.geometry.bitmapHeight),
      rotation: page.geometry.rotation,
      geometry: page.geometry,
    };
  }

  const renderScale = Math.max(
    MIN_LAYOUT_SCALE,
    safeNumber(page.renderScale, 1),
  );

  const pageWidthPt = clampPositive(
    safeNumber(page.pageWidthPt, 0),
    safeNumber(page.cssWidth, FALLBACK_PAGE_WIDTH_PT) / renderScale,
  );

  const pageHeightPt = clampPositive(
    safeNumber(page.pageHeightPt, 0),
    safeNumber(page.cssHeight, FALLBACK_PAGE_HEIGHT_PT) / renderScale,
  );

  const cssWidth = normalizeCssSide(
    safeNumber(page.cssWidth, 0),
    pageWidthPt * renderScale,
  );

  const cssHeight = normalizeCssSide(
    safeNumber(page.cssHeight, 0),
    pageHeightPt * renderScale,
  );

  return {
    cssWidth,
    cssHeight,
    pageWidthPt,
    pageHeightPt,
    renderScale,
    outputScale: Math.max(1, safeNumber(page.outputScale, 1)),
    bitmapWidth: Math.max(1, safeNumber(page.width, cssWidth)),
    bitmapHeight: Math.max(1, safeNumber(page.height, cssHeight)),
    rotation: safeNumber(page.rotation, 0),
  };
}

function deriveNextPageBoxFromPrevious(input: {
  previous: StablePageBox | null;
  zoom: number;
}): StablePageBox {
  const scale = zoomPercentToScale(input.zoom);

  if (!input.previous) {
    return createFallbackPageBox(input.zoom);
  }

  return {
    cssWidth: normalizeCssSide(input.previous.pageWidthPt * scale),
    cssHeight: normalizeCssSide(input.previous.pageHeightPt * scale),
    pageWidthPt: input.previous.pageWidthPt,
    pageHeightPt: input.previous.pageHeightPt,
    renderScale: scale,
    outputScale: input.previous.outputScale,
    bitmapWidth: input.previous.bitmapWidth,
    bitmapHeight: input.previous.bitmapHeight,
    rotation: input.previous.rotation,
  };
}

function applyCanvasCssBox(input: {
  canvas: HTMLCanvasElement;
  box: StablePageBox;
}) {
  input.canvas.style.width = `${input.box.cssWidth}px`;
  input.canvas.style.height = `${input.box.cssHeight}px`;
  input.canvas.style.imageRendering = "auto";
  input.canvas.style.backgroundColor = "#ffffff";
}

function getCanvasRatio(input: {
  bitmapWidth: number;
  bitmapHeight: number;
  cssWidth: number;
  cssHeight: number;
}) {
  const ratioX = input.bitmapWidth / Math.max(1, input.cssWidth);
  const ratioY = input.bitmapHeight / Math.max(1, input.cssHeight);

  return {
    ratioX,
    ratioY,
    ratio: Math.min(ratioX, ratioY),
  };
}

function getCanvasRatioForBox(input: {
  canvas: HTMLCanvasElement;
  box: StablePageBox;
}) {
  return getCanvasRatio({
    bitmapWidth: Math.max(1, input.canvas.width),
    bitmapHeight: Math.max(1, input.canvas.height),
    cssWidth: input.box.cssWidth,
    cssHeight: input.box.cssHeight,
  });
}

function getRasterCacheRenderMode(renderText: boolean): string {
  return renderText ? "bitmap-only" : "hybrid-visual";
}

function createBitmapCacheInput(input: {
  documentId: string;
  backend: string;
  pageNumber: number;
  geometry: KnexPdfPageGeometry;
  quality: PdfRenderQualityMode;
  renderPhase: KnexPdfRenderPhase;
  renderMode: string;
  backendVersion: number;
}): PageBitmapCacheKeyInput {
  return {
    documentId: input.documentId,
    backend: input.backend,
    pageNumber: input.pageNumber,
    region: "page",
    renderScale: input.geometry.zoom,
    zoomBucket: input.geometry.zoom,
    devicePixelRatio: input.geometry.devicePixelRatio,
    renderMode: input.renderMode,
    outputScale: input.geometry.outputScale,
    cssWidth: input.geometry.cssWidth,
    cssHeight: input.geometry.cssHeight,
    width: input.geometry.bitmapWidth,
    height: input.geometry.bitmapHeight,
    quality: input.quality,
    renderPhase: input.renderPhase,
    rotation: input.geometry.rotation,
    backendVersion: input.backendVersion,
  };
}

function createBitmapCacheRequirements(
  input: PageBitmapCacheKeyInput,
  usage: "final" | "preview",
): PageBitmapCacheEntryRequirements {
  if (usage === "preview") {
    return {
      documentId: input.documentId,
      backend: input.backend,
      pageNumber: input.pageNumber,
      region: input.region,
      renderMode: input.renderMode,
      rotation: input.rotation,
      backendVersion: input.backendVersion,
      exactBackendVersion: true,
      minRenderPhase: "interactive-preview",
      numericTolerance: 0.01,
    };
  }

  return {
    documentId: input.documentId,
    backend: input.backend,
    pageNumber: input.pageNumber,
    region: input.region,
    renderScale: input.renderScale,
    zoomBucket: input.zoomBucket,
    devicePixelRatio: input.devicePixelRatio,
    renderMode: input.renderMode,
    cssWidth: input.cssWidth,
    cssHeight: input.cssHeight,
    width: input.width,
    height: input.height,
    rotation: input.rotation,
    backendVersion: input.backendVersion,
    exactBackendVersion: true,
    minOutputScale: input.outputScale,
    minBitmapCssRatio: input.outputScale,
    minQuality: input.quality,
    minRenderPhase: input.renderPhase,
    exactRenderPhase: true,
  };
}

async function createImageBitmapFromCanvas(
  canvas: HTMLCanvasElement,
): Promise<ImageBitmap | null> {
  if (typeof globalThis.createImageBitmap !== "function") {
    return null;
  }

  return globalThis.createImageBitmap(canvas);
}

function copyImageBitmapToVisibleCanvas(input: {
  bitmap: ImageBitmap;
  visibleCanvas: HTMLCanvasElement;
  box: StablePageBox;
}) {
  const { bitmap, visibleCanvas, box } = input;

  visibleCanvas.width = Math.max(1, bitmap.width);
  visibleCanvas.height = Math.max(1, bitmap.height);

  applyCanvasCssBox({
    canvas: visibleCanvas,
    box,
  });

  const context = visibleCanvas.getContext("2d", {
    alpha: false,
    desynchronized: false,
  });

  if (!context) {
    throw new Error("Could not initialize KnexPDF visible canvas.");
  }

  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.clearRect(0, 0, visibleCanvas.width, visibleCanvas.height);
  context.drawImage(bitmap, 0, 0);
  context.restore();

  const ratio = getCanvasRatioForBox({
    canvas: visibleCanvas,
    box,
  });

  visibleCanvas.dataset.knexPdfCommittedOutputScale = String(ratio.ratio);
  visibleCanvas.dataset.knexPdfCommittedOutputScaleX = String(ratio.ratioX);
  visibleCanvas.dataset.knexPdfCommittedOutputScaleY = String(ratio.ratioY);
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

function getRenderPhaseRank(phase: string | undefined): number {
  if (phase === "settled-final") return 3;
  if (phase === "warmup-preview") return 2;
  if (phase === "interactive-preview") return 1;
  return 0;
}

function getRenderQualityRank(quality: string | undefined): number {
  if (quality === "extreme") return 5;
  if (quality === "high") return 4;
  if (quality === "balanced") return 3;
  if (quality === "standard") return 2;
  if (quality === "low") return 1;
  return 0;
}

function readCanvasDatasetNumber(
  canvas: HTMLCanvasElement,
  key: string,
  fallback = 0,
): number {
  const value = canvas.dataset[key];
  const parsed = Number.parseFloat(value ?? "");

  return Number.isFinite(parsed) ? parsed : fallback;
}

function readCanvasCommittedOutputScale(canvas: HTMLCanvasElement): number {
  return Math.max(
    readCanvasDatasetNumber(canvas, "knexPdfOutputScale", 0),
    readCanvasDatasetNumber(canvas, "knexPdfBitmapCssRatio", 0),
    readCanvasDatasetNumber(canvas, "knexPdfRenderedOutputScale", 0),
    readCanvasDatasetNumber(canvas, "knexPdfDisplayOutputScale", 0),
  );
}

function shouldPromoteRenderedCanvas(input: {
  currentCanvas: HTMLCanvasElement | null;
  targetCanvas: HTMLCanvasElement;
  committedIdentity: RenderIdentity;
}): boolean {
  const { currentCanvas, targetCanvas, committedIdentity } = input;

  if (!currentCanvas || currentCanvas === targetCanvas) {
    return true;
  }

  const currentPageNumber = Number.parseInt(
    currentCanvas.dataset.knexPdfPageNumber ?? "",
    10,
  );

  if (
    Number.isFinite(currentPageNumber) &&
    currentPageNumber !== committedIdentity.pageNumber
  ) {
    return true;
  }

  const currentPhase = currentCanvas.dataset.knexPdfRenderPhase;
  const currentQuality = currentCanvas.dataset.knexPdfRenderQuality;
  const currentPhaseRank = getRenderPhaseRank(currentPhase);
  const nextPhaseRank = getRenderPhaseRank(committedIdentity.renderPhase);

  if (nextPhaseRank > currentPhaseRank) {
    return true;
  }

  if (nextPhaseRank < currentPhaseRank) {
    targetCanvas.dataset.knexPdfAcceptanceReason = "not-promoted";
    targetCanvas.dataset.knexPdfRejectedRenderReason =
      "lower-render-phase-than-active-canvas";
    return false;
  }

  const currentQualityRank = getRenderQualityRank(currentQuality);
  const nextQualityRank = getRenderQualityRank(
    committedIdentity.renderQuality,
  );

  if (nextQualityRank > currentQualityRank) {
    return true;
  }

  if (nextQualityRank < currentQualityRank) {
    targetCanvas.dataset.knexPdfAcceptanceReason = "not-promoted";
    targetCanvas.dataset.knexPdfRejectedRenderReason =
      "lower-render-quality-than-active-canvas";
    return false;
  }

  const currentOutputScale = readCanvasCommittedOutputScale(currentCanvas);

  if (committedIdentity.outputScale + 0.0001 < currentOutputScale) {
    targetCanvas.dataset.knexPdfAcceptanceReason = "not-promoted";
    targetCanvas.dataset.knexPdfRejectedRenderReason =
      "lower-output-scale-than-active-canvas";
    return false;
  }

  return true;
}

function normalizeBackendKind(
  backend: string,
): "pdfjs" | "pdfium" | "mupdf" {
  if (backend === "pdfium" || backend === "mupdf") return backend;
  return "pdfjs";
}

function resolveStableRenderQuality(input: {
  backend: "pdfjs" | "pdfium" | "mupdf";
  phase: KnexPdfRenderPhase;
  requestedQuality: PdfRenderQualityMode;
  zoom: number;
  isActivePage: boolean;
  isPageVisible: boolean;
  isWarmupPage: boolean;
}): PdfRenderQualityMode {
  const resolved = resolveRenderQualityForPhase({
    backend: input.backend,
    phase: input.phase,
    requestedQuality: input.requestedQuality,
    zoom: input.zoom,
  });

  if (
    input.phase === "settled-final" &&
    (input.isActivePage || input.isPageVisible || input.isWarmupPage)
  ) {
    return "extreme";
  }

  return resolved;
}

function shouldDeferRenderDuringInteraction(input: {
  hasRenderedOnce: boolean;
  renderPhase: KnexPdfRenderPhase;
  isZooming: boolean;
  isScrolling: boolean;
}): boolean {
  if (!input.hasRenderedOnce) return false;

  if (input.isZooming || input.isScrolling) {
    return true;
  }

  return input.renderPhase === "interactive-preview";
}

function copyCanvasDiagnosticDatasets(input: {
  sourceCanvas: HTMLCanvasElement;
  visibleCanvas: HTMLCanvasElement;
}) {
  const { sourceCanvas, visibleCanvas } = input;

  visibleCanvas.dataset.knexPdfRequestedOutputScale =
    sourceCanvas.dataset.knexPdfRequestedOutputScale ?? "";
  visibleCanvas.dataset.knexPdfMinimumOutputScale =
    sourceCanvas.dataset.knexPdfMinimumOutputScale ?? "";
  visibleCanvas.dataset.knexPdfQualityMaxOutputScale =
    sourceCanvas.dataset.knexPdfQualityMaxOutputScale ?? "";
  visibleCanvas.dataset.knexPdfWasOutputScaleClamped =
    sourceCanvas.dataset.knexPdfWasOutputScaleClamped ?? "";
  visibleCanvas.dataset.knexPdfWasOutputScaleFloorApplied =
    sourceCanvas.dataset.knexPdfWasOutputScaleFloorApplied ?? "";
  visibleCanvas.dataset.knexPdfRenderIntent =
    sourceCanvas.dataset.knexPdfRenderIntent ?? "";
  visibleCanvas.dataset.knexPdfBitmapRenderPhase =
    sourceCanvas.dataset.knexPdfBitmapRenderPhase ?? "";
  visibleCanvas.dataset.knexPdfOutputScaleX =
    sourceCanvas.dataset.knexPdfOutputScaleX ?? "";
  visibleCanvas.dataset.knexPdfOutputScaleY =
    sourceCanvas.dataset.knexPdfOutputScaleY ?? "";
  visibleCanvas.dataset.knexPdfCanvasTextRender =
    sourceCanvas.dataset.knexPdfCanvasTextRender ?? "";
  visibleCanvas.dataset.knexPdfCanvasTextMode =
    sourceCanvas.dataset.knexPdfCanvasTextMode ?? "";
  visibleCanvas.dataset.knexPdfFilteredTextOperations =
    sourceCanvas.dataset.knexPdfFilteredTextOperations ?? "";
  visibleCanvas.dataset.knexPdfiumRenderProfile =
    sourceCanvas.dataset.knexPdfiumRenderProfile ?? "";
  visibleCanvas.dataset.knexPdfiumColorConversion =
    sourceCanvas.dataset.knexPdfiumColorConversion ?? "";
}

function applyCanvasBufferVisibility(input: {
  canvas: HTMLCanvasElement;
  bufferIndex: CanvasBufferIndex;
  active: boolean;
}) {
  input.canvas.dataset.knexPdfBufferIndex = String(input.bufferIndex);
  input.canvas.dataset.knexPdfBufferState = input.active
    ? "active"
    : "inactive";

  input.canvas.style.removeProperty("opacity");
  input.canvas.style.visibility = input.active ? "visible" : "hidden";
  input.canvas.style.zIndex = input.active ? "2" : "1";
  input.canvas.style.pointerEvents = "none";
  input.canvas.style.backgroundColor = "#ffffff";
  input.canvas.setAttribute("aria-hidden", input.active ? "false" : "true");
}

function copyRenderedCanvasToVisibleCanvas(input: {
  sourceCanvas: HTMLCanvasElement;
  visibleCanvas: HTMLCanvasElement;
  box: StablePageBox;
}) {
  const { sourceCanvas, visibleCanvas, box } = input;

  const targetWidth = Math.max(1, sourceCanvas.width);
  const targetHeight = Math.max(1, sourceCanvas.height);

  if (visibleCanvas.width !== targetWidth) {
    visibleCanvas.width = targetWidth;
  }

  if (visibleCanvas.height !== targetHeight) {
    visibleCanvas.height = targetHeight;
  }

  applyCanvasCssBox({
    canvas: visibleCanvas,
    box,
  });

  visibleCanvas.style.backgroundColor = "#ffffff";
  visibleCanvas.style.imageRendering = "auto";

  const context = visibleCanvas.getContext("2d", { alpha: false });

  if (!context) {
    throw new Error("Failed to update rendered canvas.");
  }

  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, visibleCanvas.width, visibleCanvas.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(sourceCanvas, 0, 0);
  context.restore();

  const bitmapRatio = getCanvasRatio({
    bitmapWidth: visibleCanvas.width,
    bitmapHeight: visibleCanvas.height,
    cssWidth: box.cssWidth,
    cssHeight: box.cssHeight,
  });

  visibleCanvas.dataset.knexPdfCssWidth = String(box.cssWidth);
  visibleCanvas.dataset.knexPdfCssHeight = String(box.cssHeight);
  visibleCanvas.dataset.knexPdfBitmapWidth = String(visibleCanvas.width);
  visibleCanvas.dataset.knexPdfBitmapHeight = String(visibleCanvas.height);
  visibleCanvas.dataset.knexPdfBitmapCssRatio = String(bitmapRatio.ratio);
  visibleCanvas.dataset.knexPdfOutputScale = String(bitmapRatio.ratio);
  visibleCanvas.dataset.knexPdfOutputScaleX = String(bitmapRatio.ratioX);
  visibleCanvas.dataset.knexPdfOutputScaleY = String(bitmapRatio.ratioY);
  visibleCanvas.dataset.knexPdfDisplayOutputScale = String(bitmapRatio.ratio);
  visibleCanvas.dataset.knexPdfDisplayOutputScaleX = String(
    bitmapRatio.ratioX,
  );
  visibleCanvas.dataset.knexPdfDisplayOutputScaleY = String(
    bitmapRatio.ratioY,
  );
}

function getRenderedPageBackendDiagnostics(input: {
  page: RenderedPdfPage;
  fallbackActiveBackend: string;
  fallbackRequestedBackend: string;
  renderPhase: KnexPdfRenderPhase;
  renderQuality: PdfRenderQualityMode;
}) {
  const pageWithDiagnostics = input.page as RenderedPageWithBackendDiagnostics;

  return {
    activeBackend:
      pageWithDiagnostics.activeBackend || input.fallbackActiveBackend,
    requestedBackend:
      pageWithDiagnostics.requestedBackend || input.fallbackRequestedBackend,
    fallbackUsed: Boolean(pageWithDiagnostics.fallbackUsed),
    failedBackend: pageWithDiagnostics.failedBackend || "",
    fallbackReason: pageWithDiagnostics.fallbackReason || "",
    renderDurationMs:
      typeof pageWithDiagnostics.renderDurationMs === "number" &&
      Number.isFinite(pageWithDiagnostics.renderDurationMs)
        ? String(Math.round(pageWithDiagnostics.renderDurationMs))
        : "",
    renderPhase: pageWithDiagnostics.renderPhase ?? input.renderPhase,
    renderQuality: pageWithDiagnostics.renderQuality ?? input.renderQuality,
  };
}

function writeCanvasBackendDataset(input: {
  canvas: HTMLCanvasElement;
  page: RenderedPdfPage;
  box: StablePageBox;
  fallbackActiveBackend: string;
  fallbackRequestedBackend: string;
  renderPhase: KnexPdfRenderPhase;
  renderQuality: PdfRenderQualityMode;
  renderPriority: number;
  isActivePage: boolean;
  isPageVisible: boolean;
  isWarmupPage: boolean;
  renderIdentity: RenderIdentity;
}) {
  const diagnostics = getRenderedPageBackendDiagnostics({
    page: input.page,
    fallbackActiveBackend: input.fallbackActiveBackend,
    fallbackRequestedBackend: input.fallbackRequestedBackend,
    renderPhase: input.renderPhase,
    renderQuality: input.renderQuality,
  });

  const bitmapRatio = getCanvasRatioForBox({
    canvas: input.canvas,
    box: input.box,
  });

  input.canvas.dataset.knexPdfBackend = diagnostics.activeBackend;
  input.canvas.dataset.knexPdfLogicalBackend = input.fallbackActiveBackend;
  input.canvas.dataset.knexPdfVisualBackend = diagnostics.activeBackend;
  input.canvas.dataset.knexPdfActualBackend = diagnostics.activeBackend;
  input.canvas.dataset.knexPdfRequestedBackend = diagnostics.requestedBackend;
  input.canvas.dataset.knexPdfRequestedRenderBackend =
    input.renderIdentity.backend;
  input.canvas.dataset.knexPdfFallbackUsed = String(diagnostics.fallbackUsed);
  input.canvas.dataset.knexPdfFailedBackend = diagnostics.failedBackend;
  input.canvas.dataset.knexPdfFallbackReason = diagnostics.fallbackReason;
  input.canvas.dataset.knexPdfRenderDurationMs = diagnostics.renderDurationMs;
  input.canvas.dataset.knexPdfRenderPhase = diagnostics.renderPhase;
  input.canvas.dataset.knexPdfRenderQuality = diagnostics.renderQuality;
  input.canvas.dataset.knexPdfRenderPriority = String(input.renderPriority);
  input.canvas.dataset.knexPdfIsActivePage = String(input.isActivePage);
  input.canvas.dataset.knexPdfIsVisiblePage = String(input.isPageVisible);
  input.canvas.dataset.knexPdfIsWarmupPage = String(input.isWarmupPage);

  input.canvas.dataset.knexPdfCanvasTextRender =
    input.renderIdentity.renderText ? "true" : "false";
  input.canvas.dataset.knexPdfCanvasTextMode =
    input.renderIdentity.canvasTextMode;

  input.canvas.dataset.knexPdfCssWidth = String(input.box.cssWidth);
  input.canvas.dataset.knexPdfCssHeight = String(input.box.cssHeight);
  input.canvas.dataset.knexPdfBitmapWidth = String(input.canvas.width);
  input.canvas.dataset.knexPdfBitmapHeight = String(input.canvas.height);
  input.canvas.dataset.knexPdfRenderIdentityCssWidth = String(
    input.renderIdentity.cssWidth,
  );
  input.canvas.dataset.knexPdfRenderIdentityCssHeight = String(
    input.renderIdentity.cssHeight,
  );
  input.canvas.dataset.knexPdfRenderIdentityBitmapWidth = String(
    input.renderIdentity.bitmapWidth,
  );
  input.canvas.dataset.knexPdfRenderIdentityBitmapHeight = String(
    input.renderIdentity.bitmapHeight,
  );
  input.canvas.dataset.knexPdfRenderIdentityRotation = String(
    input.renderIdentity.rotation,
  );
  input.canvas.dataset.knexPdfBitmapCssRatio = String(bitmapRatio.ratio);
  input.canvas.dataset.knexPdfOutputScale = String(bitmapRatio.ratio);
  input.canvas.dataset.knexPdfOutputScaleX = String(bitmapRatio.ratioX);
  input.canvas.dataset.knexPdfOutputScaleY = String(bitmapRatio.ratioY);
  input.canvas.dataset.knexPdfDisplayOutputScale = String(bitmapRatio.ratio);
  input.canvas.dataset.knexPdfDisplayOutputScaleX = String(
    bitmapRatio.ratioX,
  );
  input.canvas.dataset.knexPdfDisplayOutputScaleY = String(
    bitmapRatio.ratioY,
  );
  input.canvas.dataset.knexPdfSourceOutputScale = String(
    input.page.outputScale,
  );
  input.canvas.dataset.knexPdfRenderedOutputScale = String(
    input.page.outputScale,
  );
  input.canvas.dataset.knexPdfRenderScale = String(input.page.renderScale);
  input.canvas.dataset.knexPdfPageNumber = String(input.page.pageNumber);
  input.canvas.dataset.knexPdfRenderVersion = String(
    input.renderIdentity.renderVersion,
  );
  input.canvas.dataset.knexPdfBackendVersion = String(
    input.renderIdentity.backendVersion,
  );
  input.canvas.dataset.knexPdfFinalRenderVersion = String(
    input.renderIdentity.finalRenderVersion,
  );
  input.canvas.dataset.knexPdfRenderIdentity =
    createRenderIdentityKey(input.renderIdentity);
  input.canvas.dataset.knexPdfActualRenderIdentity =
    createRenderIdentityKey(input.renderIdentity);
  input.canvas.dataset.knexPdfRequestedRenderIdentity =
    createRenderIdentityKey(input.renderIdentity);
  input.canvas.dataset.knexPdfIsHeldCanvas = "false";
  input.canvas.dataset.knexPdfHoldReason = "";
  input.canvas.dataset.knexPdfAcceptanceReason = "accepted";
  input.canvas.dataset.knexPdfRejectedRenderReason = "";
  input.canvas.dataset.knexPdfRenderAppliedAt = String(Date.now());
}

export type PdfPageCanvasProps = {
  session: NativePdfSession;
  pageNumber: number;
  zoom: number;
  renderQuality: PdfRenderQualityMode;
  onRendered: (page: RenderedPdfPage) => void;
  isZooming?: boolean;
  isScrolling?: boolean;
  renderPhase?: KnexPdfRenderPhase;
  finalRenderVersion?: number;
  isActivePage?: boolean;
  isPageVisible?: boolean;
  isWarmupPage?: boolean;
  renderPriority?: number;
  renderText?: boolean;
  onCanvasTextRenderStateChange?: (state: PdfCanvasTextRenderState) => void;
};

export function PdfPageCanvas({
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
}: PdfPageCanvasProps) {
  const engine = useKnexPdfEngine();
  const engineState = useKnexPdfEngineState();

  const frontCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const backCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeCanvasIndexRef = useRef<CanvasBufferIndex>(0);
  const pendingBufferSwapFrameRef = useRef<number | null>(null);
  const pendingSecondBufferSwapFrameRef = useRef<number | null>(null);

  const renderTicketRef = useRef(0);
  const currentRenderIdentityRef = useRef<RenderIdentity | null>(null);
  const stablePageBoxRef = useRef<StablePageBox | null>(null);
  const hasRenderedOnceRef = useRef(false);

  const [activeCanvasIndex, setActiveCanvasIndex] =
    useState<CanvasBufferIndex>(0);
  const [pageBox, setPageBox] = useState<StablePageBox>(() =>
    createFallbackPageBox(zoom),
  );
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasRenderedOnce, setHasRenderedOnce] = useState(false);
  const [deferredRenderVersion, setDeferredRenderVersion] = useState(0);

  const estimatedPageBox = useMemo(
    () =>
      deriveNextPageBoxFromPrevious({
        previous: stablePageBoxRef.current,
        zoom,
      }),
    [zoom],
  );

  useEffect(() => {
    setPageBox((current) =>
      arePageBoxesVisuallyEquivalent(current, estimatedPageBox)
        ? current
        : estimatedPageBox,
    );

    for (const canvas of [frontCanvasRef.current, backCanvasRef.current]) {
      if (!canvas) continue;

      applyCanvasCssBox({
        canvas,
        box: estimatedPageBox,
      });
    }
  }, [estimatedPageBox]);

  useEffect(() => {
    const getCanvasBuffer = (
      index: CanvasBufferIndex,
    ): HTMLCanvasElement | null =>
      index === 0 ? frontCanvasRef.current : backCanvasRef.current;

    const getInactiveCanvasIndex = (): CanvasBufferIndex =>
      activeCanvasIndexRef.current === 0 ? 1 : 0;

    if (pendingBufferSwapFrameRef.current !== null) {
      cancelNextAnimationFrame(pendingBufferSwapFrameRef.current);
      pendingBufferSwapFrameRef.current = null;
    }

    if (pendingSecondBufferSwapFrameRef.current !== null) {
      cancelNextAnimationFrame(pendingSecondBufferSwapFrameRef.current);
      pendingSecondBufferSwapFrameRef.current = null;
    }

    const visibleCanvas = getCanvasBuffer(activeCanvasIndexRef.current);
    if (!visibleCanvas) return;

    let cancelled = false;
    let renderSettled = false;
    let deferredWakeupTimer: ReturnType<typeof globalThis.setTimeout> | null =
      null;

    const renderVersion = renderTicketRef.current + 1;
    renderTicketRef.current = renderVersion;

    const renderToken = createRenderTaskToken(pageNumber, renderVersion);
    const abortController = new AbortController();
    const scale = zoomPercentToScale(zoom);
    const canvasTextMode = resolveCanvasTextMode(renderText);

    const optimisticBox = deriveNextPageBoxFromPrevious({
      previous: stablePageBoxRef.current,
      zoom,
    });

    setPageBox((current) =>
      arePageBoxesVisuallyEquivalent(current, optimisticBox)
        ? current
        : optimisticBox,
    );

    for (const canvas of [frontCanvasRef.current, backCanvasRef.current]) {
      if (!canvas) continue;

      applyCanvasCssBox({
        canvas,
        box: optimisticBox,
      });
    }

    if (!hasRenderedOnceRef.current) {
      setLoading(true);
    }

    setError(null);

    const resolvedRenderPriority =
      renderPriority ??
      getDefaultRenderPriority({
        isActivePage,
        isPageVisible,
        isWarmupPage,
      });

    const backendKind = normalizeBackendKind(engineState.activeBackend);

    const effectiveRenderQuality = resolveStableRenderQuality({
      backend: backendKind,
      phase: renderPhase,
      requestedQuality: renderQuality,
      zoom,
      isActivePage,
      isPageVisible,
      isWarmupPage,
    });

    const requestGeometry = buildKnexPdfPageGeometry({
      pageNumber,
      baseWidth: estimatedPageBox.pageWidthPt,
      baseHeight: estimatedPageBox.pageHeightPt,
      zoom: scale,
      quality: effectiveRenderQuality,
      backend: backendKind,
      renderPhase,
    });
    const requestRenderMode = getRasterCacheRenderMode(renderText);
    const requestCacheInput = createBitmapCacheInput({
      documentId: getRenderDocumentId(session),
      backend: String(engineState.activeBackend),
      pageNumber,
      geometry: requestGeometry,
      quality: effectiveRenderQuality,
      renderPhase,
      renderMode: requestRenderMode,
      backendVersion: engineState.backendVersion,
    });
    const requestCacheRequirements =
      createBitmapCacheRequirements(requestCacheInput, "final");
    const previewCacheRequirements = createBitmapCacheRequirements(
      requestCacheInput,
      "preview",
    );

    const requestIdentity: RenderIdentity = {
      documentId: getRenderDocumentId(session),
      pageNumber,
      backend: String(engineState.activeBackend),
      renderPhase,
      renderQuality: effectiveRenderQuality,
      renderScale: scale,
      outputScale: requestGeometry.outputScale,
      cssWidth: requestGeometry.cssWidth,
      cssHeight: requestGeometry.cssHeight,
      bitmapWidth: requestGeometry.bitmapWidth,
      bitmapHeight: requestGeometry.bitmapHeight,
      rotation: requestGeometry.rotation,
      zoom,
      renderText,
      canvasTextMode,
      renderVersion,
      backendVersion: engineState.backendVersion,
      finalRenderVersion,
    };

    const shouldDeferRender = shouldDeferRenderDuringInteraction({
      hasRenderedOnce: hasRenderedOnceRef.current,
      renderPhase,
      isZooming,
      isScrolling,
    });

    if (shouldDeferRender) {
      const interactionState = getKnexPdfRenderInteractionState();
      const currentIdentity = currentRenderIdentityRef.current;
      const requestedRenderIdentity = createRenderIdentityKey(requestIdentity);
      const actualRenderIdentity = currentIdentity
        ? createRenderIdentityKey(currentIdentity)
        : (visibleCanvas.dataset.knexPdfActualRenderIdentity ??
          visibleCanvas.dataset.knexPdfRenderIdentity ??
          "");

      visibleCanvas.dataset.knexPdfInteractionRenderGuard = "true";
      visibleCanvas.dataset.knexPdfInteractionState =
        interactionState === "idle"
          ? isZooming
            ? "zooming"
            : isScrolling
              ? "scrolling"
              : "interaction"
          : interactionState;
      visibleCanvas.dataset.knexPdfRequestedBackend =
        engineState.preferredBackend;
      visibleCanvas.dataset.knexPdfRequestedRenderBackend =
        String(engineState.activeBackend);
      visibleCanvas.dataset.knexPdfRequestedRenderPhase = renderPhase;
      visibleCanvas.dataset.knexPdfRequestedRenderQuality =
        effectiveRenderQuality;
      visibleCanvas.dataset.knexPdfCanvasTextRender =
        renderText ? "true" : "false";
      visibleCanvas.dataset.knexPdfCanvasTextMode = canvasTextMode;
      visibleCanvas.dataset.knexPdfPageNumber = String(pageNumber);
      visibleCanvas.dataset.knexPdfRenderPriority = String(
        resolvedRenderPriority,
      );
      visibleCanvas.dataset.knexPdfIsActivePage = String(isActivePage);
      visibleCanvas.dataset.knexPdfIsVisiblePage = String(isPageVisible);
      visibleCanvas.dataset.knexPdfIsWarmupPage = String(isWarmupPage);
      visibleCanvas.dataset.knexPdfRequestedRenderVersion =
        String(renderVersion);
      visibleCanvas.dataset.knexPdfRequestedBackendVersion = String(
        engineState.backendVersion,
      );
      visibleCanvas.dataset.knexPdfRequestedFinalRenderVersion =
        String(finalRenderVersion);
      visibleCanvas.dataset.knexPdfRequestedRenderIdentity =
        requestedRenderIdentity;
      visibleCanvas.dataset.knexPdfActualRenderIdentity = actualRenderIdentity;
      visibleCanvas.dataset.knexPdfIsHeldCanvas = "true";
      visibleCanvas.dataset.knexPdfHoldReason = "interaction-deferred";
      visibleCanvas.dataset.knexPdfCacheLookup = "preview-miss";

      const previewEntry = pageBitmapCache.getBestEntry(
        previewCacheRequirements,
      );
      const previewPage = previewEntry
        ? pageBitmapCache.get(previewEntry.key, previewCacheRequirements)
        : undefined;

      if (previewPage) {
        const targetCanvasIndex: CanvasBufferIndex =
          getInactiveCanvasIndex();
        const targetCanvas = getCanvasBuffer(targetCanvasIndex);

        if (targetCanvas) {
          const previewBox: StablePageBox = {
            ...optimisticBox,
            outputScale: previewPage.box.outputScale,
            bitmapWidth: previewPage.bitmap.width,
            bitmapHeight: previewPage.bitmap.height,
            rotation: previewPage.box.rotation,
          };

          try {
            copyImageBitmapToVisibleCanvas({
              bitmap: previewPage.bitmap,
              visibleCanvas: targetCanvas,
              box: previewBox,
            });

            const previewRatio = getCanvasRatioForBox({
              canvas: targetCanvas,
              box: previewBox,
            });
            const previewIdentity: RenderIdentity = {
              ...requestIdentity,
              backend:
                previewPage.page.activeBackend ?? requestIdentity.backend,
              outputScale: previewRatio.ratio,
              cssWidth: previewBox.cssWidth,
              cssHeight: previewBox.cssHeight,
              bitmapWidth: targetCanvas.width,
              bitmapHeight: targetCanvas.height,
              rotation: previewBox.rotation ?? requestIdentity.rotation,
            };

            stablePageBoxRef.current = previewBox;
            writeCanvasBackendDataset({
              canvas: targetCanvas,
              page: previewPage.page,
              box: previewBox,
              fallbackActiveBackend: engineState.activeBackend,
              fallbackRequestedBackend: engineState.preferredBackend,
              renderPhase,
              renderQuality: effectiveRenderQuality,
              renderPriority: resolvedRenderPriority,
              isActivePage,
              isPageVisible,
              isWarmupPage,
              renderIdentity: previewIdentity,
            });

            targetCanvas.dataset.knexPdfCacheLookup = "preview-hit";
            targetCanvas.dataset.knexPdfCachePolicy = "preview";
            targetCanvas.dataset.knexPdfCacheKey = previewPage.key;
            targetCanvas.dataset.knexPdfCacheSize = String(
              pageBitmapCache.size,
            );
            targetCanvas.dataset.knexPdfCacheBytes = String(
              pageBitmapCache.bytes,
            );
            targetCanvas.dataset.knexPdfIsHeldCanvas = "true";
            targetCanvas.dataset.knexPdfHoldReason = "interaction-cache-preview";

            currentRenderIdentityRef.current = previewIdentity;
            activeCanvasIndexRef.current = targetCanvasIndex;

            if (frontCanvasRef.current) {
              applyCanvasBufferVisibility({
                canvas: frontCanvasRef.current,
                bufferIndex: 0,
                active: targetCanvasIndex === 0,
              });
            }

            if (backCanvasRef.current) {
              applyCanvasBufferVisibility({
                canvas: backCanvasRef.current,
                bufferIndex: 1,
                active: targetCanvasIndex === 1,
              });
            }

            setActiveCanvasIndex(targetCanvasIndex);
            setPageBox(previewBox);

            onCanvasTextRenderStateChange?.({
              documentId: previewIdentity.documentId,
              pageNumber,
              backend: previewIdentity.backend,
              renderPhase: previewIdentity.renderPhase,
              renderQuality: previewIdentity.renderQuality,
              renderScale: previewIdentity.renderScale,
              outputScale: previewIdentity.outputScale,
              zoom,
              renderText: previewIdentity.renderText,
              canvasTextMode: previewIdentity.canvasTextMode,
              filteredTextOperationCount: parseDatasetInteger(
                targetCanvas.dataset.knexPdfFilteredTextOperations,
              ),
              renderIdentity: createRenderIdentityKey(previewIdentity),
              renderVersion: previewIdentity.renderVersion,
              backendVersion: previewIdentity.backendVersion,
              finalRenderVersion: previewIdentity.finalRenderVersion,
              cacheLookup: targetCanvas.dataset.knexPdfCacheLookup,
              cacheKey: targetCanvas.dataset.knexPdfCacheKey,
              cacheSize: parseDatasetInteger(
                targetCanvas.dataset.knexPdfCacheSize,
              ),
              cacheBytes: parseDatasetInteger(
                targetCanvas.dataset.knexPdfCacheBytes,
              ),
            });
          } catch {
            pageBitmapCache.delete(previewPage.key);
            visibleCanvas.dataset.knexPdfCacheLookup = "preview-discarded";
          }
        }
      }

      setLoading(false);

      const wakeup = () => {
        if (!cancelled) {
          setDeferredRenderVersion((version) => version + 1);
        }
      };

      const unsubscribe = subscribeKnexPdfRenderInteractionIdle(wakeup);

      deferredWakeupTimer = globalThis.setTimeout(
        wakeup,
        DEFERRED_RENDER_WAKEUP_MS,
      );

      return () => {
        cancelled = true;
        unsubscribe();
        cancelRenderTaskToken(renderToken);

        if (deferredWakeupTimer !== null) {
          globalThis.clearTimeout(deferredWakeupTimer);
          deferredWakeupTimer = null;
        }
      };
    }

    visibleCanvas.dataset.knexPdfInteractionRenderGuard = "false";
    visibleCanvas.dataset.knexPdfInteractionState = "idle";
    visibleCanvas.dataset.knexPdfRenderPhase = renderPhase;
    visibleCanvas.dataset.knexPdfRenderQuality = effectiveRenderQuality;
    visibleCanvas.dataset.knexPdfCanvasTextRender =
      renderText ? "true" : "false";
    visibleCanvas.dataset.knexPdfCanvasTextMode = canvasTextMode;
    visibleCanvas.dataset.knexPdfPageNumber = String(pageNumber);
    visibleCanvas.dataset.knexPdfCacheLookup = "miss";

    const cachedEntry = pageBitmapCache.getBestEntry(requestCacheRequirements);
    const cachedPage = cachedEntry
      ? pageBitmapCache.get(cachedEntry.key, requestCacheRequirements)
      : undefined;

    if (cachedPage) {
      try {
        const targetCanvasIndex: CanvasBufferIndex = hasRenderedOnceRef.current
          ? getInactiveCanvasIndex()
          : activeCanvasIndexRef.current;
        const targetCanvas = getCanvasBuffer(targetCanvasIndex);

        if (!targetCanvas) {
          throw new Error("No canvas buffer available for cached bitmap.");
        }

        const cachedBox = cachedPage.box;

        copyImageBitmapToVisibleCanvas({
          bitmap: cachedPage.bitmap,
          visibleCanvas: targetCanvas,
          box: cachedBox,
        });

        const committedRatio = getCanvasRatioForBox({
          canvas: targetCanvas,
          box: cachedBox,
        });
        const diagnostics = getRenderedPageBackendDiagnostics({
          page: cachedPage.page,
          fallbackActiveBackend: engineState.activeBackend,
          fallbackRequestedBackend: engineState.preferredBackend,
          renderPhase,
          renderQuality: effectiveRenderQuality,
        });
        const committedBox: StablePageBox = {
          ...cachedBox,
          outputScale: committedRatio.ratio,
          bitmapWidth: targetCanvas.width,
          bitmapHeight: targetCanvas.height,
        };
        const committedIdentity: RenderIdentity = {
          ...requestIdentity,
          backend: diagnostics.activeBackend,
          renderPhase: diagnostics.renderPhase,
          renderQuality: diagnostics.renderQuality,
          renderScale: cachedPage.page.renderScale,
          outputScale: committedRatio.ratio,
          cssWidth: committedBox.cssWidth,
          cssHeight: committedBox.cssHeight,
          bitmapWidth: targetCanvas.width,
          bitmapHeight: targetCanvas.height,
          rotation: committedBox.rotation ?? requestIdentity.rotation,
        };

        stablePageBoxRef.current = committedBox;

        writeCanvasBackendDataset({
          canvas: targetCanvas,
          page: cachedPage.page,
          box: committedBox,
          fallbackActiveBackend: engineState.activeBackend,
          fallbackRequestedBackend: engineState.preferredBackend,
          renderPhase,
          renderQuality: effectiveRenderQuality,
          renderPriority: resolvedRenderPriority,
          isActivePage,
          isPageVisible,
          isWarmupPage,
          renderIdentity: committedIdentity,
        });

        const shouldPromoteCachedCanvas = shouldPromoteRenderedCanvas({
          currentCanvas: visibleCanvas,
          targetCanvas,
          committedIdentity,
        });

        if (!shouldPromoteCachedCanvas) {
          applyCanvasBufferVisibility({
            canvas: targetCanvas,
            bufferIndex: targetCanvasIndex,
            active: false,
          });

          setLoading(false);
          setError(null);

          return () => {
            cancelled = true;
            cancelRenderTaskToken(renderToken);
            abortController.abort();
          };
        }

        targetCanvas.dataset.knexPdfCacheLookup = "hit";
        targetCanvas.dataset.knexPdfCacheKey = cachedPage.key;
        targetCanvas.dataset.knexPdfCacheSize = String(pageBitmapCache.size);
        targetCanvas.dataset.knexPdfCacheBytes = String(pageBitmapCache.bytes);
        targetCanvas.dataset.knexPdfBufferState = "ready";

        currentRenderIdentityRef.current = committedIdentity;
        activeCanvasIndexRef.current = targetCanvasIndex;
        if (frontCanvasRef.current) {
          applyCanvasBufferVisibility({
            canvas: frontCanvasRef.current,
            bufferIndex: 0,
            active: targetCanvasIndex === 0,
          });
        }
        if (backCanvasRef.current) {
          applyCanvasBufferVisibility({
            canvas: backCanvasRef.current,
            bufferIndex: 1,
            active: targetCanvasIndex === 1,
          });
        }

        setActiveCanvasIndex(targetCanvasIndex);
        setPageBox(committedBox);
        hasRenderedOnceRef.current = true;
        setHasRenderedOnce(true);
        setLoading(false);
        setError(null);
        onCanvasTextRenderStateChange?.({
          documentId: committedIdentity.documentId,
          pageNumber,
          backend: committedIdentity.backend,
          renderPhase: committedIdentity.renderPhase,
          renderQuality: committedIdentity.renderQuality,
          renderScale: committedIdentity.renderScale,
          outputScale: committedIdentity.outputScale,
          zoom,
          renderText: committedIdentity.renderText,
          canvasTextMode: committedIdentity.canvasTextMode,
          filteredTextOperationCount: parseDatasetInteger(
            targetCanvas.dataset.knexPdfFilteredTextOperations,
          ),
          renderIdentity: createRenderIdentityKey(committedIdentity),
          renderVersion: committedIdentity.renderVersion,
          backendVersion: committedIdentity.backendVersion,
          finalRenderVersion: committedIdentity.finalRenderVersion,
          cacheLookup: targetCanvas.dataset.knexPdfCacheLookup,
          cacheKey: targetCanvas.dataset.knexPdfCacheKey,
          cacheSize: parseDatasetInteger(targetCanvas.dataset.knexPdfCacheSize),
          cacheBytes: parseDatasetInteger(
            targetCanvas.dataset.knexPdfCacheBytes,
          ),
        });
        onRendered(cachedPage.page);

        return () => {
          cancelled = true;
          cancelRenderTaskToken(renderToken);
          abortController.abort();
        };
      } catch {
        pageBitmapCache.delete(cachedPage.key);
        visibleCanvas.dataset.knexPdfCacheLookup = "discarded";
      }
    }

    const workerCanvas = document.createElement("canvas");

    const renderPage = async (): Promise<RenderedPageWithBackendDiagnostics> => {
      if (engineState.activeBackend === "pdfjs") {
        const renderStartedAt = nowMs();

        const renderedPage = await renderKnexPdfPageToCanvas({
          session,
          pageNumber,
          canvas: workerCanvas,
          scale,
          quality: effectiveRenderQuality,
          renderPhase,
          renderText,
          signal: abortController.signal,
        });

        return {
          ...renderedPage,
          activeBackend: "pdfjs",
          requestedBackend: engineState.preferredBackend,
          fallbackUsed: false,
          failedBackend: "",
          fallbackReason: "",
          renderDurationMs: nowMs() - renderStartedAt,
          renderPhase,
          renderQuality: effectiveRenderQuality,
        };
      }

      const backend = engine.getBackend();

      try {
        return await runKnexPdfRenderTask({
          backend: String(backend.id),
          priority: resolvedRenderPriority,
          signal: abortController.signal,
          task: async () => {
            const document = await getKnexPdfDocumentHandleWithBackend({
              backend,
              session,
            });

            const renderStartedAt = nowMs();

            const renderedPage = await renderKnexPdfPageWithBackend({
              backend,
              document,
              pageNumber,
              canvas: workerCanvas,
              scale,
              quality: effectiveRenderQuality,
              renderText,
              canvasTextMode,
              signal: abortController.signal,
              requestedBackend: engineState.preferredBackend,
              renderPhase,
            });

            return {
              ...renderedPage,
              activeBackend: String(backend.id),
              requestedBackend: engineState.preferredBackend,
              fallbackUsed: false,
              failedBackend: "",
              fallbackReason: "",
              renderDurationMs: nowMs() - renderStartedAt,
              renderPhase,
              renderQuality: effectiveRenderQuality,
            };
          },
        });
      } catch (backendError) {
        if (isRenderCancellation(backendError)) {
          throw backendError;
        }

        const reason =
          backendError instanceof Error
            ? backendError.message
            : "Backend render failed.";

        engine.reportBackendError({
          backend: engineState.activeBackend,
          reason,
          error: backendError,
        });

        engine.reportBackendFallback({
          requestedBackend: engineState.preferredBackend,
          failedBackend: engineState.activeBackend,
          reason,
        });

        const fallbackRenderStartedAt = nowMs();

        const fallbackPage = await renderKnexPdfPageToCanvas({
          session,
          pageNumber,
          canvas: workerCanvas,
          scale,
          quality: effectiveRenderQuality,
          renderPhase,
          renderText,
          signal: abortController.signal,
        });

        return {
          ...fallbackPage,
          activeBackend: "pdfjs",
          requestedBackend: engineState.preferredBackend,
          fallbackUsed: true,
          failedBackend: String(engineState.activeBackend),
          fallbackReason: reason,
          renderDurationMs: nowMs() - fallbackRenderStartedAt,
          renderPhase,
          renderQuality: effectiveRenderQuality,
        };
      }
    };

    renderPage()
      .then(async (page) => {
        if (
          cancelled ||
          !isRenderTaskTokenCurrent(renderToken, renderTicketRef.current)
        ) {
          return;
        }

        const targetCanvasIndex: CanvasBufferIndex = hasRenderedOnceRef.current
          ? getInactiveCanvasIndex()
          : activeCanvasIndexRef.current;

        const targetCanvas = getCanvasBuffer(targetCanvasIndex);
        const currentVisibleCanvas = getCanvasBuffer(
          activeCanvasIndexRef.current,
        );

        if (!targetCanvas || !currentVisibleCanvas) return;

        const nextBox = pageBoxFromRenderedPage(page);
        const diagnostics = getRenderedPageBackendDiagnostics({
          page,
          fallbackActiveBackend: engineState.activeBackend,
          fallbackRequestedBackend: engineState.preferredBackend,
          renderPhase,
          renderQuality: effectiveRenderQuality,
        });

        const nextIdentity: RenderIdentity = {
          ...requestIdentity,
          backend: diagnostics.activeBackend,
          renderPhase: diagnostics.renderPhase,
          renderQuality: diagnostics.renderQuality,
          renderScale: page.renderScale,
          outputScale: page.outputScale,
          cssWidth: nextBox.cssWidth,
          cssHeight: nextBox.cssHeight,
          bitmapWidth: nextBox.bitmapWidth ?? page.width,
          bitmapHeight: nextBox.bitmapHeight ?? page.height,
          rotation: nextBox.rotation ?? page.rotation ?? 0,
        };

        if (
          nextIdentity.renderVersion !== renderTicketRef.current ||
          nextIdentity.backendVersion !== engineState.backendVersion ||
          nextIdentity.finalRenderVersion !== finalRenderVersion ||
          nextIdentity.pageNumber !== pageNumber ||
          normalizeIdentityNumber(nextIdentity.renderScale) !==
            normalizeIdentityNumber(scale) ||
          normalizeIdentityNumber(nextIdentity.zoom) !==
            normalizeIdentityNumber(zoom)
        ) {
          currentVisibleCanvas.dataset.knexPdfAcceptanceReason = "rejected";
          currentVisibleCanvas.dataset.knexPdfRejectedRenderReason =
            "stale-or-mismatched-render";
          currentVisibleCanvas.dataset.knexPdfRejectedRenderIdentity =
            createRenderIdentityKey(nextIdentity);
          return;
        }

        targetCanvas.dataset.knexPdfBufferState = "preparing";
        targetCanvas.dataset.knexPdfBufferIndex = String(targetCanvasIndex);

        copyRenderedCanvasToVisibleCanvas({
          sourceCanvas: workerCanvas,
          visibleCanvas: targetCanvas,
          box: nextBox,
        });

        const committedRatio = getCanvasRatioForBox({
          canvas: targetCanvas,
          box: nextBox,
        });

        const committedBox: StablePageBox = {
          ...nextBox,
          outputScale: committedRatio.ratio,
          bitmapWidth: targetCanvas.width,
          bitmapHeight: targetCanvas.height,
        };

        const committedIdentity: RenderIdentity = {
          ...nextIdentity,
          outputScale: committedRatio.ratio,
          cssWidth: committedBox.cssWidth,
          cssHeight: committedBox.cssHeight,
          bitmapWidth: committedBox.bitmapWidth ?? targetCanvas.width,
          bitmapHeight: committedBox.bitmapHeight ?? targetCanvas.height,
          rotation: committedBox.rotation ?? nextIdentity.rotation,
        };

        stablePageBoxRef.current = committedBox;

        copyCanvasDiagnosticDatasets({
          sourceCanvas: workerCanvas,
          visibleCanvas: targetCanvas,
        });

        writeCanvasBackendDataset({
          canvas: targetCanvas,
          page,
          box: committedBox,
          fallbackActiveBackend: engineState.activeBackend,
          fallbackRequestedBackend: engineState.preferredBackend,
          renderPhase,
          renderQuality: effectiveRenderQuality,
          renderPriority: resolvedRenderPriority,
          isActivePage,
          isPageVisible,
          isWarmupPage,
          renderIdentity: committedIdentity,
        });

        const shouldPromote = shouldPromoteRenderedCanvas({
          currentCanvas: currentVisibleCanvas,
          targetCanvas,
          committedIdentity,
        });

        if (shouldPromote) {
          setPageBox((current) =>
            arePageBoxesVisuallyEquivalent(current, committedBox)
              ? current
              : committedBox,
          );

          applyCanvasBufferVisibility({
            canvas: targetCanvas,
            bufferIndex: targetCanvasIndex,
            active: true,
          });

          if (currentVisibleCanvas !== targetCanvas) {
            applyCanvasBufferVisibility({
              canvas: currentVisibleCanvas,
              bufferIndex: activeCanvasIndexRef.current,
              active: false,
            });
          }

          activeCanvasIndexRef.current = targetCanvasIndex;
          setActiveCanvasIndex(targetCanvasIndex);
          currentRenderIdentityRef.current = committedIdentity;

          onCanvasTextRenderStateChange?.({
            documentId: committedIdentity.documentId,
            pageNumber,
            backend: committedIdentity.backend,
            renderPhase: committedIdentity.renderPhase,
            renderQuality: committedIdentity.renderQuality,
            renderScale: committedIdentity.renderScale,
            outputScale: committedIdentity.outputScale,
            zoom,
            renderText: committedIdentity.renderText,
            canvasTextMode: committedIdentity.canvasTextMode,
            filteredTextOperationCount: parseDatasetInteger(
              targetCanvas.dataset.knexPdfFilteredTextOperations,
            ),
            renderIdentity: createRenderIdentityKey(committedIdentity),
            renderVersion: committedIdentity.renderVersion,
            backendVersion: committedIdentity.backendVersion,
            finalRenderVersion: committedIdentity.finalRenderVersion,
            cacheLookup: targetCanvas.dataset.knexPdfCacheLookup ?? "miss",
            cacheKey: targetCanvas.dataset.knexPdfCacheKey,
            cacheSize: parseDatasetInteger(
              targetCanvas.dataset.knexPdfCacheSize,
            ),
            cacheBytes: parseDatasetInteger(
              targetCanvas.dataset.knexPdfCacheBytes,
            ),
          });

          const committedPage: RenderedPdfPage = {
            ...page,
            width: targetCanvas.width,
            height: targetCanvas.height,
            cssWidth: committedBox.cssWidth,
            cssHeight: committedBox.cssHeight,
            pageWidthPt: committedBox.pageWidthPt,
            pageHeightPt: committedBox.pageHeightPt,
            renderScale: committedBox.renderScale,
            outputScale: committedIdentity.outputScale,
            zoom,
            devicePixelRatio:
              typeof globalThis.devicePixelRatio === "number"
                ? globalThis.devicePixelRatio
                : page.devicePixelRatio,
          };

          onRendered(committedPage);

          hasRenderedOnceRef.current = true;
          setHasRenderedOnce(true);
          setLoading(false);
          setError(null);
        } else {
          applyCanvasBufferVisibility({
            canvas: targetCanvas,
            bufferIndex: targetCanvasIndex,
            active: false,
          });
        }

        const cacheGeometry =
          page.geometry ??
          buildKnexPdfPageGeometry({
            pageNumber,
            baseWidth: nextBox.pageWidthPt,
            baseHeight: nextBox.pageHeightPt,
            zoom: nextBox.renderScale,
            quality: diagnostics.renderQuality,
            backend: normalizeBackendKind(diagnostics.activeBackend),
            renderPhase: diagnostics.renderPhase,
          });
        const cacheInput = createBitmapCacheInput({
          documentId: getRenderDocumentId(session),
          backend: diagnostics.activeBackend,
          pageNumber,
          geometry: cacheGeometry,
          quality: diagnostics.renderQuality,
          renderPhase: diagnostics.renderPhase,
          renderMode: page.renderMode ?? getRasterCacheRenderMode(renderText),
          backendVersion: engineState.backendVersion,
        });
        const bitmapForCache = await createImageBitmapFromCanvas(targetCanvas);

        if (
          bitmapForCache &&
          !cancelled &&
          isRenderTaskTokenCurrent(renderToken, renderTicketRef.current)
        ) {
          const cacheKey = pageBitmapCache.setByInput(
            cacheInput,
            {
              bitmap: bitmapForCache,
              page,
              box: committedBox,
              key: "",
            },
            {
              bytes: targetCanvas.width * targetCanvas.height * 4,
            },
          );
          const cached = pageBitmapCache.peek(cacheKey);

          if (cached) {
            cached.key = cacheKey;
          }

          targetCanvas.dataset.knexPdfCacheLookup = "stored";
          targetCanvas.dataset.knexPdfCacheKey = cacheKey;
          targetCanvas.dataset.knexPdfCacheSize = String(pageBitmapCache.size);
          targetCanvas.dataset.knexPdfCacheBytes = String(
            pageBitmapCache.bytes,
          );
        } else if (bitmapForCache) {
          try {
            bitmapForCache.close();
          } catch {
            // Ignore cache cleanup failures.
          }
        }

        targetCanvas.dataset.knexPdfBufferState = shouldPromote
          ? "active"
          : "inactive";
      })
      .catch((renderError) => {
        if (
          cancelled ||
          !isRenderTaskTokenCurrent(renderToken, renderTicketRef.current)
        ) {
          return;
        }

        if (isRenderCancellation(renderError)) return;

        setError(
          renderError instanceof Error
            ? renderError.message
            : "Failed to render PDF page.",
        );
      })
      .finally(() => {
        renderSettled = true;

        if (
          cancelled ||
          !isRenderTaskTokenCurrent(renderToken, renderTicketRef.current)
        ) {
          return;
        }

        setLoading(false);

        workerCanvas.width = 0;
        workerCanvas.height = 0;
      });

    return () => {
      cancelled = true;
      cancelRenderTaskToken(renderToken);

      if (deferredWakeupTimer !== null) {
        globalThis.clearTimeout(deferredWakeupTimer);
        deferredWakeupTimer = null;
      }

      if (pendingBufferSwapFrameRef.current !== null) {
        cancelNextAnimationFrame(pendingBufferSwapFrameRef.current);
        pendingBufferSwapFrameRef.current = null;
      }

      if (pendingSecondBufferSwapFrameRef.current !== null) {
        cancelNextAnimationFrame(pendingSecondBufferSwapFrameRef.current);
        pendingSecondBufferSwapFrameRef.current = null;
      }

      if (!renderSettled) {
        abortController.abort();
      }
    };
  }, [
    engine,
    engineState.activeBackend,
    engineState.backendVersion,
    engineState.preferredBackend,
    finalRenderVersion,
    isActivePage,
    isPageVisible,
    isScrolling,
    isWarmupPage,
    isZooming,
    onCanvasTextRenderStateChange,
    onRendered,
    pageNumber,
    renderPhase,
    renderPriority,
    renderQuality,
    renderText,
    session,
    zoom,
    deferredRenderVersion,
  ]);

  return (
    <div
      className="relative shrink-0 overflow-hidden rounded bg-white"
      data-knexread-page-canvas-frame="true"
      data-page-number={pageNumber}
      data-knex-pdf-css-width={pageBox.cssWidth}
      data-knex-pdf-css-height={pageBox.cssHeight}
      data-knex-pdf-output-scale={pageBox.outputScale ?? ""}
      data-knex-pdf-canvas-text-render={renderText ? "true" : "false"}
      data-knex-pdf-canvas-text-mode={resolveCanvasTextMode(renderText)}
      style={{
        boxSizing: "content-box",
        width: `${pageBox.cssWidth}px`,
        height: `${pageBox.cssHeight}px`,
        minWidth: `${pageBox.cssWidth}px`,
        minHeight: `${pageBox.cssHeight}px`,
        contain: "layout paint size style",
        isolation: "isolate",
        backgroundColor: "#ffffff",
        boxShadow: "0 0 0 1px rgb(212 212 216)",
      }}
    >
      <canvas
        ref={frontCanvasRef}
        className="absolute block bg-white"
        data-knex-pdf-buffer-index="0"
        data-knex-pdf-buffer-state={
          activeCanvasIndex === 0 ? "active" : "inactive"
        }
        data-knex-pdf-backend={engineState.activeBackend}
        data-knex-pdf-requested-backend={engineState.preferredBackend}
        data-knex-pdf-fallback-used="false"
        data-knex-pdf-interaction-render-guard="false"
        data-knex-pdf-interaction-state="idle"
        data-knex-pdf-render-phase={renderPhase}
        data-knex-pdf-render-quality={renderQuality}
        data-knex-pdf-canvas-text-render={renderText ? "true" : "false"}
        data-knex-pdf-canvas-text-mode={resolveCanvasTextMode(renderText)}
        data-knex-pdf-page-number={pageNumber}
        data-knex-pdf-render-priority={
          renderPriority ??
          getDefaultRenderPriority({
            isActivePage,
            isPageVisible,
            isWarmupPage,
          })
        }
        data-knex-pdf-is-active-page={isActivePage ? "true" : "false"}
        data-knex-pdf-is-visible-page={isPageVisible ? "true" : "false"}
        data-knex-pdf-is-warmup-page={isWarmupPage ? "true" : "false"}
        aria-hidden={activeCanvasIndex !== 0}
        style={{
          left: 0,
          top: 0,
          right: "auto",
          bottom: "auto",
          boxSizing: "content-box",
          width: `${pageBox.cssWidth}px`,
          height: `${pageBox.cssHeight}px`,
          backgroundColor: "#ffffff",
          imageRendering: "auto",
          visibility: activeCanvasIndex === 0 ? "visible" : "hidden",
          pointerEvents: "none",
          zIndex: activeCanvasIndex === 0 ? 2 : 1,
          transform: "none",
          filter: "none",
        }}
      />

      <canvas
        ref={backCanvasRef}
        className="absolute block bg-white"
        data-knex-pdf-buffer-index="1"
        data-knex-pdf-buffer-state={
          activeCanvasIndex === 1 ? "active" : "inactive"
        }
        data-knex-pdf-backend={engineState.activeBackend}
        data-knex-pdf-requested-backend={engineState.preferredBackend}
        data-knex-pdf-fallback-used="false"
        data-knex-pdf-interaction-render-guard="false"
        data-knex-pdf-interaction-state="idle"
        data-knex-pdf-render-phase={renderPhase}
        data-knex-pdf-render-quality={renderQuality}
        data-knex-pdf-canvas-text-render={renderText ? "true" : "false"}
        data-knex-pdf-canvas-text-mode={resolveCanvasTextMode(renderText)}
        data-knex-pdf-page-number={pageNumber}
        data-knex-pdf-render-priority={
          renderPriority ??
          getDefaultRenderPriority({
            isActivePage,
            isPageVisible,
            isWarmupPage,
          })
        }
        data-knex-pdf-is-active-page={isActivePage ? "true" : "false"}
        data-knex-pdf-is-visible-page={isPageVisible ? "true" : "false"}
        data-knex-pdf-is-warmup-page={isWarmupPage ? "true" : "false"}
        aria-hidden={activeCanvasIndex !== 1}
        style={{
          left: 0,
          top: 0,
          right: "auto",
          bottom: "auto",
          boxSizing: "content-box",
          width: `${pageBox.cssWidth}px`,
          height: `${pageBox.cssHeight}px`,
          backgroundColor: "#ffffff",
          imageRendering: "auto",
          visibility: activeCanvasIndex === 1 ? "visible" : "hidden",
          pointerEvents: "none",
          zIndex: activeCanvasIndex === 1 ? 2 : 1,
          transform: "none",
          filter: "none",
        }}
      />

      {loading && !hasRenderedOnce ? (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-white/70 text-xs text-zinc-600">
          Rendering page {pageNumber}...
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
