import type {
  KnexPdfCanvasRenderResult,
  KnexPdfSemanticTextBlock,
} from "../../core/engineTypes";
import type {
  PdfBackendAnnotation,
  PdfBackendCapabilities,
  PdfBackendDocumentHandle,
  PdfBackendDocumentSource,
  PdfBackendPageHandle,
  PdfBackendRenderPageInput,
  PdfBackendRenderTileInput,
  PdfRenderBackend,
} from "../PdfRenderBackend";
import { PdfiumAnnotationExtractor } from "./PdfiumAnnotationExtractor";
import { PdfiumPageRenderer } from "./PdfiumPageRenderer";
import { PdfiumRuntimeLoader } from "./PdfiumRuntimeLoader";
import { PdfiumTextExtractor } from "./PdfiumTextExtractor";

function normalizeScale(scale: number): number {
  return Math.max(0.01, Number.isFinite(scale) ? scale : 1);
}

export class PdfiumBackend implements PdfRenderBackend {
  readonly id = "pdfium" as const;
  readonly label = "PDFium WASM";
  readonly priority = 90;

  constructor(
    private readonly runtimeLoader = new PdfiumRuntimeLoader(),
    private readonly pageRenderer = new PdfiumPageRenderer(runtimeLoader),
    private readonly textExtractor = new PdfiumTextExtractor(runtimeLoader),
    private readonly annotationExtractor = new PdfiumAnnotationExtractor(
      runtimeLoader,
    ),
  ) {}

  getCapabilities(): Promise<PdfBackendCapabilities> {
    return this.runtimeLoader.getCapabilities();
  }

  async createDocumentHandle(
    source: PdfBackendDocumentSource,
  ): Promise<PdfBackendDocumentHandle> {
    const runtime = await this.runtimeLoader.getRuntime();
    return runtime.createDocumentHandle(source);
  }

  async getPage(
    document: PdfBackendDocumentHandle,
    pageNumber: number,
  ): Promise<PdfBackendPageHandle> {
    const runtime = await this.runtimeLoader.getRuntime();
    return runtime.getPage(document, pageNumber);
  }

  renderPage(
    input: PdfBackendRenderPageInput,
  ): Promise<KnexPdfCanvasRenderResult> {
    return this.pageRenderer.render({
      ...input,
      scale: normalizeScale(input.scale),
    });
  }

  renderTile(
    input: PdfBackendRenderTileInput,
  ): Promise<KnexPdfCanvasRenderResult> {
    return this.pageRenderer.renderTile({
      ...input,
      scale: normalizeScale(input.scale),
    });
  }

  extractText(
    page: PdfBackendPageHandle,
    scale: number,
  ): Promise<KnexPdfSemanticTextBlock[]> {
    return this.extractTextFromPage({
      page,
      scale,
    });
  }

  extractTextFromPage(input: {
    page: PdfBackendPageHandle;
    scale: number;
    signal?: AbortSignal;
  }): Promise<KnexPdfSemanticTextBlock[]> {
    return this.textExtractor.extract({
      ...input,
      scale: normalizeScale(input.scale),
    });
  }

  extractAnnotations(
    page: PdfBackendPageHandle,
    scale: number,
  ): Promise<PdfBackendAnnotation[]> {
    return this.extractAnnotationsFromPage({
      page,
      scale,
    });
  }

  extractAnnotationsFromPage(input: {
    page: PdfBackendPageHandle;
    scale: number;
    signal?: AbortSignal;
  }): Promise<PdfBackendAnnotation[]> {
    return this.annotationExtractor.extract({
      ...input,
      scale: normalizeScale(input.scale),
    });
  }

  async destroyDocument(document: PdfBackendDocumentHandle): Promise<void> {
    const runtime = await this.runtimeLoader.getRuntime();
    await runtime.destroyDocument?.(document);
  }

  async destroy(): Promise<void> {
    const runtime = await this.runtimeLoader.getRuntime();
    await runtime.destroy?.();
  }
}
