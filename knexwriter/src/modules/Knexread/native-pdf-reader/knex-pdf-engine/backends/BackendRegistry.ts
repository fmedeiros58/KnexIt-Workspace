import type { KnexPdfBackendId } from "../core/engineTypes";
import type { KnexPdfBackendSelectionMode } from "../core/engineState";
import type { PdfRenderBackend } from "./PdfRenderBackend";
import { PdfJsBackend } from "./pdfjs/PdfJsBackend";

// TODO: PDFium backend planned for future phases
// import { PdfiumBackend } from "./future-pdfium";

export type { KnexPdfBackendSelectionMode };

export type BackendRegistryEntry = {
  backend: PdfRenderBackend;
  experimental: boolean;
};

export class BackendRegistry {
  private readonly backends = new Map<string, BackendRegistryEntry>();

  register(
    backend: PdfRenderBackend,
    options: { experimental?: boolean } = {},
  ): this {
    this.backends.set(backend.id, {
      backend,
      experimental: options.experimental ?? false,
    });

    return this;
  }

  get(id: KnexPdfBackendId | string): PdfRenderBackend | undefined {
    return this.backends.get(id)?.backend;
  }

  getRequired(id: KnexPdfBackendId | string): PdfRenderBackend {
    const backend = this.get(id);

    if (!backend) {
      throw new Error(`KnexPDF backend is not registered: ${id}`);
    }

    return backend;
  }

  list(): BackendRegistryEntry[] {
    return [...this.backends.values()].sort(
      (a, b) => (b.backend.priority ?? 0) - (a.backend.priority ?? 0),
    );
  }

  listBackends(): PdfRenderBackend[] {
    return this.list().map((entry) => entry.backend);
  }

  has(id: KnexPdfBackendId | string): boolean {
    return this.backends.has(id);
  }
}

export function createDefaultBackendRegistry(options: {
  pdfJsBackend?: PdfJsBackend;
  // TODO: Add pdfiumBackend option when PDFium backend is implemented
} = {}): BackendRegistry {
  const registry = new BackendRegistry();

  // Register PDF.js as the default backend
  registry.register(options.pdfJsBackend ?? new PdfJsBackend());

  // TODO: Register PDFium backend here in future phases (Phase 3)

  return registry;
}
