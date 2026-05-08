"use client";

import { useMemo, type CSSProperties } from "react";

export type KnexWriterPrintableAreaGuideMargins = {
  topPx: number;
  rightPx: number;
  bottomPx: number;
  leftPx: number;
};

export type KnexWriterPrintableAreaGuideProps = {
  pageWidthPx: number;
  pageHeightPx: number;
  pageMargins: KnexWriterPrintableAreaGuideMargins;
  show?: boolean;
  showHeaderFooter?: boolean;
  headerDistanceFromTopPx?: number;
  footerDistanceFromBottomPx?: number;
  className?: string;
  style?: CSSProperties;
};

const DEFAULT_HEADER_DISTANCE_FROM_TOP_PX = 48;
const DEFAULT_FOOTER_DISTANCE_FROM_BOTTOM_PX = 48;

export function KnexWriterPrintableAreaGuide({
  pageWidthPx,
  pageHeightPx,
  pageMargins,
  show = true,
  showHeaderFooter = true,
  headerDistanceFromTopPx = DEFAULT_HEADER_DISTANCE_FROM_TOP_PX,
  footerDistanceFromBottomPx = DEFAULT_FOOTER_DISTANCE_FROM_BOTTOM_PX,
  className = "",
  style,
}: KnexWriterPrintableAreaGuideProps) {
  const geometry = useMemo(() => {
    const left = Math.max(0, pageMargins.leftPx);
    const top = Math.max(0, pageMargins.topPx);
    const right = Math.max(0, pageMargins.rightPx);
    const bottom = Math.max(0, pageMargins.bottomPx);

    return {
      bodyLeft: left,
      bodyTop: top,
      bodyWidth: Math.max(1, pageWidthPx - left - right),
      bodyHeight: Math.max(1, pageHeightPx - top - bottom),
      headerTop: Math.max(0, headerDistanceFromTopPx - 18),
      footerTop: Math.max(0, pageHeightPx - footerDistanceFromBottomPx - 18),
    };
  }, [
    footerDistanceFromBottomPx,
    headerDistanceFromTopPx,
    pageHeightPx,
    pageMargins.bottomPx,
    pageMargins.leftPx,
    pageMargins.rightPx,
    pageMargins.topPx,
    pageWidthPx,
  ]);

  if (!show) {
    return null;
  }

  return (
    <div
      data-knexwriter-printable-area-guide="true"
      className={["pointer-events-none absolute inset-0 select-none", className].join(" ")}
      style={style}
      aria-hidden="true"
    >
      <div
        className="absolute border border-dashed border-blue-300/80"
        style={{
          left: geometry.bodyLeft,
          top: geometry.bodyTop,
          width: geometry.bodyWidth,
          height: geometry.bodyHeight,
        }}
      />

      {showHeaderFooter ? (
        <>
          <div
            className="absolute border-b border-dotted border-zinc-300"
            style={{
              left: geometry.bodyLeft,
              top: geometry.headerTop,
              width: geometry.bodyWidth,
              height: 18,
            }}
          />

          <div
            className="absolute border-t border-dotted border-zinc-300"
            style={{
              left: geometry.bodyLeft,
              top: geometry.footerTop,
              width: geometry.bodyWidth,
              height: 18,
            }}
          />
        </>
      ) : null}
    </div>
  );
}
