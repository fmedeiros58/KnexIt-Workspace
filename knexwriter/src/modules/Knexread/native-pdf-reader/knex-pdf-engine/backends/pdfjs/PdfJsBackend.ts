import type {
  PdfBackendAnnotation,
  PdfBackendDocumentHandle,
  PdfBackendPageHandle,
  PdfRenderBackend,
} from "../PdfRenderBackend";
import type {
  KnexPdfCanvasRenderResult,
  KnexPdfRenderQualityInput,
  KnexPdfSemanticTextBlock,
} from "../../core/engineTypes";
import type { KnexPdfRenderPhase } from "../../rendering/RenderQualityController";
import { PdfJsAnnotationExtractor } from "./PdfJsAnnotationExtractor";
import { PdfJsPageRenderer } from "./PdfJsPageRenderer";
import { PdfJsTextExtractor } from "./PdfJsTextExtractor";

export type PdfJsDocumentLike = {
  numPages: number;
  getPage: (pageNumber: number) => Promise<unknown>;
};

export type PdfJsDocumentHandle = PdfBackendDocumentHandle & {
  pdf: PdfJsDocumentLike;
};

function safeNumber(
  value: number | null | undefined,
  fallback = 0,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function clampPageNumber(pageNumber: number, pageCount: number): number {
  const safePageCount = Math.max(1, Math.floor(safeNumber(pageCount, 1)));
  const safePageNumber = Math.floor(safeNumber(pageNumber, 1));

  return Math.max(1, Math.min(safePageCount, safePageNumber));
}

function normalizeRenderScale(scale: number): number {
  return Math.max(0.01, safeNumber(scale, 1));
}

export class PdfJsBackend implements PdfRenderBackend {
  readonly id = "pdfjs" as const;
  readonly label = "PDF.js";
  readonly priority = 10;

  constructor(
    private readonly pageRenderer = new PdfJsPageRenderer(),
    private readonly textExtractor = new PdfJsTextExtractor(),
    private readonly annotationExtractor = new PdfJsAnnotationExtractor(),
  ) {}

  getCapabilities() {
    return {
      available: true,
      renderPage: true,
      extractText: true,
      extractAnnotations: true,
      cancellation: true,
      hiDpi: true,
      tileRendering: false,
      worker: true,
      reason: "PDF.js backend available.",
    };
  }

  createDocumentHandle(input: {
    id: string;
    pdf: PdfJsDocumentLike;
  }): PdfJsDocumentHandle {
    return {
      id: input.id,
      backendId: this.id,
      pageCount: Math.max(0, Math.floor(safeNumber(input.pdf.numPages, 0))),
      backendDocument: input.pdf,
      pdf: input.pdf,
    };
  }

  async getPage(
    document: PdfBackendDocumentHandle,
    pageNumber: number,
  ): Promise<PdfBackendPageHandle> {
    const pdfDocument = document as PdfJsDocumentHandle;

    const safePageNumber = clampPageNumber(
      pageNumber,
      pdfDocument.pageCount || pdfDocument.pdf.numPages,
    );

    return {
      pageNumber: safePageNumber,
      backendId: this.id,
      document: pdfDocument,
      backendPage: await pdfDocument.pdf.getPage(safePageNumber),
    };
  }

  renderPage(input: {
    page: PdfBackendPageHandle;
    canvas: HTMLCanvasElement;
    scale: number;
    quality?: KnexPdfRenderQualityInput;
    signal?: AbortSignal;
    renderVersion?: number;
    renderPhase?: KnexPdfRenderPhase;
  }): Promise<KnexPdfCanvasRenderResult> {
    return this.pageRenderer.render({
      page: input.page,
      canvas: input.canvas,
      scale: normalizeRenderScale(input.scale),
      quality: input.quality,
      renderPhase: input.renderPhase,
      signal: input.signal,
    });
  }

  extractText(
    page: PdfBackendPageHandle,
    scale: number,
  ): Promise<KnexPdfSemanticTextBlock[]> {
    return this.textExtractor.extract(page, normalizeRenderScale(scale));
  }

  extractTextFromPage(input: {
    page: PdfBackendPageHandle;
    scale: number;
    signal?: AbortSignal;
  }): Promise<KnexPdfSemanticTextBlock[]> {
    return this.extractText(input.page, input.scale);
  }

  extractAnnotations(
    page: PdfBackendPageHandle,
    scale: number,
  ): Promise<PdfBackendAnnotation[]> {
    return this.annotationExtractor.extract(page, normalizeRenderScale(scale));
  }

  extractAnnotationsFromPage(input: {
    page: PdfBackendPageHandle;
    scale: number;
    signal?: AbortSignal;
  }): Promise<PdfBackendAnnotation[]> {
    return this.extractAnnotations(input.page, input.scale);
  }

  async destroyDocument(document: PdfBackendDocumentHandle): Promise<void> {
    const pdfDocument = document as PdfJsDocumentHandle & {
      pdf?: {
        destroy?: () => Promise<void> | void;
        cleanup?: () => Promise<void> | void;
      };
    };

    try {
      if (typeof pdfDocument.pdf?.cleanup === "function") {
        await pdfDocument.pdf.cleanup();
      }

      if (typeof pdfDocument.pdf?.destroy === "function") {
        await pdfDocument.pdf.destroy();
      }
    } catch {
      /**
       * Não derrubar o leitor por falha de limpeza do PDF.js.
       */
    }
  }
}
