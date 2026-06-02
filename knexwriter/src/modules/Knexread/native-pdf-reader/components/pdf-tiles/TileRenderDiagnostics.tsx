"use client";

import { useEffect } from "react";
import type { KnexPdfVisualRenderMode } from "../../knex-pdf-engine";

export type KnexReadDebugTileEntry = {
  pageNumber: string;
  tileId: string;
  row: string;
  column: string;
  status: string;
  cache: string;
  cacheStatus: string;
  backend: string;
  activeBackend: string;
  preferredBackend: string;
  backendVersion: string;
  renderSource: string;
  renderer: string;
  renderPhase: string;
  generationId: string;
  renderVersion: string;
  finalRenderVersion: string;
  outputScale: string;
  outputScaleX: string;
  outputScaleY: string;
  cssWidth: string;
  cssHeight: string;
  bitmapWidth: string;
  bitmapHeight: string;
  tileRows: string;
  tileColumns: string;
  layerSurface: string;
  layerVisible: string;
  dpi: string;
  renderDurationMs: string;
  storageHit: string;
  viewportVisible: string;
};

export type KnexReadPageTileAuditSummary = {
  page: number;
  tileCount: number;
  gridLikely: string;
  rows: number;
  columns: number;
  duplicatedTileCells: number;
  visibleGenerationIds: string[];
  avgScaleX: number;
  avgScaleY: number;
  minScaleX: number;
  minScaleY: number;
  internalVerticalProblems: number;
  internalHorizontalProblems: number;
  qualityLikely: "alta" | "baixa" | "pendente";
};

export type KnexReadRuntimeTileTrace = {
  pageNumber: number;
  row: number;
  column: number;
  tileId: string;
  activeBackend: string;
  preferredBackend: string;
  backendVersion: string;
  renderSource: string;
  renderer: string;
  cacheStatus: string;
  generationId: string;
  renderVersion: string;
  finalRenderVersion: string;
  outputScaleX: number;
  outputScaleY: number;
  cssWidth: number;
  cssHeight: number;
  bitmapWidth: number;
  bitmapHeight: number;
  layerSurface: string;
  layerVisible: boolean;
};

export type KnexReadRuntimePageTrace = {
  pageNumber: number;
  activeBackend: string;
  preferredBackend: string;
  backendVersion: string;
  renderMode: string;
  tileRenderMode: string;
  tileRows: number;
  tileColumns: number;
  totalTiles: number;
  outputScale: number;
  finalRenderVersion: string;
  generationId: string;
  renderedTileCount: number;
  duplicatedTileCells: number;
  visibleGenerationIds: string[];
  cacheHitCount: number;
  cacheMissCount: number;
};

export type KnexReadRuntimeDuplicateTrace = {
  pageNumber: number;
  row: number;
  column: number;
  count: number;
  generationIds: string[];
  tileIds: string[];
};

declare global {
  interface Window {
    knexReadDebugTiles?: () => {
      visualRenderMode: string;
      tiles: KnexReadDebugTileEntry[];
      visibleTiles: KnexReadDebugTileEntry[];
    };
    __KNEX_PAGE_TILE_COUNT_AUDIT__?: {
      summary: KnexReadPageTileAuditSummary[];
      detail: (pageNumber: number) => KnexReadDebugTileEntry[];
      all: (pageNumber: number) => KnexReadDebugTileEntry[];
      highlightPage: (pageNumber: number) => void;
    };
    __KNEX_PDF_RUNTIME_TRACE__?: {
      summary: () => KnexReadRuntimePageTrace[];
      page: (pageNumber: number) => KnexReadRuntimePageTrace | null;
      tiles: (pageNumber: number) => KnexReadRuntimeTileTrace[];
      duplicates: () => KnexReadRuntimeDuplicateTrace[];
      highlight: (pageNumber: number) => void;
    };
  }
}

export type TileRenderDiagnosticsProps = {
  visualRenderMode: KnexPdfVisualRenderMode;
};

function toNumber(value: string | undefined, fallback = 0): number {
  const parsed = Number(value ?? "");
  return Number.isFinite(parsed) ? parsed : fallback;
}

