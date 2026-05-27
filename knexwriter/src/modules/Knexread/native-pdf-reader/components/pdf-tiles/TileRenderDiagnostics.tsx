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
  backend: string;
  renderPhase: string;
  outputScale: string;
  dpi: string;
  renderDurationMs: string;
  storageHit: string;
  viewportVisible: string;
};

declare global {
  interface Window {
    knexReadDebugTiles?: () => {
      visualRenderMode: string;
      tiles: KnexReadDebugTileEntry[];
    };
  }
}

export type TileRenderDiagnosticsProps = {
  visualRenderMode: KnexPdfVisualRenderMode;
};

export function TileRenderDiagnostics({
  visualRenderMode,
}: TileRenderDiagnosticsProps) {
  useEffect(() => {
    window.knexReadDebugTiles = () => {
      const tiles = [
        ...document.querySelectorAll<HTMLElement>(
          '[data-knex-pdf-tile="true"]',
        ),
      ].map((tile) => ({
        pageNumber: tile.dataset.knexPdfPageNumber ?? "",
        tileId: tile.dataset.knexPdfTileId ?? "",
        row: tile.dataset.knexPdfTileRow ?? "",
        column: tile.dataset.knexPdfTileColumn ?? "",
        status: tile.dataset.knexPdfTileStatus ?? "",
        cache: tile.dataset.knexPdfTileCache ?? "",
        backend: tile.dataset.knexPdfBackend ?? "",
        renderPhase: tile.dataset.knexPdfRenderPhase ?? "",
        outputScale: tile.dataset.knexPdfOutputScale ?? "",
        dpi: tile.dataset.knexPdfDpi ?? "",
        renderDurationMs: tile.dataset.knexPdfTileRenderDurationMs ?? "",
        storageHit: tile.dataset.knexPdfStorageHit ?? "",
        viewportVisible: tile.dataset.knexPdfTileViewportVisible ?? "",
      }));

      return {
        visualRenderMode,
        tiles,
      };
    };

    return () => {
      delete window.knexReadDebugTiles;
    };
  }, [visualRenderMode]);

  return null;
}
