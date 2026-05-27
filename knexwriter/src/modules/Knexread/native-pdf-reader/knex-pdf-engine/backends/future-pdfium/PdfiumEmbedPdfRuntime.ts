import type {
  KnexPdfCanvasRenderResult,
  KnexPdfSemanticTextBlock,
} from "../../core/engineTypes";
import {
  PDFIUM_FINAL_RENDER_WARNING_MS,
  type KnexPdfRenderPhase,
} from "../../rendering/RenderQualityController";
import { buildKnexPdfPageGeometry } from "../../rendering/PageGeometry";
import type {
  PdfBackendAnnotation,
  PdfBackendCanvasTextMode,
  PdfBackendCapabilities,
  PdfBackendDocumentHandle,
  PdfBackendDocumentSource,
  PdfBackendExtractAnnotationsInput,
  PdfBackendExtractTextInput,
  PdfBackendPageHandle,
  PdfBackendRenderPageInput,
} from "../PdfRenderBackend";
import type { PdfiumRuntime } from "./PdfiumRuntimeLoader";

export const EMBED_PDF_PDFIUM_PACKAGE = "@embedpdf/pdfium";
export const DEFAULT_LOCAL_PDFIUM_WASM_URL = "/vendor/pdfium/pdfium.wasm";

const PDFIUM_FORMAT_BGRA = 4;
const FPDF_ANNOT = 0x01;
const FPDF_LCD_TEXT = 0x02;
const KNEX_PDF_DEBUG_PDFIUM = false;

const FPDF_PAGEOBJ_TEXT = 1;

const PDFIUM_DEFAULT_MAX_BITMAP_PIXELS = 160_000_000;
const PDFIUM_MAX_BITMAP_SIDE = 32767;

type PdfiumRenderProfile =
  | "chrome-like"
  | "annot-only"
  | "lcd-text"
  | "safe-bitmap";

type PdfiumColorConversionMode = "fast" | "safe";
type PdfiumTextContrastMode = "off" | "mild" | "strong";
type PdfiumInkSmoothingMode = "off" | "mild" | "medium" | "strong";

type PdfiumTextSuppressionStatus =
  | "not-requested"
  | "applied"
  | "unsupported"
  | "failed";

type PdfiumTextSuppressionResult = {
  status: PdfiumTextSuppressionStatus;
  filteredTextOperationCount: number;
  supported: boolean;
};

type PdfiumWasmExports = {
  malloc: (size: number) => number;
  free: (ptr: number) => void;
  memory?: WebAssembly.Memory;
};

type PdfiumRuntimeMethodsLike = {
  HEAPU8?: Uint8Array;
  UTF16ToString?: (ptr: number, maxBytesToRead?: number) => string;
  getValue?: (ptr: number, type: string) => number;
  wasmExports: PdfiumWasmExports;
};

type EmbedPdfPdfiumModule = {
  pdfium: PdfiumRuntimeMethodsLike;
  PDFiumExt_Init: () => void;
  FPDF_CloseDocument: (documentPtr: number) => null;
  FPDF_ClosePage: (pagePtr: number) => null;
  FPDF_GetLastError: () => number;
  FPDF_GetPageCount: (documentPtr: number) => number;
  FPDF_GetPageHeightF: (pagePtr: number) => number;
  FPDF_GetPageWidthF: (pagePtr: number) => number;
  FPDF_LoadMemDocument: (
    dataPtr: number,
    size: number,
    password: string,
  ) => number;
  FPDF_LoadPage: (documentPtr: number, pageIndex: number) => number;
  FPDF_RenderPageBitmap: (
    bitmapPtr: number,
    pagePtr: number,
    startX: number,
    startY: number,
    sizeX: number,
    sizeY: number,
    rotate: number,
    flags: number,
  ) => null;
  FPDFBitmap_CreateEx: (
    width: number,
    height: number,
    format: number,
    bufferPtr: number,
    stride: number,
  ) => number;
  FPDFBitmap_Destroy: (bitmapPtr: number) => null;
  FPDFBitmap_FillRect: (
    bitmapPtr: number,
    left: number,
    top: number,
    width: number,
    height: number,
    color: number,
  ) => boolean;

  FPDFPage_CountObjects?: (pagePtr: number) => number;
  FPDFPage_GetObject?: (pagePtr: number, index: number) => number;
  FPDFPageObj_GetType?: (pageObjectPtr: number) => number;
  FPDFPage_RemoveObject?: (
    pagePtr: number,
    pageObjectPtr: number,
  ) => boolean;
  FPDFPage_GenerateContent?: (pagePtr: number) => boolean;

  FPDFLink_CloseWebLinks?: (linkPagePtr: number) => null;
  FPDFLink_CountRects?: (linkPagePtr: number, linkIndex: number) => number;
  FPDFLink_CountWebLinks?: (linkPagePtr: number) => number;
  FPDFLink_GetRect?: (
    linkPagePtr: number,
    linkIndex: number,
    rectIndex: number,
    leftPtr: number,
    topPtr: number,
    rightPtr: number,
    bottomPtr: number,
  ) => boolean;
  FPDFLink_GetURL?: (
    linkPagePtr: number,
    linkIndex: number,
    bufferPtr: number,
    bufferLength: number,
  ) => number;
  FPDFLink_LoadWebLinks?: (textPagePtr: number) => number;
  FPDFText_ClosePage?: (textPagePtr: number) => null;
  FPDFText_CountChars?: (textPagePtr: number) => number;
  FPDFText_GetCharBox?: (
    textPagePtr: number,
    charIndex: number,
    leftPtr: number,
    rightPtr: number,
    bottomPtr: number,
    topPtr: number,
  ) => boolean;
  FPDFText_GetFontSize?: (textPagePtr: number, charIndex: number) => number;
  FPDFText_GetUnicode?: (textPagePtr: number, charIndex: number) => number;
  FPDFText_LoadPage?: (pagePtr: number) => number;
};

type EmbedPdfModuleNamespace = {
  init?: (options: { wasmBinary: ArrayBuffer }) => Promise<EmbedPdfPdfiumModule>;
  DEFAULT_PDFIUM_WASM_URL?: string;
};

type PdfiumDocumentState = {
  pdfium: EmbedPdfPdfiumModule;
  documentPtr: number;
  sourcePtr: number;
  sourceLength: number;
};

type PdfiumPageState = {
  pdfium: EmbedPdfPdfiumModule;
  document: PdfBackendDocumentHandle;
  pagePtr: number;
  pageWidthPt: number;
  pageHeightPt: number;
};

type TextChar = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  charIndex: number;
};

type TextVisualLine = {
  chars: TextChar[];
  x: number;
  y: number;
  right: number;
  bottom: number;
  fontSize: number;
  lineIndex: number;
};

type TextWord = {
  text: string;
  x: number;
  y: number;
  right: number;
  bottom: number;
  fontSize: number;
  lineIndex: number;
  wordIndex: number;
  scaleX: number;
  confidence: number;
};

