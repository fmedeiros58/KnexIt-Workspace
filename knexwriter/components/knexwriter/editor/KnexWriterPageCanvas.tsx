"use client";

import { type CSSProperties, type ReactNode } from "react";

export type KnexWriterPageCanvasProps = {
  pageIndex: number;
  pageWidthPx: number;
  pageHeightPx: number;
  zoom: number;
  isActive?: boolean;
  className?: string;
  innerClassName?: string;
  style?: CSSProperties;
  children?: ReactNode;
  onClickPage?: (pageIndex: number) => void;
};

const PAGE_BACKGROUND_COLOR = "#ffffff";
const PAGE_FRAME_COLOR = "#AEB4BE";
const PAGE_ACTIVE_FRAME_COLOR = "#93C5FD";

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

function applyZoom(value: number, zoom: number) {
  return value * zoom;
}

export function KnexWriterPageCanvas({
  pageIndex,
  pageWidthPx,
  pageHeightPx,
  zoom,
  isActive = false,
  className = "",
  innerClassName = "",
  style,
  children,
  onClickPage,
}: KnexWriterPageCanvasProps) {
  const safePageWidthPx = Math.max(1, clampPositive(pageWidthPx, 1));
  const safePageHeightPx = Math.max(1, clampPositive(pageHeightPx, 1));
  const safeZoom = clampZoom(zoom);

  const visualWidthPx = applyZoom(safePageWidthPx, safeZoom);
  const visualHeightPx = applyZoom(safePageHeightPx, safeZoom);

  return (
    <article
      data-knexwriter-page-canvas-outer="true"
      data-page-index={pageIndex}
      className={["relative shrink-0", className].filter(Boolean).join(" ")}
      style={{
        width: visualWidthPx,
        height: visualHeightPx,
        boxSizing: "border-box",
        ...style,
      }}
      onMouseDown={() => onClickPage?.(pageIndex)}
    >
      <div
        data-knexwriter-page-canvas-frame="true"
        data-page-index={pageIndex}
        aria-hidden="true"
        className="pointer-events-none absolute left-0 top-0"
        style={{
          width: visualWidthPx,
          height: visualHeightPx,
          boxSizing: "border-box",
          backgroundColor: PAGE_BACKGROUND_COLOR,
        }}
      >
        <span
          aria-hidden="true"
          className="absolute left-0 top-0 block"
          style={{
            width: "100%",
            height: 1,
            backgroundColor: isActive
              ? PAGE_ACTIVE_FRAME_COLOR
              : PAGE_FRAME_COLOR,
          }}
        />

        <span
          aria-hidden="true"
          className="absolute bottom-0 left-0 block"
          style={{
            width: "100%",
            height: 1,
            backgroundColor: isActive
              ? PAGE_ACTIVE_FRAME_COLOR
              : PAGE_FRAME_COLOR,
          }}
        />

        <span
          aria-hidden="true"
          className="absolute left-0 top-0 block"
          style={{
            width: 1,
            height: "100%",
            backgroundColor: isActive
              ? PAGE_ACTIVE_FRAME_COLOR
              : PAGE_FRAME_COLOR,
          }}
        />

        <span
          aria-hidden="true"
          className="absolute right-0 top-0 block"
          style={{
            width: 1,
            height: "100%",
            backgroundColor: isActive
              ? PAGE_ACTIVE_FRAME_COLOR
              : PAGE_FRAME_COLOR,
          }}
        />
      </div>

      <div
        data-knexwriter-page-canvas="true"
        data-page-index={pageIndex}
        className={[
          "absolute left-0 top-0 overflow-hidden bg-transparent text-black",
          innerClassName,
        ]
          .filter(Boolean)
          .join(" ")}
        style={{
          width: safePageWidthPx,
          height: safePageHeightPx,
          transform: `scale(${safeZoom})`,
          transformOrigin: "top left",
          boxSizing: "border-box",
        }}
      >
        {children}
      </div>
    </article>
  );
}

export default KnexWriterPageCanvas;