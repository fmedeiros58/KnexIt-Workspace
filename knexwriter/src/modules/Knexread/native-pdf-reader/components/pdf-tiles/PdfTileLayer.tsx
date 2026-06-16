"use client";

import { useEffect, useMemo, useState } from "react";
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

/**
 * Política de montagem progressiva de tiles.
 *
 * O ponto crítico aqui é memória: o PdfTiledPageCanvas pode manter uma camada
 * ativa e uma camada pending montadas ao mesmo tempo para evitar piscada.
 * Se o PdfTileLayer montar todos os canvases de todos os tiles imediatamente,
 * a memória pode explodir em zoom alto, mesmo com o zoom global limitado.
 *
 * Esta política mantém a qualidade final, mas evita o pico abrupto:
 * - tiles mais importantes entram primeiro;
 * - pending invisível renderiza em ritmo mais lento;
 * - zoom alto usa lotes menores;
 * - todos os tiles continuam sendo renderizados ao final, apenas sem rajada.
 */
const VISIBLE_LAYER_BASE_INITIAL_TILE_BUDGET = 24;
const VISIBLE_LAYER_BASE_TILE_CHUNK_SIZE = 16;
const HIDDEN_PENDING_BASE_INITIAL_TILE_BUDGET = 8;
const HIDDEN_PENDING_BASE_TILE_CHUNK_SIZE = 6;

type TileMountPolicy = {
  initialBudget: number;
  chunkSize: number;
  delayMs: number;
};

function clampTileBudget(value: number, tileCount: number): number {
  return Math.max(0, Math.min(Math.max(0, tileCount), Math.ceil(value)));
}