function getTileElements(input: { visibleOnly?: boolean } = {}): HTMLElement[] {
  const tiles = [
    ...document.querySelectorAll<HTMLElement>(
      '[data-knex-pdf-tile="true"]',
    ),
  ];

  return input.visibleOnly ? tiles.filter(isTileVisiblyMounted) : tiles;
}

function getPageFrame(pageNumber: number): HTMLElement | null {
  for (const frame of document.querySelectorAll<HTMLElement>(
    '[data-knexread-page-tile-frame="true"]',
  )) {
    if (Number(frame.dataset.pageNumber ?? "") === pageNumber) {
      return frame;
    }
  }

  return null;
}

function isStyleVisible(element: HTMLElement | null): boolean {
  if (!element) return true;

  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }

  return Number(style.opacity || "1") > 0;
}

function isTileVisiblyMounted(tile: HTMLElement): boolean {
  if (tile.dataset.knexPdfLayerVisible === "false") return false;

  const surface = tile.closest<HTMLElement>("[data-knex-pdf-tile-page-surface]");
  if (surface?.dataset.knexPdfLayerVisible === "false") return false;

  return isStyleVisible(surface) && isStyleVisible(tile);
}

function readTileEntry(tile: HTMLElement): KnexReadDebugTileEntry {
  const canvas = tile as HTMLCanvasElement;

  return {
    pageNumber: tile.dataset.knexPdfPageNumber ?? "",
    tileId: tile.dataset.knexPdfTileId ?? "",
    row: tile.dataset.knexPdfTileRow ?? "",
    column: tile.dataset.knexPdfTileColumn ?? "",
    status: tile.dataset.knexPdfTileStatus ?? "",
    cache: tile.dataset.knexPdfTileCache ?? "",
    cacheStatus:
      tile.dataset.knexPdfCacheStatus ?? tile.dataset.knexPdfTileCache ?? "",
    backend: tile.dataset.knexPdfBackend ?? "unknown",
    activeBackend: tile.dataset.knexPdfActiveBackend ?? "unknown",
    preferredBackend: tile.dataset.knexPdfPreferredBackend ?? "unknown",
    backendVersion: tile.dataset.knexPdfBackendVersion ?? "",
    renderSource: tile.dataset.knexPdfRenderSource ?? "unknown",
    renderer: tile.dataset.knexPdfRenderer ?? "unknown",
    renderPhase: tile.dataset.knexPdfRenderPhase ?? "",
    generationId:
      tile.dataset.knexPdfGenerationId ??
      tile.dataset.knexPdfTileGenerationId ??
      "",
    renderVersion: tile.dataset.knexPdfRenderVersion ?? "",
    finalRenderVersion: tile.dataset.knexPdfFinalRenderVersion ?? "",
    outputScale: tile.dataset.knexPdfOutputScale ?? "",
    outputScaleX: tile.dataset.knexPdfOutputScaleX ?? "",
    outputScaleY: tile.dataset.knexPdfOutputScaleY ?? "",
    cssWidth: tile.dataset.knexPdfTileCssWidth ?? "",
    cssHeight: tile.dataset.knexPdfTileCssHeight ?? "",
    bitmapWidth: tile.dataset.knexPdfTileBitmapWidth ?? String(canvas.width),
    bitmapHeight: tile.dataset.knexPdfTileBitmapHeight ?? String(canvas.height),
    tileRows: tile.dataset.knexPdfTileRows ?? "",
    tileColumns: tile.dataset.knexPdfTileColumns ?? "",
    layerSurface: tile.dataset.knexPdfLayerSurface ?? "",
    layerVisible: tile.dataset.knexPdfLayerVisible ?? "",
    dpi: tile.dataset.knexPdfDpi ?? "",
    renderDurationMs: tile.dataset.knexPdfTileRenderDurationMs ?? "",
    storageHit: tile.dataset.knexPdfStorageHit ?? "",
    viewportVisible: tile.dataset.knexPdfTileViewportVisible ?? "",
  };
}

function getDebugTileEntries(input: { visibleOnly?: boolean } = {}) {
  return getTileElements(input).map(readTileEntry);
}

