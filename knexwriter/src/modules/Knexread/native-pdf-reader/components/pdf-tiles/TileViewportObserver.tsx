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
   * Limite defensivo para o snapshot.
   *
   * Mesmo se muitos tiles cruzarem a margem do observer, o snapshot publicado
   * fica limitado aos tiles mais próximos do centro do viewport.
   */
  maxVisibleTileIds?: number;

  onSnapshot?: (snapshot: TileViewportSnapshot) => void;
};

const TILE_SELECTOR =
  '[data-knex-pdf-tile="true"][data-knex-pdf-layer-visible="true"]';

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
  maxVisibleTileIds = 32,
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
    let observeFrameId = 0;

    const clearPublishFrame = () => {
      if (!publishFrameId) return;
      window.cancelAnimationFrame(publishFrameId);
      publishFrameId = 0;
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
      if (publishFrameId) return;
      publishFrameId = window.requestAnimationFrame(publishSnapshotNow);
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
            tile.setAttribute("data-knex-pdf-tile-viewport-visible", "false");
            continue;
          }

          if (entry.isIntersecting) {
            visibleTileIds.add(tileId);
            tile.setAttribute("data-knex-pdf-tile-viewport-visible", "true");
          } else {
            visibleTileIds.delete(tileId);
            tile.setAttribute("data-knex-pdf-tile-viewport-visible", "false");
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

          tile.setAttribute("data-knex-pdf-tile-viewport-visible", "false");
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
      attributes: true,
      attributeFilter: [
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
        tile.setAttribute("data-knex-pdf-tile-viewport-visible", "false");
      }

      observedTiles.clear();
      visibleTileIds.clear();
    };
  }, [
    containerRef,
    enabled,
    maxVisibleTileIds,
    onSnapshot,
    pageNumber,
    rootMargin,
    rootRef,
    zoomPercent,
  ]);

  return null;
}
