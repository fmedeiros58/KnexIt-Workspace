import type { KnexPdfPageGeometry } from "../core/engineTypes";

export type TileGridCell = {
  tileX: number;
  tileY: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

export type KnexPdfTilePriority = "visible" | "nearby" | "background";

export type KnexPdfPageTile = {
  id: string;
  pageNumber: number;
  tileX: number;
  tileY: number;
  column: number;
  row: number;
  cssX: number;
  cssY: number;
  cssWidth: number;
  cssHeight: number;
  renderCssX: number;
  renderCssY: number;
  renderCssWidth: number;
  renderCssHeight: number;
  cellCssX: number;
  cellCssY: number;
  cellCssWidth: number;
  cellCssHeight: number;
  bitmapX: number;
  bitmapY: number;
  bitmapWidth: number;
  bitmapHeight: number;
  outputScaleX: number;
  outputScaleY: number;
  overlapPx: number;
  bleedPx: number;
  tileRows: number;
  tileColumns: number;
  priority: KnexPdfTilePriority;
};

export type KnexPdfTileRenderPlan = {
  pageNumber: number;
  cssWidth: number;
  cssHeight: number;
  bitmapWidth: number;
  bitmapHeight: number;
  outputScale: number;
  outputScaleX: number;
  outputScaleY: number;
  tileSizeCss: number;
  tileRows: number;
  tileColumns: number;
  overlapPx: number;
  bleedPx: number;
  totalTiles: number;
  visibleTiles: number;
  estimatedBytes: number;
  reason: "not-needed" | "bitmap-too-large" | "output-scale-clamped";
  tiles: KnexPdfPageTile[];
};

export type KnexPdfVisibleTileRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

const DEFAULT_TILE_SIZE_CSS = 1024;
const DEFAULT_TILE_MAX_BITMAP_PIXELS = 96_000_000;

function safeNumber(
  value: number | null | undefined,
  fallback = 0,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function normalizePositiveInteger(value: number, fallback = 1): number {
  return Math.max(1, Math.ceil(safeNumber(value, fallback)));
}

function normalizeGridInteger(value: number | undefined): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  return Math.max(1, Math.floor(value));
}

function intersects(a: KnexPdfVisibleTileRect, b: KnexPdfVisibleTileRect) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function expandRect(
  rect: KnexPdfVisibleTileRect | undefined,
  margin: number,
): KnexPdfVisibleTileRect | undefined {
  if (!rect) return undefined;

  return {
    x: rect.x - margin,
    y: rect.y - margin,
    width: rect.width + margin * 2,
    height: rect.height + margin * 2,
  };
}

function createTileId(input: {
  pageNumber: number;
  zoomBucket: number;
  scaleBucket: number;
  row: number;
  column: number;
  tileRows: number;
  tileColumns: number;
  overlapPx: number;
  bleedPx: number;
}): string {
  /*
   * Importante:
   * A chave anterior não incluía tileRows/tileColumns/bleed/overlap.
   * Isso permite que cache/DOM reaproveitem tiles de uma malha antiga
   * quando a geometria muda. Aqui a identidade passa a representar
   * a célula dentro da grade real que foi renderizada.
   */
  return [
    `p${input.pageNumber}`,
    `z${input.zoomBucket}`,
    `r${input.row}`,
    `c${input.column}`,
    `rows${input.tileRows}`,
    `cols${input.tileColumns}`,
    `s${input.scaleBucket}`,
    `o${input.overlapPx}`,
    `b${input.bleedPx}`,
  ].join("_");
}

export function calculateTileGrid(input: {
  pageWidth: number;
  pageHeight: number;
  tileSize?: number;
  tileRows?: number;
  tileColumns?: number;
}): TileGridCell[] {
  const fixedRows = normalizeGridInteger(input.tileRows);
  const fixedColumns = normalizeGridInteger(input.tileColumns);
  const pageWidth = normalizePositiveInteger(input.pageWidth, 1);
  const pageHeight = normalizePositiveInteger(input.pageHeight, 1);
  const tileSize = input.tileSize ?? 1024;
  const columns =
    fixedColumns ?? Math.max(1, Math.ceil(pageWidth / tileSize));
  const rows = fixedRows ?? Math.max(1, Math.ceil(pageHeight / tileSize));
  const cells: TileGridCell[] = [];

  for (let tileY = 0; tileY < rows; tileY += 1) {
    const y =
      fixedRows !== null
        ? Math.round((pageHeight * tileY) / rows)
        : tileY * tileSize;
    const nextY =
      fixedRows !== null
        ? tileY === rows - 1
          ? pageHeight
          : Math.round((pageHeight * (tileY + 1)) / rows)
        : Math.min(pageHeight, y + tileSize);

    for (let tileX = 0; tileX < columns; tileX += 1) {
      const x =
        fixedColumns !== null
          ? Math.round((pageWidth * tileX) / columns)
          : tileX * tileSize;
      const nextX =
        fixedColumns !== null
          ? tileX === columns - 1
            ? pageWidth
            : Math.round((pageWidth * (tileX + 1)) / columns)
          : Math.min(pageWidth, x + tileSize);

      cells.push({
        tileX,
        tileY,
        x,
        y,
        width: Math.max(1, nextX - x),
        height: Math.max(1, nextY - y),
      });
    }
  }

  return cells;
}

export function shouldUseKnexPdfTileRendering(input: {
  geometry: KnexPdfPageGeometry;
  maxBitmapPixels?: number;
}): boolean {
  const maxBitmapPixels = normalizePositiveInteger(
    input.maxBitmapPixels ?? DEFAULT_TILE_MAX_BITMAP_PIXELS,
    DEFAULT_TILE_MAX_BITMAP_PIXELS,
  );

  return (
    input.geometry.bitmapPixels > maxBitmapPixels ||
    input.geometry.wasOutputScaleClamped
  );
}

export function buildKnexPdfTileRenderPlan(input: {
  geometry: KnexPdfPageGeometry;
  tileSizeCss?: number;
  tileRows?: number;
  tileColumns?: number;
  overlapPx?: number;
  bleedPx?: number;
  visibleRect?: KnexPdfVisibleTileRect;
  preloadMarginCss?: number;
  maxBitmapPixels?: number;
}): KnexPdfTileRenderPlan {
  const { geometry } = input;
  const tileSizeCss = normalizePositiveInteger(
    input.tileSizeCss ?? DEFAULT_TILE_SIZE_CSS,
    DEFAULT_TILE_SIZE_CSS,
  );
  const requestedTileRows = normalizeGridInteger(input.tileRows);
  const requestedTileColumns = normalizeGridInteger(input.tileColumns);

  /*
   * overlapPx e bleedPx NÃO podem aumentar o retângulo visual do tile.
   *
   * - A célula visual é sempre cell.x/cell.y/cell.width/cell.height.
   * - overlap/bleed expandem apenas a área renderizada internamente.
   * - O wrapper visual precisa cortar a área extra com overflow:hidden.
   *
   * O bug de sobreposição normalmente acontece quando cssWidth/cssHeight
   * recebem cell.width + overlapPx. Isso faz o tile ocupar visualmente
   * a célula vizinha. Por isso cssWidth/cssHeight voltam a ser somente
   * a célula real.
   */
  const overlapPx = Math.max(0, Math.ceil(safeNumber(input.overlapPx, 0)));
  const bleedPx = Math.max(0, Math.ceil(safeNumber(input.bleedPx, 0)));
  const renderPaddingPx = overlapPx + bleedPx;

  const visibleRect = input.visibleRect;
  const nearbyRect = expandRect(
    visibleRect,
    Math.max(0, safeNumber(input.preloadMarginCss, tileSizeCss)),
  );

  const cells = calculateTileGrid({
    pageWidth: geometry.cssWidth,
    pageHeight: geometry.cssHeight,
    tileSize: tileSizeCss,
    tileRows: requestedTileRows ?? undefined,
    tileColumns: requestedTileColumns ?? undefined,
  });

  const tileRows =
    cells.reduce((maxRow, cell) => Math.max(maxRow, cell.tileY), 0) + 1;
  const tileColumns =
    cells.reduce((maxColumn, cell) => Math.max(maxColumn, cell.tileX), 0) + 1;

  const zoomBucket = Math.round(geometry.zoom * 100) / 100;
  const scaleBucket = Math.round(geometry.outputScale * 100) / 100;

  const tiles: KnexPdfPageTile[] = cells.map((cell) => {
    const cellCssX = cell.x;
    const cellCssY = cell.y;
    const cellCssWidth = cell.width;
    const cellCssHeight = cell.height;

    /*
     * Retângulo visual da célula.
     * Este é o único retângulo que deve definir o espaço do tile na página.
     */
    const cssX = cellCssX;
    const cssY = cellCssY;
    const cssWidth = cellCssWidth;
    const cssHeight = cellCssHeight;

    /*
     * Retângulo de renderização expandido.
     * Pode renderizar pixels extras para evitar cortes de antialiasing,
     * acentos, hastes e descendentes, mas essa área deve ficar recortada
     * pelo wrapper visual no componente.
     */
    const renderCssX = Math.max(0, cellCssX - renderPaddingPx);
    const renderCssY = Math.max(0, cellCssY - renderPaddingPx);
    const renderCssRight = Math.min(
      geometry.cssWidth,
      cellCssX + cellCssWidth + renderPaddingPx,
    );
    const renderCssBottom = Math.min(
      geometry.cssHeight,
      cellCssY + cellCssHeight + renderPaddingPx,
    );

    const renderCssWidth = Math.max(1, renderCssRight - renderCssX);
    const renderCssHeight = Math.max(1, renderCssBottom - renderCssY);

    const rect: KnexPdfVisibleTileRect = {
      x: cellCssX,
      y: cellCssY,
      width: cellCssWidth,
      height: cellCssHeight,
    };

    const priority: KnexPdfTilePriority =
      visibleRect && intersects(rect, visibleRect)
        ? "visible"
        : nearbyRect && intersects(rect, nearbyRect)
          ? "nearby"
          : "background";

    return {
      id: createTileId({
        pageNumber: geometry.pageNumber,
        zoomBucket,
        scaleBucket,
        row: cell.tileY,
        column: cell.tileX,
        tileRows,
        tileColumns,
        overlapPx,
        bleedPx,
      }),
      pageNumber: geometry.pageNumber,
      tileX: cell.tileX,
      tileY: cell.tileY,
      column: cell.tileX,
      row: cell.tileY,

      /*
       * css* = retângulo visual. Não inclui overlap/bleed.
       */
      cssX,
      cssY,
      cssWidth,
      cssHeight,

      /*
       * renderCss* = retângulo expandido de renderização.
       */
      renderCssX,
      renderCssY,
      renderCssWidth,
      renderCssHeight,

      /*
       * cellCss* = célula geométrica original. Mantido explicitamente
       * para componentes que distinguem célula visual e render extra.
       */
      cellCssX,
      cellCssY,
      cellCssWidth,
      cellCssHeight,

      bitmapX: Math.floor(renderCssX * geometry.outputScaleX),
      bitmapY: Math.floor(renderCssY * geometry.outputScaleY),
      bitmapWidth: normalizePositiveInteger(
        renderCssWidth * geometry.outputScaleX,
      ),
      bitmapHeight: normalizePositiveInteger(
        renderCssHeight * geometry.outputScaleY,
      ),
      outputScaleX: geometry.outputScaleX,
      outputScaleY: geometry.outputScaleY,
      overlapPx,
      bleedPx,
      tileRows,
      tileColumns,
      priority,
    };
  });

  const priorityRank: Record<KnexPdfTilePriority, number> = {
    visible: 0,
    nearby: 1,
    background: 2,
  };

  tiles.sort((a, b) => {
    const priorityDiff = priorityRank[a.priority] - priorityRank[b.priority];
    if (priorityDiff !== 0) return priorityDiff;
    if (a.tileY !== b.tileY) return a.tileY - b.tileY;
    return a.tileX - b.tileX;
  });

  const reason = geometry.wasOutputScaleClamped
    ? "output-scale-clamped"
    : shouldUseKnexPdfTileRendering({
        geometry,
        maxBitmapPixels: input.maxBitmapPixels,
      })
      ? "bitmap-too-large"
      : "not-needed";

  return {
    pageNumber: geometry.pageNumber,
    cssWidth: geometry.cssWidth,
    cssHeight: geometry.cssHeight,
    bitmapWidth: geometry.bitmapWidth,
    bitmapHeight: geometry.bitmapHeight,
    outputScale: geometry.outputScale,
    outputScaleX: geometry.outputScaleX,
    outputScaleY: geometry.outputScaleY,
    tileSizeCss,
    tileRows,
    tileColumns,
    overlapPx,
    bleedPx,
    totalTiles: tiles.length,
    visibleTiles: tiles.filter((tile) => tile.priority === "visible").length,
    estimatedBytes: geometry.bitmapPixels * 4,
    reason,
    tiles,
  };
}
