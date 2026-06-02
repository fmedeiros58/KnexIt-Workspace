import type {
  KnexPdfCanvasRenderResult,
  KnexPdfPageGeometry,
  KnexPdfPageViewport,
  KnexPdfRenderQualityInput,
} from "../core/engineTypes";
import { isRenderCancellation } from "../core/engineErrors";
import {
  type KnexPdfRenderPhase,
} from "./RenderQualityController";
import { buildKnexPdfPageGeometry } from "./PageGeometry";

export type PdfJsRenderIntent = "display" | "print";

type PdfJsOperationsFilter = (index: number) => boolean;

type PdfJsOperatorListLike = {
  fnArray: number[];
};

export type PdfJsPageLike = {
  getViewport: (params: { scale: number }) => KnexPdfPageViewport;
  getOperatorList?: (params?: {
    intent?: PdfJsRenderIntent | "any";
  }) => Promise<PdfJsOperatorListLike>;
  render: (params: {
    canvasContext: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;
    transform?: number[];
    viewport: KnexPdfPageViewport;
    intent: PdfJsRenderIntent;
    operationsFilter?: PdfJsOperationsFilter;
  }) => { promise: Promise<void>; cancel?: () => void };
};

type NormalizedCanvasGeometry = {
  cssWidth: number;
  cssHeight: number;

  /**
   * Bitmap real do canvas.
   */
  width: number;
  height: number;

  /**
   * Escala final efetiva usada para diagnosticar a nitidez.
   * É a menor razão entre bitmap real e caixa CSS.
   */
  outputScale: number;

  /**
   * Escalas reais por eixo.
   *
   * Como width/height são inteiros, a razão real pode variar minimamente
   * entre X e Y. Usamos essas escalas no transform para evitar diferença
   * subpixel entre bitmap e viewport.
   */
  outputScaleX: number;
  outputScaleY: number;

  requestedOutputScale: number;
  requestedMinimumOutputScale: number;
  qualityMaxOutputScale: number;
  pixelCount: number;
  wasOutputScaleClamped: boolean;
  wasOutputScaleFloorApplied: boolean;
  pageGeometry: KnexPdfPageGeometry;
};

const MIN_RENDER_SCALE = 0.01;
const PDFJS_SHOW_TEXT_OPERATION_IDS = new Set([
  44, // OPS.showText
  45, // OPS.showSpacedText
  46, // OPS.nextLineShowText
  47, // OPS.nextLineSetSpacingShowText
]);

/**
 * Limite emergencial de segurança.
 *
 * O limite real por qualidade deve vir do RenderQualityController.
 * Este teto existe apenas para impedir estouro extremo por bug.
 */
const EMERGENCY_MAX_CANVAS_PIXELS = 268_435_456; // 16384 x 16384
const EMERGENCY_MAX_CANVAS_SIDE = 32767;