function safeNumber(value: number | null | undefined, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function normalizeScale(scale: number): number {
  return Math.max(0.01, safeNumber(scale, 1));
}

function normalizeQualityLabel(quality: unknown): string {
  return typeof quality === "string" ? quality : "extreme";
}

function normalizeRenderPhase(phase: unknown): KnexPdfRenderPhase {
  if (phase === "interactive-preview" || phase === "warmup-preview") {
    return phase;
  }

  return "settled-final";
}

function allowPdfiumTextSuppression(): boolean {
  /**
   * A nova arquitetura do KnexRead usa o PDFium como fonte visual real.
   *
   * Portanto, por padrão, o canvas SEMPRE deve renderizar o texto nativo do PDF.
   * A camada textual HTML deve ser semântica/invisível, usada para seleção,
   * busca e acessibilidade, não para redesenhar tipografia.
   *
   * O modo antigo "without-text" só deve existir como experimento explícito.
   */
  return getGlobalBoolean("KNEX_PDFIUM_ALLOW_TEXT_SUPPRESSION") === true;
}

function normalizeCanvasTextMode(input: {
  renderText?: boolean;
  canvasTextMode?: PdfBackendCanvasTextMode;
}): PdfBackendCanvasTextMode {
  if (!allowPdfiumTextSuppression()) {
    return "normal";
  }

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

function shouldRenderCanvasText(input: {
  renderText?: boolean;
  canvasTextMode?: PdfBackendCanvasTextMode;
}): boolean {
  /**
   * A renderização visual confiável precisa vir do PDFium.
   *
   * Mesmo que uma camada superior ainda envie renderText=false por causa do
   * modo híbrido antigo, este runtime força texto no canvas, salvo quando o
   * experimento de supressão for explicitamente habilitado no console:
   *
   * globalThis.KNEX_PDFIUM_ALLOW_TEXT_SUPPRESSION = true
   */
  if (getGlobalBoolean("KNEX_PDFIUM_FORCE_CANVAS_TEXT") === true) {
    return true;
  }

  if (!allowPdfiumTextSuppression()) {
    return true;
  }

  if (input.renderText === false) {
    return false;
  }

  if (input.canvasTextMode === "without-text") {
    return false;
  }

  return true;
}

function getGlobalNumber(key: string): number | undefined {
  const value = (globalThis as unknown as Record<string, unknown>)[key];
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number.parseFloat(value)
        : Number.NaN;

  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function getGlobalString(key: string): string | undefined {
  const value = (globalThis as unknown as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getGlobalBoolean(key: string): boolean | undefined {
  const value = (globalThis as unknown as Record<string, unknown>)[key];

  if (value === true || value === "true" || value === "1") {
    return true;
  }

  if (value === false || value === "false" || value === "0") {
    return false;
  }

  return undefined;
}


function getPdfiumMaxBitmapPixels(): number {
  return Math.max(
    8_000_000,
    safeNumber(
      getGlobalNumber("KNEX_PDFIUM_MAX_BITMAP_PIXELS"),
      PDFIUM_DEFAULT_MAX_BITMAP_PIXELS,
    ),
  );
}

function getPdfiumMinimumOutputScale(input: {
  quality: unknown;
  renderPhase: KnexPdfRenderPhase;
}): number {
  const genericMinimum = getGlobalNumber("KNEX_PDFIUM_MIN_OUTPUT_SCALE");

  if (genericMinimum) {
    return Math.max(1, genericMinimum);
  }

  if (input.renderPhase === "interactive-preview") {
    return Math.max(
      1,
      getGlobalNumber("KNEX_PDFIUM_INTERACTIVE_MIN_OUTPUT_SCALE") ?? 1.75,
    );
  }

  if (input.renderPhase === "warmup-preview") {
    return Math.max(
      1,
      getGlobalNumber("KNEX_PDFIUM_WARMUP_MIN_OUTPUT_SCALE") ?? 2.5,
    );
  }

  return Math.max(
    1,
    getGlobalNumber("KNEX_PDFIUM_FINAL_MIN_OUTPUT_SCALE") ?? 5,
  );
}

function resolvePdfiumRenderProfile(): PdfiumRenderProfile {
  const profile = getGlobalString("KNEX_PDFIUM_RENDER_PROFILE");

  if (
    profile === "chrome-like" ||
    profile === "annot-only" ||
    profile === "lcd-text" ||
    profile === "safe-bitmap"
  ) {
    return profile;
  }

  return "lcd-text";
}

function resolvePdfiumRenderFlags(profile: PdfiumRenderProfile): number {
  if (profile === "annot-only" || profile === "safe-bitmap") {
    return FPDF_ANNOT;
  }

  return FPDF_ANNOT | FPDF_LCD_TEXT;
}

function resolvePdfiumColorConversionMode(): PdfiumColorConversionMode {
  const mode = getGlobalString("KNEX_PDFIUM_COLOR_CONVERSION");

  return mode === "fast" ? "fast" : "safe";
}

function resolvePdfiumTextContrastMode(): PdfiumTextContrastMode {
  const mode = getGlobalString("KNEX_PDFIUM_TEXT_CONTRAST");

  if (mode === "off" || mode === "mild" || mode === "strong") {
    return mode;
  }

  return "off";
}

function resolvePdfiumInkSmoothingMode(): PdfiumInkSmoothingMode {
  const mode = getGlobalString("KNEX_PDFIUM_INK_SMOOTHING");

  if (
    mode === "off" ||
    mode === "mild" ||
    mode === "medium" ||
    mode === "strong"
  ) {
    return mode;
  }

  /**
   * O PDFium já entrega o bitmap em alta densidade. Ainda assim, alguns PDFs
   * ficam visualmente "duros" em letras pequenas mesmo com bitmapCssRatio alto.
   *
   * O modo mild aplica uma suavização seletiva apenas em pixels neutros/escuros
   * que estão em bordas de tinta, evitando mexer agressivamente no branco da
   * página ou em imagens coloridas.
   */
  return "mild";
}

function normalizeOptionalString(value: string | undefined): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function resolveWasmUrl(input: {
  configuredWasmUrl?: string;
  moduleDefaultWasmUrl?: string;
}): string {
  return (
    normalizeOptionalString(input.configuredWasmUrl) ??
    getGlobalString("KNEX_PDFIUM_WASM_URL") ??
    getGlobalString("__KNEX_PDFIUM_WASM_URL__") ??
    normalizeOptionalString(input.moduleDefaultWasmUrl) ??
    DEFAULT_LOCAL_PDFIUM_WASM_URL
  );
}

function logPdfiumDebug(data: Record<string, unknown>) {
  if (!getPdfiumDebugFlag()) return;

  // eslint-disable-next-line no-console
  console.table(data);
}

function getPdfiumDebugFlag(): boolean {
  const globalFlag = (globalThis as unknown as Record<string, unknown>)
    .KNEX_PDF_DEBUG_PDFIUM;
  const envFlag =
    typeof process !== "undefined"
      ? process.env.NEXT_PUBLIC_KNEX_PDF_DEBUG_PDFIUM ??
        process.env.KNEX_PDF_DEBUG_PDFIUM
      : undefined;

  return (
    KNEX_PDF_DEBUG_PDFIUM ||
    globalFlag === true ||
    globalFlag === "true" ||
    envFlag === "true"
  );
}

function isEmbedPdfModule(module: unknown): module is EmbedPdfModuleNamespace {
  return Boolean(
    module &&
      typeof module === "object" &&
      typeof (module as EmbedPdfModuleNamespace).init === "function",
  );
}

function getHeapU8(pdfium: EmbedPdfPdfiumModule): Uint8Array {
  if (pdfium.pdfium.HEAPU8) return pdfium.pdfium.HEAPU8;

  const memory = pdfium.pdfium.wasmExports.memory;
  if (!memory) {
    throw new Error("PDFium WASM memory is not exposed by the runtime.");
  }

  return new Uint8Array(memory.buffer);
}

function getDouble(pdfium: EmbedPdfPdfiumModule, ptr: number): number {
  if (!pdfium.pdfium.getValue) {
    const memory = pdfium.pdfium.wasmExports.memory;
    if (!memory) {
      throw new Error("PDFium WASM memory is not exposed by the runtime.");
    }

    return new DataView(memory.buffer).getFloat64(ptr, true);
  }

  return pdfium.pdfium.getValue(ptr, "double");
}

function formatPdfiumError(pdfium: EmbedPdfPdfiumModule): string {
  const code = pdfium.FPDF_GetLastError();
  const label =
    code === 1
      ? "unknown"
      : code === 2
        ? "file"
        : code === 3
          ? "format"
          : code === 4
            ? "password"
            : code === 5
              ? "security"
              : code === 6
                ? "page"
                : "none";

  return `PDFium error ${code} (${label}).`;
}

function getDocumentState(
  document: PdfBackendDocumentHandle,
): PdfiumDocumentState {
  const state = document.backendDocument as PdfiumDocumentState | undefined;

  if (!state || typeof state.documentPtr !== "number") {
    throw new Error("Invalid PDFium document handle.");
  }

  return state;
}

function getPageState(page: PdfBackendPageHandle): PdfiumPageState {
  const state = page.backendPage as PdfiumPageState | undefined;

  if (!state || typeof state.pagePtr !== "number") {
    throw new Error("Invalid PDFium page handle.");
  }

  return state;
}

function closePageQuietly(state: PdfiumPageState) {
  if (!state.pagePtr) return;

  try {
    state.pdfium.FPDF_ClosePage(state.pagePtr);
  } catch {
    // Page cleanup must not hide the render/extraction result.
  } finally {
    state.pagePtr = 0;
  }
}

function readUtf16String(input: {
  pdfium: EmbedPdfPdfiumModule;
  ptr: number;
  charLength: number;
}): string {
  if (input.pdfium.pdfium.UTF16ToString) {
    return input.pdfium.pdfium.UTF16ToString(
      input.ptr,
      input.charLength * 2,
    );
  }

  const heap = getHeapU8(input.pdfium);
  const codes: number[] = [];

  for (let index = 0; index < input.charLength; index += 1) {
    const offset = input.ptr + index * 2;
    const code = heap[offset] | ((heap[offset + 1] ?? 0) << 8);
    if (code === 0) break;
    codes.push(code);
  }

  return String.fromCharCode(...codes);
}

function canSuppressPdfiumTextObjects(pdfium: EmbedPdfPdfiumModule): boolean {
  return Boolean(
    pdfium.FPDFPage_CountObjects &&
      pdfium.FPDFPage_GetObject &&
      pdfium.FPDFPageObj_GetType &&
      pdfium.FPDFPage_RemoveObject,
  );
}

function suppressPdfiumTextObjects(input: {
  pdfium: EmbedPdfPdfiumModule;
  pagePtr: number;
  requested: boolean;
}): PdfiumTextSuppressionResult {
  if (!input.requested) {
    return {
      status: "not-requested",
      filteredTextOperationCount: 0,
      supported: canSuppressPdfiumTextObjects(input.pdfium),
    };
  }

  const pdfium = input.pdfium;

  if (!canSuppressPdfiumTextObjects(pdfium)) {
    return {
      status: "unsupported",
      filteredTextOperationCount: 0,
      supported: false,
    };
  }

  try {
    const countObjects = pdfium.FPDFPage_CountObjects!;
    const getObject = pdfium.FPDFPage_GetObject!;
    const getObjectType = pdfium.FPDFPageObj_GetType!;
    const removeObject = pdfium.FPDFPage_RemoveObject!;

    const objectCount = Math.max(0, countObjects(input.pagePtr));
    let removed = 0;

    for (let index = objectCount - 1; index >= 0; index -= 1) {
      const objectPtr = getObject(input.pagePtr, index);
      if (!objectPtr) continue;

      const objectType = getObjectType(objectPtr);

      if (objectType !== FPDF_PAGEOBJ_TEXT) {
        continue;
      }

      const ok = removeObject(input.pagePtr, objectPtr);

      if (ok) {
        removed += 1;
      }
    }

    if (removed > 0 && pdfium.FPDFPage_GenerateContent) {
      try {
        pdfium.FPDFPage_GenerateContent(input.pagePtr);
      } catch {
        // A geração de conteúdo não deve impedir o render em memória.
      }
    }

    return {
      status: "applied",
      filteredTextOperationCount: removed,
      supported: true,
    };
  } catch {
    return {
      status: "failed",
      filteredTextOperationCount: 0,
      supported: true,
    };
  }
}

function configureCanvas(input: {
  canvas: HTMLCanvasElement;
  cssWidth: number;
  cssHeight: number;
  width: number;
  height: number;
  outputScale: number;
  requestedOutputScale: number;
  wasOutputScaleClamped: boolean;
  renderProfile?: PdfiumRenderProfile;
  colorConversionMode?: PdfiumColorConversionMode;
  textContrastMode?: PdfiumTextContrastMode;
  inkSmoothingMode?: PdfiumInkSmoothingMode;
  renderText: boolean;
  canvasTextMode: PdfBackendCanvasTextMode;
  textSuppressionStatus: PdfiumTextSuppressionStatus;
  filteredTextOperationCount: number;
}) {
  const { canvas } = input;
  const outputScaleX = input.width / Math.max(1, input.cssWidth);
  const outputScaleY = input.height / Math.max(1, input.cssHeight);
  const bitmapCssRatio = Math.min(outputScaleX, outputScaleY);

  canvas.width = input.width;
  canvas.height = input.height;
  canvas.style.width = `${input.cssWidth}px`;
  canvas.style.height = `${input.cssHeight}px`;
  canvas.style.imageRendering = "auto";
  canvas.style.backgroundColor = "#ffffff";

  canvas.dataset.knexPdfCssWidth = String(input.cssWidth);
  canvas.dataset.knexPdfCssHeight = String(input.cssHeight);

  canvas.dataset.knexPdfBitmapWidth = String(input.width);
  canvas.dataset.knexPdfBitmapHeight = String(input.height);
  canvas.dataset.knexPdfBitmapPixels = String(input.width * input.height);
  canvas.dataset.knexPdfBitmapCssRatio = String(bitmapCssRatio);

  canvas.dataset.knexPdfOutputScale = String(input.outputScale);
  canvas.dataset.knexPdfOutputScaleX = String(outputScaleX);
  canvas.dataset.knexPdfOutputScaleY = String(outputScaleY);

  canvas.dataset.knexPdfRequestedOutputScale = String(
    input.requestedOutputScale,
  );
  canvas.dataset.knexPdfWasOutputScaleClamped = String(
    input.wasOutputScaleClamped,
  );

  canvas.dataset.knexPdfCanvasTextRender = input.renderText ? "true" : "false";
  canvas.dataset.knexPdfCanvasTextMode = input.canvasTextMode;
  canvas.dataset.knexPdfTextSuppressionStatus = input.textSuppressionStatus;
  canvas.dataset.knexPdfFilteredTextOperations = String(
    input.filteredTextOperationCount,
  );

  canvas.dataset.knexPdfiumRenderProfile = input.renderProfile ?? "";
  canvas.dataset.knexPdfiumColorConversion =
    input.colorConversionMode ?? "";
  canvas.dataset.knexPdfiumTextContrast = input.textContrastMode ?? "";
  canvas.dataset.knexPdfiumInkSmoothing = input.inkSmoothingMode ?? "";
}

function bgraToRgba(input: {
  bgra: Uint8Array;
  byteLength: number;
  mode: PdfiumColorConversionMode;
}): Uint8ClampedArray {
  const { bgra, byteLength, mode } = input;
  const output = new Uint8ClampedArray(byteLength);

  if (mode === "fast" && bgra.byteOffset % 4 === 0 && byteLength % 4 === 0) {
    const input32 = new Uint32Array(
      bgra.buffer,
      bgra.byteOffset,
      byteLength / 4,
    );
    const output32 = new Uint32Array(output.buffer);

    for (let index = 0; index < input32.length; index += 1) {
      const pixel = input32[index] ?? 0;

      output32[index] =
        0xff000000 |
        (pixel & 0x0000ff00) |
        ((pixel & 0x00ff0000) >>> 16) |
        ((pixel & 0x000000ff) << 16);
    }

    return output;
  }

  for (let index = 0; index < byteLength; index += 4) {
    output[index] = bgra[index + 2] ?? 255;
    output[index + 1] = bgra[index + 1] ?? 255;
    output[index + 2] = bgra[index] ?? 255;
    output[index + 3] = 255;
  }

  return output;
}

function applyPdfiumTextContrast(input: {
  rgba: Uint8ClampedArray;
  mode: PdfiumTextContrastMode;
}): Uint8ClampedArray {
  const { rgba, mode } = input;

  if (mode === "off") return rgba;

  const darkenBase = mode === "strong" ? 18 : 8;
  const scale = mode === "strong" ? 0.92 : 0.97;
  const neutralTolerance = mode === "strong" ? 28 : 18;

  for (let index = 0; index < rgba.length; index += 4) {
    const red = rgba[index] ?? 255;
    const green = rgba[index + 1] ?? 255;
    const blue = rgba[index + 2] ?? 255;
    const alpha = rgba[index + 3] ?? 255;

    if (alpha < 32) continue;

    const maxChannel = Math.max(red, green, blue);
    const minChannel = Math.min(red, green, blue);
    const isNeutral = maxChannel - minChannel <= neutralTolerance;

    if (!isNeutral || maxChannel >= 245) continue;

    const luminance = 0.299 * red + 0.587 * green + 0.114 * blue;
    const weight = Math.max(0, Math.min(1, (245 - luminance) / 245));
    const darken = darkenBase * weight;

    rgba[index] = Math.max(0, Math.min(255, red * scale - darken));
    rgba[index + 1] = Math.max(0, Math.min(255, green * scale - darken));
    rgba[index + 2] = Math.max(0, Math.min(255, blue * scale - darken));
    rgba[index + 3] = 255;
  }

  return rgba;
}

function getNeutralLuminanceAt(input: {
  rgba: Uint8ClampedArray;
  index: number;
}): number {
  const red = input.rgba[input.index] ?? 255;
  const green = input.rgba[input.index + 1] ?? 255;
  const blue = input.rgba[input.index + 2] ?? 255;

  const maxChannel = Math.max(red, green, blue);
  const minChannel = Math.min(red, green, blue);

  /**
   * Evita suavizar imagens coloridas ou elementos cromáticos. O foco aqui é
   * texto preto/cinza em fundo branco.
   */
  if (maxChannel - minChannel > 18) {
    return Number.NaN;
  }

  return (red + green + blue) / 3;
}

function applyPdfiumInkSmoothing(input: {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
  mode: PdfiumInkSmoothingMode;
}): Uint8ClampedArray {
  const { rgba, width, height, mode } = input;

  if (mode === "off" || width < 3 || height < 3) {
    return rgba;
  }

  /**
   * Suavização seletiva de borda.
   *
   * Não é um blur geral. O algoritmo só atua em pixels neutros, escuros ou
   * intermediários, localizados em regiões de alto contraste com o fundo.
   *
   * Isso tenta corrigir o serrilhado residual de letras pequenas sem borrar a
   * página inteira.
   */
  const amount =
    mode === "strong" ? 0.32 : mode === "medium" ? 0.24 : 0.16;
  const edgeContrast =
    mode === "strong" ? 24 : mode === "medium" ? 30 : 36;

  const output = new Uint8ClampedArray(rgba);

  const getIndex = (x: number, y: number) => (y * width + x) * 4;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const index = getIndex(x, y);
      const lum = getNeutralLuminanceAt({ rgba, index });

      if (!Number.isFinite(lum)) continue;

      /**
       * Branco puro ou quase branco não precisa ser processado.
       */
      if (lum >= 246) continue;

      let minLum = 255;
      let maxLum = 0;
      let sumRed = 0;
      let sumGreen = 0;
      let sumBlue = 0;
      let samples = 0;

      for (let oy = -1; oy <= 1; oy += 1) {
        for (let ox = -1; ox <= 1; ox += 1) {
          const sampleIndex = getIndex(x + ox, y + oy);
          const sampleLum = getNeutralLuminanceAt({
            rgba,
            index: sampleIndex,
          });

          if (!Number.isFinite(sampleLum)) continue;

          minLum = Math.min(minLum, sampleLum);
          maxLum = Math.max(maxLum, sampleLum);

          sumRed += rgba[sampleIndex] ?? 255;
          sumGreen += rgba[sampleIndex + 1] ?? 255;
          sumBlue += rgba[sampleIndex + 2] ?? 255;
          samples += 1;
        }
      }

      if (samples < 4) continue;

      const isInkEdge = maxLum - minLum >= edgeContrast && maxLum >= 210;

      if (!isInkEdge) continue;

      const avgRed = sumRed / samples;
      const avgGreen = sumGreen / samples;
      const avgBlue = sumBlue / samples;

      output[index] = Math.max(
        0,
        Math.min(255, (rgba[index] ?? 255) * (1 - amount) + avgRed * amount),
      );
      output[index + 1] = Math.max(
        0,
        Math.min(
          255,
          (rgba[index + 1] ?? 255) * (1 - amount) + avgGreen * amount,
        ),
      );
      output[index + 2] = Math.max(
        0,
        Math.min(
          255,
          (rgba[index + 2] ?? 255) * (1 - amount) + avgBlue * amount,
        ),
      );
      output[index + 3] = 255;
    }
  }

  return output;
}

function createBrowserImageData(input: {
  rgba: Uint8ClampedArray;
  width: number;
  height: number;
}): ImageData {
  const imageDataBuffer = new ArrayBuffer(input.rgba.byteLength);
  const imageDataArray = new Uint8ClampedArray(imageDataBuffer);

  imageDataArray.set(input.rgba);

  return new ImageData(imageDataArray, input.width, input.height);
}

function isWhitespaceText(text: string): boolean {
  return /^\s+$/.test(text);
}

function clampTextScaleX(value: number): number {
  /**
   * No modo visual por palavra, a escala horizontal deve ser apenas uma
   * correção fina. Escalas muito agressivas alteram o desenho da fonte em
   * zoom baixo e fazem o HTML parecer diferente do PDF original.
   */
  return Math.max(0.78, Math.min(1.28, safeNumber(value, 1)));
}

function estimateTextNaturalWidth(input: {
  text: string;
  fontSize: number;
}): number {
  const text = input.text;
  const fontSize = Math.max(1, input.fontSize);

  let widthFactor = 0;

  for (const char of text) {
    if (/[ilI\.,:;!'|]/.test(char)) {
      widthFactor += 0.28;
    } else if (/[mwMW@#%&]/.test(char)) {
      widthFactor += 0.9;
    } else if (/[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(char)) {
      widthFactor += 0.66;
    } else {
      widthFactor += 0.54;
    }
  }

  return Math.max(1, widthFactor * fontSize);
}

function createWordFromChars(input: {
  chars: TextChar[];
  lineIndex: number;
  wordIndex: number;
}): TextWord | null {
  if (input.chars.length === 0) return null;

  const sortedChars = [...input.chars].sort((a, b) => {
    if (Math.abs(a.x - b.x) > 0.5) return a.x - b.x;
    return a.charIndex - b.charIndex;
  });

  const visibleChars = sortedChars.filter((char) => !isWhitespaceText(char.text));
  if (visibleChars.length === 0) return null;

  /**
   * Estratégia por PALAVRA.
   *
   * A estratégia por linha inteira acumulava erro de métrica: se a fonte HTML
   * não fosse exatamente a mesma fonte embutida no PDF, uma pequena diferença
   * em cada letra virava uma diferença grande no final da linha. Isso ficava
   * especialmente evidente em zoom baixo.
   *
   * Por palavra, o erro fica local. Cada palavra preserva a própria caixa,
   * reduzindo desalinhamento acumulado e diminuindo a necessidade de scaleX
   * agressivo.
   */
  const text = visibleChars.map((char) => char.text).join("").trim();
  if (!text) return null;

  const x = Math.min(...visibleChars.map((char) => char.x));
  const y = Math.min(...visibleChars.map((char) => char.y));
  const right = Math.max(...visibleChars.map((char) => char.x + char.width));
  const bottom = Math.max(...visibleChars.map((char) => char.y + char.height));
  const fontSize = Math.max(...visibleChars.map((char) => char.fontSize));

  const visualWidth = Math.max(1, right - x);
  const estimatedWidth = estimateTextNaturalWidth({
    text,
    fontSize,
  });
  const scaleX = clampTextScaleX(visualWidth / estimatedWidth);

  const distortion = Math.abs(scaleX - 1);
  const confidence = Math.max(0.72, Math.min(0.96, 0.96 - distortion * 0.22));

  return {
    text,
    x,
    y,
    right,
    bottom,
    fontSize,
    lineIndex: input.lineIndex,
    wordIndex: input.wordIndex,
    scaleX,
    confidence,
  };
}

function groupCharsIntoVisualLines(chars: TextChar[]): TextVisualLine[] {
  const lines: TextVisualLine[] = [];

  const sortedInputChars = [...chars]
    .filter((char) => char.text && char.text !== "\r" && char.text !== "\n")
    .sort((a, b) => {
      const centerYA = a.y + a.height / 2;
      const centerYB = b.y + b.height / 2;

      if (Math.abs(centerYA - centerYB) > Math.max(2, Math.min(a.height, b.height) * 0.5)) {
        return centerYA - centerYB;
      }

      if (Math.abs(a.x - b.x) > 0.5) return a.x - b.x;
      return a.charIndex - b.charIndex;
    });

  for (const char of sortedInputChars) {
    const centerY = char.y + char.height / 2;

    let targetLine: TextVisualLine | undefined;

    for (let index = lines.length - 1; index >= 0; index -= 1) {
      const candidate = lines[index];
      if (!candidate) continue;

      const candidateCenterY = candidate.y + (candidate.bottom - candidate.y) / 2;
      const sameLine =
        Math.abs(centerY - candidateCenterY) <=
        Math.max(3, Math.max(char.height, candidate.bottom - candidate.y) * 0.62);

      if (sameLine) {
        targetLine = candidate;
        break;
      }

      if (candidate.y < char.y - Math.max(8, char.height * 1.5)) {
        break;
      }
    }

    if (!targetLine) {
      lines.push({
        chars: [char],
        x: char.x,
        y: char.y,
        right: char.x + char.width,
        bottom: char.y + char.height,
        fontSize: char.fontSize,
        lineIndex: lines.length,
      });
      continue;
    }

    targetLine.chars.push(char);
    targetLine.x = Math.min(targetLine.x, char.x);
    targetLine.y = Math.min(targetLine.y, char.y);
    targetLine.right = Math.max(targetLine.right, char.x + char.width);
    targetLine.bottom = Math.max(targetLine.bottom, char.y + char.height);
    targetLine.fontSize = Math.max(targetLine.fontSize, char.fontSize);
  }

  return lines.sort((a, b) => {
    if (Math.abs(a.y - b.y) > 1) return a.y - b.y;
    return a.x - b.x;
  });
}

function getWordGapThreshold(input: {
  previousChar: TextChar;
  nextChar: TextChar;
}): number {
  const fontSize = Math.max(
    1,
    Math.min(input.previousChar.fontSize, input.nextChar.fontSize),
  );

  /**
   * Gap mínimo para separar palavras quando o PDF não entrega caractere de
   * espaço. O limite precisa ser maior do que pequenos ruídos entre letras,
   * mas menor do que o espaço visual entre palavras.
   */
  return Math.max(1.5, Math.min(8, fontSize * 0.32));
}

function splitLineIntoWordCharGroups(line: TextVisualLine): TextChar[][] {
  const sortedChars = [...line.chars].sort((a, b) => {
    if (Math.abs(a.x - b.x) > 0.5) return a.x - b.x;
    return a.charIndex - b.charIndex;
  });

  const groups: TextChar[][] = [];
  let currentGroup: TextChar[] = [];
  let previousVisibleChar: TextChar | null = null;

  const flushCurrentGroup = () => {
    if (currentGroup.length === 0) return;
    groups.push(currentGroup);
    currentGroup = [];
  };

  for (const char of sortedChars) {
    if (isWhitespaceText(char.text)) {
      flushCurrentGroup();
      previousVisibleChar = null;
      continue;
    }

    if (previousVisibleChar) {
      const previousRight = previousVisibleChar.x + previousVisibleChar.width;
      const gap = char.x - previousRight;
      const threshold = getWordGapThreshold({
        previousChar: previousVisibleChar,
        nextChar: char,
      });

      if (gap > threshold) {
        flushCurrentGroup();
      }
    }

    currentGroup.push(char);
    previousVisibleChar = char;
  }

  flushCurrentGroup();

  return groups;
}

function groupCharsIntoWords(chars: TextChar[]): TextWord[] {
  const lines = groupCharsIntoVisualLines(chars);
  const words: TextWord[] = [];

  /**
   * Retornamos blocos por PALAVRA, não por linha.
   *
   * Essa é a estratégia intermediária mais estável:
   * - melhor que linha inteira em zoom baixo, pois não acumula erro de fonte;
   * - muito mais leve que caractere por caractere;
   * - preserva a posição local de cada unidade textual;
   * - reduz a necessidade de distorção horizontal agressiva.
   */
  for (const line of lines) {
    const wordGroups = splitLineIntoWordCharGroups(line);

    for (let wordIndex = 0; wordIndex < wordGroups.length; wordIndex += 1) {
      const word = createWordFromChars({
        chars: wordGroups[wordIndex] ?? [],
        lineIndex: line.lineIndex,
        wordIndex,
      });

      if (word) {
        words.push(word);
      }
    }
  }

  return words;
}

function createTextBlock(input: {
  word: TextWord;
  pageNumber: number;
  index: number;
}): KnexPdfSemanticTextBlock {
  const width = Math.max(1, input.word.right - input.word.x);
  const height = Math.max(1, input.word.bottom - input.word.y);
  const normalizedText = input.word.text.trim();
  const isLikelyHeading =
    normalizedText.length > 12 &&
    normalizedText === normalizedText.toUpperCase() &&
    input.word.fontSize >= 8;

  return {
    id: `pdfium-word-${input.pageNumber}-${input.index}`,
    pageNumber: input.pageNumber,
    text: normalizedText,
    x: input.word.x,
    y: input.word.y,
    width,
    height,
    fontFamily: "Arial, Helvetica, sans-serif",
    fontName: "pdfium-word-inferred",
    fontSize: input.word.fontSize,
    fontWeight: isLikelyHeading ? "500" : "normal",
    fontStyle: "normal",
    color: "#111827",
    align: "left",
    lineHeight: Math.max(height, input.word.fontSize),
    letterSpacing: 0,
    readingOrder: input.index,
    lineIndex: input.word.lineIndex,
    paragraphIndex: input.word.lineIndex,
    sourceBackend: "pdfium",
    textRenderMode: "semantic",
    opacity: 1,
    rotation: 0,
    scaleX: input.word.scaleX,
    scaleY: 1,
    confidence: input.word.confidence,
  };
}

export function createEmbedPdfPdfiumRuntime(
  module: unknown,
  options: { wasmUrl?: string } = {},
): PdfiumRuntime | null {
  if (!isEmbedPdfModule(module) || !module.init) {
    return null;
  }

  const embedPdfModule = module;
  let pdfiumPromise: Promise<EmbedPdfPdfiumModule> | null = null;

  async function getPdfium(): Promise<EmbedPdfPdfiumModule> {
    if (!pdfiumPromise) {
      const wasmUrl = resolveWasmUrl({
        configuredWasmUrl: options.wasmUrl,
        moduleDefaultWasmUrl: embedPdfModule.DEFAULT_PDFIUM_WASM_URL,
      });

      logPdfiumDebug({
        step: "pdfium-runtime-init",
        wasmUrl,
        moduleHasInit: typeof embedPdfModule.init === "function",
        moduleDefaultWasmUrl: embedPdfModule.DEFAULT_PDFIUM_WASM_URL ?? "",
      });

      pdfiumPromise = fetch(wasmUrl)
        .then((response) => {
          if (!response.ok) {
            throw new Error(
              `Could not load PDFium WASM from ${wasmUrl} (${response.status} ${response.statusText}).`,
            );
          }

          return response.arrayBuffer();
        })
        .then((wasmBinary) => embedPdfModule.init?.({ wasmBinary }))
        .then((nextPdfium) => {
          if (!nextPdfium) {
            throw new Error("PDFium runtime initialization returned no module.");
          }

          nextPdfium.PDFiumExt_Init();
          return nextPdfium;
        })
        .catch((error) => {
          pdfiumPromise = null;
          throw error;
        });
    }

    return pdfiumPromise;
  }

  return {
    async getCapabilities(): Promise<Partial<PdfBackendCapabilities>> {
      try {
        const pdfium = await getPdfium();

        return {
          available: true,
          renderPage: true,
          extractText: true,
          extractAnnotations: true,
          cancellation: false,
          hiDpi: true,
          tileRendering: false,
          worker: false,
          renderWithoutText:
            allowPdfiumTextSuppression() && canSuppressPdfiumTextObjects(pdfium),
          reason:
            "PDFium runtime configured and initialized through @embedpdf/pdfium.",
        };
      } catch (error) {
        return {
          available: false,
          renderPage: false,
          extractText: false,
          extractAnnotations: false,
          cancellation: false,
          hiDpi: false,
          tileRendering: false,
          worker: false,
          renderWithoutText: false,
          reason:
            error instanceof Error
              ? error.message
              : "PDFium runtime could not be initialized.",
        };
      }
    },

    async createDocumentHandle(
      source: PdfBackendDocumentSource,
    ): Promise<PdfBackendDocumentHandle> {
      if (!source.data?.byteLength) {
        throw new Error(
          "PDFium backend requires Uint8Array PDF data in document source.",
        );
      }

      const pdfium = await getPdfium();
      const byteLength = source.data.byteLength;
      const sourcePtr = pdfium.pdfium.wasmExports.malloc(byteLength);

      if (!sourcePtr) {
        throw new Error("PDFium could not allocate memory for the PDF source.");
      }

      getHeapU8(pdfium).set(source.data, sourcePtr);

      const documentPtr = pdfium.FPDF_LoadMemDocument(
        sourcePtr,
        byteLength,
        "",
      );

      if (!documentPtr) {
        pdfium.pdfium.wasmExports.free(sourcePtr);
        throw new Error(
          `Could not open PDF with PDFium. ${formatPdfiumError(pdfium)}`,
        );
      }

      return {
        id: source.id,
        backendId: "pdfium",
        pageCount: Math.max(0, pdfium.FPDF_GetPageCount(documentPtr)),
        backendDocument: {
          pdfium,
          documentPtr,
          sourcePtr,
          sourceLength: byteLength,
        } satisfies PdfiumDocumentState,
        metadata: {
          fileName: source.fileName,
          fileSize: source.fileSize,
          mimeType: source.mimeType,
        },
      };
    },

    async getPage(
      document: PdfBackendDocumentHandle,
      pageNumber: number,
    ): Promise<PdfBackendPageHandle> {
      const documentState = getDocumentState(document);
      const pageCount = Math.max(1, document.pageCount);
      const safePageNumber = Math.max(
        1,
        Math.min(pageCount, Math.floor(safeNumber(pageNumber, 1))),
      );
      const pagePtr = documentState.pdfium.FPDF_LoadPage(
        documentState.documentPtr,
        safePageNumber - 1,
      );

      if (!pagePtr) {
        throw new Error(
          `Could not load PDFium page ${safePageNumber}. ${formatPdfiumError(documentState.pdfium)}`,
        );
      }

      return {
        pageNumber: safePageNumber,
        backendId: "pdfium",
        document,
        backendPage: {
          pdfium: documentState.pdfium,
          document,
          pagePtr,
          pageWidthPt: documentState.pdfium.FPDF_GetPageWidthF(pagePtr),
          pageHeightPt: documentState.pdfium.FPDF_GetPageHeightF(pagePtr),
        } satisfies PdfiumPageState,
      };
    },

    async renderPage(
      input: PdfBackendRenderPageInput,
    ): Promise<KnexPdfCanvasRenderResult> {
      const renderStartedAt = performance.now();
      const pageState = getPageState(input.page);
      const renderPhase = normalizeRenderPhase(input.renderPhase);
      const renderScale = normalizeScale(input.scale);
      const canvasTextMode = normalizeCanvasTextMode({
        renderText: input.renderText,
        canvasTextMode: input.canvasTextMode,
      });
      const renderText = shouldRenderCanvasText({
        renderText: input.renderText,
        canvasTextMode,
      });

      const minimumOutputScale = getPdfiumMinimumOutputScale({
        quality: input.quality,
        renderPhase,
      });

      const geometry = buildKnexPdfPageGeometry({
        pageNumber: input.page.pageNumber,
        baseWidth: pageState.pageWidthPt,
        baseHeight: pageState.pageHeightPt,
        zoom: renderScale,
        quality: input.quality,
        backend: "pdfium",
        renderPhase,
        minimumOutputScale,
        maxBitmapPixels: getPdfiumMaxBitmapPixels(),
        maxBitmapSide: PDFIUM_MAX_BITMAP_SIDE,
        maxOutputScale: getGlobalNumber("KNEX_PDFIUM_MAX_OUTPUT_SCALE"),
      });

      const cssWidth = geometry.cssWidth;
      const cssHeight = geometry.cssHeight;
      const requestedOutputScale = geometry.requestedOutputScale;
      const targetOutputScale = geometry.targetOutputScale;
      const phaseClampedOutputScale = geometry.phaseClampedOutputScale;
      const outputScale = geometry.outputScale;
      const width = geometry.bitmapWidth;
      const height = geometry.bitmapHeight;
      const effectiveOutputScaleX = geometry.outputScaleX;
      const effectiveOutputScaleY = geometry.outputScaleY;
      const effectiveOutputScale = geometry.outputScale;

      const byteLength = width * height * 4;
      const bufferPtr = pageState.pdfium.pdfium.wasmExports.malloc(byteLength);
      let bitmapPtr = 0;

      if (!bufferPtr) {
        closePageQuietly(pageState);
        throw new Error(
          `PDFium could not allocate render buffer for page ${input.page.pageNumber}.`,
        );
      }

      const renderProfile = resolvePdfiumRenderProfile();
      const colorConversionMode = resolvePdfiumColorConversionMode();
      const textContrastMode = resolvePdfiumTextContrastMode();
      const inkSmoothingMode = resolvePdfiumInkSmoothingMode();
      const renderFlags = resolvePdfiumRenderFlags(renderProfile);
      const textSuppression = suppressPdfiumTextObjects({
        pdfium: pageState.pdfium,
        pagePtr: pageState.pagePtr,
        requested: !renderText,
      });

      const wasOutputScaleClamped = geometry.wasOutputScaleClamped;

      logPdfiumDebug({
        backend: "pdfium",
        pageNumber: input.page.pageNumber,
        renderPhase,
        renderProfile,
        colorConversionMode,
        textContrastMode,
        inkSmoothingMode,
        quality: normalizeQualityLabel(input.quality),
        renderScale,
        outputScale,
        effectiveOutputScale,
        effectiveOutputScaleX,
        effectiveOutputScaleY,
        requestedOutputScale,
        minimumOutputScale,
        targetOutputScale,
        phaseClampedOutputScale,
        renderFlags,
        renderText,
        canvasTextMode,
        textSuppressionStatus: textSuppression.status,
        filteredTextOperationCount:
          textSuppression.filteredTextOperationCount,
        textSuppressionSupported: textSuppression.supported,
        cssWidth,
        cssHeight,
        width,
        height,
        bitmapPixels: width * height,
        maxBitmapPixels: getPdfiumMaxBitmapPixels(),
        wasOutputScaleClamped,
      });

      configureCanvas({
        canvas: input.canvas,
        cssWidth,
        cssHeight,
        width,
        height,
        outputScale: effectiveOutputScale,
        requestedOutputScale,
        wasOutputScaleClamped,
        renderProfile,
        colorConversionMode,
        textContrastMode,
        inkSmoothingMode,
        renderText,
        canvasTextMode,
        textSuppressionStatus: textSuppression.status,
        filteredTextOperationCount:
          textSuppression.filteredTextOperationCount,
      });

      try {
        if (input.signal?.aborted) {
          throw new DOMException("Render aborted", "AbortError");
        }

        getHeapU8(pageState.pdfium).fill(
          255,
          bufferPtr,
          bufferPtr + byteLength,
        );

        bitmapPtr = pageState.pdfium.FPDFBitmap_CreateEx(
          width,
          height,
          PDFIUM_FORMAT_BGRA,
          bufferPtr,
          width * 4,
        );

        if (!bitmapPtr) {
          throw new Error("PDFium could not create a render bitmap.");
        }

        const filled = pageState.pdfium.FPDFBitmap_FillRect(
          bitmapPtr,
          0,
          0,
          width,
          height,
          0xffffffff,
        );

        if (!filled) {
          logPdfiumDebug({
            step: "pdfium-fillrect-failed",
            pageNumber: input.page.pageNumber,
            width,
            height,
          });
        }

        pageState.pdfium.FPDF_RenderPageBitmap(
          bitmapPtr,
          pageState.pagePtr,
          0,
          0,
          width,
          height,
          0,
          renderFlags,
        );

        if (input.signal?.aborted) {
          throw new DOMException("Render aborted", "AbortError");
        }

        const heap = getHeapU8(pageState.pdfium);
        const bgra = heap.subarray(bufferPtr, bufferPtr + byteLength);
        const context = input.canvas.getContext("2d", {
          alpha: false,
          desynchronized: false,
        });

        if (!context) {
          throw new Error("Could not initialize KnexPDF canvas.");
        }

        context.save();
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, width, height);

        const rgba = applyPdfiumInkSmoothing({
          rgba: applyPdfiumTextContrast({
            rgba: bgraToRgba({
              bgra,
              byteLength,
              mode: colorConversionMode,
            }),
            mode: textContrastMode,
          }),
          width,
          height,
          mode: inkSmoothingMode,
        });

        context.putImageData(
          createBrowserImageData({
            rgba,
            width,
            height,
          }),
          0,
          0,
        );

        context.restore();
      } finally {
        if (bitmapPtr) pageState.pdfium.FPDFBitmap_Destroy(bitmapPtr);
        pageState.pdfium.pdfium.wasmExports.free(bufferPtr);
        closePageQuietly(pageState);
      }

      const renderDurationMs = performance.now() - renderStartedAt;

      if (
        renderPhase === "settled-final" &&
        renderDurationMs > PDFIUM_FINAL_RENDER_WARNING_MS
      ) {
        logPdfiumDebug({
          step: "pdfium-final-render-budget-exceeded",
          pageNumber: input.page.pageNumber,
          renderDurationMs,
          warningBudgetMs: PDFIUM_FINAL_RENDER_WARNING_MS,
          outputScale: effectiveOutputScale,
          bitmapPixels: width * height,
        });
      }

      const withoutTextApplied =
        !renderText && textSuppression.status === "applied";

      return {
        pageNumber: input.page.pageNumber,
        geometry,
        width,
        height,
        cssWidth,
        cssHeight,
        pageWidthPt: pageState.pageWidthPt,
        pageHeightPt: pageState.pageHeightPt,
        renderScale,
        outputScale: effectiveOutputScale,
        renderPixelRatio: effectiveOutputScale,
        bitmapPixels: width * height,
        wasOutputScaleClamped,
        zoom: renderScale * 100,
        devicePixelRatio:
          typeof globalThis.devicePixelRatio === "number"
            ? globalThis.devicePixelRatio
            : 1,
        renderMode: withoutTextApplied ? "hybrid-visual" : "bitmap-only",
        textLayerMode: withoutTextApplied ? "visual" : "semantic",
      };
    },

    async extractText(
      input: PdfBackendExtractTextInput,
    ): Promise<KnexPdfSemanticTextBlock[]> {
      const pageState = getPageState(input.page);
      const pdfium = pageState.pdfium;
      const loadTextPage = pdfium.FPDFText_LoadPage;
      const countChars = pdfium.FPDFText_CountChars;
      const getUnicode = pdfium.FPDFText_GetUnicode;
      const getCharBox = pdfium.FPDFText_GetCharBox;
      const closeTextPage = pdfium.FPDFText_ClosePage;

      if (!loadTextPage || !countChars || !getUnicode || !getCharBox) {
        closePageQuietly(pageState);
        return [];
      }

      const textPagePtr = loadTextPage(pageState.pagePtr);
      if (!textPagePtr) {
        closePageQuietly(pageState);
        return [];
      }

      const scratchPtr = pdfium.pdfium.wasmExports.malloc(8 * 4);
      const chars: TextChar[] = [];
      const scale = normalizeScale(input.scale);

      if (!scratchPtr) {
        closeTextPage?.(textPagePtr);
        closePageQuietly(pageState);
        return [];
      }

      try {
        const charCount = Math.max(0, countChars(textPagePtr));

        for (let index = 0; index < charCount; index += 1) {
          const unicode = getUnicode(textPagePtr, index);
          if (!unicode) continue;

          const ok = getCharBox(
            textPagePtr,
            index,
            scratchPtr,
            scratchPtr + 8,
            scratchPtr + 16,
            scratchPtr + 24,
          );
          if (!ok) continue;

          const left = getDouble(pdfium, scratchPtr);
          const right = getDouble(pdfium, scratchPtr + 8);
          const bottom = getDouble(pdfium, scratchPtr + 16);
          const top = getDouble(pdfium, scratchPtr + 24);
          const fontSize = Math.max(
            1,
            safeNumber(pdfium.FPDFText_GetFontSize?.(textPagePtr, index), 12) *
              scale,
          );

          chars.push({
            text: String.fromCodePoint(unicode),
            x: left * scale,
            y: (pageState.pageHeightPt - top) * scale,
            width: Math.max(1, (right - left) * scale),
            height: Math.max(1, (top - bottom) * scale),
            fontSize,
            charIndex: index,
          });
        }
      } finally {
        pdfium.pdfium.wasmExports.free(scratchPtr);
        closeTextPage?.(textPagePtr);
        closePageQuietly(pageState);
      }

      return groupCharsIntoWords(chars).map((word, index) =>
        createTextBlock({
          word,
          pageNumber: input.page.pageNumber,
          index,
        }),
      );
    },

    async extractAnnotations(
      input: PdfBackendExtractAnnotationsInput,
    ): Promise<PdfBackendAnnotation[]> {
      const pageState = getPageState(input.page);
      const pdfium = pageState.pdfium;
      const loadTextPage = pdfium.FPDFText_LoadPage;
      const closeTextPage = pdfium.FPDFText_ClosePage;
      const loadWebLinks = pdfium.FPDFLink_LoadWebLinks;
      const countWebLinks = pdfium.FPDFLink_CountWebLinks;
      const countRects = pdfium.FPDFLink_CountRects;
      const getRect = pdfium.FPDFLink_GetRect;
      const getUrl = pdfium.FPDFLink_GetURL;
      const closeWebLinks = pdfium.FPDFLink_CloseWebLinks;

      if (
        !loadTextPage ||
        !loadWebLinks ||
        !countWebLinks ||
        !countRects ||
        !getRect ||
        !getUrl
      ) {
        closePageQuietly(pageState);
        return [];
      }

      const textPagePtr = loadTextPage(pageState.pagePtr);
      if (!textPagePtr) {
        closePageQuietly(pageState);
        return [];
      }

      const linkPagePtr = loadWebLinks(textPagePtr);
      const annotations: PdfBackendAnnotation[] = [];
      const scratchPtr = pdfium.pdfium.wasmExports.malloc(8 * 4);
      const scale = normalizeScale(input.scale);

      if (!scratchPtr) {
        if (linkPagePtr) closeWebLinks?.(linkPagePtr);
        closeTextPage?.(textPagePtr);
        closePageQuietly(pageState);
        return [];
      }

      try {
        const linkCount = Math.max(0, countWebLinks(linkPagePtr));

        for (let linkIndex = 0; linkIndex < linkCount; linkIndex += 1) {
          const urlLength = Math.max(0, getUrl(linkPagePtr, linkIndex, 0, 0));
          const urlPtr = urlLength
            ? pdfium.pdfium.wasmExports.malloc(urlLength * 2)
            : 0;
          let url: string | undefined;

          try {
            if (urlPtr) {
              getUrl(linkPagePtr, linkIndex, urlPtr, urlLength);
              url = readUtf16String({
                pdfium,
                ptr: urlPtr,
                charLength: urlLength,
              });
            }
          } finally {
            if (urlPtr) pdfium.pdfium.wasmExports.free(urlPtr);
          }

          const rectCount = Math.max(0, countRects(linkPagePtr, linkIndex));

          for (let rectIndex = 0; rectIndex < rectCount; rectIndex += 1) {
            const ok = getRect(
              linkPagePtr,
              linkIndex,
              rectIndex,
              scratchPtr,
              scratchPtr + 8,
              scratchPtr + 16,
              scratchPtr + 24,
            );
            if (!ok) continue;

            const left = getDouble(pdfium, scratchPtr);
            const top = getDouble(pdfium, scratchPtr + 8);
            const right = getDouble(pdfium, scratchPtr + 16);
            const bottom = getDouble(pdfium, scratchPtr + 24);

            annotations.push({
              id: `pdfium-link-${input.page.pageNumber}-${linkIndex}-${rectIndex}`,
              pageNumber: input.page.pageNumber,
              x: left * scale,
              y: (pageState.pageHeightPt - top) * scale,
              width: Math.max(1, (right - left) * scale),
              height: Math.max(1, (top - bottom) * scale),
              url,
            });
          }
        }
      } finally {
        pdfium.pdfium.wasmExports.free(scratchPtr);
        if (linkPagePtr) closeWebLinks?.(linkPagePtr);
        closeTextPage?.(textPagePtr);
        closePageQuietly(pageState);
      }

      return annotations;
    },

    async destroyDocument(document: PdfBackendDocumentHandle): Promise<void> {
      const state = getDocumentState(document);

      if (state.documentPtr) {
        state.pdfium.FPDF_CloseDocument(state.documentPtr);
        state.documentPtr = 0;
      }

      if (state.sourcePtr) {
        state.pdfium.pdfium.wasmExports.free(state.sourcePtr);
        state.sourcePtr = 0;
        state.sourceLength = 0;
      }
    },
  };
}
