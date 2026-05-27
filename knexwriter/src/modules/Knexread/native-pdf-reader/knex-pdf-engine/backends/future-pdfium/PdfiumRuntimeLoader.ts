import type {
  KnexPdfCanvasRenderResult,
  KnexPdfSemanticTextBlock,
} from "../../core/engineTypes";
import type {
  PdfBackendAnnotation,
  PdfBackendCapabilities,
  PdfBackendDocumentHandle,
  PdfBackendDocumentSource,
  PdfBackendExtractAnnotationsInput,
  PdfBackendExtractTextInput,
  PdfBackendPageHandle,
  PdfBackendRenderPageInput,
  PdfBackendRenderTileInput,
} from "../PdfRenderBackend";
import {
  createEmbedPdfPdfiumRuntime,
  EMBED_PDF_PDFIUM_PACKAGE,
} from "./PdfiumEmbedPdfRuntime";

export const PDFIUM_RUNTIME_NOT_CONFIGURED_REASON =
  "PDFium runtime is not installed/configured.";

export const PDFIUM_RUNTIME_REQUESTED_BUT_NOT_CONFIGURED =
  "PDFium backend requested but runtime is not installed/configured.";

export type PdfiumRuntime = {
  getCapabilities?: () =>
    | Partial<PdfBackendCapabilities>
    | Promise<Partial<PdfBackendCapabilities>>;
  createDocumentHandle: (
    source: PdfBackendDocumentSource,
  ) => Promise<PdfBackendDocumentHandle> | PdfBackendDocumentHandle;
  getPage: (
    document: PdfBackendDocumentHandle,
    pageNumber: number,
  ) => Promise<PdfBackendPageHandle> | PdfBackendPageHandle;
  renderPage: (
    input: PdfBackendRenderPageInput,
  ) => Promise<KnexPdfCanvasRenderResult>;
  renderTile?: (
    input: PdfBackendRenderTileInput,
  ) => Promise<KnexPdfCanvasRenderResult>;
  extractText?: (
    input: PdfBackendExtractTextInput,
  ) => Promise<KnexPdfSemanticTextBlock[]>;
  extractAnnotations?: (
    input: PdfBackendExtractAnnotationsInput,
  ) => Promise<PdfBackendAnnotation[]>;
  destroyDocument?: (
    document: PdfBackendDocumentHandle,
  ) => Promise<void> | void;
  destroy?: () => Promise<void> | void;
};

export type PdfiumRuntimeLoaderOptions = {
  runtime?: PdfiumRuntime;
  runtimeFactory?: () => Promise<PdfiumRuntime | null> | PdfiumRuntime | null;
  importSpecifier?: string;
  wasmUrl?: string;
  resolveRuntime?: (module: unknown) => PdfiumRuntime | null | undefined;
  globalRuntimeKeys?: string[];
  globalImportSpecifierKeys?: string[];
  globalWasmUrlKeys?: string[];
};

const DEFAULT_GLOBAL_RUNTIME_KEYS = [
  "KNEX_PDFIUM_RUNTIME",
  "__KNEX_PDFIUM_RUNTIME__",
];
const DEFAULT_GLOBAL_IMPORT_SPECIFIER_KEYS = [
  "KNEX_PDFIUM_RUNTIME_MODULE",
  "__KNEX_PDFIUM_RUNTIME_MODULE__",
];
const DEFAULT_GLOBAL_WASM_URL_KEYS = [
  "KNEX_PDFIUM_WASM_URL",
  "__KNEX_PDFIUM_WASM_URL__",
];

const baseUnavailableCapabilities: PdfBackendCapabilities = {
  available: false,
  renderPage: false,
  extractText: false,
  extractAnnotations: false,
  cancellation: false,
  hiDpi: false,
  tileRendering: false,
  worker: false,
  reason: PDFIUM_RUNTIME_NOT_CONFIGURED_REASON,
};

function getGlobalValue(key: string): unknown {
  return (globalThis as unknown as Record<string, unknown>)[key];
}

function isPdfiumRuntime(value: unknown): value is PdfiumRuntime {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<PdfiumRuntime>;

  return (
    typeof candidate.createDocumentHandle === "function" &&
    typeof candidate.getPage === "function" &&
    typeof candidate.renderPage === "function"
  );
}

function pickRuntimeFromModule(module: unknown): PdfiumRuntime | null {
  if (isPdfiumRuntime(module)) return module;

  if (!module || typeof module !== "object") return null;

  const record = module as Record<string, unknown>;
  const candidates = [
    record.default,
    record.runtime,
    record.pdfiumRuntime,
    record.PdfiumRuntime,
  ];

  return candidates.find(isPdfiumRuntime) ?? null;
}

