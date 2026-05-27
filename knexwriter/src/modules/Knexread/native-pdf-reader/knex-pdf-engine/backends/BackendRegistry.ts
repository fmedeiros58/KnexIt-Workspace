import type { KnexPdfBackendId } from "../core/engineTypes";
import type { KnexPdfBackendSelectionMode } from "../core/engineState";
import type { PdfRenderBackend } from "./PdfRenderBackend";
import { PdfJsBackend } from "./pdfjs/PdfJsBackend";
import { PdfiumBackend } from "./future-pdfium";
import { MuPdfBackend } from "./future-mupdf";

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
  pdfiumBackend?: PdfiumBackend;
  muPdfBackend?: MuPdfBackend;
} = {}): BackendRegistry {
  const registry = new BackendRegistry();

  registry.register(options.pdfJsBackend ?? new PdfJsBackend());
  registry.register(options.pdfiumBackend ?? new PdfiumBackend(), {
    experimental: true,
  });
  registry.register(options.muPdfBackend ?? new MuPdfBackend(), {
    experimental: true,
  });

  return registry;
}
