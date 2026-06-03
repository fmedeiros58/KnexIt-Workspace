"use client";

import { useEffect, type RefObject } from "react";

export type TileViewportSnapshot = {
  pageNumber: number;
  visibleTileIds: string[];
  centralTileId: string | null;
};

export type TileViewportObserverProps = {
  /**
   * Container da página/layer onde os tiles existem.
   */
  containerRef: RefObject<HTMLElement | null>;

  /**
   * Root real de rolagem do leitor.
   *
   * Se não for informado, o observer tenta localizar o ancestral com overflow.
   * Evitar root:null é importante, porque root:null usa a janela do navegador,
   * não o palco interno do Knexread.
   */
  rootRef?: RefObject<HTMLElement | null>;

  pageNumber: number;

  /**
   * Zoom atual em percentual.
   *
   * Usado para reduzir rootMargin em zoom alto e evitar que muitos tiles sejam
   * considerados "próximos/visíveis" ao mesmo tempo.
   */
  zoomPercent?: number;

  /**
   * Se informado, sobrescreve a margem adaptativa.
   */
  rootMargin?: string;

  /**
   * Suspende o observer sem desmontar o componente.
   */
  enabled?: boolean;

  /**
   * Sinaliza que o palco está em scroll/zoom ativo.
   *
   * Durante interação, o observer reduz publicação de snapshot e evita escrita
   * frequente de atributos no DOM. Isso impede que o observer concorra com a
   * fluidez do palco.
   */
  interactionActive?: boolean;

  /**
   * Limite defensivo para o snapshot.
   *
   * Mesmo se muitos tiles cruzarem a margem do observer, o snapshot publicado
   * fica limitado aos tiles mais próximos do centro do viewport.
   */
  maxVisibleTileIds?: number;

  /**
   * Intervalos de publicação do snapshot.
   *
   * Snapshot de tile é útil para diagnóstico/prioridade, mas não deve atualizar
   * estado React em todo micro-scroll.
   */
  publishThrottleMs?: number;
  interactionPublishThrottleMs?: number;

  /**
   * Escreve data-knex-pdf-tile-viewport-visible nos tiles.
   *
   * Desativado por padrão porque escrita de atributo durante scroll pode
   * invalidar estilo/paint e gerar sensação de renderização em fragmentos.
   */
  writeViewportAttributes?: boolean;

  onSnapshot?: (snapshot: TileViewportSnapshot) => void;
};

const TILE_SELECTOR =
  '[data-knex-pdf-tile="true"][data-knex-pdf-layer-visible="true"]';

const DEFAULT_MAX_VISIBLE_TILE_IDS = 12;
const DEFAULT_SNAPSHOT_PUBLISH_THROTTLE_MS = 96;
const DEFAULT_INTERACTION_SNAPSHOT_PUBLISH_THROTTLE_MS = 260;

