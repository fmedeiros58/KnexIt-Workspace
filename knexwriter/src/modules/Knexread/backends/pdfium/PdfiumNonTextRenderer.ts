import type { KnexPdfBlueprintElement } from "../../core/KnexPdfBlueprintTypes";
import { KnexPdfGeometryMath } from "../../core/KnexPdfGeometry";
import type { NativePdfSession } from "../../native-pdf-reader/services";
import type { KnexPdfTextBlock } from "../../native-pdf-reader/knex-pdf-engine";
import {
  getDefaultPdfiumRuntimeAdapterLoader,
  type PdfiumDocumentHandle,
  type PdfiumRenderPageResult,
  type PdfiumRuntimeCapabilities,
} from "./PdfiumRuntimeAdapter";

export type PdfiumCanvasRenderInput = {
  session: NativePdfSession;
  pageNumber: number;
  canvas: HTMLCanvasElement;
  scale: number;
  outputScale: number;
  cssWidth: number;
  cssHeight: number;
  renderText: boolean;

  /*
   * Força documento isolado mesmo quando renderText=true.
   *
   * Necessário para renderizações temporárias do blueprint, porque várias
   * páginas podem construir imagens não textuais ao mesmo tempo. O PDFium/WASM
   * não deve compartilhar o mesmo document handle persistente em renderizações
   * concorrentes.
   */
  forceIsolated?: boolean;
  signal?: AbortSignal;
};

export type PdfiumNonTextImageElementInput = {
  session: NativePdfSession;
  pageNumber: number;
  scale: number;
  cssWidth: number;
  cssHeight: number;
  outputScale?: number;
  imageFormat?: "png" | "jpeg";
  jpegQuality?: number;
  maskTextBlocks?: KnexPdfTextBlock[];
  signal?: AbortSignal;
};

const persistentDocumentCache = new WeakMap<
  NativePdfSession,
  Promise<PdfiumDocumentHandle>
>();

let capabilitiesPromise: Promise<PdfiumRuntimeCapabilities> | null = null;

function getDocumentId(session: NativePdfSession): string {
  return session.id ?? session.fingerprint ?? session.fileName;
}

async function readPdfBytes(session: NativePdfSession): Promise<Uint8Array> {
  return new Uint8Array(await session.file.arrayBuffer());
}

async function createDocumentHandle(
  session: NativePdfSession,
): Promise<PdfiumDocumentHandle> {
  const loader = getDefaultPdfiumRuntimeAdapterLoader();
  const runtime = await loader.getRuntimeAdapter();

  return runtime.createDocumentHandle({
    id: getDocumentId(session),
    fileName: session.fileName,
    fileSize: session.fileSize,
    mimeType: session.mimeType,
    data: await readPdfBytes(session),
  });
}

async function getPersistentDocumentHandle(
  session: NativePdfSession,
): Promise<PdfiumDocumentHandle> {
  let promise = persistentDocumentCache.get(session);

  if (!promise) {
    promise = createDocumentHandle(session).catch((error) => {
      persistentDocumentCache.delete(session);
      throw error;
    });
    persistentDocumentCache.set(session, promise);
  }

  return promise;
}

async function withPdfiumDocument<T>(
  input: {
    session: NativePdfSession;
    isolated: boolean;
  },
  callback: (document: PdfiumDocumentHandle) => Promise<T>,
): Promise<T> {
  if (!input.isolated) {
    return callback(await getPersistentDocumentHandle(input.session));
  }

  const loader = getDefaultPdfiumRuntimeAdapterLoader();
  const runtime = await loader.getRuntimeAdapter();
  const document = await createDocumentHandle(input.session);

  try {
    return await callback(document);
  } finally {
    await runtime.destroyDocument?.(document);
  }
}

function getDevicePixelRatio(): number {
  if (typeof window === "undefined") return 1;

  return KnexPdfGeometryMath.normalizeDevicePixelRatio(
    window.devicePixelRatio || 1,
  );
}

function normalizeRenderScale(scale: number): number {
  return KnexPdfGeometryMath.normalizeZoom(scale);
}

function normalizeCssDimension(value: number): number {
  return Math.max(1, KnexPdfGeometryMath.roundCss(value));
}

function resolveNonTextOutputScale(value: number | undefined): number {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.min(3, KnexPdfGeometryMath.normalizeOutputScale(value));
  }

  return Math.min(2, getDevicePixelRatio());
}

function resolveImageMimeType(format: "png" | "jpeg" | undefined): string {
  return format === "jpeg" ? "image/jpeg" : "image/png";
}

