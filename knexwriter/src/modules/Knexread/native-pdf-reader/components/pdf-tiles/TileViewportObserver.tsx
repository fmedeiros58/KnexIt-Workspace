"use client";

import { useEffect, type RefObject } from "react";

export type TileViewportSnapshot = {
  pageNumber: number;
  visibleTileIds: string[];
  centralTileId: string | null;
};

export type TileViewportObserverProps = {
  containerRef: RefObject<HTMLElement | null>;
  pageNumber: number;
  rootMargin?: string;
  onSnapshot?: (snapshot: TileViewportSnapshot) => void;
};

function getTileCenterDistance(tile: Element): number {
  const rect = tile.getBoundingClientRect();
  const viewportCenterX = window.innerWidth / 2;
  const viewportCenterY = window.innerHeight / 2;
  const tileCenterX = rect.left + rect.width / 2;
  const tileCenterY = rect.top + rect.height / 2;
  const dx = tileCenterX - viewportCenterX;
  const dy = tileCenterY - viewportCenterY;

  return Math.sqrt(dx * dx + dy * dy);
}

export function TileViewportObserver({
  containerRef,
  pageNumber,
  rootMargin = "1200px 0px 1200px 0px",
  onSnapshot,
}: TileViewportObserverProps) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof IntersectionObserver === "undefined") return;

    const visibleTileIds = new Set<string>();
    let observedTiles = new Set<Element>();

    const publishSnapshot = () => {
      const visibleTiles = [...visibleTileIds]
        .map((tileId) =>
          container.querySelector(`[data-knex-pdf-tile-id="${tileId}"]`),
        )
        .filter((tile): tile is Element => Boolean(tile));
      const centralTile =
        visibleTiles.sort(
          (a, b) => getTileCenterDistance(a) - getTileCenterDistance(b),
        )[0] ?? null;

      onSnapshot?.({
        pageNumber,
        visibleTileIds: [...visibleTileIds],
        centralTileId:
          centralTile?.getAttribute("data-knex-pdf-tile-id") ?? null,
      });
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const tileId = entry.target.getAttribute("data-knex-pdf-tile-id");
          if (!tileId) continue;

          if (entry.isIntersecting) {
            visibleTileIds.add(tileId);
            entry.target.setAttribute(
              "data-knex-pdf-tile-viewport-visible",
              "true",
            );
          } else {
            visibleTileIds.delete(tileId);
            entry.target.setAttribute(
              "data-knex-pdf-tile-viewport-visible",
              "false",
            );
          }
        }

        publishSnapshot();
      },
      {
        root: null,
        rootMargin,
        threshold: [0, 0.01, 0.5, 1],
      },
    );

    const observeTiles = () => {
      const nextTiles = new Set(
        container.querySelectorAll('[data-knex-pdf-tile="true"]'),
      );

      for (const tile of observedTiles) {
        if (!nextTiles.has(tile)) {
          observer.unobserve(tile);
          const tileId = tile.getAttribute("data-knex-pdf-tile-id");
          if (tileId) visibleTileIds.delete(tileId);
        }
      }

      for (const tile of nextTiles) {
        if (!observedTiles.has(tile)) {
          observer.observe(tile);
        }
      }

      observedTiles = nextTiles;
      publishSnapshot();
    };

    observeTiles();

    const mutationObserver = new MutationObserver(observeTiles);
    mutationObserver.observe(container, {
      childList: true,
      subtree: true,
    });

    return () => {
      mutationObserver.disconnect();
      observer.disconnect();
    };
  }, [containerRef, onSnapshot, pageNumber, rootMargin]);

  return null;
}