function getNowMs(): number {
  return typeof performance !== "undefined" &&
    typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

function setTileViewportVisibleAttribute(
  tile: Element,
  value: boolean,
  enabled: boolean,
) {
  if (!enabled) return;

  const next = value ? "true" : "false";

  if (tile.getAttribute("data-knex-pdf-tile-viewport-visible") === next) {
    return;
  }

  tile.setAttribute("data-knex-pdf-tile-viewport-visible", next);
}

function resolveAdaptiveRootMargin(input: {
  rootMargin?: string;
  zoomPercent?: number;
}): string {
  if (input.rootMargin) return input.rootMargin;

  const zoomPercent =
    typeof input.zoomPercent === "number" && Number.isFinite(input.zoomPercent)
      ? input.zoomPercent
      : 100;

  /*
   * A margem antiga de 1200px era boa para zoom baixo, mas perigosa em zoom
   * alto: muitos tiles entravam como candidatos ao mesmo tempo.
   */
  if (zoomPercent >= 1600) return "96px 0px 96px 0px";
  if (zoomPercent >= 1200) return "140px 0px 140px 0px";
  if (zoomPercent >= 800) return "220px 0px 220px 0px";
  if (zoomPercent >= 400) return "480px 0px 480px 0px";

  return "900px 0px 900px 0px";
}

function isScrollableElement(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  const overflowY = style.overflowY;
  const overflowX = style.overflowX;

  return (
    /(auto|scroll|overlay)/.test(overflowY) ||
    /(auto|scroll|overlay)/.test(overflowX)
  );
}

function findNearestScrollRoot(container: HTMLElement): HTMLElement | null {
  let current: HTMLElement | null = container.parentElement;

  while (current) {
    if (isScrollableElement(current)) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
}

function getViewportRect(root: HTMLElement | null): DOMRect {
  if (root) return root.getBoundingClientRect();

  return {
    left: 0,
    top: 0,
    right: window.innerWidth,
    bottom: window.innerHeight,
    width: window.innerWidth,
    height: window.innerHeight,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  } as DOMRect;
}

function getTileCenterDistance(input: {
  tile: Element;
  root: HTMLElement | null;
}): number {
  const rect = input.tile.getBoundingClientRect();
  const viewportRect = getViewportRect(input.root);
  const viewportCenterX = viewportRect.left + viewportRect.width / 2;
  const viewportCenterY = viewportRect.top + viewportRect.height / 2;
  const tileCenterX = rect.left + rect.width / 2;
  const tileCenterY = rect.top + rect.height / 2;
  const dx = tileCenterX - viewportCenterX;
  const dy = tileCenterY - viewportCenterY;

  return Math.sqrt(dx * dx + dy * dy);
}

function getVisibleTileCandidates(input: {
  container: HTMLElement;
  root: HTMLElement | null;
  visibleTileIds: Set<string>;
  maxVisibleTileIds: number;
}): Element[] {
  const candidates = [...input.visibleTileIds]
    .map((tileId) =>
      input.container.querySelector(
        `[data-knex-pdf-tile-id="${CSS.escape(tileId)}"][data-knex-pdf-layer-visible="true"]`,
      ),
    )
    .filter((tile): tile is Element => Boolean(tile));

  candidates.sort(
    (a, b) =>
      getTileCenterDistance({ tile: a, root: input.root }) -
      getTileCenterDistance({ tile: b, root: input.root }),
  );

  return candidates.slice(0, input.maxVisibleTileIds);
}

export function TileViewportObserver({
  containerRef,
  rootRef,
  pageNumber,
  zoomPercent = 100,
  rootMargin,
  enabled = true,
  interactionActive = false,
  maxVisibleTileIds = DEFAULT_MAX_VISIBLE_TILE_IDS,
  publishThrottleMs = DEFAULT_SNAPSHOT_PUBLISH_THROTTLE_MS,
  interactionPublishThrottleMs = DEFAULT_INTERACTION_SNAPSHOT_PUBLISH_THROTTLE_MS,
  writeViewportAttributes = false,
  onSnapshot,
}: TileViewportObserverProps) {
  useEffect(() => {
    const container = containerRef.current;

    if (
      !enabled ||
      !container ||
      typeof IntersectionObserver === "undefined" ||
      typeof MutationObserver === "undefined"
    ) {
      return;
    }

    const root = rootRef?.current ?? findNearestScrollRoot(container);
    const resolvedRootMargin = resolveAdaptiveRootMargin({
      rootMargin,
      zoomPercent,
    });
    const safeMaxVisibleTileIds = Math.max(1, Math.trunc(maxVisibleTileIds));
    const visibleTileIds = new Set<string>();
    let observedTiles = new Set<Element>();
    let publishFrameId = 0;
    let publishTimerId = 0;
    let observeFrameId = 0;
    let lastPublishAt = 0;

    const clearPublishFrame = () => {
      if (publishFrameId) {
        window.cancelAnimationFrame(publishFrameId);
        publishFrameId = 0;
      }

      if (publishTimerId) {
        window.clearTimeout(publishTimerId);
        publishTimerId = 0;
      }
    };

    const clearObserveFrame = () => {
      if (!observeFrameId) return;
      window.cancelAnimationFrame(observeFrameId);
      observeFrameId = 0;
    };

    const publishSnapshotNow = () => {
      publishFrameId = 0;

      const visibleTiles = getVisibleTileCandidates({
        container,
        root,
        visibleTileIds,
        maxVisibleTileIds: safeMaxVisibleTileIds,
      });
      const centralTile = visibleTiles[0] ?? null;

      onSnapshot?.({
        pageNumber,
        visibleTileIds: visibleTiles
          .map((tile) => tile.getAttribute("data-knex-pdf-tile-id"))
          .filter((tileId): tileId is string => Boolean(tileId)),
        centralTileId:
          centralTile?.getAttribute("data-knex-pdf-tile-id") ?? null,
      });
    };

    const schedulePublishSnapshot = () => {
      if (publishFrameId || publishTimerId) return;

      const throttleMs = Math.max(
        0,
        interactionActive ? interactionPublishThrottleMs : publishThrottleMs,
      );
      const now = getNowMs();
      const elapsed = now - lastPublishAt;

      const requestPublish = () => {
        publishTimerId = 0;
        publishFrameId = window.requestAnimationFrame(() => {
          lastPublishAt = getNowMs();
          publishSnapshotNow();
        });
      };

      if (elapsed >= throttleMs) {
        requestPublish();
        return;
      }

      publishTimerId = window.setTimeout(
        requestPublish,
        Math.max(0, throttleMs - elapsed),
      );
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const tile = entry.target;
          const tileId = tile.getAttribute("data-knex-pdf-tile-id");
          const isLayerVisible =
            tile.getAttribute("data-knex-pdf-layer-visible") === "true";

          if (!tileId || !isLayerVisible) {
            if (tileId) visibleTileIds.delete(tileId);
            setTileViewportVisibleAttribute(
              tile,
              false,
              writeViewportAttributes,
            );
            continue;
          }

          if (entry.isIntersecting) {
            visibleTileIds.add(tileId);
            setTileViewportVisibleAttribute(
              tile,
              true,
              writeViewportAttributes,
            );
          } else {
            visibleTileIds.delete(tileId);
            setTileViewportVisibleAttribute(
              tile,
              false,
              writeViewportAttributes,
            );
          }
        }

        schedulePublishSnapshot();
      },
      {
        root,
        rootMargin: resolvedRootMargin,
        threshold: [0, 0.01],
      },
    );

    const observeTilesNow = () => {
      observeFrameId = 0;

      const nextTiles = new Set<Element>(
        container.querySelectorAll(TILE_SELECTOR),
      );

      for (const tile of observedTiles) {
        if (!nextTiles.has(tile)) {
          observer.unobserve(tile);

          const tileId = tile.getAttribute("data-knex-pdf-tile-id");
          if (tileId) visibleTileIds.delete(tileId);

          setTileViewportVisibleAttribute(
            tile,
            false,
            writeViewportAttributes,
          );
        }
      }

      for (const tile of nextTiles) {
        if (!observedTiles.has(tile)) {
          observer.observe(tile);
        }
      }

      observedTiles = nextTiles;
      schedulePublishSnapshot();
    };

    const scheduleObserveTiles = () => {
      if (observeFrameId) return;
      observeFrameId = window.requestAnimationFrame(observeTilesNow);
    };

    observeTilesNow();

    const mutationObserver = new MutationObserver(scheduleObserveTiles);
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
      /*
       * Durante interação, evitar observer de atributos. Mudanças de atributo
       * em muitos tiles podem disparar nova varredura enquanto a tela rola.
       */
      attributes: !interactionActive,
      attributeFilter: interactionActive
        ? undefined
        : [
            "data-knex-pdf-layer-visible",
            "data-knex-pdf-tile",
            "data-knex-pdf-tile-id",
          ],
    });

    return () => {
      clearPublishFrame();
      clearObserveFrame();
      mutationObserver.disconnect();
      observer.disconnect();

      for (const tile of observedTiles) {
        setTileViewportVisibleAttribute(
          tile,
          false,
          writeViewportAttributes,
        );
      }

      observedTiles.clear();
      visibleTileIds.clear();
    };
  }, [
    containerRef,
    enabled,
    interactionActive,
    interactionPublishThrottleMs,
    maxVisibleTileIds,
    onSnapshot,
    pageNumber,
    publishThrottleMs,
    rootMargin,
    rootRef,
    writeViewportAttributes,
    zoomPercent,
  ]);

  return null;
}