function resolveTileLayerMountPolicy(input: {
  tileCount: number;
  zoom: number;
  layerSurface: "active" | "pending";
  layerVisible: boolean;
  interactionActive?: boolean;
  suspendMountingDuringInteraction?: boolean;
}): TileMountPolicy {
  const tileCount = Math.max(0, input.tileCount);
  const zoom = Math.max(0.01, input.zoom);
  const isHiddenPending =
    input.layerSurface === "pending" && !input.layerVisible;
  const shouldSuspendDuringInteraction =
    input.interactionActive && input.suspendMountingDuringInteraction;

  if (tileCount <= 0) {
    return {
      initialBudget: 0,
      chunkSize: 0,
      delayMs: 0,
    };
  }

  if (shouldSuspendDuringInteraction && isHiddenPending) {
    /*
     * Pending invisível durante scroll/zoom não deve montar novos canvases.
     * A camada ativa já está visível e deve apenas deslizar pelo palco.
     */
    return {
      initialBudget: 0,
      chunkSize: 0,
      delayMs: 0,
    };
  }

  if (shouldSuspendDuringInteraction && input.layerVisible) {
    /*
     * Camada visível durante interação:
     * montamos um orçamento inicial um pouco maior, mas suspendemos chunks
     * temporizados. Isso evita que novos canvases apareçam em rajadas durante
     * o scroll, que era percebido como renderização saltada.
     */
    if (zoom >= 16) {
      return {
        initialBudget: clampTileBudget(12, tileCount),
        chunkSize: 0,
        delayMs: 0,
      };
    }

    if (zoom >= 12) {
      return {
        initialBudget: clampTileBudget(14, tileCount),
        chunkSize: 0,
        delayMs: 0,
      };
    }

    if (zoom >= 8) {
      return {
        initialBudget: clampTileBudget(18, tileCount),
        chunkSize: 0,
        delayMs: 0,
      };
    }

    if (zoom >= 4) {
      return {
        initialBudget: clampTileBudget(26, tileCount),
        chunkSize: 0,
        delayMs: 0,
      };
    }

    return {
      initialBudget: clampTileBudget(36, tileCount),
      chunkSize: 0,
      delayMs: 0,
    };
  }

  if (isHiddenPending) {
    /*
     * Política anti-estouro:
     *
     * Em zoom alto, uma pendingLayer invisível é o maior risco de pico de
     * memória, porque ela duplica canvases enquanto a activeLayer ainda está
     * montada. A partir de 800%, não montamos tiles invisíveis; a nova geração
     * deve ser preparada somente depois que virar camada ativa/promovida.
     */
    if (zoom >= 8) {
      return {
        initialBudget: 0,
        chunkSize: 0,
        delayMs: 0,
      };
    }

    if (zoom >= 4) {
      return {
        initialBudget: clampTileBudget(2, tileCount),
        chunkSize: clampTileBudget(2, tileCount),
        delayMs: 120,
      };
    }

    return {
      initialBudget: clampTileBudget(
        Math.min(4, HIDDEN_PENDING_BASE_INITIAL_TILE_BUDGET),
        tileCount,
      ),
      chunkSize: clampTileBudget(
        Math.min(3, HIDDEN_PENDING_BASE_TILE_CHUNK_SIZE),
        tileCount,
      ),
      delayMs: 80,
    };
  }

  /*
   * Camada visível em zoom alto também deve montar poucos tiles por lote.
   * A qualidade final continua a mesma; apenas evitamos rajadas de canvases.
   */
  if (zoom >= 16) {
    return {
      initialBudget: clampTileBudget(4, tileCount),
      chunkSize: clampTileBudget(3, tileCount),
      delayMs: 64,
    };
  }

  if (zoom >= 12) {
    return {
      initialBudget: clampTileBudget(5, tileCount),
      chunkSize: clampTileBudget(4, tileCount),
      delayMs: 56,
    };
  }

  if (zoom >= 8) {
    return {
      initialBudget: clampTileBudget(6, tileCount),
      chunkSize: clampTileBudget(4, tileCount),
      delayMs: 48,
    };
  }

  if (zoom >= 4) {
    return {
      initialBudget: clampTileBudget(10, tileCount),
      chunkSize: clampTileBudget(6, tileCount),
      delayMs: 36,
    };
  }

  return {
    initialBudget: clampTileBudget(
      VISIBLE_LAYER_BASE_INITIAL_TILE_BUDGET,
      tileCount,
    ),
    chunkSize: clampTileBudget(VISIBLE_LAYER_BASE_TILE_CHUNK_SIZE, tileCount),
    delayMs: 12,
  };
}

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

  /**
   * Sinal de scroll/zoom ativo vindo do PdfTiledPageCanvas.
   */
  interactionActive?: boolean;

  /**
   * Quando true, suspende montagem progressiva de novos tiles durante interação.
   */
  suspendMountingDuringInteraction?: boolean;
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
  interactionActive = false,
  suspendMountingDuringInteraction = true,
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

  const mountPolicy = useMemo(
    () =>
      resolveTileLayerMountPolicy({
        tileCount: orderedTiles.length,
        zoom: geometry.zoom,
        layerSurface,
        layerVisible,
        interactionActive,
        suspendMountingDuringInteraction,
      }),
    [
      geometry.zoom,
      interactionActive,
      layerSurface,
      layerVisible,
      orderedTiles.length,
      suspendMountingDuringInteraction,
    ],
  );

  const [mountedTileCount, setMountedTileCount] = useState(() =>
    mountPolicy.initialBudget,
  );

  useEffect(() => {
    setMountedTileCount((current) => {
      /*
       * Durante interação, nunca reduzir tiles já montados. Reduzir contagem
       * desmontaria canvases e causaria salto visual enquanto o palco rola.
       */
      if (interactionActive) {
        return Math.max(current, mountPolicy.initialBudget);
      }

      return mountPolicy.initialBudget;
    });
  }, [generationId, interactionActive, mountPolicy.initialBudget]);

  useEffect(() => {
    if (interactionActive && suspendMountingDuringInteraction) return;
    if (mountedTileCount >= orderedTiles.length) return;
    if (mountPolicy.chunkSize <= 0) return;

    const timerId = window.setTimeout(() => {
      setMountedTileCount((current) =>
        Math.min(orderedTiles.length, current + mountPolicy.chunkSize),
      );
    }, mountPolicy.delayMs);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [
    interactionActive,
    mountedTileCount,
    mountPolicy.chunkSize,
    mountPolicy.delayMs,
    orderedTiles.length,
    suspendMountingDuringInteraction,
  ]);

  const mountedTiles = useMemo(
    () => orderedTiles.slice(0, mountedTileCount),
    [mountedTileCount, orderedTiles],
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
      data-knex-pdf-mounted-tile-count={mountedTiles.length}
      data-knex-pdf-tile-mount-initial-budget={mountPolicy.initialBudget}
      data-knex-pdf-tile-mount-chunk-size={mountPolicy.chunkSize}
      data-knex-pdf-tile-mount-delay-ms={mountPolicy.delayMs}
      data-knex-pdf-tile-mount-suspended={
        mountPolicy.initialBudget === 0 && mountPolicy.chunkSize === 0
          ? "true"
          : "false"
      }
      data-knex-pdf-tile-layer-interaction-active={
        interactionActive ? "true" : "false"
      }
      data-knex-pdf-tile-layer-suspend-during-interaction={
        suspendMountingDuringInteraction ? "true" : "false"
      }
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
      {mountedTiles.map((tile) => (
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
          interactionActive={interactionActive}
          suspendRenderDuringInteraction={suspendMountingDuringInteraction}
        />
      ))}
    </div>
  );
}
