import type {
  KnexPdfPageLinkAnnotation,
  KnexPdfRenderedPage,
  KnexPdfRenderQualityInput,
  KnexPdfTextBlock,
} from "../core/engineTypes";
import type {
  PdfBackendCanvasTextMode,
  PdfBackendDocumentHandle,
  PdfBackendDocumentSource,
  PdfRenderBackend,
} from "../backends/PdfRenderBackend";
import {
  extractAnnotationsWithBackend,
  extractTextWithBackend,
} from "../backends/PdfRenderBackend";
import { PdfJsAnnotationExtractor } from "../backends/pdfjs/PdfJsAnnotationExtractor";
import { PdfJsTextExtractor } from "../backends/pdfjs/PdfJsTextExtractor";
import {
  renderPdfJsPageToHiDpiCanvas,
  type PdfJsRenderIntent,
} from "../rendering/HiDpiCanvasRenderer";
import type { KnexPdfRenderPhase } from "../rendering/RenderQualityController";

export type KnexPdfSessionLike = {
  id?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  file?: {
    name?: string;
    size?: number;
    type?: string;
    arrayBuffer: () => Promise<ArrayBuffer>;
  };
  pdf: {
    getPage: (pageNumber: number) => Promise<unknown>;
  };
};

const textExtractor = new PdfJsTextExtractor();
const annotationExtractor = new PdfJsAnnotationExtractor();
const backendDocumentCache = new WeakMap<
  object,
  Map<string, Promise<PdfBackendDocumentHandle>>
>();

