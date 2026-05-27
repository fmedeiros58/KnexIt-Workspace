"use client";

import { useMemo } from "react";
import type { NativePdfSession } from "../../services";
import type {
  KnexPdfPageGeometry,
  KnexPdfPageTile,
  KnexPdfRenderPhase,
  KnexPdfTilePriority,
} from "../../knex-pdf-engine";
import { PdfTileCanvas } from "./PdfTileCanvas";

const TILE_PRIORITY_WEIGHT: Record<KnexPdfTilePriority, number> = {
  visible: 30,
  nearby: 15,
  background: 0,
};

function getTilePriority(input: {
  tile: KnexPdfPageTile;
  pagePriority: number;
  isActivePage: boolean;
}) {
  const activeBoost = input.isActivePage ? 20 : 0;

  return (
    input.pagePriority +
    activeBoost +
    (TILE_PRIORITY_WEIGHT[input.tile.priority] ?? 0)
  );
}

export type PdfTileLayerProps = {
  documentId: string;
  pdfFileId?: string;
  session: NativePdfSession;
  geometry: KnexPdfPageGeometry;
  tiles: KnexPdfPageTile[];
  renderQuality: string;
  renderPhase: KnexPdfRenderPhase;
  renderText: boolean;
  tileRenderMode: "server-tiled" | "tiled-canvas" | "page-canvas";
  pagePriority: number;
  isActivePage: boolean;
  backendVersion: number;
  finalRenderVersion: number;
  generationId: string;
  onTileReady?: (tileId: string, generationId: string) => void;
};

export function PdfTileLayer({
  documentId,
  pdfFileId,
  session,
  geometry,
  tiles,
  renderQuality,
  renderPhase,
  renderText,
  tileRenderMode,
  pagePriority,
  isActivePage,
  backendVersion,
  finalRenderVersion,
  generationId,
  onTileReady,
}: PdfTileLayerProps) {
  const orderedTiles = useMemo(
    () =>
      [...tiles].sort((a, b) => {
        const priorityDelta =
          getTilePriority({ tile: b, pagePriority, isActivePage }) -
          getTilePriority({ tile: a, pagePriority, isActivePage });
        if (priorityDelta !== 0) return priorityDelta;
        if (a.row !== b.row) return a.row - b.row;
        return a.column - b.column;
      }),
    [isActivePage, pagePriority, tiles],
  );

  return (
    <div
      className="absolute inset-0"
      data-knex-pdf-tile-layer="true"
      data-knex-pdf-page-number={geometry.pageNumber}
      data-knex-pdf-tile-count={orderedTiles.length}
      data-knex-pdf-tile-generation-id={generationId}
      style={{
        width: `${geometry.cssWidth}px`,
        height: `${geometry.cssHeight}px`,
      }}
    >
      {orderedTiles.map((tile) => (
        <PdfTileCanvas
          key={`${generationId}:${tile.row}:${tile.column}`}
          documentId={documentId}
          pdfFileId={pdfFileId}
          session={session}
          geometry={geometry}
          tile={tile}
          renderQuality={renderQuality}
          renderPhase={renderPhase}
          renderText={renderText}
          tileRenderMode={tileRenderMode}
          priority={getTilePriority({ tile, pagePriority, isActivePage })}
          backendVersion={backendVersion}
          finalRenderVersion={finalRenderVersion}
          generationId={generationId}
          onTileReady={onTileReady}
        />
      ))}
    </div>
  );
}
