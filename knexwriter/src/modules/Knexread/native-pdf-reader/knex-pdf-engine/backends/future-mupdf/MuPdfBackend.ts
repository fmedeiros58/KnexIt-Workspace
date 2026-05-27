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
import { MuPdfAnnotationExtractor } from "./MuPdfAnnotationExtractor";
import { MuPdfPageRenderer } from "./MuPdfPageRenderer";
import { MuPdfRuntimeLoader } from "./MuPdfRuntimeLoader";
import { MuPdfTextExtractor } from "./MuPdfTextExtractor";

function normalizeScale(scale: number): number {
  return Math.max(0.01, Number.isFinite(scale) ? scale : 1);
}

export class MuPdfBackend implements PdfRenderBackend {
  readonly id = "mupdf" as const;
  readonly label = "MuPDF WASM";
  readonly priority = 80;

  constructor(
    private readonly runtimeLoader = new MuPdfRuntimeLoader(),
    private readonly pageRenderer = new MuPdfPageRenderer(runtimeLoader),
    private readonly textExtractor = new MuPdfTextExtractor(runtimeLoader),
    private readonly annotationExtractor = new MuPdfAnnotationExtractor(
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
