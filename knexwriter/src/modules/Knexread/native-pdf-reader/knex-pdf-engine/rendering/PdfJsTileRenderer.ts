import type { KnexPdfPageGeometry } from "../core/engineTypes";
import type { PdfJsPageLike } from "./HiDpiCanvasRenderer";
import type { KnexPdfRenderPhase } from "./RenderQualityController";
import type { KnexPdfPageTile } from "./TileGridCalculator";

export type KnexPdfTileSessionLike = {
  pdf: {
    getPage: (pageNumber: number) => Promise<unknown>;
  };
};

export type RenderKnexPdfTileToCanvasInput = {
  documentId: string;
  session: KnexPdfTileSessionLike;
  pageNumber: number;
  canvas: HTMLCanvasElement;
  geometry: KnexPdfPageGeometry;
  tile: KnexPdfPageTile;
  renderPhase: KnexPdfRenderPhase;
  signal?: AbortSignal;
};

export type KnexPdfRenderedTile = {
  documentId: string;
  pageNumber: number;
  tileId: string;
  backend: "pdfjs";
  renderPhase: KnexPdfRenderPhase;
  zoom: number;
  outputScale: number;
  outputScaleX: number;
  outputScaleY: number;
  cssLeft: number;
  cssTop: number;
  cssWidth: number;
  cssHeight: number;
  bitmapWidth: number;
  bitmapHeight: number;
  renderedAt: number;
  renderDurationMs: number;
};

function nowMs(): number {
  return typeof performance !== "undefined" &&
    typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function createAbortError(): DOMException {
  return new DOMException("Tile render aborted.", "AbortError");
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

function isTileDebugEnabled(): boolean {
  const value = (globalThis as unknown as Record<string, unknown>)
    .KNEX_PDF_TILE_DEBUG;

  return value === true || value === "true" || value === "1";
}

function configureTileCanvas(input: RenderKnexPdfTileToCanvasInput) {
  const { canvas, geometry, tile } = input;

  canvas.width = Math.max(1, tile.bitmapWidth);
  canvas.height = Math.max(1, tile.bitmapHeight);
  canvas.style.width = `${tile.cssWidth}px`;
  canvas.style.height = `${tile.cssHeight}px`;
  canvas.style.imageRendering = "auto";

  canvas.dataset.knexPdfTile = "true";
  canvas.dataset.knexPdfPageNumber = String(tile.pageNumber);
  canvas.dataset.knexPdfTileId = tile.id;
  canvas.dataset.knexPdfTileRow = String(tile.row);
  canvas.dataset.knexPdfTileColumn = String(tile.column);
  canvas.dataset.knexPdfBackend = "pdfjs";
  canvas.dataset.knexPdfRenderPhase = input.renderPhase;
  canvas.dataset.knexPdfOutputScale = String(geometry.outputScale);
  canvas.dataset.knexPdfOutputScaleX = String(tile.outputScaleX);
  canvas.dataset.knexPdfOutputScaleY = String(tile.outputScaleY);
  canvas.dataset.knexPdfTileCssLeft = String(tile.cssX);
  canvas.dataset.knexPdfTileCssTop = String(tile.cssY);
  canvas.dataset.knexPdfTileCssWidth = String(tile.cssWidth);
  canvas.dataset.knexPdfTileCssHeight = String(tile.cssHeight);
  canvas.dataset.knexPdfTileBitmapWidth = String(canvas.width);
  canvas.dataset.knexPdfTileBitmapHeight = String(canvas.height);
}

export async function renderKnexPdfTileToCanvas(
  input: RenderKnexPdfTileToCanvasInput,
): Promise<KnexPdfRenderedTile> {
  if (input.signal?.aborted) {
    throw createAbortError();
  }

  const startedAt = nowMs();
  configureTileCanvas(input);

  const context = input.canvas.getContext("2d", {
    alpha: false,
    desynchronized: false,
  });

  if (!context) {
    throw new Error("Could not initialize KnexPDF tile canvas.");
  }

  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, input.canvas.width, input.canvas.height);
  context.restore();

  const page = (await input.session.pdf.getPage(
    input.pageNumber,
  )) as PdfJsPageLike;

  if (input.signal?.aborted) {
    throw createAbortError();
  }

  const viewport = page.getViewport({ scale: input.geometry.zoom });
  const renderTask = page.render({
    canvasContext: context,
    canvas: input.canvas,
    viewport,
    transform: [
      input.tile.outputScaleX,
      0,
      0,
      input.tile.outputScaleY,
      -input.tile.cssX * input.tile.outputScaleX,
      -input.tile.cssY * input.tile.outputScaleY,
    ],
    intent: "display",
  });

  const cancelRenderTask = () => {
    try {
      renderTask.cancel?.();
    } catch {
      // PDF.js cancellation is best-effort.
    }
  };

  input.signal?.addEventListener("abort", cancelRenderTask, { once: true });

  try {
    await renderTask.promise;

    if (input.signal?.aborted) {
      throw createAbortError();
    }
  } catch (error) {
    if (input.signal?.aborted || isAbortError(error)) {
      throw createAbortError();
    }

    throw error;
  } finally {
    input.signal?.removeEventListener("abort", cancelRenderTask);
  }

  const renderedTile: KnexPdfRenderedTile = {
    documentId: input.documentId,
    pageNumber: input.pageNumber,
    tileId: input.tile.id,
    backend: "pdfjs",
    renderPhase: input.renderPhase,
    zoom: input.geometry.zoom,
    outputScale: input.geometry.outputScale,
    outputScaleX: input.tile.outputScaleX,
    outputScaleY: input.tile.outputScaleY,
    cssLeft: input.tile.cssX,
    cssTop: input.tile.cssY,
    cssWidth: input.tile.cssWidth,
    cssHeight: input.tile.cssHeight,
    bitmapWidth: input.canvas.width,
    bitmapHeight: input.canvas.height,
    renderedAt: Date.now(),
    renderDurationMs: nowMs() - startedAt,
  };

  if (isTileDebugEnabled()) {
    // eslint-disable-next-line no-console
    console.debug("[KnexPDF][TileRender]", renderedTile);
  }

  return renderedTile;
}