function readTileScale(tile: HTMLElement): { scaleX: number; scaleY: number } {
  const rect = tile.getBoundingClientRect();
  const canvas = tile as HTMLCanvasElement;
  const scaleX = canvas.width / Math.max(1, rect.width);
  const scaleY = canvas.height / Math.max(1, rect.height);

  return { scaleX, scaleY };
}

function countInternalGaps(input: {
  tiles: HTMLElement[];
  axis: "x" | "y";
  groupDatasetKey: "knexPdfTileRow" | "knexPdfTileColumn";
}) {
  const grouped = new Map<string, HTMLElement[]>();

  for (const tile of input.tiles) {
    const key = tile.dataset[input.groupDatasetKey] ?? "";
    grouped.set(key, [...(grouped.get(key) ?? []), tile]);
  }

  let gaps = 0;

  for (const groupTiles of grouped.values()) {
    const sorted = [...groupTiles].sort((a, b) => {
      const aStart =
        input.axis === "x"
          ? Number(a.dataset.knexPdfTileCssLeft ?? 0)
          : Number(a.dataset.knexPdfTileCssTop ?? 0);
      const bStart =
        input.axis === "x"
          ? Number(b.dataset.knexPdfTileCssLeft ?? 0)
          : Number(b.dataset.knexPdfTileCssTop ?? 0);

      return aStart - bStart;
    });

    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      const previousStart =
        input.axis === "x"
          ? Number(previous.dataset.knexPdfTileCssLeft ?? 0)
          : Number(previous.dataset.knexPdfTileCssTop ?? 0);
      const previousSize =
        input.axis === "x"
          ? Number(previous.dataset.knexPdfTileCssWidth ?? 0)
          : Number(previous.dataset.knexPdfTileCssHeight ?? 0);
      const currentStart =
        input.axis === "x"
          ? Number(current.dataset.knexPdfTileCssLeft ?? 0)
          : Number(current.dataset.knexPdfTileCssTop ?? 0);

      if (currentStart > previousStart + previousSize + 0.5) {
        gaps += 1;
      }
    }
  }

  return gaps;
}

function groupVisibleTilesByPage(): Map<number, HTMLElement[]> {
  const pageTiles = new Map<number, HTMLElement[]>();

  for (const tile of getTileElements({ visibleOnly: true })) {
    const pageNumber = Number(tile.dataset.knexPdfPageNumber ?? "");
    if (!Number.isFinite(pageNumber)) continue;

    pageTiles.set(pageNumber, [...(pageTiles.get(pageNumber) ?? []), tile]);
  }

  return pageTiles;
}

function getDuplicateTileCells(
  tiles: HTMLElement[],
): KnexReadRuntimeDuplicateTrace[] {
  const cells = new Map<string, HTMLElement[]>();

  for (const tile of tiles) {
    const pageNumber = toNumber(tile.dataset.knexPdfPageNumber);
    const row = toNumber(tile.dataset.knexPdfTileRow);
    const column = toNumber(tile.dataset.knexPdfTileColumn);
    const key = `${pageNumber}:${row}:${column}`;
    cells.set(key, [...(cells.get(key) ?? []), tile]);
  }

  return [...cells.entries()]
    .filter(([, cellTiles]) => cellTiles.length > 1)
    .map(([key, cellTiles]) => {
      const [pageNumber, row, column] = key.split(":").map(Number);
      return {
        pageNumber,
        row,
        column,
        count: cellTiles.length,
        generationIds: [
          ...new Set(
            cellTiles.map(
              (tile) =>
                tile.dataset.knexPdfGenerationId ??
                tile.dataset.knexPdfTileGenerationId ??
                "",
            ),
          ),
        ],
        tileIds: cellTiles.map((tile) => tile.dataset.knexPdfTileId ?? ""),
      };
    });
}