function resolvePdfiumCanvasGeometry(input: {
  scale: number;
  outputScale: number;
  cssWidth: number;
  cssHeight: number;
}): {
  renderScale: number;
  outputScale: number;
  cssWidth: number;
  cssHeight: number;
} {
  /*
   * Ponto central:
   *
   * - renderScale/scale é o zoom CSS final, normalizado pelo núcleo geométrico.
   * - cssWidth/cssHeight são dimensões CSS finais.
   * - outputScale pertence apenas ao bitmap/canvas.
   */
  return {
    renderScale: normalizeRenderScale(input.scale),
    outputScale: resolveNonTextOutputScale(input.outputScale),
    cssWidth: normalizeCssDimension(input.cssWidth),
    cssHeight: normalizeCssDimension(input.cssHeight),
  };
}

function canvasToDataUrl(input: {
  canvas: HTMLCanvasElement;
  imageFormat?: "png" | "jpeg";
  jpegQuality?: number;
}): string {
  const mimeType = resolveImageMimeType(input.imageFormat);

  if (mimeType === "image/jpeg") {
    return input.canvas.toDataURL(
      mimeType,
      Math.max(0, Math.min(1, (input.jpegQuality ?? 92) / 100)),
    );
  }

  return input.canvas.toDataURL(mimeType);
}

function eraseTextRegionsFromCanvas(input: {
  canvas: HTMLCanvasElement;
  textBlocks: KnexPdfTextBlock[];
  outputScale: number;
  cssWidth: number;
  cssHeight: number;
}) {
  if (input.textBlocks.length === 0) return;

  const context = input.canvas.getContext("2d", { alpha: false });
  if (!context) return;

  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = "#ffffff";

  for (const block of input.textBlocks) {
    /*
     * Margem pequena para cobrir antialiasing dos glifos rasterizados.
     * A geometria dos blocos já está no mesmo espaço CSS passado ao renderer.
     */
    const margin = 2;
    const pageBitmapWidth = input.cssWidth * input.outputScale;
    const pageBitmapHeight = input.cssHeight * input.outputScale;
    const x = KnexPdfGeometryMath.clamp(
      (KnexPdfGeometryMath.roundCss(block.x) - margin) * input.outputScale,
      0,
      pageBitmapWidth,
    );
    const y = KnexPdfGeometryMath.clamp(
      (KnexPdfGeometryMath.roundCss(block.y) - margin) * input.outputScale,
      0,
      pageBitmapHeight,
    );
    const width = Math.min(
      pageBitmapWidth - x,
      Math.max(1, KnexPdfGeometryMath.roundCss(block.width) + margin * 2) *
        input.outputScale,
    );
    const height = Math.min(
      pageBitmapHeight - y,
      Math.max(1, KnexPdfGeometryMath.roundCss(block.height) + margin * 2) *
        input.outputScale,
    );

    if (width <= 0 || height <= 0) continue;

    context.fillRect(x, y, width, height);
  }

  context.restore();
}

export async function getPdfiumNonTextRendererCapabilities(): Promise<PdfiumRuntimeCapabilities> {
  if (!capabilitiesPromise) {
    capabilitiesPromise =
      getDefaultPdfiumRuntimeAdapterLoader().getCapabilities();
  }

  return capabilitiesPromise;
}

export function resetPdfiumNonTextRendererRuntime(): void {
  capabilitiesPromise = null;
}

export async function renderPdfiumPageToCanvas(
  input: PdfiumCanvasRenderInput,
): Promise<PdfiumRenderPageResult> {
  const capabilities = await getPdfiumNonTextRendererCapabilities();

  if (!capabilities.available || !capabilities.renderPage) {
    throw new Error(capabilities.reason || "pdfium-renderer-unavailable");
  }

  if (!input.renderText && !capabilities.renderWithoutText) {
    throw new Error("pdfium-render-without-text-unavailable");
  }

  const runtime = await getDefaultPdfiumRuntimeAdapterLoader().getRuntimeAdapter();
  const geometry = resolvePdfiumCanvasGeometry({
    scale: input.scale,
    outputScale: input.outputScale,
    cssWidth: input.cssWidth,
    cssHeight: input.cssHeight,
  });

  return withPdfiumDocument(
    {
      session: input.session,
      isolated: input.forceIsolated ?? !input.renderText,
    },
    async (document) => {
      const page = await runtime.getPage(document, input.pageNumber);

      return runtime.renderPage({
        page,
        canvas: input.canvas,
        scale: geometry.renderScale,
        outputScale: geometry.outputScale,
        cssWidth: geometry.cssWidth,
        cssHeight: geometry.cssHeight,
        renderText: input.renderText,
        signal: input.signal,
      });
    },
  );
}

