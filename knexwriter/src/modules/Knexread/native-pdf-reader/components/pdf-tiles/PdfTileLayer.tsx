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
  tileRenderMode: "server-tiled" | "tiled-canvas";
  pagePriority: number;
  isActivePage: boolean;
  backendVersion: number;
  finalRenderVersion: number;
  renderVersion: number;
  generationId: string;
  activeBackend: string;
  preferredBackend: string;
  tileRows: number;
  tileColumns: number;
  layerSurface: "active" | "pending";
  layerVisible: boolean;
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
  renderVersion,
  generationId,
  activeBackend,
  preferredBackend,
  tileRows,
  tileColumns,
  layerSurface,
  layerVisible,
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

  /*
   * Importante:
   * O PdfTiledPageCanvas pode manter uma camada ativa e uma pending montadas
   * simultaneamente para permitir promoção sem flash. Antes, a camada invisível
   * ficava apenas com opacity: 0 no contêiner pai, mas os canvases ainda eram
   * detectados como "visíveis" por auditorias e podiam contribuir para efeitos
   * visuais em cenários de z-index/stacking.
   *
   * Aqui a própria layer declara visibility:hidden quando não é a camada
   * visível. Isso mantém os filhos montados para finalizar render/cache, mas
   * impede participação visual da geração antiga/pendente.
   */
  const renderSource = tileRenderMode === "server-tiled" ? "server" : "pdfjs";

  return (
    <div
      className="absolute inset-0"
      aria-hidden={layerVisible ? "false" : "true"}
      data-knex-pdf-tile-layer="true"
      data-knex-pdf-page-number={geometry.pageNumber}
      data-knex-pdf-tile-count={orderedTiles.length}
      data-knex-pdf-tile-generation-id={generationId}
      data-knex-pdf-generation-id={generationId}
      data-knex-pdf-active-backend={activeBackend}
      data-knex-pdf-preferred-backend={preferredBackend}
      data-knex-pdf-backend-version={backendVersion}
      data-knex-pdf-render-version={renderVersion}
      data-knex-pdf-final-render-version={finalRenderVersion}
      data-knex-pdf-tile-rows={tileRows}
      data-knex-pdf-tile-columns={tileColumns}
      data-knex-pdf-layer-surface={layerSurface}
      data-knex-pdf-layer-visible={layerVisible ? "true" : "false"}
      data-knex-pdf-tile-render-mode={tileRenderMode}
      data-knex-pdf-render-source={renderSource}
      style={{
        width: `${geometry.cssWidth}px`,
        height: `${geometry.cssHeight}px`,
        visibility: layerVisible ? "visible" : "hidden",
        pointerEvents: "none",
        contain: "layout paint style",
      }}
    >
      {orderedTiles.map((tile) => (
        <PdfTileCanvas
          key={`${generationId}:${tileRenderMode}:${tile.row}:${tile.column}`}
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
          renderVersion={renderVersion}
          generationId={generationId}
          activeBackend={activeBackend}
          preferredBackend={preferredBackend}
          tileRows={tileRows}
          tileColumns={tileColumns}
          layerSurface={layerSurface}
          layerVisible={layerVisible}
          onTileReady={onTileReady}
        />
      ))}
    </div>
  );
}