function safeNumber(
  value: number | null | undefined,
  fallback = 0,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function computeCanvasGeometry(input: {
  pageNumber: number;
  baseWidth: number;
  baseHeight: number;
  zoom: number;
  quality?: KnexPdfRenderQualityInput;
  minimumOutputScale?: number;
}): NormalizedCanvasGeometry {
  const geometry = buildKnexPdfPageGeometry({
    pageNumber: input.pageNumber,
    baseWidth: input.baseWidth,
    baseHeight: input.baseHeight,
    zoom: input.zoom,
    quality: input.quality,
    minimumOutputScale: input.minimumOutputScale,
    maxBitmapPixels: EMERGENCY_MAX_CANVAS_PIXELS,
    maxBitmapSide: EMERGENCY_MAX_CANVAS_SIDE,
  });

  return {
    cssWidth: geometry.cssWidth,
    cssHeight: geometry.cssHeight,
    width: geometry.bitmapWidth,
    height: geometry.bitmapHeight,
    outputScale: geometry.outputScale,
    outputScaleX: geometry.outputScaleX,
    outputScaleY: geometry.outputScaleY,
    requestedOutputScale: geometry.phaseClampedOutputScale,
    requestedMinimumOutputScale: geometry.requestedMinimumOutputScale,
    qualityMaxOutputScale: geometry.maxAllowedOutputScale,
    pixelCount: geometry.bitmapPixels,
    wasOutputScaleClamped: geometry.wasOutputScaleClamped,
    wasOutputScaleFloorApplied: geometry.wasOutputScaleFloorApplied,
    pageGeometry: geometry,
  };
}

function resetCanvasBitmap(input: {
  canvas: HTMLCanvasElement;
  geometry: NormalizedCanvasGeometry;
}) {
  const { canvas, geometry } = input;

  /**
   * width/height controlam o bitmap real HiDPI.
   * style.width/style.height controlam a caixa visual CSS.
   */
  canvas.width = geometry.width;
  canvas.height = geometry.height;

  canvas.style.width = `${geometry.cssWidth}px`;
  canvas.style.height = `${geometry.cssHeight}px`;
  canvas.style.imageRendering = "auto";

  canvas.dataset.knexPdfCssWidth = String(geometry.cssWidth);
  canvas.dataset.knexPdfCssHeight = String(geometry.cssHeight);

  canvas.dataset.knexPdfBitmapWidth = String(geometry.width);
  canvas.dataset.knexPdfBitmapHeight = String(geometry.height);
  canvas.dataset.knexPdfBitmapPixels = String(geometry.pixelCount);

  canvas.dataset.knexPdfOutputScale = String(geometry.outputScale);
  canvas.dataset.knexPdfOutputScaleX = String(geometry.outputScaleX);
  canvas.dataset.knexPdfOutputScaleY = String(geometry.outputScaleY);

  canvas.dataset.knexPdfRequestedOutputScale = String(
    geometry.requestedOutputScale,
  );
  canvas.dataset.knexPdfMinimumOutputScale = String(
    geometry.requestedMinimumOutputScale,
  );
  canvas.dataset.knexPdfQualityMaxOutputScale = String(
    geometry.qualityMaxOutputScale,
  );

  canvas.dataset.knexPdfWasOutputScaleClamped = String(
    geometry.wasOutputScaleClamped,
  );
  canvas.dataset.knexPdfWasOutputScaleFloorApplied = String(
    geometry.wasOutputScaleFloorApplied,
  );
}

function prepareCanvasContext(
  canvas: HTMLCanvasElement,
): CanvasRenderingContext2D {
  const context = canvas.getContext("2d", {
    alpha: false,
    desynchronized: false,
  });

  if (!context) {
    throw new Error("Could not initialize KnexPDF canvas.");
  }

  /**
   * O canvas acabou de ter width/height redefinidos, então o contexto já foi
   * reiniciado pelo navegador. Mesmo assim, limpamos explicitamente para evitar
   * resíduos visuais em reuso de canvas.
   */
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.clearRect(0, 0, canvas.width, canvas.height);

  /**
   * PDF.js desenha vetores/texto diretamente na escala final.
   * imageSmoothing afeta principalmente imagens internas do PDF.
   */
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";

  return context;
}

async function createPdfJsTextPaintOperationsFilter(input: {
  page: PdfJsPageLike;
  renderIntent: PdfJsRenderIntent;
  renderText: boolean;
}): Promise<{
  operationsFilter?: PdfJsOperationsFilter;
  filteredTextOperationCount: number;
}> {
  if (input.renderText) {
    return {
      filteredTextOperationCount: 0,
    };
  }

  if (typeof input.page.getOperatorList !== "function") {
    return {
      filteredTextOperationCount: 0,
    };
  }

  const operatorList = await input.page.getOperatorList({
    intent: input.renderIntent,
  });
  const textOperationIndexes = new Set<number>();

  operatorList.fnArray.forEach((operationId, index) => {
    if (PDFJS_SHOW_TEXT_OPERATION_IDS.has(operationId)) {
      textOperationIndexes.add(index);
    }
  });

  return {
    operationsFilter: (index) => !textOperationIndexes.has(index),
    filteredTextOperationCount: textOperationIndexes.size,
  };
}

export async function renderPdfJsPageToHiDpiCanvas(input: {
  pageNumber: number;
  page: PdfJsPageLike;
  canvas: HTMLCanvasElement;
  scale: number;
  quality?: KnexPdfRenderQualityInput;
  renderPhase?: KnexPdfRenderPhase;
  minimumOutputScale?: number;
  renderIntent?: PdfJsRenderIntent;
  renderText?: boolean;
  signal?: AbortSignal;
}): Promise<KnexPdfCanvasRenderResult> {
  const renderScale = Math.max(
    MIN_RENDER_SCALE,
    safeNumber(input.scale, 1),
  );

  const viewport = input.page.getViewport({ scale: renderScale });
  const pageWidthPt = viewport.width / Math.max(0.0001, viewport.scale);
  const pageHeightPt = viewport.height / Math.max(0.0001, viewport.scale);
  const renderIntent =
    input.renderIntent ??
    (input.renderPhase === "settled-final" ? "print" : "display");

  const geometry = computeCanvasGeometry({
    pageNumber: input.pageNumber,
    baseWidth: pageWidthPt,
    baseHeight: pageHeightPt,
    zoom: renderScale,
    quality: input.quality,
    minimumOutputScale: input.minimumOutputScale,
  });

  resetCanvasBitmap({
    canvas: input.canvas,
    geometry,
  });
  input.canvas.dataset.knexPdfRenderIntent = renderIntent;
  input.canvas.dataset.knexPdfBitmapRenderPhase = input.renderPhase ?? "";
  input.canvas.dataset.knexPdfCanvasTextRender = String(
    input.renderText !== false,
  );

  const context = prepareCanvasContext(input.canvas);

  if (input.signal?.aborted) {
    throw new DOMException("Render aborted", "AbortError");
  }

  const { operationsFilter, filteredTextOperationCount } =
    await createPdfJsTextPaintOperationsFilter({
      page: input.page,
      renderIntent,
      renderText: input.renderText !== false,
    });

  if (input.signal?.aborted) {
    throw new DOMException("Render aborted", "AbortError");
  }

  input.canvas.dataset.knexPdfFilteredTextOperations = String(
    filteredTextOperationCount,
  );

  /**
   * Usamos outputScaleX/Y efetivos, derivados do bitmap inteiro real.
   * Isso evita pequenas discrepâncias entre:
   * - escala pedida;
   * - canvas.width/canvas.height arredondados;
   * - caixa CSS final.
   */
  const transform =
    geometry.outputScaleX === 1 && geometry.outputScaleY === 1
      ? undefined
      : [geometry.outputScaleX, 0, 0, geometry.outputScaleY, 0, 0];

  const renderTask = input.page.render({
    canvasContext: context,
    canvas: input.canvas,
    transform,
    viewport,
    intent: renderIntent,
    operationsFilter,
  });

  const renderPromise = renderTask.promise.catch((error) => {
    if (isRenderCancellation(error)) {
      throw new DOMException("Render aborted", "AbortError");
    }

    throw error;
  });

  let renderSettled = false;

  const cancelRenderTask = () => {
    if (renderSettled) return;

    try {
      renderTask.cancel?.();
    } catch (error) {
      if (!isRenderCancellation(error)) {
        throw error;
      }
    }
  };

  const abortListener = () => {
    cancelRenderTask();
  };

  input.signal?.addEventListener("abort", abortListener, { once: true });

  try {
    if (input.signal?.aborted) {
      cancelRenderTask();
      throw new DOMException("Render aborted", "AbortError");
    }

    await renderPromise;
  } catch (error) {
    if (isRenderCancellation(error)) {
      throw new DOMException("Render aborted", "AbortError");
    }

    throw error;
  } finally {
    renderSettled = true;
    input.signal?.removeEventListener("abort", abortListener);
  }

  return {
    pageNumber: input.pageNumber,
    geometry: geometry.pageGeometry,

    /**
     * Bitmap real HiDPI.
     */
    width: geometry.width,
    height: geometry.height,

    /**
     * Caixa visual CSS.
     */
    cssWidth: geometry.cssWidth,
    cssHeight: geometry.cssHeight,

    pageWidthPt,
    pageHeightPt,

    renderScale: viewport.scale,

    /**
     * Escala efetiva mínima do bitmap.
     */
    outputScale: geometry.outputScale,

    renderPixelRatio: geometry.outputScale,
    bitmapPixels: geometry.pixelCount,
    wasOutputScaleClamped: geometry.wasOutputScaleClamped,
    devicePixelRatio:
      typeof globalThis.devicePixelRatio === "number"
        ? globalThis.devicePixelRatio
        : 1,
    bitmap: {
      width: geometry.width,
      height: geometry.height,
      cssWidth: geometry.cssWidth,
      cssHeight: geometry.cssHeight,
      outputScale: geometry.outputScale,
      devicePixelRatio:
        typeof globalThis.devicePixelRatio === "number"
          ? globalThis.devicePixelRatio
          : 1,
    },
  };
}
