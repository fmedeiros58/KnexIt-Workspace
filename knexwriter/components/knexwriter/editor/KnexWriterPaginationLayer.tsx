"use client";

import { type CSSProperties } from "react";

export type KnexWriterPaginationLayerMargins = {
  topPx: number;
  rightPx: number;
  bottomPx: number;
  leftPx: number;
};

export type KnexWriterPaginationLayerProps = {
  pageIndex: number;
  pageNumber: number;
  pageCount: number;
  pageWidthPx: number;
  pageHeightPx: number;
  pageMargins: KnexWriterPaginationLayerMargins;
  showPageNumber?: boolean;
  label?: string;
  className?: string;
  style?: CSSProperties;
};

function clampPositive(value: number, fallback = 0) {
  if (!Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, value);
}

export function KnexWriterPaginationLayer({
  pageIndex,
  pageNumber,
  pageCount,
  pageWidthPx,
  pageHeightPx,
  pageMargins,
  showPageNumber = true,
  label,
  className = "",
  style,
}: KnexWriterPaginationLayerProps) {
  if (!showPageNumber) {
    return null;
  }

  const safeLeftPx = clampPositive(pageMargins.leftPx);
  const safeRightPx = clampPositive(pageMargins.rightPx);
  const safeBottomPx = clampPositive(pageMargins.bottomPx);

  const printableWidthPx = Math.max(
    1,
    pageWidthPx - safeLeftPx - safeRightPx,
  );

  const footerOffsetPx = Math.max(22, safeBottomPx / 2);

  const text =
    label || `Página ${pageNumber}${pageCount > 1 ? ` de ${pageCount}` : ""}`;

  return (
    <div
      data-knexwriter-pagination-layer="true"
      data-page-index={pageIndex}
      data-page-number={pageNumber}
      data-page-count={pageCount}
      className={[
        "pointer-events-none absolute select-none text-[10px] text-zinc-400",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      style={{
        left: safeLeftPx,
        top: Math.max(0, pageHeightPx - footerOffsetPx),
        width: printableWidthPx,
        boxSizing: "border-box",
        textAlign: "right",
        ...style,
      }}
      aria-hidden="true"
    >
      {text}
    </div>
  );
}

export default KnexWriterPaginationLayer;