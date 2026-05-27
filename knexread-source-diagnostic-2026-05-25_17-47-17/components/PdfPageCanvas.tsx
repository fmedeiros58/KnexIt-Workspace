"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PdfRenderQualityMode } from "../types";
import type { NativePdfSession } from "../services";
import {
  cancelRenderTaskToken,
  createRenderTaskToken,
  getKnexPdfDocumentHandleWithBackend,
  isRenderCancellation,
  isRenderTaskTokenCurrent,
  renderKnexPdfPageWithBackend,
  renderKnexPdfPageToCanvas,
  resolveRenderQualityForPhase,
  runKnexPdfRenderTask,
  type KnexPdfRenderPhase,
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
};

const FALLBACK_PAGE_WIDTH_PT = 612;
const FALLBACK_PAGE_HEIGHT_PT = 792;
const MIN_PAGE_SIDE_PX = 1;
const MIN_LAYOUT_SCALE = 0.01;
const RENDER_IDENTITY_NUMBER_PRECISION = 4;
const DEFERRED_RENDER_WAKEUP_MS = 140;

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
  context.imageSmoothingEnabled = false;
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
}: {
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
}) {
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

    const requestIdentity: RenderIdentity = {
      documentId: getRenderDocumentId(session),
      pageNumber,
      backend: String(engineState.activeBackend),
      renderPhase,
      renderQuality: effectiveRenderQuality,
      renderScale: scale,
      outputScale: 0,
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
      .then((page) => {
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

        targetCanvas.dataset.knexPdfBufferState = "ready";

        pendingBufferSwapFrameRef.current = requestNextAnimationFrame(() => {
          pendingBufferSwapFrameRef.current = null;

          if (
            cancelled ||
            !isRenderTaskTokenCurrent(renderToken, renderTicketRef.current)
          ) {
            return;
          }

          pendingSecondBufferSwapFrameRef.current = requestNextAnimationFrame(
            () => {
              pendingSecondBufferSwapFrameRef.current = null;

              if (
                cancelled ||
                !isRenderTaskTokenCurrent(
                  renderToken,
                  renderTicketRef.current,
                )
              ) {
                return;
              }

              const latestTargetCanvas = getCanvasBuffer(targetCanvasIndex);
              const latestVisibleCanvas = getCanvasBuffer(
                activeCanvasIndexRef.current,
              );

              if (!latestTargetCanvas || !latestVisibleCanvas) return;

              setPageBox((current) =>
                arePageBoxesVisuallyEquivalent(current, committedBox)
                  ? current
                  : committedBox,
              );

              applyCanvasBufferVisibility({
                canvas: latestTargetCanvas,
                bufferIndex: targetCanvasIndex,
                active: true,
              });

              if (latestVisibleCanvas !== latestTargetCanvas) {
                applyCanvasBufferVisibility({
                  canvas: latestVisibleCanvas,
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
                  latestTargetCanvas.dataset.knexPdfFilteredTextOperations,
                ),
                renderIdentity: createRenderIdentityKey(committedIdentity),
                renderVersion: committedIdentity.renderVersion,
                backendVersion: committedIdentity.backendVersion,
                finalRenderVersion: committedIdentity.finalRenderVersion,
              });

              const committedPage: RenderedPdfPage = {
                ...page,
                width: latestTargetCanvas.width,
                height: latestTargetCanvas.height,
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
            },
          );
        });
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