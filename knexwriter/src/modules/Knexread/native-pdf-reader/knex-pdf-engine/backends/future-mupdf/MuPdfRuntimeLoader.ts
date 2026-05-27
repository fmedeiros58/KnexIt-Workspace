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

export const MUPDF_RUNTIME_NOT_CONFIGURED_REASON =
  "MuPDF runtime is not installed/configured.";

export const MUPDF_RUNTIME_REQUESTED_BUT_NOT_CONFIGURED =
  "MuPDF backend requested but runtime is not installed/configured.";

export type MuPdfRuntime = {
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

export type MuPdfRuntimeLoaderOptions = {
  runtime?: MuPdfRuntime;
  runtimeFactory?: () => Promise<MuPdfRuntime | null> | MuPdfRuntime | null;
  importSpecifier?: string;
  resolveRuntime?: (module: unknown) => MuPdfRuntime | null | undefined;
  globalRuntimeKeys?: string[];
  globalImportSpecifierKeys?: string[];
};

const DEFAULT_GLOBAL_RUNTIME_KEYS = [
  "KNEX_MUPDF_RUNTIME",
  "__KNEX_MUPDF_RUNTIME__",
];
const DEFAULT_GLOBAL_IMPORT_SPECIFIER_KEYS = [
  "KNEX_MUPDF_RUNTIME_MODULE",
  "__KNEX_MUPDF_RUNTIME_MODULE__",
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
  reason: MUPDF_RUNTIME_NOT_CONFIGURED_REASON,
};

function getGlobalValue(key: string): unknown {
  return (globalThis as unknown as Record<string, unknown>)[key];
}

function isMuPdfRuntime(value: unknown): value is MuPdfRuntime {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<MuPdfRuntime>;

  return (
    typeof candidate.createDocumentHandle === "function" &&
    typeof candidate.getPage === "function" &&
    typeof candidate.renderPage === "function"
  );
}

function pickRuntimeFromModule(module: unknown): MuPdfRuntime | null {
  if (isMuPdfRuntime(module)) return module;

  if (!module || typeof module !== "object") return null;

  const record = module as Record<string, unknown>;
  const candidates = [
    record.default,
    record.runtime,
    record.muPdfRuntime,
    record.mupdfRuntime,
    record.MuPdfRuntime,
  ];

  return candidates.find(isMuPdfRuntime) ?? null;
}

async function dynamicImportModule(specifier: string): Promise<unknown> {
  const importer = new Function(
    "specifier",
    "return import(specifier)",
  ) as (nextSpecifier: string) => Promise<unknown>;

  return importer(specifier);
}

export class MuPdfRuntimeLoader {
  private runtimePromise: Promise<MuPdfRuntime> | null = null;

  constructor(private readonly options: MuPdfRuntimeLoaderOptions = {}) {}

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
        reason:
          runtimeCapabilities?.reason ??
          "MuPDF runtime configured. Review AGPL/commercial licensing before enabling it by default.",
      };
    } catch (error) {
      return {
        ...baseUnavailableCapabilities,
        reason:
          error instanceof Error
            ? error.message
            : MUPDF_RUNTIME_NOT_CONFIGURED_REASON,
      };
    }
  }

  async getRuntime(): Promise<MuPdfRuntime> {
    if (!this.runtimePromise) {
      this.runtimePromise = this.loadRuntime().catch((error) => {
        this.runtimePromise = null;
        throw error;
      });
    }

    return this.runtimePromise;
  }

  private async loadRuntime(): Promise<MuPdfRuntime> {
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
      throw new Error(MUPDF_RUNTIME_REQUESTED_BUT_NOT_CONFIGURED);
    }

    const module = await dynamicImportModule(importSpecifier);
    const runtime =
      this.options.resolveRuntime?.(module) ?? pickRuntimeFromModule(module);

    if (!runtime) {
      throw new Error(
        "MuPDF runtime module was loaded, but no KnexPDF-compatible adapter was configured.",
      );
    }

    return runtime;
  }

  private getGlobalRuntime(): MuPdfRuntime | null {
    const keys = this.options.globalRuntimeKeys ?? DEFAULT_GLOBAL_RUNTIME_KEYS;

    for (const key of keys) {
      const value = getGlobalValue(key);
      if (isMuPdfRuntime(value)) return value;
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

    return undefined;
  }
}
