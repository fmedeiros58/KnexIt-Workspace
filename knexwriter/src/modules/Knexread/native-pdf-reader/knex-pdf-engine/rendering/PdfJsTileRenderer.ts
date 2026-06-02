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
  /**
   * Experimental:
   * renderText=false tenta remover operadores de texto do canvas.
   * Isso só deve ser usado junto com camada textual HTML/CSS visual,
   * para evitar duplicação.
   */
  renderText?: boolean;
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

function positiveNumber(value: number | null | undefined, fallback = 1): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0
    ? value
    : fallback;
}

function roundScale(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function resolveSafeTileBitmapGeometry(input: {
  renderCssWidth: number;
  renderCssHeight: number;
  requestedOutputScaleX: number;
  requestedOutputScaleY: number;
}): {
  bitmapWidth: number;
  bitmapHeight: number;
  actualOutputScaleX: number;
  actualOutputScaleY: number;
  memoryScale: number;
  memoryCapped: boolean;
  requestedBitmapWidth: number;
  requestedBitmapHeight: number;
} {
  const renderCssWidth = positiveNumber(input.renderCssWidth, 1);
  const renderCssHeight = positiveNumber(input.renderCssHeight, 1);
  const requestedOutputScaleX = positiveNumber(input.requestedOutputScaleX, 1);
  const requestedOutputScaleY = positiveNumber(input.requestedOutputScaleY, 1);

  const requestedBitmapWidth = Math.max(
    1,
    Math.round(renderCssWidth * requestedOutputScaleX),
  );
  const requestedBitmapHeight = Math.max(
    1,
    Math.round(renderCssHeight * requestedOutputScaleY),
  );

  const maxByArea = Math.sqrt(
    PDFJS_TILE_MAX_BITMAP_PIXELS /
      Math.max(1, requestedBitmapWidth * requestedBitmapHeight),
  );
  const maxBySide = Math.min(
    PDFJS_TILE_MAX_BITMAP_SIDE / requestedBitmapWidth,
    PDFJS_TILE_MAX_BITMAP_SIDE / requestedBitmapHeight,
  );
  const memoryScale = Math.min(1, maxByArea, maxBySide);

  const actualOutputScaleX = Math.max(
    PDFJS_TILE_MIN_OUTPUT_SCALE,
    requestedOutputScaleX * memoryScale,
  );
  const actualOutputScaleY = Math.max(
    PDFJS_TILE_MIN_OUTPUT_SCALE,
    requestedOutputScaleY * memoryScale,
  );

  const bitmapWidth = Math.max(
    1,
    Math.round(renderCssWidth * actualOutputScaleX),
  );
  const bitmapHeight = Math.max(
    1,
    Math.round(renderCssHeight * actualOutputScaleY),
  );

  return {
    bitmapWidth,
    bitmapHeight,
    actualOutputScaleX: roundScale(bitmapWidth / renderCssWidth),
    actualOutputScaleY: roundScale(bitmapHeight / renderCssHeight),
    memoryScale: roundScale(memoryScale),
    memoryCapped: memoryScale < 0.999,
    requestedBitmapWidth,
    requestedBitmapHeight,
  };
}

function releaseCanvasBitmap(canvas: HTMLCanvasElement) {
  try {
    const context = canvas.getContext("2d");
    context?.clearRect(0, 0, canvas.width, canvas.height);
  } catch {
    // Best-effort cleanup.
  }

  canvas.width = 1;
  canvas.height = 1;
}

type PdfJsOperatorListLike = {
  fnArray?: readonly number[];
};

type PdfJsRenderablePageLike = PdfJsPageLike & {
  getOperatorList?: () => Promise<PdfJsOperatorListLike>;
  render: (params: {
    canvas?: HTMLCanvasElement;
    canvasContext: CanvasRenderingContext2D;
    viewport: ReturnType<PdfJsPageLike["getViewport"]>;
    transform: [number, number, number, number, number, number];
    intent: "display";
    operationsFilter?: (operationIndexOrFnId: number) => boolean;
  }) => {
    promise: Promise<void>;
    cancel?: () => void;
  };
};

const PDFJS_TEXT_OPERATOR_NAMES = [
  "beginText",
  "endText",
  "setCharSpacing",
  "setWordSpacing",
  "setHScale",
  "setLeading",
  "setFont",
  "setTextRenderingMode",
  "setTextRise",
  "moveText",
  "setLeadingMoveText",
  "setTextMatrix",
  "nextLine",
  "showText",
  "showSpacedText",
  "nextLineShowText",
  "paintChar",
  "paintCharPath",
];

/**
 * Limites defensivos do renderer real de tiles.
 *
 * Os limites do ZoomController, PdfTiledPageCanvas, PdfTileLayer e PdfTileCanvas
 * reduzem a pressão, mas este arquivo é a última barreira antes do PDF.js
 * criar o bitmap do workerCanvas.
 *
 * Em zoom alto, se renderCssWidth/renderCssHeight * outputScale gerar um bitmap
 * grande demais, reduzimos a escala efetiva do tile. Isso preserva o leitor
 * funcionando e evita tela preta/estouro de memória.
 */
const PDFJS_TILE_MAX_BITMAP_PIXELS = 5_000_000;
const PDFJS_TILE_MAX_BITMAP_SIDE = 7_680;
const PDFJS_TILE_MIN_OUTPUT_SCALE = 0.2;

function getPdfJsOpsRecord(): Record<string, number> | null {
  const record = globalThis as unknown as Record<string, unknown>;
  const candidates = [
    (record.pdfjsLib as { OPS?: unknown } | undefined)?.OPS,
    (record.pdfjs as { OPS?: unknown } | undefined)?.OPS,
    (record.PDFJS as { OPS?: unknown } | undefined)?.OPS,
  ];

  for (const candidate of candidates) {
    if (candidate && typeof candidate === "object") {
      return candidate as Record<string, number>;
    }
  }

  return null;
}

function resolvePdfJsTextOperatorIds(): Set<number> {
  const ops = getPdfJsOpsRecord();
  const ids = new Set<number>();

  if (!ops) {
    return ids;
  }

  for (const name of PDFJS_TEXT_OPERATOR_NAMES) {
    const id = ops[name];

    if (typeof id === "number" && Number.isFinite(id)) {
      ids.add(id);
    }
  }

  return ids;
}

async function createCanvasTextOperationsFilter(input: {
  page: PdfJsRenderablePageLike;
  renderText: boolean;
  canvas: HTMLCanvasElement;
}): Promise<((operationIndexOrFnId: number) => boolean) | undefined> {
  if (input.renderText) {
    input.canvas.dataset.knexPdfCanvasTextFilter = "disabled-render-text-true";
    return undefined;
  }

  if (typeof input.page.getOperatorList !== "function") {
    input.canvas.dataset.knexPdfCanvasTextFilter =
      "unavailable-getOperatorList";
    return undefined;
  }

  const textOperatorIds = resolvePdfJsTextOperatorIds();

  if (textOperatorIds.size === 0) {
    input.canvas.dataset.knexPdfCanvasTextFilter = "unavailable-ops";
    return undefined;
  }

  const operatorList = await input.page.getOperatorList();
  const fnArray = Array.isArray(operatorList.fnArray)
    ? operatorList.fnArray
    : [];

  if (fnArray.length === 0) {
    input.canvas.dataset.knexPdfCanvasTextFilter = "unavailable-empty-ops";
    return undefined;
  }

  const skippedOperationIndexes = new Set<number>();

  for (let index = 0; index < fnArray.length; index += 1) {
    if (textOperatorIds.has(fnArray[index])) {
      skippedOperationIndexes.add(index);
    }
  }

  if (skippedOperationIndexes.size === 0) {
    input.canvas.dataset.knexPdfCanvasTextFilter = "active-no-text-ops-found";
    return undefined;
  }

  input.canvas.dataset.knexPdfCanvasTextFilter = "active";
  input.canvas.dataset.knexPdfCanvasTextFilteredOps = String(
    skippedOperationIndexes.size,
  );
  input.canvas.dataset.knexPdfCanvasTextTotalOps = String(fnArray.length);

  return (operationIndexOrFnId: number) => {
    /*
     * Em versões atuais do PDF.js, operationsFilter recebe o índice da operação.
     * Em caso de variação de versão, também bloqueamos quando vier o próprio
     * fnId do operador textual.
     */
    return (
      !skippedOperationIndexes.has(operationIndexOrFnId) &&
      !textOperatorIds.has(operationIndexOrFnId)
    );
  };
}

function configureTileCanvas(input: RenderKnexPdfTileToCanvasInput): {
  bitmapWidth: number;
  bitmapHeight: number;
  actualOutputScaleX: number;
  actualOutputScaleY: number;
} {
  const { canvas, geometry, tile } = input;

  const renderCssWidth = positiveNumber(tile.renderCssWidth, tile.cssWidth);
  const renderCssHeight = positiveNumber(tile.renderCssHeight, tile.cssHeight);
  const requestedOutputScaleX = positiveNumber(tile.outputScaleX, 1);
  const requestedOutputScaleY = positiveNumber(tile.outputScaleY, 1);

  /*
   * O bitmap precisa ser derivado do retângulo REAL que será renderizado,
   * mas agora passa por uma trava de memória antes do PDF.js receber o canvas.
   */
  const safeBitmap = resolveSafeTileBitmapGeometry({
    renderCssWidth,
    renderCssHeight,
    requestedOutputScaleX,
    requestedOutputScaleY,
  });

  const {
    bitmapWidth,
    bitmapHeight,
    actualOutputScaleX,
    actualOutputScaleY,
  } = safeBitmap;

  canvas.width = bitmapWidth;
  canvas.height = bitmapHeight;

  /*
   * Este canvas é de trabalho/renderização do tile. Ele deve manter o tamanho
   * CSS correspondente ao renderRect. O recorte para a célula visual, quando
   * houver bleed/overscan, deve acontecer no PdfTileCanvas.tsx ao copiar para
   * o canvas final visível.
   */
  canvas.style.width = `${renderCssWidth}px`;
  canvas.style.height = `${renderCssHeight}px`;
  canvas.style.imageRendering = "auto";

  canvas.dataset.knexPdfTile = "true";
  canvas.dataset.knexPdfPageNumber = String(tile.pageNumber);
  canvas.dataset.knexPdfTileId = tile.id;
  canvas.dataset.knexPdfTileRow = String(tile.row);
  canvas.dataset.knexPdfTileColumn = String(tile.column);
  canvas.dataset.knexPdfBackend = "pdfjs";
  canvas.dataset.knexPdfRenderSource = "pdfjs";
  canvas.dataset.knexPdfRenderer = "pdfjs-tile-canvas";
  canvas.dataset.knexPdfRenderPhase = input.renderPhase;
  canvas.dataset.knexPdfRenderText = input.renderText === false ? "false" : "true";
  canvas.dataset.knexPdfOutputScale = String(geometry.outputScale);
  canvas.dataset.knexPdfOutputScaleX = String(actualOutputScaleX);
  canvas.dataset.knexPdfOutputScaleY = String(actualOutputScaleY);
  canvas.dataset.knexPdfRequestedOutputScaleX = String(tile.outputScaleX);
  canvas.dataset.knexPdfRequestedOutputScaleY = String(tile.outputScaleY);
  canvas.dataset.knexPdfTileMemoryCapped = safeBitmap.memoryCapped
    ? "true"
    : "false";
  canvas.dataset.knexPdfTileMemoryScale = String(safeBitmap.memoryScale);
  canvas.dataset.knexPdfTileRequestedBitmapWidth = String(
    safeBitmap.requestedBitmapWidth,
  );
  canvas.dataset.knexPdfTileRequestedBitmapHeight = String(
    safeBitmap.requestedBitmapHeight,
  );
  canvas.dataset.knexPdfTileMaxBitmapPixels = String(
    PDFJS_TILE_MAX_BITMAP_PIXELS,
  );
  canvas.dataset.knexPdfTileMaxBitmapSide = String(PDFJS_TILE_MAX_BITMAP_SIDE);
  canvas.dataset.knexPdfTileCssLeft = String(tile.cssX);
  canvas.dataset.knexPdfTileCssTop = String(tile.cssY);
  canvas.dataset.knexPdfTileCssWidth = String(tile.cssWidth);
  canvas.dataset.knexPdfTileCssHeight = String(tile.cssHeight);
  canvas.dataset.knexPdfTileRenderCssLeft = String(tile.renderCssX);
  canvas.dataset.knexPdfTileRenderCssTop = String(tile.renderCssY);
  canvas.dataset.knexPdfTileRenderCssWidth = String(renderCssWidth);
  canvas.dataset.knexPdfTileRenderCssHeight = String(renderCssHeight);
  canvas.dataset.knexPdfTileCellCssLeft = String(tile.cellCssX);
  canvas.dataset.knexPdfTileCellCssTop = String(tile.cellCssY);
  canvas.dataset.knexPdfTileCellCssWidth = String(tile.cellCssWidth);
  canvas.dataset.knexPdfTileCellCssHeight = String(tile.cellCssHeight);
  canvas.dataset.knexPdfTileBleedPx = String(tile.bleedPx);
  canvas.dataset.knexPdfTileRows = String(tile.tileRows);
  canvas.dataset.knexPdfTileColumns = String(tile.tileColumns);
  canvas.dataset.knexPdfTileBitmapWidth = String(bitmapWidth);
  canvas.dataset.knexPdfTileBitmapHeight = String(bitmapHeight);

  return {
    bitmapWidth,
    bitmapHeight,
    actualOutputScaleX,
    actualOutputScaleY,
  };
}

export async function renderKnexPdfTileToCanvas(
  input: RenderKnexPdfTileToCanvasInput,
): Promise<KnexPdfRenderedTile> {
  if (input.signal?.aborted) {
    throw createAbortError();
  }

  const startedAt = nowMs();
  const {
    bitmapWidth,
    bitmapHeight,
    actualOutputScaleX,
    actualOutputScaleY,
  } = configureTileCanvas(input);

  const context = input.canvas.getContext("2d", {
    alpha: false,
    desynchronized: false,
  });

  if (!context) {
    throw new Error("Could not initialize KnexPDF tile canvas.");
  }

  /*
   * Para PDF.js, a nitidez depende de:
   * 1. bitmap real alto;
   * 2. escala real coerente com o bitmap;
   * 3. crop feito por transform sem reamostragem posterior;
   * 4. evitar transform CSS artificial no canvas final.
   */
  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, bitmapWidth, bitmapHeight);
  context.restore();

  const page = (await input.session.pdf.getPage(
    input.pageNumber,
  )) as PdfJsRenderablePageLike;

  if (input.signal?.aborted) {
    throw createAbortError();
  }

  const renderText = input.renderText !== false;
  const operationsFilter = await createCanvasTextOperationsFilter({
    page,
    renderText,
    canvas: input.canvas,
  });

  if (input.signal?.aborted) {
    throw createAbortError();
  }

  const viewport = page.getViewport({ scale: input.geometry.zoom });

  /*
   * Usar a escala efetiva real, calculada a partir do bitmap final.
   * Isso evita microblur por diferença entre ceil/round do bitmap e
   * outputScale nominal vindo da geometria.
   */
  const transform: [number, number, number, number, number, number] = [
    actualOutputScaleX,
    0,
    0,
    actualOutputScaleY,
    -input.tile.renderCssX * actualOutputScaleX,
    -input.tile.renderCssY * actualOutputScaleY,
  ];

  const renderTask = page.render({
    canvasContext: context,
    canvas: input.canvas,
    viewport,
    transform,
    intent: "display",
    operationsFilter,
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
    /*
     * Em cancelamento/erro, liberar imediatamente o workerCanvas evita que
     * uma geração antiga continue segurando bitmap grande após novo zoom.
     */
    releaseCanvasBitmap(input.canvas);

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
    outputScaleX: actualOutputScaleX,
    outputScaleY: actualOutputScaleY,
    cssLeft: input.tile.renderCssX,
    cssTop: input.tile.renderCssY,
    cssWidth: input.tile.renderCssWidth,
    cssHeight: input.tile.renderCssHeight,
    bitmapWidth,
    bitmapHeight,
    renderedAt: Date.now(),
    renderDurationMs: nowMs() - startedAt,
  };

  input.canvas.dataset.knexPdfRenderText = renderText ? "true" : "false";
  input.canvas.dataset.knexPdfTileBitmapBytes = String(
    input.canvas.width * input.canvas.height * 4,
  );

  if (isTileDebugEnabled()) {
    // eslint-disable-next-line no-console
    console.debug("[KnexPDF][TileRender]", renderedTile);
  }

  return renderedTile;
}
