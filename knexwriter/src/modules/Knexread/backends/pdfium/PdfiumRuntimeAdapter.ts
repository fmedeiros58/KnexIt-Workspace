import type { KnexPdfTextBlock } from "../../native-pdf-reader/knex-pdf-engine";

export const PDFIUM_RUNTIME_NOT_CONFIGURED_REASON =
  "pdfium-runtime-not-configured";

const EMBED_PDF_PDFIUM_PACKAGE = "@embedpdf/pdfium";
const DEFAULT_LOCAL_PDFIUM_WASM_URL = "/vendor/pdfium/pdfium.wasm";
const PDFIUM_FORMAT_BGRA = 4;
const FPDF_ANNOT = 0x01;
const FPDF_LCD_TEXT = 0x02;
const FPDF_PAGEOBJ_TEXT = 1;

export type PdfiumTextSuppressionStatus =
  | "not-requested"
  | "applied"
  | "unsupported"
  | "failed";

export type PdfiumRuntimeCapabilities = {
  available: boolean;
  renderPage: boolean;
  extractText: boolean;
  renderWithoutText: boolean;
  reason: string;
};

export type PdfiumDocumentHandle = {
  id: string;
  pageCount: number;
  backendDocument: PdfiumDocumentState;
};

export type PdfiumPageHandle = {
  pageNumber: number;
  backendPage: PdfiumPageState;
};

export type PdfiumRenderPageResult = {
  pageNumber: number;
  width: number;
  height: number;
  cssWidth: number;
  cssHeight: number;
  pageWidthPt: number;
  pageHeightPt: number;
  renderScale: number;
  outputScale: number;
  renderText: boolean;
  textSuppressionStatus: PdfiumTextSuppressionStatus;
  filteredTextOperationCount: number;
};

export type PdfiumRuntimeAdapter = {
  getCapabilities: () =>
    | PdfiumRuntimeCapabilities
    | Promise<PdfiumRuntimeCapabilities>;
  createDocumentHandle: (source: {
    id: string;
    fileName?: string;
    fileSize?: number;
    mimeType?: string;
    data: Uint8Array;
  }) => Promise<PdfiumDocumentHandle>;
  getPage: (
    document: PdfiumDocumentHandle,
    pageNumber: number,
  ) => Promise<PdfiumPageHandle>;
  renderPage: (input: {
    page: PdfiumPageHandle;
    canvas: HTMLCanvasElement;
    scale: number;
    outputScale: number;
    cssWidth?: number;
    cssHeight?: number;
    renderText: boolean;
    signal?: AbortSignal;
  }) => Promise<PdfiumRenderPageResult>;
  extractText: (input: {
    page: PdfiumPageHandle;
    scale: number;
    signal?: AbortSignal;
  }) => Promise<KnexPdfTextBlock[]>;
  destroyDocument?: (document: PdfiumDocumentHandle) => Promise<void> | void;
};

type PdfiumWasmExports = {
  malloc: (size: number) => number;
  free: (ptr: number) => void;
  memory?: WebAssembly.Memory;
};

type PdfiumMethodsLike = {
  HEAPU8?: Uint8Array;
  UTF16ToString?: (ptr: number, maxBytesToRead?: number) => string;
  getValue?: (ptr: number, type: string) => number;
  wasmExports: PdfiumWasmExports;
};

type EmbedPdfPdfiumModule = {
  pdfium: PdfiumMethodsLike;
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
  document: PdfiumDocumentHandle;
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
};

type TextWord = {
  text: string;
  x: number;
  y: number;
  right: number;
  bottom: number;
  fontSize: number;
  lineIndex: number;
};

function getGlobalValue(key: string): unknown {
  return (globalThis as unknown as Record<string, unknown>)[key];
}

