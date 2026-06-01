"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { PdfRenderQualityMode } from "../../native-pdf-reader/types";
import type { NativePdfSession } from "../../native-pdf-reader/services";
import type { PdfTileRenderState } from "../../native-pdf-reader/components/pdf-tiles/PdfTileCanvasTypes";
import type {
  KnexPdfRenderPhase,
  KnexPdfRenderedPage as RenderedPdfPage,
} from "../../native-pdf-reader/knex-pdf-engine";
import { renderPdfiumPageToCanvas } from "../../backends/pdfium/PdfiumNonTextRenderer";

type PdfCanvasLayerRenderSource = "pdfium" | "pdfjs" | "unknown";

type PdfJsViewport = {
  width: number;
  height: number;
  scale?: number;
  transform?: number[];
};

type PdfJsRenderTask = {
  promise: Promise<void>;
  cancel?: () => void;
};

type PdfJsPage = {
  getViewport: (params: { scale: number }) => PdfJsViewport;
  render: (params: {
    canvasContext: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;
    viewport: PdfJsViewport;
    intent?: "display" | "print";
    transform?: number[];
    operationsFilter?: (fnId: number) => boolean;
  }) => PdfJsRenderTask;
};

type TextOperationFilterResult = {
  supported: boolean;
  reason: string;
  filter?: (fnId: number) => boolean;
};

export type PdfCanvasLayerProps = {
  session: NativePdfSession;
  pageNumber: number;
  zoom: number;
  pageCssWidth: number;
  pageCssHeight: number;
  renderQuality: PdfRenderQualityMode;
  renderPhase: KnexPdfRenderPhase;
  finalRenderVersion: number;
  renderText: boolean;
  onRendered?: (page: RenderedPdfPage) => void;
  onCanvasRenderStateChange?: (state: PdfTileRenderState) => void;
};

function getDocumentId(session: NativePdfSession): string {
  return session.id ?? session.fingerprint ?? session.fileName;
}

function getRenderScale(zoom: number): number {
  return Math.max(0.01, zoom / 100);
}

function getDevicePixelRatio(): number {
  if (typeof window === "undefined") return 1;
  return Math.max(1, window.devicePixelRatio || 1);
}

function resolveOutputScale(renderQuality: PdfRenderQualityMode): number {
  const dpr = getDevicePixelRatio();

  if (renderQuality === "extreme") {
    return Math.min(3, Math.max(2, dpr));
  }

  if (renderQuality === "high") {
    return Math.min(2.5, Math.max(1.5, dpr));
  }

  return Math.min(2, dpr);
}

function createRenderIdentity(input: {
  documentId: string;
  pageNumber: number;
  renderScale: number;
  renderText: boolean;
  renderPhase: KnexPdfRenderPhase;
  finalRenderVersion: number;
  outputScale: number;
}) {
  return [
    "modular-single-canvas",
    `doc=${input.documentId}`,
    `p=${input.pageNumber}`,
    `z=${Math.round(input.renderScale * 1000) / 1000}`,
    `os=${Math.round(input.outputScale * 1000) / 1000}`,
    `text=${input.renderText ? "1" : "0"}`,
    `phase=${input.renderPhase}`,
    `fv=${input.finalRenderVersion}`,
  ].join("|");
}

function resolvePdfJsTextOperationFilter(): TextOperationFilterResult {
  const ops = (globalThis as unknown as { pdfjsLib?: { OPS?: Record<string, number> } })
    .pdfjsLib?.OPS;

  if (!ops) {
    return {
      supported: false,
      reason: "pdfjs-ops-unavailable",
    };
  }

  const textOperationIds = [
    ops.beginText,
    ops.endText,
    ops.setCharSpacing,
    ops.setWordSpacing,
    ops.setHScale,
    ops.setLeading,
    ops.setFont,
    ops.setTextRenderingMode,
    ops.setTextRise,
    ops.moveText,
    ops.setLeadingMoveText,
    ops.setTextMatrix,
    ops.nextLine,
    ops.showText,
    ops.showSpacedText,
    ops.nextLineShowText,
    ops.nextLineSetSpacingShowText,
    ops.paintChar,
  ].filter((value): value is number => typeof value === "number");

  if (textOperationIds.length === 0) {
    return {
      supported: false,
      reason: "pdfjs-text-ops-unavailable",
    };
  }

  const blocked = new Set(textOperationIds);

  return {
    supported: true,
    reason: "pdfjs-ops-filter",
    filter: (fnId: number) => !blocked.has(fnId),
  };
}

