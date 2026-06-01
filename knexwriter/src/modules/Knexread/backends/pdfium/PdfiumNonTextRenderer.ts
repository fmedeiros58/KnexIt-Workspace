import type { NativePdfSession } from "../../native-pdf-reader/services";
import type { KnexPdfTextBlock } from "../../native-pdf-reader/knex-pdf-engine";
import {
  getDefaultPdfiumRuntimeAdapterLoader,
  type PdfiumDocumentHandle,
  type PdfiumRenderPageResult,
  type PdfiumRuntimeCapabilities,
} from "./PdfiumRuntimeAdapter";

export type PdfiumCanvasRenderInput = {
  session: NativePdfSession;
  pageNumber: number;
  canvas: HTMLCanvasElement;
  scale: number;
  outputScale: number;
  cssWidth: number;
  cssHeight: number;
  renderText: boolean;
  signal?: AbortSignal;
};

const persistentDocumentCache = new WeakMap<
  NativePdfSession,
  Promise<PdfiumDocumentHandle>
>();

let capabilitiesPromise: Promise<PdfiumRuntimeCapabilities> | null = null;

function getDocumentId(session: NativePdfSession): string {
  return session.id ?? session.fingerprint ?? session.fileName;
}

async function readPdfBytes(session: NativePdfSession): Promise<Uint8Array> {
  return new Uint8Array(await session.file.arrayBuffer());
}

async function createDocumentHandle(
  session: NativePdfSession,
): Promise<PdfiumDocumentHandle> {
  const loader = getDefaultPdfiumRuntimeAdapterLoader();
  const runtime = await loader.getRuntimeAdapter();

  return runtime.createDocumentHandle({
    id: getDocumentId(session),
    fileName: session.fileName,
    fileSize: session.fileSize,
    mimeType: session.mimeType,
    data: await readPdfBytes(session),
  });
}

async function getPersistentDocumentHandle(
  session: NativePdfSession,
): Promise<PdfiumDocumentHandle> {
  let promise = persistentDocumentCache.get(session);

  if (!promise) {
    promise = createDocumentHandle(session).catch((error) => {
      persistentDocumentCache.delete(session);
      throw error;
    });
    persistentDocumentCache.set(session, promise);
  }

  return promise;
}

async function withPdfiumDocument<T>(
  input: {
    session: NativePdfSession;
    isolated: boolean;
  },
  callback: (document: PdfiumDocumentHandle) => Promise<T>,
): Promise<T> {
  if (!input.isolated) {
    return callback(await getPersistentDocumentHandle(input.session));
  }

  const loader = getDefaultPdfiumRuntimeAdapterLoader();
  const runtime = await loader.getRuntimeAdapter();
  const document = await createDocumentHandle(input.session);

  try {
    return await callback(document);
  } finally {
    await runtime.destroyDocument?.(document);
  }
}

export async function getPdfiumNonTextRendererCapabilities(): Promise<PdfiumRuntimeCapabilities> {
  if (!capabilitiesPromise) {
    capabilitiesPromise =
      getDefaultPdfiumRuntimeAdapterLoader().getCapabilities();
  }

  return capabilitiesPromise;
}

export function resetPdfiumNonTextRendererRuntime(): void {
  capabilitiesPromise = null;
}

export async function renderPdfiumPageToCanvas(
  input: PdfiumCanvasRenderInput,
): Promise<PdfiumRenderPageResult> {
  const capabilities = await getPdfiumNonTextRendererCapabilities();

  if (!capabilities.available || !capabilities.renderPage) {
    throw new Error(capabilities.reason || "pdfium-renderer-unavailable");
  }

  if (!input.renderText && !capabilities.renderWithoutText) {
    throw new Error("pdfium-render-without-text-unavailable");
  }

  const runtime = await getDefaultPdfiumRuntimeAdapterLoader().getRuntimeAdapter();

  return withPdfiumDocument(
    {
      session: input.session,
      isolated: !input.renderText,
    },
    async (document) => {
      const page = await runtime.getPage(document, input.pageNumber);

      return runtime.renderPage({
        page,
        canvas: input.canvas,
        scale: input.scale,
        outputScale: input.outputScale,
        cssWidth: input.cssWidth,
        cssHeight: input.cssHeight,
        renderText: input.renderText,
        signal: input.signal,
      });
    },
  );
}

export async function extractPdfiumPageText(input: {
  session: NativePdfSession;
  pageNumber: number;
  scale: number;
  signal?: AbortSignal;
}): Promise<KnexPdfTextBlock[]> {
  const capabilities = await getPdfiumNonTextRendererCapabilities();

  if (!capabilities.available || !capabilities.extractText) {
    return [];
  }

  const runtime = await getDefaultPdfiumRuntimeAdapterLoader().getRuntimeAdapter();
  const document = await getPersistentDocumentHandle(input.session);
  const page = await runtime.getPage(document, input.pageNumber);

  return runtime.extractText({
    page,
    scale: input.scale,
    signal: input.signal,
  });
}