/**
 * Renderiza a camada não textual pelo PDFium e devolve um elemento de blueprint.
 *
 * Esta função é a ponte correta entre o PDFium e o blueprint:
 *
 * PDFium → canvas temporário sem texto → dataURL → KnexPdfBlueprintElement image
 *
 * O parâmetro maskTextBlocks é uma segunda barreira contra duplicação. Mesmo
 * quando o runtime informa renderText=false, alguns PDFs/runtimes podem deixar
 * resíduos textuais no raster. Nesse caso, as regiões dos blocos HTML são
 * apagadas antes de gerar o dataURL.
 */
export async function renderPdfiumPageNonTextToImageElement(
  input: PdfiumNonTextImageElementInput,
): Promise<KnexPdfBlueprintElement | null> {
  if (typeof document === "undefined") {
    return null;
  }

  if (input.signal?.aborted) {
    throw new DOMException("PDFium non-text render aborted.", "AbortError");
  }

  const geometry = resolvePdfiumCanvasGeometry({
    scale: input.scale,
    outputScale: input.outputScale ?? getDevicePixelRatio(),
    cssWidth: input.cssWidth,
    cssHeight: input.cssHeight,
  });
  const canvas = document.createElement("canvas");

  /*
   * Caminho estável:
   *
   * Renderiza a página completa pelo PDFium e, antes de transformar o canvas em
   * dataURL, apaga as caixas dos textos que já serão renderizados pelo HTML do
   * blueprint.
   *
   * Isso evita o bloqueio observado quando o runtime tenta remover objetos
   * textuais internamente com renderText=false e também impede que a imagem de
   * fundo duplique o texto HTML.
   */
  const rendered = await renderPdfiumPageToCanvas({
    session: input.session,
    pageNumber: input.pageNumber,
    canvas,
    scale: geometry.renderScale,
    outputScale: geometry.outputScale,
    cssWidth: geometry.cssWidth,
    cssHeight: geometry.cssHeight,
    renderText: true,
    forceIsolated: true,
    signal: input.signal,
  });

  if (input.signal?.aborted) {
    throw new DOMException("PDFium non-text render aborted.", "AbortError");
  }

  eraseTextRegionsFromCanvas({
    canvas,
    textBlocks: input.maskTextBlocks ?? [],
    outputScale: rendered.outputScale || geometry.outputScale,
    cssWidth: geometry.cssWidth,
    cssHeight: geometry.cssHeight,
  });

  const mimeType = resolveImageMimeType(input.imageFormat);
  const dataUrl = canvasToDataUrl({
    canvas,
    imageFormat: input.imageFormat,
    jpegQuality: input.jpegQuality,
  });

  return {
    type: "image",
    id: `pdfium-non-text-raster-${input.pageNumber}`,
    pageNumber: input.pageNumber,
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width: geometry.cssWidth,
    height: geometry.cssHeight,
    src: dataUrl,
    dataUrl,
    url: dataUrl,
    imageUrl: dataUrl,
    mimeType,
    format: input.imageFormat ?? "png",
    opacity: 1,
    zIndex: 0,
    sourceBackend: "pdfium",
    sourceKind: "pdfium-full-render-masked",
    renderText: false,
    renderMode: "pdfium-full-render-masked",
    fallbackReason: "stable-full-render-with-text-mask-isolated-document",
    textSuppressionStatus: "not-requested",
    filteredTextOperationCount: 0,
    maskedTextBlockCount: input.maskTextBlocks?.length ?? 0,
    confidence: 0.74,
  } as unknown as KnexPdfBlueprintElement;
}

export async function extractPdfiumPageText(input: {
  session: NativePdfSession;
  pageNumber: number;
  scale: number;
  signal?: AbortSignal;
}): Promise<KnexPdfTextBlock[]> {
  const capabilities = await getPdfiumNonTextRendererCapabilities();

  if (!capabilities.available || !capabilities.extractText) {
    return [];
  }

  const runtime = await getDefaultPdfiumRuntimeAdapterLoader().getRuntimeAdapter();
  const document = await getPersistentDocumentHandle(input.session);
  const page = await runtime.getPage(document, input.pageNumber);

  return runtime.extractText({
    page,
    scale: input.scale,
    signal: input.signal,
  });
}