function getGlobalString(key: string): string | undefined {
  const value = getGlobalValue(key);
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function getGlobalBoolean(key: string): boolean {
  const value = getGlobalValue(key);
  return value === true || value === "true" || value === "1";
}

function normalizeScale(scale: number): number {
  return Number.isFinite(scale) && scale > 0 ? scale : 1;
}

function canSuppressTextObjects(pdfium: EmbedPdfPdfiumModule): boolean {
  return Boolean(
    pdfium.FPDFPage_CountObjects &&
      pdfium.FPDFPage_GetObject &&
      pdfium.FPDFPageObj_GetType &&
      pdfium.FPDFPage_RemoveObject,
  );
}

function shouldDisableNonTextRendering(): boolean {
  return (
    getGlobalBoolean("KNEX_PDFIUM_FORCE_CANVAS_TEXT") ||
    getGlobalBoolean("KNEX_PDFIUM_DISABLE_NON_TEXT_RENDER")
  );
}

function suppressTextObjects(input: {
  pdfium: EmbedPdfPdfiumModule;
  pagePtr: number;
  requested: boolean;
}): {
  status: PdfiumTextSuppressionStatus;
  filteredTextOperationCount: number;
} {
  if (!input.requested) {
    return { status: "not-requested", filteredTextOperationCount: 0 };
  }

  if (shouldDisableNonTextRendering() || !canSuppressTextObjects(input.pdfium)) {
    return { status: "unsupported", filteredTextOperationCount: 0 };
  }

  try {
    const objectCount = Math.max(0, input.pdfium.FPDFPage_CountObjects!(input.pagePtr));
    let removed = 0;

    for (let index = objectCount - 1; index >= 0; index -= 1) {
      const objectPtr = input.pdfium.FPDFPage_GetObject!(input.pagePtr, index);
      if (!objectPtr) continue;

      if (input.pdfium.FPDFPageObj_GetType!(objectPtr) !== FPDF_PAGEOBJ_TEXT) {
        continue;
      }

      if (input.pdfium.FPDFPage_RemoveObject!(input.pagePtr, objectPtr)) {
        removed += 1;
      }
    }

    if (removed > 0 && input.pdfium.FPDFPage_GenerateContent) {
      try {
        input.pdfium.FPDFPage_GenerateContent(input.pagePtr);
      } catch {
        // Content regeneration is best effort for the transient page handle.
      }
    }

    return { status: "applied", filteredTextOperationCount: removed };
  } catch {
    return { status: "failed", filteredTextOperationCount: 0 };
  }
}

function getHeapU8(pdfium: EmbedPdfPdfiumModule): Uint8Array {
  if (pdfium.pdfium.HEAPU8) return pdfium.pdfium.HEAPU8;
  const memory = pdfium.pdfium.wasmExports.memory;
  if (!memory) throw new Error("pdfium-wasm-memory-unavailable");
  return new Uint8Array(memory.buffer);
}

function getDouble(pdfium: EmbedPdfPdfiumModule, ptr: number): number {
  if (pdfium.pdfium.getValue) return pdfium.pdfium.getValue(ptr, "double");
  const memory = pdfium.pdfium.wasmExports.memory;
  if (!memory) throw new Error("pdfium-wasm-memory-unavailable");
  return new DataView(memory.buffer).getFloat64(ptr, true);
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

  return `pdfium-error-${code}-${label}`;
}

function bgraToRgba(input: {
  bgra: Uint8Array;
  byteLength: number;
}): Uint8ClampedArray {
  const output = new Uint8ClampedArray(input.byteLength);

  for (let index = 0; index < input.byteLength; index += 4) {
    output[index] = input.bgra[index + 2] ?? 255;
    output[index + 1] = input.bgra[index + 1] ?? 255;
    output[index + 2] = input.bgra[index] ?? 255;
    output[index + 3] = 255;
  }

  return output;
}

function closePageQuietly(pageState: PdfiumPageState) {
  if (!pageState.pagePtr) return;

  try {
    pageState.pdfium.FPDF_ClosePage(pageState.pagePtr);
  } catch {
    // Cleanup must not hide the original render/extraction error.
  } finally {
    pageState.pagePtr = 0;
  }
}

function isEmbedPdfModule(value: unknown): value is EmbedPdfModuleNamespace {
  return Boolean(
    value &&
      typeof value === "object" &&
      typeof (value as EmbedPdfModuleNamespace).init === "function",
  );
}

function pickEmbedPdfModule(module: unknown): EmbedPdfModuleNamespace | null {
  if (isEmbedPdfModule(module)) return module;
  if (!module || typeof module !== "object") return null;
  const record = module as Record<string, unknown>;
  return isEmbedPdfModule(record.default) ? record.default : null;
}

function isRuntimeAdapter(value: unknown): value is PdfiumRuntimeAdapter {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PdfiumRuntimeAdapter>;
  return (
    typeof candidate.getCapabilities === "function" &&
    typeof candidate.createDocumentHandle === "function" &&
    typeof candidate.getPage === "function" &&
    typeof candidate.renderPage === "function" &&
    typeof candidate.extractText === "function"
  );
}

async function dynamicImportModule(specifier: string): Promise<unknown> {
  const importer = new Function(
    "specifier",
    "return import(specifier)",
  ) as (nextSpecifier: string) => Promise<unknown>;

  return importer(specifier);
}

function resolveWasmUrl(input: {
  configuredWasmUrl?: string;
  moduleDefaultWasmUrl?: string;
}): string {
  return (
    input.configuredWasmUrl ??
    getGlobalString("KNEX_PDFIUM_WASM_URL") ??
    getGlobalString("__KNEX_PDFIUM_WASM_URL__") ??
    input.moduleDefaultWasmUrl ??
    DEFAULT_LOCAL_PDFIUM_WASM_URL
  );
}

function wordToBlock(input: {
  word: TextWord;
  pageNumber: number;
  index: number;
}): KnexPdfTextBlock {
  const height = Math.max(1, input.word.bottom - input.word.y);
  const width = Math.max(1, input.word.right - input.word.x);

  return {
    id: `pdfium-text-${input.pageNumber}-${input.index}`,
    pageNumber: input.pageNumber,
    text: input.word.text,
    x: input.word.x,
    y: input.word.y,
    width,
    height,
    fontFamily: "Arial, Helvetica, sans-serif",
    fontName: "pdfium-inferred",
    fontSize: Math.max(1, input.word.fontSize),
    fontWeight: "400",
    fontStyle: "normal",
    color: "rgb(17, 24, 39)",
    align: "left",
    lineHeight: Math.max(height, input.word.fontSize),
    letterSpacing: 0,
    readingOrder: input.index,
    lineIndex: input.word.lineIndex,
    paragraphIndex: input.word.lineIndex,
    sourceBackend: "pdfium",
    visualRole: "body",
    textRenderMode: "hybrid",
    opacity: 1,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    confidence: 0.9,
    decorative: false,
    rasterized: false,
  };
}

function charsToWords(chars: TextChar[]): TextWord[] {
  const words: TextWord[] = [];
  let current: TextWord | null = null;
  let currentLine = 0;
  let previousY = Number.NaN;

  const finish = () => {
    if (current && current.text.trim()) words.push(current);
    current = null;
  };

  for (const char of chars) {
    if (!Number.isFinite(previousY) || Math.abs(char.y - previousY) > char.height * 0.75) {
      finish();
      currentLine += 1;
      previousY = char.y;
    }

    if (/\s/.test(char.text)) {
      finish();
      continue;
    }

    const charRight = char.x + char.width;
    const charBottom = char.y + char.height;

    if (
      current &&
      char.x - current.right > Math.max(4, char.fontSize * 0.45)
    ) {
      finish();
    }

    if (!current) {
      current = {
        text: char.text,
        x: char.x,
        y: char.y,
        right: charRight,
        bottom: charBottom,
        fontSize: char.fontSize,
        lineIndex: currentLine,
      };
      continue;
    }

    current.text += char.text;
    current.right = Math.max(current.right, charRight);
    current.bottom = Math.max(current.bottom, charBottom);
    current.y = Math.min(current.y, char.y);
    current.fontSize = Math.max(current.fontSize, char.fontSize);
  }

  finish();
  return words;
}

function createEmbedPdfRuntimeAdapter(
  module: unknown,
  options: { wasmUrl?: string } = {},
): PdfiumRuntimeAdapter | null {
  const embedPdfModule = pickEmbedPdfModule(module);
  if (!embedPdfModule) return null;
  if (!embedPdfModule.init) return null;
  const initPdfium = embedPdfModule.init.bind(embedPdfModule) as (
    options: { wasmBinary: ArrayBuffer },
  ) => Promise<EmbedPdfPdfiumModule>;
  const pdfiumModule = embedPdfModule;

  let pdfiumPromise: Promise<EmbedPdfPdfiumModule> | null = null;

  async function getPdfium(): Promise<EmbedPdfPdfiumModule> {
    if (!pdfiumPromise) {
      const wasmUrl = resolveWasmUrl({
        configuredWasmUrl: options.wasmUrl,
        moduleDefaultWasmUrl: pdfiumModule.DEFAULT_PDFIUM_WASM_URL,
      });

      pdfiumPromise = fetch(wasmUrl)
        .then((response) => {
          if (!response.ok) {
            throw new Error(
              `pdfium-wasm-load-failed-${response.status}-${response.statusText}`,
            );
          }
          return response.arrayBuffer();
        })
        .then((wasmBinary) => initPdfium({ wasmBinary }))
        .then((pdfium) => {
          pdfium.PDFiumExt_Init();
          return pdfium;
        })
        .catch((error) => {
          pdfiumPromise = null;
          throw error;
        });
    }

    return pdfiumPromise;
  }

  return {
    async getCapabilities(): Promise<PdfiumRuntimeCapabilities> {
      try {
        const pdfium = await getPdfium();

        return {
          available: true,
          renderPage: true,
          extractText: Boolean(
            pdfium.FPDFText_LoadPage &&
              pdfium.FPDFText_CountChars &&
              pdfium.FPDFText_GetUnicode &&
              pdfium.FPDFText_GetCharBox,
          ),
          renderWithoutText:
            !shouldDisableNonTextRendering() && canSuppressTextObjects(pdfium),
          reason: "pdfium-runtime-ready",
        };
      } catch (error) {
        return {
          available: false,
          renderPage: false,
          extractText: false,
          renderWithoutText: false,
          reason:
            error instanceof Error
              ? error.message
              : PDFIUM_RUNTIME_NOT_CONFIGURED_REASON,
        };
      }
    },

    async createDocumentHandle(source): Promise<PdfiumDocumentHandle> {
      const pdfium = await getPdfium();
      const byteLength = source.data.byteLength;
      const sourcePtr = pdfium.pdfium.wasmExports.malloc(byteLength);

      if (!sourcePtr) {
        throw new Error("pdfium-source-allocation-failed");
      }

      getHeapU8(pdfium).set(source.data, sourcePtr);

      const documentPtr = pdfium.FPDF_LoadMemDocument(sourcePtr, byteLength, "");

      if (!documentPtr) {
        pdfium.pdfium.wasmExports.free(sourcePtr);
        throw new Error(formatPdfiumError(pdfium));
      }

      return {
        id: source.id,
        pageCount: Math.max(0, pdfium.FPDF_GetPageCount(documentPtr)),
        backendDocument: {
          pdfium,
          documentPtr,
          sourcePtr,
          sourceLength: byteLength,
        },
      };
    },

    async getPage(
      document: PdfiumDocumentHandle,
      pageNumber: number,
    ): Promise<PdfiumPageHandle> {
      const state = document.backendDocument;
      const safePageNumber = Math.max(
        1,
        Math.min(document.pageCount || 1, Math.floor(pageNumber)),
      );
      const pagePtr = state.pdfium.FPDF_LoadPage(
        state.documentPtr,
        safePageNumber - 1,
      );

      if (!pagePtr) {
        throw new Error(formatPdfiumError(state.pdfium));
      }

      return {
        pageNumber: safePageNumber,
        backendPage: {
          pdfium: state.pdfium,
          document,
          pagePtr,
          pageWidthPt: state.pdfium.FPDF_GetPageWidthF(pagePtr),
          pageHeightPt: state.pdfium.FPDF_GetPageHeightF(pagePtr),
        },
      };
    },

    async renderPage(input): Promise<PdfiumRenderPageResult> {
      const pageState = input.page.backendPage;
      const renderScale = normalizeScale(input.scale);
      const outputScale = Math.max(1, input.outputScale);
      const cssWidth = Math.max(
        1,
        Math.ceil(input.cssWidth ?? pageState.pageWidthPt * renderScale),
      );
      const cssHeight = Math.max(
        1,
        Math.ceil(input.cssHeight ?? pageState.pageHeightPt * renderScale),
      );
      const width = Math.max(1, Math.ceil(cssWidth * outputScale));
      const height = Math.max(1, Math.ceil(cssHeight * outputScale));
      const byteLength = width * height * 4;
      const renderText = input.renderText;
      const textSuppression = suppressTextObjects({
        pdfium: pageState.pdfium,
        pagePtr: pageState.pagePtr,
        requested: !renderText,
      });

      if (!renderText && textSuppression.status !== "applied") {
        closePageQuietly(pageState);
        throw new Error(`pdfium-non-text-${textSuppression.status}`);
      }

      input.canvas.width = width;
      input.canvas.height = height;
      input.canvas.style.width = `${cssWidth}px`;
      input.canvas.style.height = `${cssHeight}px`;
      input.canvas.style.imageRendering = "auto";
      input.canvas.style.backgroundColor = "#ffffff";

      const bufferPtr = pageState.pdfium.pdfium.wasmExports.malloc(byteLength);
      let bitmapPtr = 0;

      if (!bufferPtr) {
        closePageQuietly(pageState);
        throw new Error("pdfium-render-buffer-allocation-failed");
      }

      try {
        if (input.signal?.aborted) throw new DOMException("Render aborted", "AbortError");

        getHeapU8(pageState.pdfium).fill(255, bufferPtr, bufferPtr + byteLength);

        bitmapPtr = pageState.pdfium.FPDFBitmap_CreateEx(
          width,
          height,
          PDFIUM_FORMAT_BGRA,
          bufferPtr,
          width * 4,
        );

        if (!bitmapPtr) {
          throw new Error("pdfium-bitmap-create-failed");
        }

        pageState.pdfium.FPDFBitmap_FillRect(
          bitmapPtr,
          0,
          0,
          width,
          height,
          0xffffffff,
        );
        pageState.pdfium.FPDF_RenderPageBitmap(
          bitmapPtr,
          pageState.pagePtr,
          0,
          0,
          width,
          height,
          0,
          FPDF_ANNOT | FPDF_LCD_TEXT,
        );

        if (input.signal?.aborted) throw new DOMException("Render aborted", "AbortError");

        const context = input.canvas.getContext("2d", { alpha: false });
        if (!context) throw new Error("canvas-2d-context-unavailable");

        const bgra = getHeapU8(pageState.pdfium).subarray(
          bufferPtr,
          bufferPtr + byteLength,
        );
        const imageData = new ImageData(
          bgraToRgba({ bgra, byteLength }),
          width,
          height,
        );

        context.save();
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        context.putImageData(imageData, 0, 0);
        context.restore();
      } finally {
        if (bitmapPtr) pageState.pdfium.FPDFBitmap_Destroy(bitmapPtr);
        pageState.pdfium.pdfium.wasmExports.free(bufferPtr);
        closePageQuietly(pageState);
      }

      return {
        pageNumber: input.page.pageNumber,
        width,
        height,
        cssWidth,
        cssHeight,
        pageWidthPt: pageState.pageWidthPt,
        pageHeightPt: pageState.pageHeightPt,
        renderScale,
        outputScale,
        renderText,
        textSuppressionStatus: textSuppression.status,
        filteredTextOperationCount: textSuppression.filteredTextOperationCount,
      };
    },

    async extractText(input): Promise<KnexPdfTextBlock[]> {
      const pageState = input.page.backendPage;
      const pdfium = pageState.pdfium;
      const scale = normalizeScale(input.scale);

      if (
        !pdfium.FPDFText_LoadPage ||
        !pdfium.FPDFText_CountChars ||
        !pdfium.FPDFText_GetUnicode ||
        !pdfium.FPDFText_GetCharBox
      ) {
        closePageQuietly(pageState);
        return [];
      }

      const textPagePtr = pdfium.FPDFText_LoadPage(pageState.pagePtr);
      if (!textPagePtr) {
        closePageQuietly(pageState);
        return [];
      }

      const scratchPtr = pdfium.pdfium.wasmExports.malloc(8 * 4);
      if (!scratchPtr) {
        pdfium.FPDFText_ClosePage?.(textPagePtr);
        closePageQuietly(pageState);
        return [];
      }

      const chars: TextChar[] = [];

      try {
        const count = Math.max(0, pdfium.FPDFText_CountChars(textPagePtr));

        for (let index = 0; index < count; index += 1) {
          if (input.signal?.aborted) break;

          const unicode = pdfium.FPDFText_GetUnicode(textPagePtr, index);
          if (!unicode) continue;

          const ok = pdfium.FPDFText_GetCharBox(
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
          const width = Math.max(0, (right - left) * scale);
          const height = Math.max(0, (top - bottom) * scale);

          if (width <= 0 || height <= 0) continue;

          chars.push({
            text: String.fromCodePoint(unicode),
            x: left * scale,
            y: (pageState.pageHeightPt - top) * scale,
            width,
            height,
            fontSize: Math.max(
              1,
              (pdfium.FPDFText_GetFontSize?.(textPagePtr, index) ?? height) *
                scale,
            ),
          });
        }
      } finally {
        pdfium.pdfium.wasmExports.free(scratchPtr);
        pdfium.FPDFText_ClosePage?.(textPagePtr);
        closePageQuietly(pageState);
      }

      return charsToWords(chars).map((word, index) =>
        wordToBlock({ word, pageNumber: input.page.pageNumber, index }),
      );
    },

    async destroyDocument(document): Promise<void> {
      const state = document.backendDocument;
      state.pdfium.FPDF_CloseDocument(state.documentPtr);
      state.pdfium.pdfium.wasmExports.free(state.sourcePtr);
      state.documentPtr = 0;
      state.sourcePtr = 0;
      state.sourceLength = 0;
    },
  };
}

export class PdfiumRuntimeAdapterLoader {
  private runtimePromise: Promise<PdfiumRuntimeAdapter> | null = null;

  async getRuntimeAdapter(): Promise<PdfiumRuntimeAdapter> {
    if (!this.runtimePromise) {
      this.runtimePromise = this.loadRuntimeAdapter().catch((error) => {
        this.runtimePromise = null;
        throw error;
      });
    }

    return this.runtimePromise;
  }

  async getCapabilities(): Promise<PdfiumRuntimeCapabilities> {
    try {
      const runtime = await this.getRuntimeAdapter();
      return runtime.getCapabilities();
    } catch (error) {
      return {
        available: false,
        renderPage: false,
        extractText: false,
        renderWithoutText: false,
        reason:
          error instanceof Error
            ? error.message
            : PDFIUM_RUNTIME_NOT_CONFIGURED_REASON,
      };
    }
  }

  private async loadRuntimeAdapter(): Promise<PdfiumRuntimeAdapter> {
    const globalRuntime =
      getGlobalValue("KNEX_PDFIUM_RUNTIME") ??
      getGlobalValue("__KNEX_PDFIUM_RUNTIME__");

    if (isRuntimeAdapter(globalRuntime)) return globalRuntime;

    const importSpecifier =
      getGlobalString("KNEX_PDFIUM_RUNTIME_MODULE") ??
      getGlobalString("__KNEX_PDFIUM_RUNTIME_MODULE__") ??
      EMBED_PDF_PDFIUM_PACKAGE;
    const module = await dynamicImportModule(importSpecifier);

    const adapter = isRuntimeAdapter(module)
      ? module
      : createEmbedPdfRuntimeAdapter(module, {
          wasmUrl:
            getGlobalString("KNEX_PDFIUM_WASM_URL") ??
            getGlobalString("__KNEX_PDFIUM_WASM_URL__"),
        });

    if (!adapter) {
      throw new Error("pdfium-runtime-adapter-unavailable");
    }

    return adapter;
  }
}

let defaultLoader: PdfiumRuntimeAdapterLoader | null = null;

export function getDefaultPdfiumRuntimeAdapterLoader(): PdfiumRuntimeAdapterLoader {
  if (!defaultLoader) {
    defaultLoader = new PdfiumRuntimeAdapterLoader();
  }

  return defaultLoader;
}

export function resetDefaultPdfiumRuntimeAdapterLoader(): void {
  defaultLoader = null;
}
