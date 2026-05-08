"use client";

import { type CSSProperties } from "react";

export type KnexWriterPageBreakLayerProps = {
  pageCount: number;
  pageWidthPx: number;
  pageHeightPx: number;
  pageGapPx: number;
  zoom: number;
  showPageBreaks?: boolean;
  label?: string;
  showLabel?: boolean;

  /**
   * Use "self" quando esta camada estiver fora de um container com scale.
   * Use "parent" quando esta camada estiver dentro de um container já escalado.
   */
  scaleMode?: "self" | "parent";

  /**
   * Deslocamento horizontal opcional da camada.
   */
  leftPx?: number;

  /**
   * Largura opcional da camada.
   * Se não informada, usa pageWidthPx.
   */
  widthPx?: number;

  className?: string;
  style?: CSSProperties;
};

function clampPositive(value: number, fallback = 0) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, value);
}

function clampZoom(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return 1;
  }

  return value;
}

function applyZoom(
  value: number,
  zoom: number,
  scaleMode: "self" | "parent",
) {
  if (scaleMode === "parent") {
    return value;
  }

  return value * zoom;
}

export function KnexWriterPageBreakLayer({
  pageCount,
  pageWidthPx,
  pageHeightPx,
  pageGapPx,
  zoom,
  showPageBreaks = true,
  label = "Quebra de página",
  showLabel = true,
  scaleMode = "self",
  leftPx = 0,
  widthPx,
  className = "",
  style,
}: KnexWriterPageBreakLayerProps) {
  const safePageCount = Math.max(1, Math.floor(pageCount));

  if (!showPageBreaks || safePageCount <= 1) {
    return null;
  }

  const safeZoom = clampZoom(zoom);
  const safePageWidthPx = Math.max(1, clampPositive(pageWidthPx, 1));
  const safePageHeightPx = Math.max(1, clampPositive(pageHeightPx, 1));
  const safePageGapPx = Math.max(0, clampPositive(pageGapPx, 0));
  const safeLeftPx = clampPositive(leftPx);

  const safeWidthPx = Math.max(
    1,
    clampPositive(widthPx ?? safePageWidthPx, safePageWidthPx),
  );

  const visualLeftPx = applyZoom(safeLeftPx, safeZoom, scaleMode);
  const visualWidthPx = applyZoom(safeWidthPx, safeZoom, scaleMode);
  const visualPageHeightPx = applyZoom(
    safePageHeightPx,
    safeZoom,
    scaleMode,
  );
  const visualGapPx = applyZoom(safePageGapPx, safeZoom, scaleMode);

  const breakVisualHeightPx = Math.max(1, visualGapPx);
  const shouldShowLabel = showLabel && visualGapPx >= 18;

  return (
    <div
      data-knexwriter-page-break-layer="true"
      className={[
        "pointer-events-none absolute top-0 select-none",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        left: visualLeftPx,
        width: visualWidthPx,
        ...style,
      }}
      aria-hidden="true"
    >
      {Array.from({ length: safePageCount - 1 }, (_unused, index) => {
        const pageBreakTopPx =
          (index + 1) * visualPageHeightPx + index * visualGapPx;

        return (
          <div
            key={`knexwriter-page-break-${index + 1}`}
            data-knexwriter-page-break-marker="true"
            data-page-before={index}
            data-page-after={index + 1}
            className="absolute left-0 flex items-center justify-center"
            style={{
              top: pageBreakTopPx,
              width: visualWidthPx,
              height: breakVisualHeightPx,
              boxSizing: "border-box",
            }}
          >
            <div className="flex w-full items-center gap-2 px-2">
              <span className="h-px flex-1 border-t border-dashed border-zinc-300/80" />

              {shouldShowLabel ? (
                <span className="rounded border border-zinc-300 bg-zinc-100 px-2 py-0.5 text-[10px] font-medium text-zinc-500 shadow-sm">
                  {label}
                </span>
              ) : null}

              <span className="h-px flex-1 border-t border-dashed border-zinc-300/80" />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default KnexWriterPageBreakLayer;