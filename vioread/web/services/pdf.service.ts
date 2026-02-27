import { PDF_RENDER_SCALE } from "../lib/constants";
import { hashArrayBuffer, shortHash } from "../lib/hash";
import { toHexColor } from "../lib/utils";
import type { DocumentDescriptor, DocumentPage, PageMapping } from "../lib/types";
import { buildLayoutBlocksFromPdfText } from "./layout-map.service";

type PdfLoadingTask = {
  promise: Promise<any>;
};

type PdfModule = {
  getDocument: (source: unknown) => PdfLoadingTask;
  GlobalWorkerOptions?: Record<string, unknown> | ((...args: unknown[]) => unknown);
  version?: string;
  Util: {
    transform: (a: number[], b: number[]) => number[];
  };
};

type PdfDocumentProxy = Awaited<PdfLoadingTask["promise"]>;

type PdfSession = {
  id: string;
  hash: string;
  descriptor: DocumentDescriptor;
  pdf: PdfDocumentProxy;
};

let pdfModulePromise: Promise<PdfModule> | null = null;
let renderQueue: Promise<void> = Promise.resolve();
const PDFJS_VERSION = "5.4.624";

type PdfModuleCandidate = {
  label: string;
  workerSrc: string;
  load: () => Promise<unknown>;
};

const PDF_MODULE_CANDIDATES: PdfModuleCandidate[] = [
  {
    label: "cdn.jsdelivr/build",
    workerSrc: `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`,
    load: () => import(/* webpackIgnore: true */ `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`),
  },
  {
    label: "unpkg/build",
    workerSrc: `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`,
    load: () => import(/* webpackIgnore: true */ `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.min.mjs`),
  },
  {
    label: "local/legacy",
    workerSrc: `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`,
    load: () => import("pdfjs-dist/legacy/build/pdf.mjs"),
  },
  {
    label: "local/build",
    workerSrc: `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`,
    load: () => import("pdfjs-dist/build/pdf.mjs"),
  },
  {
    label: "local/webpack",
    workerSrc: `https://unpkg.com/pdfjs-dist@${PDFJS_VERSION}/build/pdf.worker.min.mjs`,
    load: () => import("pdfjs-dist/webpack.mjs"),
  },
];

function resolvePdfModule(raw: unknown): PdfModule {
  const moduleCandidate = raw as { default?: unknown };
  const resolved = (moduleCandidate?.default ?? raw) as PdfModule;
  if (!resolved || typeof resolved !== "object" || typeof resolved.getDocument !== "function") {
    throw new Error("PDF.js carregado em formato inválido.");
  }
  return resolved;
}

function configureWorker(pdfjs: PdfModule, workerSrc: string) {
  const globalWorker = pdfjs.GlobalWorkerOptions as any;
  if (!globalWorker) return;

  try {
    if (!globalWorker.workerSrc) {
      globalWorker.workerSrc = workerSrc || `https://unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;
    }
  } catch {
    // fallback para execução sem worker será aplicado no carregamento do PDF
  }
}

async function initPdfModule(): Promise<PdfModule> {
  const errors: string[] = [];

  for (const candidate of PDF_MODULE_CANDIDATES) {
    try {
      const mod = await candidate.load();
      const resolved = resolvePdfModule(mod);
      configureWorker(resolved, candidate.workerSrc);
      return resolved;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${candidate.label}: ${message}`);
    }
  }

  throw new Error(`Falha ao inicializar PDF.js. Tentativas: ${errors.join(" | ")}`);
}

async function getPdfModule(): Promise<PdfModule> {
  if (!pdfModulePromise) {
    pdfModulePromise = initPdfModule().catch((error) => {
      pdfModulePromise = null;
      throw error;
    });
  }
  return pdfModulePromise;
}

export async function loadPdfSession(file: File): Promise<PdfSession> {
  const [pdfjs, buffer] = await Promise.all([getPdfModule(), file.arrayBuffer()]);
  const hash = await hashArrayBuffer(buffer);
  let pdf: PdfDocumentProxy;

  try {
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
    pdf = await loadingTask.promise;
  } catch (error) {
    try {
      const loadingTask = pdfjs.getDocument({
        data: new Uint8Array(buffer),
        disableWorker: true,
      });
      pdf = await loadingTask.promise;
    } catch (fallbackError) {
      const primaryMessage = error instanceof Error ? error.message : "erro desconhecido";
      const fallbackMessage = fallbackError instanceof Error ? fallbackError.message : "erro desconhecido";
      throw new Error(`Falha ao abrir PDF (inicialização PDF.js). ${primaryMessage}. Fallback: ${fallbackMessage}`);
    }
  }

  const descriptor: DocumentDescriptor = {
    id: shortHash(hash),
    hash,
    kind: "pdf",
    name: file.name,
    pageCount: pdf.numPages,
  };

  return {
    id: descriptor.id,
    hash,
    descriptor,
    pdf,
  };
}

export async function renderPdfPageToCanvas(args: {
  session: PdfSession;
  pageNumber: number;
  canvas: HTMLCanvasElement;
  scale?: number;
}): Promise<DocumentPage> {
  const renderTask = async () => {
    const page = await args.session.pdf.getPage(args.pageNumber);
    const viewport = page.getViewport({ scale: args.scale ?? PDF_RENDER_SCALE });

    args.canvas.width = Math.ceil(viewport.width);
    args.canvas.height = Math.ceil(viewport.height);

    const context = args.canvas.getContext("2d", { alpha: false });
    if (!context) {
      throw new Error("Não foi possível inicializar o canvas do PDF.");
    }

    await page
      .render({
        canvasContext: context,
        canvas: args.canvas as any,
        viewport,
        intent: "display",
      })
      .promise;

    const sample = context.getImageData(2, 2, 1, 1).data;
    const backgroundColor = toHexColor([sample[0] ?? 255, sample[1] ?? 255, sample[2] ?? 255]);

    return {
      number: args.pageNumber,
      width: viewport.width,
      height: viewport.height,
      backgroundColor,
    };
  };

  const queued = renderQueue.then(renderTask);
  renderQueue = queued.then(() => undefined).catch(() => undefined);
  return queued;
}

export async function extractPdfPageMapping(args: {
  session: PdfSession;
  pageNumber: number;
  scale?: number;
}): Promise<PageMapping> {
  const page = await args.session.pdf.getPage(args.pageNumber);
  const viewport = page.getViewport({ scale: args.scale ?? PDF_RENDER_SCALE });
  const textContent = await page.getTextContent();
  const pdfjs = await getPdfModule();

  const rawItems = (textContent.items ?? []).filter((item: any): item is any => typeof (item as any)?.str === "string");

  const blocks = buildLayoutBlocksFromPdfText({
    pageNumber: args.pageNumber,
    viewportWidth: viewport.width,
    viewportHeight: viewport.height,
    viewportScale: viewport.scale,
    viewportTransform: viewport.transform,
    items: rawItems,
    styles: (textContent.styles ?? {}) as Record<string, { fontFamily?: string }>,
    utilTransform: pdfjs.Util.transform,
  });

  return {
    page: {
      number: args.pageNumber,
      width: viewport.width,
      height: viewport.height,
      backgroundColor: "#ffffff",
    },
    blocks,
  };
}

export function detectTextLayerAvailability(mapping: PageMapping) {
  return mapping.blocks.length > 0;
}

export type { PdfSession };