function createTileAuditSummary(): KnexReadPageTileAuditSummary[] {
  return [...groupVisibleTilesByPage().entries()]
    .sort(([a], [b]) => a - b)
    .map(([page, tiles]) => {
      const rows = new Set(tiles.map((tile) => tile.dataset.knexPdfTileRow));
      const columns = new Set(
        tiles.map((tile) => tile.dataset.knexPdfTileColumn),
      );
      const readyTiles = tiles.filter(
        (tile) => tile.dataset.knexPdfTileStatus === "ready",
      );
      const scales = (readyTiles.length > 0 ? readyTiles : tiles).map(
        readTileScale,
      );
      const scaleCount = Math.max(1, scales.length);
      const avgScaleX =
        scales.reduce((sum, scale) => sum + scale.scaleX, 0) / scaleCount;
      const avgScaleY =
        scales.reduce((sum, scale) => sum + scale.scaleY, 0) / scaleCount;
      const minScaleX =
        scales.length > 0 ? Math.min(...scales.map((scale) => scale.scaleX)) : 0;
      const minScaleY =
        scales.length > 0 ? Math.min(...scales.map((scale) => scale.scaleY)) : 0;

      return {
        page,
        tileCount: tiles.length,
        gridLikely: `${rows.size} linhas x ${columns.size} colunas`,
        rows: rows.size,
        columns: columns.size,
        duplicatedTileCells: getDuplicateTileCells(tiles).length,
        visibleGenerationIds: [
          ...new Set(
            tiles.map(
              (tile) =>
                tile.dataset.knexPdfGenerationId ??
                tile.dataset.knexPdfTileGenerationId ??
                "",
            ),
          ),
        ].filter(Boolean),
        avgScaleX,
        avgScaleY,
        minScaleX,
        minScaleY,
        internalVerticalProblems: countInternalGaps({
          tiles,
          axis: "x",
          groupDatasetKey: "knexPdfTileRow",
        }),
        internalHorizontalProblems: countInternalGaps({
          tiles,
          axis: "y",
          groupDatasetKey: "knexPdfTileColumn",
        }),
        qualityLikely:
          readyTiles.length === 0
            ? "pendente"
            : minScaleX >= 4.75 && minScaleY >= 4.75
              ? "alta"
              : "baixa",
      };
    });
}

function readRuntimeTileTrace(tile: HTMLElement): KnexReadRuntimeTileTrace {
  const entry = readTileEntry(tile);

  return {
    pageNumber: toNumber(entry.pageNumber),
    row: toNumber(entry.row),
    column: toNumber(entry.column),
    tileId: entry.tileId,
    activeBackend: entry.activeBackend,
    preferredBackend: entry.preferredBackend,
    backendVersion: entry.backendVersion,
    renderSource: entry.renderSource,
    renderer: entry.renderer,
    cacheStatus: entry.cacheStatus,
    generationId: entry.generationId,
    renderVersion: entry.renderVersion,
    finalRenderVersion: entry.finalRenderVersion,
    outputScaleX: toNumber(entry.outputScaleX),
    outputScaleY: toNumber(entry.outputScaleY),
    cssWidth: toNumber(entry.cssWidth),
    cssHeight: toNumber(entry.cssHeight),
    bitmapWidth: toNumber(entry.bitmapWidth),
    bitmapHeight: toNumber(entry.bitmapHeight),
    layerSurface: entry.layerSurface,
    layerVisible: entry.layerVisible === "true",
  };
}