function resetCanvas(input: {
  canvas: HTMLCanvasElement;
  cssWidth: number;
  cssHeight: number;
  outputScale: number;
}) {
  const bitmapWidth = Math.max(1, Math.ceil(input.cssWidth * input.outputScale));
  const bitmapHeight = Math.max(1, Math.ceil(input.cssHeight * input.outputScale));

  input.canvas.width = bitmapWidth;
  input.canvas.height = bitmapHeight;
  input.canvas.style.width = `${input.cssWidth}px`;
  input.canvas.style.height = `${input.cssHeight}px`;

  const context = input.canvas.getContext("2d", { alpha: false });
  if (!context) {
    throw new Error("Canvas 2D context unavailable.");
  }

  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, bitmapWidth, bitmapHeight);
  context.restore();

  return { context, bitmapWidth, bitmapHeight };
}

export function PdfCanvasLayer({
  session,
  pageNumber,
  zoom,
  pageCssWidth,
  pageCssHeight,
  renderQuality,
  renderPhase,
  finalRenderVersion,
  renderText,
  onRendered,
  onCanvasRenderStateChange,
}: PdfCanvasLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const documentId = useMemo(() => getDocumentId(session), [session]);
  const renderScale = useMemo(() => getRenderScale(zoom), [zoom]);
  const outputScale = useMemo(
    () => resolveOutputScale(renderQuality),
    [renderQuality],
  );
  const renderIdentity = useMemo(
    () =>
      createRenderIdentity({
        documentId,
        pageNumber,
        renderScale,
        renderText,
        renderPhase,
        finalRenderVersion,
        outputScale,
      }),
    [
      documentId,
      finalRenderVersion,
      outputScale,
      pageNumber,
      renderPhase,
      renderScale,
      renderText,
    ],
  );
  const [status, setStatus] = useState<"idle" | "rendering" | "ready" | "error">(
    "idle",
  );
  const [renderSource, setRenderSource] =
    useState<PdfCanvasLayerRenderSource>("unknown");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    let cancelled = false;
    let renderTask: PdfJsRenderTask | null = null;
    const abortController = new AbortController();

    const setDataset = (input: {
      status: string;
      source: PdfCanvasLayerRenderSource;
      renderer: string;
      activeBackend?: PdfCanvasLayerRenderSource;
      reason?: string;
      rendered?: RenderedPdfPage;
      nonTextFilter?: TextOperationFilterResult;
      textSuppressionStatus?: string;
      filteredTextOperationCount?: number;
    }) => {
      canvas.dataset.knexPdfPipeline = "modular-single-canvas-html-text";
      canvas.dataset.knexPdfRenderSource = input.source;
      canvas.dataset.knexPdfRenderer = input.renderer;
      canvas.dataset.knexPdfActiveBackend =
        input.activeBackend ?? input.source;
      canvas.dataset.knexPdfPreferredBackend = "pdfium";
      canvas.dataset.knexPdfBackendVersion = "0";
      canvas.dataset.knexPdfRenderText = renderText ? "true" : "false";
      canvas.dataset.knexPdfCanvasTextMode = renderText
        ? "normal"
        : "without-text";
      canvas.dataset.knexPdfRenderStatus = input.status;
      canvas.dataset.knexPdfRenderPhase = renderPhase;
      canvas.dataset.knexPdfGenerationId = renderIdentity;
      canvas.dataset.knexPdfRenderVersion = String(finalRenderVersion);
      canvas.dataset.knexPdfFinalRenderVersion = String(finalRenderVersion);
      canvas.dataset.knexPdfFallbackReason = input.reason ?? "";
      canvas.dataset.knexPdfNonTextFilterSupported = input.nonTextFilter?.supported
        ? "true"
        : "false";
      canvas.dataset.knexPdfNonTextFilterReason = input.nonTextFilter?.reason ?? "";
      canvas.dataset.knexPdfTextSuppressionStatus =
        input.textSuppressionStatus ?? "";
      canvas.dataset.knexPdfFilteredTextOperations = String(
        input.filteredTextOperationCount ?? 0,
      );
      canvas.dataset.knexPdfOutputScale = String(outputScale);
      canvas.dataset.knexPdfCssWidth = String(pageCssWidth);
      canvas.dataset.knexPdfCssHeight = String(pageCssHeight);
      canvas.dataset.knexPdfBitmapWidth = String(canvas.width);
      canvas.dataset.knexPdfBitmapHeight = String(canvas.height);

      if (input.rendered) {
        canvas.dataset.knexPdfPageWidthPt = String(input.rendered.pageWidthPt);
        canvas.dataset.knexPdfPageHeightPt = String(input.rendered.pageHeightPt);
      }
    };

    const emitState = (input: {
      rendered?: RenderedPdfPage;
      source: PdfCanvasLayerRenderSource;
      filteredTextOperationCount?: number;
    }) => {
      onCanvasRenderStateChange?.({
        documentId,
        pageNumber,
        backend: input.source,
        renderPhase,
        renderQuality,
        renderScale,
        outputScale,
        zoom,
        renderText,
        canvasTextMode: renderText ? "normal" : "without-text",
        filteredTextOperationCount: input.filteredTextOperationCount ?? 0,
        renderIdentity,
        renderVersion: finalRenderVersion,
        backendVersion: 0,
        finalRenderVersion,
        cacheLookup: "modular-single-canvas",
      });
    };

    const render = async () => {
      setStatus("rendering");
      setRenderSource("unknown");
      const nonTextFilter = renderText
        ? { supported: false, reason: "render-text-enabled" }
        : resolvePdfJsTextOperationFilter();

      const { bitmapWidth, bitmapHeight } = resetCanvas({
        canvas,
        cssWidth: pageCssWidth,
        cssHeight: pageCssHeight,
        outputScale,
      });

      setDataset({
        status: "rendering",
        source: "unknown",
        renderer: "modular-single-canvas",
        nonTextFilter,
      });

      try {
        try {
          const pdfiumResult = await renderPdfiumPageToCanvas({
            session,
            pageNumber,
            canvas,
            scale: renderScale,
            outputScale,
            cssWidth: pageCssWidth,
            cssHeight: pageCssHeight,
            renderText,
            signal: abortController.signal,
          });

          if (cancelled) return;

          const rendered: RenderedPdfPage = {
            pageNumber,
            width: pdfiumResult.width,
            height: pdfiumResult.height,
            cssWidth: pdfiumResult.cssWidth,
            cssHeight: pdfiumResult.cssHeight,
            pageWidthPt: pdfiumResult.pageWidthPt,
            pageHeightPt: pdfiumResult.pageHeightPt,
            renderScale,
            outputScale: pdfiumResult.outputScale,
            backgroundColor: "#ffffff",
            zoom,
            devicePixelRatio: getDevicePixelRatio(),
            rotation: 0,
            renderMode: renderText ? "bitmap-only" : "hybrid-semantic",
            hasTextLayer: !renderText,
            textLayerMode: "semantic",
            hybridTextEnabled: !renderText,
            canvasActsAsBackground: !renderText,
            renderPixelRatio: pdfiumResult.outputScale,
            bitmapPixels: pdfiumResult.width * pdfiumResult.height,
          };

          setRenderSource("pdfium");
          setStatus("ready");
          setDataset({
            status: "ready",
            source: "pdfium",
            activeBackend: "pdfium",
            renderer: renderText
              ? "pdfium-single-canvas"
              : "pdfium-non-text-single-canvas",
            rendered,
            textSuppressionStatus: pdfiumResult.textSuppressionStatus,
            filteredTextOperationCount:
              pdfiumResult.filteredTextOperationCount,
          });
          emitState({
            rendered,
            source: "pdfium",
            filteredTextOperationCount:
              pdfiumResult.filteredTextOperationCount,
          });
          onRendered?.(rendered);
          return;
        } catch (pdfiumError) {
          if (cancelled) return;

          setDataset({
            status: "rendering",
            source: "unknown",
            renderer: "pdfjs-fallback-after-pdfium",
            reason:
              pdfiumError instanceof Error
                ? pdfiumError.message
                : "pdfium-render-failed",
            nonTextFilter,
          });
        }

        const { context } = resetCanvas({
          canvas,
          cssWidth: pageCssWidth,
          cssHeight: pageCssHeight,
          outputScale,
        });
        const page = (await session.pdf.getPage(pageNumber)) as PdfJsPage;
        const baseViewport = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: renderScale * outputScale });

        if (!renderText && !nonTextFilter.supported) {
          const renderedBlank: RenderedPdfPage = {
            pageNumber,
            width: bitmapWidth,
            height: bitmapHeight,
            cssWidth: pageCssWidth,
            cssHeight: pageCssHeight,
            pageWidthPt: Math.max(1, baseViewport.width),
            pageHeightPt: Math.max(1, baseViewport.height),
            renderScale,
            outputScale,
            backgroundColor: "#ffffff",
            zoom,
            devicePixelRatio: getDevicePixelRatio(),
            rotation: 0,
            renderMode: "hybrid-semantic",
            hasTextLayer: true,
            textLayerMode: "semantic",
            hybridTextEnabled: true,
            canvasActsAsBackground: true,
            renderPixelRatio: outputScale,
            bitmapPixels: bitmapWidth * bitmapHeight,
          };

          if (cancelled) return;

          setRenderSource("unknown");
          setStatus("ready");
          setDataset({
            status: "ready",
            source: "unknown",
            activeBackend: "unknown",
            renderer: "blank-canvas-html-text",
            reason: nonTextFilter.reason,
            rendered: renderedBlank,
            nonTextFilter,
          });
          emitState({ rendered: renderedBlank, source: "unknown" });
          onRendered?.(renderedBlank);
          return;
        }

        const renderParams: Parameters<PdfJsPage["render"]>[0] = {
          canvasContext: context,
          canvas,
          viewport,
          intent: "display",
        };

        if (!renderText && nonTextFilter.filter) {
          renderParams.operationsFilter = nonTextFilter.filter;
        }

        renderTask = page.render(renderParams);
        await renderTask.promise;

        if (cancelled) return;

        const rendered: RenderedPdfPage = {
          pageNumber,
          width: bitmapWidth,
          height: bitmapHeight,
          cssWidth: pageCssWidth,
          cssHeight: pageCssHeight,
          pageWidthPt: Math.max(1, baseViewport.width),
          pageHeightPt: Math.max(1, baseViewport.height),
          renderScale,
          outputScale,
          backgroundColor: "#ffffff",
          zoom,
          devicePixelRatio: getDevicePixelRatio(),
          rotation: 0,
          renderMode: renderText ? "bitmap-only" : "hybrid-semantic",
          hasTextLayer: !renderText,
          textLayerMode: renderText ? "semantic" : "semantic",
          hybridTextEnabled: !renderText,
          canvasActsAsBackground: !renderText,
          renderPixelRatio: outputScale,
          bitmapPixels: bitmapWidth * bitmapHeight,
        };

        setRenderSource("pdfjs");
        setStatus("ready");
        setDataset({
          status: "ready",
          source: "pdfjs",
          activeBackend: "pdfjs",
          renderer: renderText ? "pdfjs-single-canvas" : "pdfjs-non-text-ops-filter",
          rendered,
          nonTextFilter,
        });
        emitState({
          rendered,
          source: "pdfjs",
          filteredTextOperationCount: renderText ? 0 : 1,
        });
        onRendered?.(rendered);
      } catch (error) {
        if (cancelled) return;

        setRenderSource("unknown");
        setStatus("error");
        setDataset({
          status: "error",
          source: "unknown",
          activeBackend: "unknown",
          renderer: "modular-single-canvas",
          reason:
            error instanceof Error ? error.message : "single-canvas-render-failed",
          nonTextFilter,
        });
        emitState({ source: "unknown" });
      }
    };

    void render();

    return () => {
      cancelled = true;
      abortController.abort();
      renderTask?.cancel?.();
    };
  }, [
    documentId,
    finalRenderVersion,
    onCanvasRenderStateChange,
    onRendered,
    outputScale,
    pageCssHeight,
    pageCssWidth,
    pageNumber,
    renderIdentity,
    renderPhase,
    renderQuality,
    renderScale,
    renderText,
    session,
    zoom,
  ]);

  return (
    <canvas
      ref={canvasRef}
      data-knexread-single-canvas-layer="true"
      data-knex-pdf-render-status={status}
      data-knex-pdf-render-source={renderSource}
      data-knex-pdf-render-text={renderText ? "true" : "false"}
      style={{
        display: "block",
        width: `${pageCssWidth}px`,
        height: `${pageCssHeight}px`,
        background: "#ffffff",
      }}
    />
  );
}