async function dynamicImportModule(specifier: string): Promise<unknown> {
  if (specifier === EMBED_PDF_PDFIUM_PACKAGE) {
    return import("@embedpdf/pdfium");
  }

  const importer = new Function(
    "specifier",
    "return import(specifier)",
  ) as (nextSpecifier: string) => Promise<unknown>;

  return importer(specifier);
}

export class PdfiumRuntimeLoader {
  private runtimePromise: Promise<PdfiumRuntime> | null = null;

  constructor(private readonly options: PdfiumRuntimeLoaderOptions = {}) {}

  isRuntimeConfigured(): boolean {
    return Boolean(
      this.options.runtime ||
        this.options.runtimeFactory ||
        this.getGlobalRuntime() ||
        this.getImportSpecifier(),
    );
  }

  async getCapabilities(): Promise<PdfBackendCapabilities> {
    if (!this.isRuntimeConfigured()) {
      return baseUnavailableCapabilities;
    }

    try {
      const runtime = await this.getRuntime();
      const runtimeCapabilities = await runtime.getCapabilities?.();

      return {
        available: runtimeCapabilities?.available ?? true,
        renderPage: runtimeCapabilities?.renderPage ?? true,
        extractText:
          runtimeCapabilities?.extractText ??
          typeof runtime.extractText === "function",
        extractAnnotations:
          runtimeCapabilities?.extractAnnotations ??
          typeof runtime.extractAnnotations === "function",
        cancellation: runtimeCapabilities?.cancellation ?? true,
        hiDpi: runtimeCapabilities?.hiDpi ?? true,
        tileRendering:
          runtimeCapabilities?.tileRendering ??
          typeof runtime.renderTile === "function",
        worker: runtimeCapabilities?.worker ?? true,
        reason: runtimeCapabilities?.reason ?? "PDFium runtime configured.",
      };
    } catch (error) {
      return {
        ...baseUnavailableCapabilities,
        reason:
          error instanceof Error
            ? error.message
            : PDFIUM_RUNTIME_NOT_CONFIGURED_REASON,
      };
    }
  }

  async getRuntime(): Promise<PdfiumRuntime> {
    if (!this.runtimePromise) {
      this.runtimePromise = this.loadRuntime().catch((error) => {
        this.runtimePromise = null;
        throw error;
      });
    }

    return this.runtimePromise;
  }

  private async loadRuntime(): Promise<PdfiumRuntime> {
    if (this.options.runtime) {
      return this.options.runtime;
    }

    const runtimeFromFactory = await this.options.runtimeFactory?.();
    if (runtimeFromFactory) {
      return runtimeFromFactory;
    }

    const globalRuntime = this.getGlobalRuntime();
    if (globalRuntime) {
      return globalRuntime;
    }

    const importSpecifier = this.getImportSpecifier();

    if (!importSpecifier) {
      throw new Error(PDFIUM_RUNTIME_REQUESTED_BUT_NOT_CONFIGURED);
    }

    const module = await dynamicImportModule(importSpecifier);
    const runtime =
      this.options.resolveRuntime?.(module) ??
      pickRuntimeFromModule(module) ??
      createEmbedPdfPdfiumRuntime(module, {
        wasmUrl: this.getConfiguredWasmUrl(),
      });

    if (!runtime) {
      throw new Error(
        "PDFium runtime module was loaded, but no KnexPDF-compatible adapter was configured.",
      );
    }

    return runtime;
  }

  private getGlobalRuntime(): PdfiumRuntime | null {
    const keys = this.options.globalRuntimeKeys ?? DEFAULT_GLOBAL_RUNTIME_KEYS;

    for (const key of keys) {
      const value = getGlobalValue(key);
      if (isPdfiumRuntime(value)) return value;
    }

    return null;
  }

  private getImportSpecifier(): string | undefined {
    if (this.options.importSpecifier) {
      return this.options.importSpecifier;
    }

    const keys =
      this.options.globalImportSpecifierKeys ??
      DEFAULT_GLOBAL_IMPORT_SPECIFIER_KEYS;

    for (const key of keys) {
      const value = getGlobalValue(key);

      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }

    return EMBED_PDF_PDFIUM_PACKAGE;
  }

  private getConfiguredWasmUrl(): string | undefined {
    if (this.options.wasmUrl?.trim()) {
      return this.options.wasmUrl.trim();
    }

    const keys = this.options.globalWasmUrlKeys ?? DEFAULT_GLOBAL_WASM_URL_KEYS;

    for (const key of keys) {
      const value = getGlobalValue(key);

      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }

    return undefined;
  }
}
