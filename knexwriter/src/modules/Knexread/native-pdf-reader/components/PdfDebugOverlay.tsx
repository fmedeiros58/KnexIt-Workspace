"use client";

import {
  buildKnexPdfTileRenderPlan,
  type KnexPdfRenderedPage as RenderedPdfPage,
} from "../knex-pdf-engine";
import type { PdfCanvasTextRenderState } from "./PdfPageCanvas";

function formatNumber(value: number | null | undefined, digits = 2): string {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(digits)
    : "-";
}

function formatBytes(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    return "-";
  }

  if (value >= 1024 * 1024) {
    return `${(value / 1024 / 1024).toFixed(1)} MB`;
  }

  return `${Math.round(value / 1024)} KB`;
}

export function PdfDebugOverlay({
  pageNumber,
  renderedPage,
  canvasState,
  textBlockCount,
  annotationCount,
  highlightCount,
}: {
  pageNumber: number;
  renderedPage: RenderedPdfPage | null;
  canvasState: PdfCanvasTextRenderState | null;
  textBlockCount: number;
  annotationCount: number;
  highlightCount: number;
}) {
  const geometry = renderedPage?.geometry;
  const cssWidth = geometry?.cssWidth ?? renderedPage?.cssWidth;
  const cssHeight = geometry?.cssHeight ?? renderedPage?.cssHeight;
  const bitmapWidth = geometry?.bitmapWidth ?? renderedPage?.width;
  const bitmapHeight = geometry?.bitmapHeight ?? renderedPage?.height;
  const outputScale =
    geometry?.outputScale ?? canvasState?.outputScale ?? renderedPage?.outputScale;
  const zoom = geometry?.zoom ?? renderedPage?.renderScale;
  const dpr = geometry?.devicePixelRatio ?? renderedPage?.devicePixelRatio;
  const tilePlan = geometry
    ? buildKnexPdfTileRenderPlan({ geometry })
    : null;

  return (
    <div
      className="pointer-events-none absolute left-2 top-2 z-[80] max-w-[360px] rounded border border-zinc-900/20 bg-zinc-950/85 px-2 py-1 font-mono text-[10px] leading-snug text-zinc-50 shadow-lg"
      data-knexread-page-debug-overlay="true"
    >
      <div>page {pageNumber}</div>
      <div>backend {canvasState?.backend ?? "-"}</div>
      <div>phase {canvasState?.renderPhase ?? "-"}</div>
      <div>css {formatNumber(cssWidth, 0)} x {formatNumber(cssHeight, 0)}</div>
      <div>
        bitmap {formatNumber(bitmapWidth, 0)} x {formatNumber(bitmapHeight, 0)}
      </div>
      <div>zoom {formatNumber(zoom, 3)}</div>
      <div>dpr {formatNumber(dpr, 2)}</div>
      <div>output {formatNumber(outputScale, 3)}</div>
      <div>cache {canvasState?.cacheLookup ?? "-"}</div>
      <div>cache bytes {formatBytes(canvasState?.cacheBytes)}</div>
      <div>tiles {tilePlan ? `${tilePlan.reason}:${tilePlan.totalTiles}` : "-"}</div>
      <div>text blocks {textBlockCount}</div>
      <div>highlights {highlightCount}</div>
      <div>annotations {annotationCount}</div>
      <div className="truncate">render {canvasState?.renderIdentity ?? "-"}</div>
    </div>
  );
}