function safeNumber(
  value: number | null | undefined,
  fallback = 0,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function normalizeScale(scale: number): number {
  return Math.max(0.01, safeNumber(scale, 1));
}

function resolveCanvasTextMode(input: {
  renderText?: boolean;
  canvasTextMode?: PdfBackendCanvasTextMode;
}): PdfBackendCanvasTextMode {
  if (input.canvasTextMode) {
    return input.canvasTextMode;
  }

  if (input.renderText === false) {
    return "without-text";
  }

  if (input.renderText === true) {
    return "normal";
  }

  return "unknown";
}

function sampleCanvasBackgroundColor(canvas: HTMLCanvasElement): string {
  const width = Math.max(1, canvas.width);
  const height = Math.max(1, canvas.height);

  const sampleX = Math.min(2, width - 1);
  const sampleY = Math.min(2, height - 1);

  const context = canvas.getContext("2d", { alpha: false });
  if (!context) {
    throw new Error("Could not initialize KnexPDF canvas.");
  }

  const sample = context.getImageData(sampleX, sampleY, 1, 1).data;

  return `#${[sample[0], sample[1], sample[2]]
    .map((value) => (value ?? 255).toString(16).padStart(2, "0"))
    .join("")}`;
}

function getDebugBackendFlag(): boolean {
  const globalFlag = (globalThis as unknown as Record<string, unknown>)
    .KNEX_PDF_DEBUG_BACKEND;
  const envFlag =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_KNEX_PDF_DEBUG_BACKEND ??
        process.env.KNEX_PDF_DEBUG_BACKEND
      : undefined;

  return globalFlag === true || globalFlag === "true" || envFlag === "true";
}

function logBackendRenderDebug(input: {
  requestedBackend?: string;
  activeBackend: string;
  fallbackUsed?: boolean;
  canvasTextMode?: PdfBackendCanvasTextMode;
  renderText?: boolean;
  page: KnexPdfRenderedPage;
}) {
  if (!getDebugBackendFlag()) return;

  // eslint-disable-next-line no-console
  console.table({
    requestedBackend: input.requestedBackend ?? input.activeBackend,
    activeBackend: input.activeBackend,
    fallbackUsed: input.fallbackUsed ?? false,
    canvasTextMode: input.canvasTextMode ?? "",
    renderText:
      typeof input.renderText === "boolean" ? String(input.renderText) : "",
    pageNumber: input.page.pageNumber,
    renderScale: input.page.renderScale,
    outputScale: input.page.outputScale,
    cssWidth: input.page.cssWidth,
    cssHeight: input.page.cssHeight,
    width: input.page.width,
    height: input.page.height,
    bitmapPixels: input.page.bitmapPixels,
  });
}

function createRenderedPageFromCanvas(input: {
  pageNumber: number;
  canvas: HTMLCanvasElement;
  rendered: Omit<KnexPdfRenderedPage, "backgroundColor">;
}): KnexPdfRenderedPage {
  const backgroundColor = sampleCanvasBackgroundColor(input.canvas);
  const bitmapWidth = Math.max(1, input.rendered.width || input.canvas.width);
  const bitmapHeight = Math.max(1, input.rendered.height || input.canvas.height);

  return {
    pageNumber: input.pageNumber,

    width: bitmapWidth,
    height: bitmapHeight,

    cssWidth: input.rendered.cssWidth,
    cssHeight: input.rendered.cssHeight,

    pageWidthPt: input.rendered.pageWidthPt,
    pageHeightPt: input.rendered.pageHeightPt,

    renderScale: input.rendered.renderScale,
    outputScale: input.rendered.outputScale,

    backgroundColor,
    zoom: input.rendered.zoom,
    zoomBucket: input.rendered.zoomBucket,
    devicePixelRatio: input.rendered.devicePixelRatio,
    rotation: input.rendered.rotation,
    renderMode: input.rendered.renderMode,
    textLayerMode: input.rendered.textLayerMode,
    bitmap: input.rendered.bitmap ?? {
      width: bitmapWidth,
      height: bitmapHeight,
      cssWidth: input.rendered.cssWidth,
      cssHeight: input.rendered.cssHeight,
      outputScale: input.rendered.outputScale,
      devicePixelRatio: input.rendered.devicePixelRatio,
      zoom: input.rendered.zoom,
      zoomBucket: input.rendered.zoomBucket,
      rotation: input.rendered.rotation,
    },

    renderPixelRatio: input.rendered.renderPixelRatio,
    bitmapPixels:
      input.rendered.bitmapPixels ??
      Math.max(1, bitmapWidth) * Math.max(1, bitmapHeight),
    wasOutputScaleClamped: input.rendered.wasOutputScaleClamped,
  };
}

async function buildBackendDocumentSource(input: {
  backend: PdfRenderBackend;
  session: KnexPdfSessionLike;
}): Promise<PdfBackendDocumentSource> {
  const file = input.session.file;
  const shouldReadBytes = input.backend.id !== "pdfjs" && Boolean(file);
  const data = shouldReadBytes && file
    ? new Uint8Array(await file.arrayBuffer())
    : undefined;

  return {
    id:
      input.session.id ??
      input.session.fileName ??
      input.session.file?.name ??
      "knex-pdf-document",
    fileName: input.session.fileName ?? file?.name,
    fileSize: input.session.fileSize ?? file?.size,
    mimeType: input.session.mimeType ?? file?.type,
    data,
    pdf: input.session.pdf,
  };
}

export async function getKnexPdfDocumentHandleWithBackend(input: {
  backend: PdfRenderBackend;
  session: KnexPdfSessionLike;
}): Promise<PdfBackendDocumentHandle> {
  if (!input.backend.createDocumentHandle) {
    throw new Error(
      `KnexPDF backend cannot create document handles: ${input.backend.id}`,
    );
  }

  const cacheOwner = input.session as object;
  const cacheKey = String(input.backend.id);
  const sessionCache =
    backendDocumentCache.get(cacheOwner) ??
    new Map<string, Promise<PdfBackendDocumentHandle>>();

  if (!backendDocumentCache.has(cacheOwner)) {
    backendDocumentCache.set(cacheOwner, sessionCache);
  }

  const cached = sessionCache.get(cacheKey);
  if (cached) return cached;

  const created = buildBackendDocumentSource(input)
    .then((source) => input.backend.createDocumentHandle?.(source))
    .then((document) => {
      if (!document) {
        throw new Error(
          `KnexPDF backend returned an empty document handle: ${input.backend.id}`,
        );
      }

      return document;
    })
    .catch((error) => {
      sessionCache.delete(cacheKey);
      throw error;
    });

  sessionCache.set(cacheKey, created);
  return created;
}

export async function renderKnexPdfCanvasBitmap(input: {
  session: KnexPdfSessionLike;
  pageNumber: number;
  canvas: HTMLCanvasElement;
  scale: number;
  quality?: KnexPdfRenderQualityInput;
  renderPhase?: KnexPdfRenderPhase;
  minimumOutputScale?: number;
  renderIntent?: PdfJsRenderIntent;
  renderText?: boolean;
  signal?: AbortSignal;
}) {
  const page = await input.session.pdf.getPage(input.pageNumber);

  return renderPdfJsPageToHiDpiCanvas({
    pageNumber: input.pageNumber,
    page: page as Parameters<typeof renderPdfJsPageToHiDpiCanvas>[0]["page"],
    canvas: input.canvas,
    scale: normalizeScale(input.scale),
    quality: input.quality,
    renderPhase: input.renderPhase,
    minimumOutputScale: input.minimumOutputScale,
    renderIntent: input.renderIntent,
    renderText: input.renderText,
    signal: input.signal,
  });
}

export async function renderKnexPdfPageToCanvas(input: {
  session: KnexPdfSessionLike;
  pageNumber: number;
  canvas: HTMLCanvasElement;
  scale: number;
  quality?: KnexPdfRenderQualityInput;
  renderPhase?: KnexPdfRenderPhase;
  minimumOutputScale?: number;
  renderIntent?: PdfJsRenderIntent;
  renderText?: boolean;
  signal?: AbortSignal;
}): Promise<KnexPdfRenderedPage> {
  const rendered = await renderKnexPdfCanvasBitmap(input);

  /**
   * Agora que engineTypes foi corrigido:
   *
   * rendered.width / rendered.height:
   *   bitmap real HiDPI.
   *
   * rendered.cssWidth / rendered.cssHeight:
   *   dimensão visual CSS.
   *
   * input.canvas.width / input.canvas.height:
   *   fallback de segurança para garantir que width/height reflitam o bitmap
   *   real mesmo se algum backend futuro não preencher corretamente.
   */
  const page = createRenderedPageFromCanvas({
    pageNumber: input.pageNumber,
    canvas: input.canvas,
    rendered,
  });

  const canvasTextMode = resolveCanvasTextMode({
    renderText: input.renderText,
  });

  logBackendRenderDebug({
    requestedBackend: "pdfjs",
    activeBackend: "pdfjs",
    fallbackUsed: false,
    canvasTextMode,
    renderText: input.renderText,
    page,
  });

  return page;
}

export async function renderKnexPdfPageWithBackend(input: {
  backend: PdfRenderBackend;
  document: PdfBackendDocumentHandle;
  pageNumber: number;
  canvas: HTMLCanvasElement;
  scale: number;
  quality?: KnexPdfRenderQualityInput;
  renderText?: boolean;
  canvasTextMode?: PdfBackendCanvasTextMode;
  signal?: AbortSignal;
  requestedBackend?: string;
  fallbackUsed?: boolean;
  renderPhase?: KnexPdfRenderPhase;
}): Promise<KnexPdfRenderedPage> {
  const canvasTextMode = resolveCanvasTextMode({
    renderText: input.renderText,
    canvasTextMode: input.canvasTextMode,
  });

  const pageHandle = await input.backend.getPage(
    input.document,
    input.pageNumber,
  );

  const rendered = await input.backend.renderPage({
    page: pageHandle,
    canvas: input.canvas,
    scale: normalizeScale(input.scale),
    quality: input.quality,
    renderText: input.renderText,
    canvasTextMode,
    signal: input.signal,
    renderPhase: input.renderPhase,
  });

  const page = createRenderedPageFromCanvas({
    pageNumber: input.pageNumber,
    canvas: input.canvas,
    rendered,
  });

  logBackendRenderDebug({
    requestedBackend: input.requestedBackend,
    activeBackend: String(input.backend.id),
    fallbackUsed: input.fallbackUsed,
    canvasTextMode,
    renderText: input.renderText,
    page,
  });

  return page;
}

export async function extractKnexPdfTextBlocks(input: {
  session: KnexPdfSessionLike;
  pageNumber: number;
  scale: number;
}): Promise<KnexPdfTextBlock[]> {
  const page = await input.session.pdf.getPage(input.pageNumber);

  return textExtractor.extract(
    {
      pageNumber: input.pageNumber,
      backendPage: page,
    },
    normalizeScale(input.scale),
  );
}

export async function extractKnexPdfTextBlocksWithBackend(input: {
  backend: PdfRenderBackend;
  document: PdfBackendDocumentHandle;
  pageNumber: number;
  scale: number;
  signal?: AbortSignal;
}): Promise<KnexPdfTextBlock[]> {
  const page = await input.backend.getPage(input.document, input.pageNumber);

  return extractTextWithBackend({
    backend: input.backend,
    page,
    scale: normalizeScale(input.scale),
    signal: input.signal,
  });
}

export async function extractKnexPdfPageLinks(input: {
  session: KnexPdfSessionLike;
  pageNumber: number;
  scale: number;
}): Promise<KnexPdfPageLinkAnnotation[]> {
  const page = await input.session.pdf.getPage(input.pageNumber);

  return annotationExtractor.extract(
    {
      pageNumber: input.pageNumber,
      backendPage: page,
    },
    normalizeScale(input.scale),
  );
}

export async function extractKnexPdfPageLinksWithBackend(input: {
  backend: PdfRenderBackend;
  document: PdfBackendDocumentHandle;
  pageNumber: number;
  scale: number;
  signal?: AbortSignal;
}): Promise<KnexPdfPageLinkAnnotation[]> {
  const page = await input.backend.getPage(input.document, input.pageNumber);

  return extractAnnotationsWithBackend({
    backend: input.backend,
    page,
    scale: normalizeScale(input.scale),
    signal: input.signal,
  });
}