function createRuntimePageTrace(
  pageNumber: number,
  tiles: HTMLElement[],
): KnexReadRuntimePageTrace {
  const frame = getPageFrame(pageNumber);
  const firstTile = tiles[0];
  const generationIds = [
    ...new Set(
      tiles.map(
        (tile) =>
          tile.dataset.knexPdfGenerationId ??
          tile.dataset.knexPdfTileGenerationId ??
          "",
      ),
    ),
  ].filter(Boolean);
  const cacheHitCount = tiles.filter((tile) => {
    const cache =
      tile.dataset.knexPdfCacheStatus ?? tile.dataset.knexPdfTileCache ?? "";
    return cache === "hit";
  }).length;
  const cacheMissCount = tiles.filter((tile) => {
    const cache =
      tile.dataset.knexPdfCacheStatus ?? tile.dataset.knexPdfTileCache ?? "";
    return cache === "miss";
  }).length;

  return {
    pageNumber,
    activeBackend:
      frame?.dataset.knexPdfActiveBackend ??
      firstTile?.dataset.knexPdfActiveBackend ??
      "unknown",
    preferredBackend:
      frame?.dataset.knexPdfPreferredBackend ??
      firstTile?.dataset.knexPdfPreferredBackend ??
      "unknown",
    backendVersion:
      frame?.dataset.knexPdfBackendVersion ??
      firstTile?.dataset.knexPdfBackendVersion ??
      "",
    renderMode: frame?.dataset.knexPdfVisualRenderMode ?? "",
    tileRenderMode: frame?.dataset.knexPdfEffectiveVisualRenderMode ?? "",
    tileRows: toNumber(
      frame?.dataset.knexPdfTileRows ?? firstTile?.dataset.knexPdfTileRows,
    ),
    tileColumns: toNumber(
      frame?.dataset.knexPdfTileColumns ??
        firstTile?.dataset.knexPdfTileColumns,
    ),
    totalTiles: tiles.length,
    outputScale: toNumber(
      frame?.dataset.knexPdfOutputScale ?? firstTile?.dataset.knexPdfOutputScale,
    ),
    finalRenderVersion:
      frame?.dataset.knexPdfFinalRenderVersion ??
      firstTile?.dataset.knexPdfFinalRenderVersion ??
      "",
    generationId:
      frame?.dataset.knexPdfGenerationId ??
      frame?.dataset.knexPdfActiveTileLayerId ??
      generationIds[0] ??
      "",
    renderedTileCount: tiles.filter(
      (tile) => tile.dataset.knexPdfTileStatus === "ready",
    ).length,
    duplicatedTileCells: getDuplicateTileCells(tiles).length,
    visibleGenerationIds: generationIds,
    cacheHitCount,
    cacheMissCount,
  };
}

function createRuntimeSummary(): KnexReadRuntimePageTrace[] {
  return [...groupVisibleTilesByPage().entries()]
    .sort(([a], [b]) => a - b)
    .map(([pageNumber, tiles]) => createRuntimePageTrace(pageNumber, tiles));
}

function highlightPage(pageNumber: number) {
  for (const tile of getTileElements()) {
    const isTargetPage =
      Number(tile.dataset.knexPdfPageNumber ?? "") === pageNumber &&
      isTileVisiblyMounted(tile);
    tile.style.outline = isTargetPage ? "1px solid rgb(244 63 94)" : "";
  }
}

export function TileRenderDiagnostics({
  visualRenderMode,
}: TileRenderDiagnosticsProps) {
  useEffect(() => {
    window.knexReadDebugTiles = () => {
      return {
        visualRenderMode,
        tiles: getDebugTileEntries(),
        visibleTiles: getDebugTileEntries({ visibleOnly: true }),
      };
    };
    window.__KNEX_PAGE_TILE_COUNT_AUDIT__ = {
      get summary() {
        return createTileAuditSummary();
      },
      detail: (pageNumber: number) =>
        getDebugTileEntries({ visibleOnly: true }).filter(
          (tile) => Number(tile.pageNumber) === pageNumber,
        ),
      all: (pageNumber: number) =>
        getDebugTileEntries().filter(
          (tile) => Number(tile.pageNumber) === pageNumber,
        ),
      highlightPage,
    };
    window.__KNEX_PDF_RUNTIME_TRACE__ = {
      summary: createRuntimeSummary,
      page: (pageNumber: number) =>
        createRuntimeSummary().find((page) => page.pageNumber === pageNumber) ??
        null,
      tiles: (pageNumber: number) =>
        getTileElements({ visibleOnly: true })
          .filter(
            (tile) => Number(tile.dataset.knexPdfPageNumber ?? "") === pageNumber,
          )
          .map(readRuntimeTileTrace),
      duplicates: () => getDuplicateTileCells(getTileElements({ visibleOnly: true })),
      highlight: highlightPage,
    };

    return () => {
      delete window.knexReadDebugTiles;
      delete window.__KNEX_PAGE_TILE_COUNT_AUDIT__;
      delete window.__KNEX_PDF_RUNTIME_TRACE__;
    };
  }, [visualRenderMode]);

  return null;
}
