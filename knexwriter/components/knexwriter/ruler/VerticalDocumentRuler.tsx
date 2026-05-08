"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import {
  applyZoom,
  clampNumber,
  cmToPx,
  pxToCm,
  removeZoom,
} from "./rulerMath";
import type { PageMargins } from "./rulerTypes";

export type VerticalRulerRightButtonGuidePoint = {
  clientX: number;
  clientY: number;
};

type VerticalDocumentRulerProps = {
  pageHeightPx: number;
  pageMargins: PageMargins;
  zoom: number;
  pageCount: number;
  activePage: number;
  pageGapPx: number;
  widthPx: number;
  horizontalRulerHeightPx: number;
  showMargins: boolean;
  onChangeMargins: (nextMargins: PageMargins) => void;

  /**
   * Distância do cabeçalho a partir da borda superior.
   * No Word, o valor comum é próximo de 1,25 cm.
   */
  headerDistanceFromTopPx?: number;

  /**
   * Distância do rodapé a partir da borda inferior.
   * No Word, o valor comum é próximo de 1,25 cm.
   */
  footerDistanceFromBottomPx?: number;

  showHeaderFooterAreas?: boolean;
  onRightButtonGuideStart?: (point: VerticalRulerRightButtonGuidePoint) => void;
  onRightButtonGuideMove?: (point: VerticalRulerRightButtonGuidePoint) => void;
  onRightButtonGuideEnd?: () => void;
};

type VerticalRulerDragMode = "none" | "margin-top" | "margin-bottom";

type VerticalDragState = {
  mode: VerticalRulerDragMode;
  pageIndex: number;
};

type MarginEdge = "top" | "bottom";

type QuarterTick = {
  index: number;
  positionPx: number;
  cmValue: number;
  isCentimeter: boolean;
  isHalfCentimeter: boolean;
};

const WORD_RULER_BACKGROUND = "#eeeeee";
const WORD_RULER_BORDER = "#bfbfbf";
const WORD_RULER_PAGE = "#ffffff";
const WORD_RULER_MARGIN = "#d8d8d8";
const WORD_RULER_HEADER_FOOTER = "#f5f5f5";
const WORD_RULER_MARGIN_DARK = "#9a9a9a";
const WORD_RULER_TICK = "#111111";
const WORD_RULER_TICK_MUTED = "#777777";
const WORD_RULER_NUMBER = "#111111";

const MARKER_FILL = "#f8f8f8";
const MARKER_STROKE = "#1f2937";

const MIN_MARGIN_PX = cmToPx(0.5);
const MIN_PRINTABLE_HEIGHT_PX = cmToPx(3);
const DEFAULT_HEADER_DISTANCE_PX = cmToPx(1.25);
const DEFAULT_FOOTER_DISTANCE_PX = cmToPx(1.25);

function createQuarterTicks(heightPx: number): QuarterTick[] {
  const heightCm = Math.max(0, pxToCm(heightPx));
  const totalQuarters = Math.floor(heightCm * 4);

  return Array.from({ length: totalQuarters + 1 }, (_, index) => {
    const cmValue = index / 4;

    return {
      index,
      cmValue,
      positionPx: cmToPx(cmValue),
      isCentimeter: index % 4 === 0,
      isHalfCentimeter: index % 2 === 0 && index % 4 !== 0,
    };
  });
}

export function VerticalDocumentRuler({
  pageHeightPx,
  pageMargins,
  zoom,
  pageCount,
  activePage,
  pageGapPx,
  widthPx,
  horizontalRulerHeightPx,
  showMargins,
  onChangeMargins,
  headerDistanceFromTopPx = DEFAULT_HEADER_DISTANCE_PX,
  footerDistanceFromBottomPx = DEFAULT_FOOTER_DISTANCE_PX,
  showHeaderFooterAreas = true,
  onRightButtonGuideStart,
  onRightButtonGuideMove,
  onRightButtonGuideEnd,
}: VerticalDocumentRulerProps) {
  const rulerRef = useRef<HTMLDivElement | null>(null);
  const rightButtonGuideActiveRef = useRef(false);

  const dragStateRef = useRef<VerticalDragState>({
    mode: "none",
    pageIndex: 0,
  });

  const [activeDragMode, setActiveDragMode] =
    useState<VerticalRulerDragMode>("none");

  const [hoveredMarginEdge, setHoveredMarginEdge] =
    useState<MarginEdge | null>(null);

  const safePageCount = Math.max(1, pageCount);
  const activePageIndex = clampNumber(activePage - 1, 0, safePageCount - 1);

  const visualPageHeightPx = applyZoom(pageHeightPx, zoom);
  const visualPageGapPx = applyZoom(pageGapPx, zoom);

  const visualHeightPx =
    safePageCount * visualPageHeightPx +
    Math.max(0, safePageCount - 1) * visualPageGapPx;

  const pageQuarterTicks = useMemo(() => {
    return createQuarterTicks(pageHeightPx);
  }, [pageHeightPx]);

  useEffect(() => {
    return () => {
      document.body.style.userSelect = "";
    };
  }, []);

  const getRealPositionFromEvent = (
    event: ReactPointerEvent<HTMLDivElement>,
  ) => {
    const rect = rulerRef.current?.getBoundingClientRect();

    if (!rect) {
      return {
        pageIndex: 0,
        positionPx: 0,
      };
    }

    const visualY = clampNumber(event.clientY - rect.top, 0, visualHeightPx);
    const pageStrideVisualPx = visualPageHeightPx + visualPageGapPx;

    const pageIndex = clampNumber(
      Math.floor(visualY / pageStrideVisualPx),
      0,
      Math.max(0, safePageCount - 1),
    );

    const pageTopVisualPx = pageIndex * pageStrideVisualPx;

    return {
      pageIndex,
      positionPx: removeZoom(
        clampNumber(visualY - pageTopVisualPx, 0, visualPageHeightPx),
        zoom,
      ),
    };
  };

  const stopDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragStateRef.current = {
      mode: "none",
      pageIndex: 0,
    };

    setActiveDragMode("none");
    setHoveredMarginEdge(null);
    document.body.style.userSelect = "";

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture can already be released by the browser.
    }

    if (rightButtonGuideActiveRef.current && (event.buttons & 2) === 0) {
      rightButtonGuideActiveRef.current = false;
      onRightButtonGuideEnd?.();
    }
  };

  const startDrag = (
    event: ReactPointerEvent<HTMLButtonElement>,
    mode: VerticalRulerDragMode,
    pageIndex: number,
  ) => {
    event.preventDefault();
    event.stopPropagation();

    dragStateRef.current = {
      mode,
      pageIndex,
    };

    setActiveDragMode(mode);
    setHoveredMarginEdge(
      mode === "margin-top"
        ? "top"
        : mode === "margin-bottom"
          ? "bottom"
          : null,
    );

    document.body.style.userSelect = "none";

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is only an enhancement.
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (rightButtonGuideActiveRef.current && (event.buttons & 2) !== 0) {
      event.preventDefault();
      onRightButtonGuideMove?.({
        clientX: event.clientX,
        clientY: event.clientY,
      });
      return;
    }

    const dragState = dragStateRef.current;

    if (dragState.mode === "none") {
      return;
    }

    const { positionPx } = getRealPositionFromEvent(event);

    if (dragState.mode === "margin-top") {
      onChangeMargins({
        ...pageMargins,
        topPx: clampNumber(
          positionPx,
          MIN_MARGIN_PX,
          pageHeightPx - pageMargins.bottomPx - MIN_PRINTABLE_HEIGHT_PX,
        ),
      });

      return;
    }

    if (dragState.mode === "margin-bottom") {
      const nextBottomPx = pageHeightPx - positionPx;

      onChangeMargins({
        ...pageMargins,
        bottomPx: clampNumber(
          nextBottomPx,
          MIN_MARGIN_PX,
          pageHeightPx - pageMargins.topPx - MIN_PRINTABLE_HEIGHT_PX,
        ),
      });
    }
  };

  const handleMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 2) return;
    event.preventDefault();
    rightButtonGuideActiveRef.current = true;
    onRightButtonGuideStart?.({
      clientX: event.clientX,
      clientY: event.clientY,
    });
  };

  const handleMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
    if ((event.buttons & 2) === 0) {
      if (rightButtonGuideActiveRef.current) {
        rightButtonGuideActiveRef.current = false;
        onRightButtonGuideEnd?.();
      }
      return;
    }

    if (!rightButtonGuideActiveRef.current) {
      rightButtonGuideActiveRef.current = true;
      onRightButtonGuideStart?.({
        clientX: event.clientX,
        clientY: event.clientY,
      });
    }

    onRightButtonGuideMove?.({
      clientX: event.clientX,
      clientY: event.clientY,
    });
  };

  const handleMouseUp = (event: ReactMouseEvent<HTMLDivElement>) => {
    if ((event.button === 2 || (event.buttons & 2) === 0) && rightButtonGuideActiveRef.current) {
      rightButtonGuideActiveRef.current = false;
      onRightButtonGuideEnd?.();
    }
  };

  const pageIndexes = Array.from(
    { length: safePageCount },
    (_: unknown, index: number) => index,
  );

  const cursorClassName =
    activeDragMode === "none" ? "cursor-default" : "cursor-ns-resize";

  return (
    <div
      ref={rulerRef}
      className={`relative shrink-0 overflow-visible select-none border-r ${cursorClassName}`}
      style={{
        width: widthPx,
        height: visualHeightPx,
        minHeight: `calc(100vh - ${horizontalRulerHeightPx}px)`,
        zIndex: 2,
        backgroundColor: WORD_RULER_BACKGROUND,
        borderColor: WORD_RULER_BORDER,
        fontFamily:
          'Arial, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
      onPointerDown={(event) => {
        if (event.button === 2) {
          event.preventDefault();
          rightButtonGuideActiveRef.current = true;
          onRightButtonGuideStart?.({
            clientX: event.clientX,
            clientY: event.clientY,
          });
        }
      }}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onContextMenu={(event) => {
        if (rightButtonGuideActiveRef.current) {
          event.preventDefault();
        }
      }}
      aria-label="Régua vertical do documento"
    >
      {pageIndexes.map((pageIndex: number) => {
        const isActivePage = pageIndex === activePageIndex;
        const pageTop = pageIndex * (visualPageHeightPx + visualPageGapPx);

        const topMarginY = applyZoom(pageMargins.topPx, zoom);
        const bottomMarginY = applyZoom(
          pageHeightPx - pageMargins.bottomPx,
          zoom,
        );

        const visualTopMarginHeight = applyZoom(pageMargins.topPx, zoom);
        const visualBottomMarginHeight = applyZoom(pageMargins.bottomPx, zoom);

        const visualBodyTop = topMarginY;
        const visualBodyBottom = bottomMarginY;
        const visualBodyHeight = Math.max(0, visualBodyBottom - visualBodyTop);

        const headerTopY = applyZoom(headerDistanceFromTopPx, zoom);
        const headerHeight = Math.max(0, topMarginY - headerTopY);

        const footerTopY = bottomMarginY;
        const footerBottomY = applyZoom(
          pageHeightPx - footerDistanceFromBottomPx,
          zoom,
        );
        const footerHeight = Math.max(0, footerBottomY - footerTopY);

        return (
          <div
            key={`vertical-ruler-page-${pageIndex}`}
            className="absolute left-0 right-0 overflow-visible"
            style={{
              top: pageTop,
              height: visualPageHeightPx,
              opacity: isActivePage ? 1 : 0.62,
            }}
          >
            {showMargins ? (
              <>
                <div
                  className="pointer-events-none absolute inset-x-0 top-0"
                  style={{
                    height: visualTopMarginHeight,
                    backgroundColor: WORD_RULER_MARGIN,
                    boxShadow: "inset -1px 0 0 rgba(0,0,0,0.08)",
                  }}
                />

                <div
                  className="pointer-events-none absolute inset-x-0"
                  style={{
                    top: visualBodyTop,
                    height: visualBodyHeight,
                    backgroundColor: WORD_RULER_PAGE,
                    boxShadow:
                      "inset -1px 0 0 rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.95)",
                  }}
                />

                <div
                  className="pointer-events-none absolute inset-x-0 bottom-0"
                  style={{
                    height: visualBottomMarginHeight,
                    backgroundColor: WORD_RULER_MARGIN,
                    boxShadow: "inset -1px 0 0 rgba(0,0,0,0.08)",
                  }}
                />

                {showHeaderFooterAreas ? (
                  <>
                    <div
                      className="pointer-events-none absolute inset-x-0"
                      title="Área de cabeçalho"
                      style={{
                        top: headerTopY,
                        height: headerHeight,
                        backgroundColor: WORD_RULER_HEADER_FOOTER,
                        borderTop: `1px solid ${WORD_RULER_BORDER}`,
                        borderBottom: `1px dotted ${WORD_RULER_MARGIN_DARK}`,
                      }}
                    />

                    <div
                      className="pointer-events-none absolute inset-x-0"
                      title="Área de rodapé"
                      style={{
                        top: footerTopY,
                        height: footerHeight,
                        backgroundColor: WORD_RULER_HEADER_FOOTER,
                        borderTop: `1px dotted ${WORD_RULER_MARGIN_DARK}`,
                        borderBottom: `1px solid ${WORD_RULER_BORDER}`,
                      }}
                    />
                  </>
                ) : null}

                <div
                  className="pointer-events-none absolute inset-x-0 h-px"
                  style={{
                    top: topMarginY,
                    backgroundColor: WORD_RULER_MARGIN_DARK,
                  }}
                />

                <div
                  className="pointer-events-none absolute inset-x-0 h-px"
                  style={{
                    top: bottomMarginY,
                    backgroundColor: WORD_RULER_MARGIN_DARK,
                  }}
                />
              </>
            ) : null}

            {pageQuarterTicks.map((tick: QuarterTick) => {
              const top = applyZoom(tick.positionPx, zoom);

              const isInsidePrintableArea =
                top >= topMarginY && top <= bottomMarginY;

              const tickWidth = tick.isCentimeter
                ? 12
                : tick.isHalfCentimeter
                  ? 8
                  : 4;

              const shouldShowNumber = tick.isCentimeter && tick.index > 0;
              const label = Math.round(tick.cmValue);

              return (
                <span
                  key={`vertical-quarter-${pageIndex}-${tick.index}`}
                  className="pointer-events-none absolute right-0 block h-px"
                  style={{ top }}
                >
                  <span
                    className="absolute right-0 block h-px"
                    style={{
                      width: tickWidth,
                      backgroundColor: isInsidePrintableArea
                        ? WORD_RULER_TICK
                        : WORD_RULER_TICK_MUTED,
                      opacity: isInsidePrintableArea ? 0.84 : 0.46,
                    }}
                  />

                  {shouldShowNumber ? (
                    <span
                      className="absolute -translate-y-1/2 whitespace-nowrap text-right"
                      style={{
                        right: 16,
                        top: 0,
                        minWidth: 14,
                        fontSize: 10,
                        lineHeight: "10px",
                        fontWeight: 400,
                        color: WORD_RULER_NUMBER,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      {label}
                    </span>
                  ) : null}
                </span>
              );
            })}

            {isActivePage && showMargins ? (
              <>
                <VerticalMarginHandle
                  y={topMarginY}
                  label={`Mover margem superior ${pxToCm(
                    pageMargins.topPx,
                  ).toFixed(1)} cm`}
                  mode="margin-top"
                  edge="top"
                  displayLabel="Margem superior"
                  valueCm={pxToCm(pageMargins.topPx)}
                  isVisible={
                    hoveredMarginEdge === "top" ||
                    activeDragMode === "margin-top"
                  }
                  onHoverChange={setHoveredMarginEdge}
                  onPointerDown={(event, mode) =>
                    startDrag(event, mode, pageIndex)
                  }
                />

                <VerticalMarginHandle
                  y={bottomMarginY}
                  label={`Mover margem inferior ${pxToCm(
                    pageMargins.bottomPx,
                  ).toFixed(1)} cm`}
                  mode="margin-bottom"
                  edge="bottom"
                  displayLabel="Margem inferior"
                  valueCm={pxToCm(pageMargins.bottomPx)}
                  isVisible={
                    hoveredMarginEdge === "bottom" ||
                    activeDragMode === "margin-bottom"
                  }
                  onHoverChange={setHoveredMarginEdge}
                  onPointerDown={(event, mode) =>
                    startDrag(event, mode, pageIndex)
                  }
                />
              </>
            ) : null}
          </div>
        );
      })}

      {activeDragMode !== "none" ? (
        <div className="pointer-events-none absolute inset-0 bg-blue-100/10" />
      ) : null}
    </div>
  );
}

function VerticalMarginHandle({
  y,
  label,
  mode,
  edge,
  displayLabel,
  valueCm,
  isVisible,
  onHoverChange,
  onPointerDown,
}: {
  y: number;
  label: string;
  mode: Exclude<VerticalRulerDragMode, "none">;
  edge: MarginEdge;
  displayLabel: string;
  valueCm: number;
  isVisible: boolean;
  onHoverChange: (edge: MarginEdge | null) => void;
  onPointerDown: (
    event: ReactPointerEvent<HTMLButtonElement>,
    mode: Exclude<VerticalRulerDragMode, "none">,
  ) => void;
}) {
  return (
    <button
      type="button"
      data-ruler-control="true"
      aria-label={label}
      title={label}
      className="absolute right-0 h-7 w-7 -translate-y-1/2 cursor-ns-resize bg-transparent p-0"
      style={{
        top: y,
        zIndex: 50,
      }}
      onPointerEnter={() => onHoverChange(edge)}
      onPointerLeave={() => onHoverChange(null)}
      onPointerDown={(event) => onPointerDown(event, mode)}
    >
      {isVisible ? (
        <>
          <span
            className="pointer-events-none absolute right-[18px] top-1/2 -translate-y-1/2 whitespace-nowrap rounded-sm border px-1.5 py-[1px] text-[10px] leading-none shadow-sm"
            style={{
              borderColor: WORD_RULER_BORDER,
              backgroundColor: "#ffffff",
              color: WORD_RULER_NUMBER,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {displayLabel} {valueCm.toFixed(1)} cm
          </span>

          <span
            className="pointer-events-none absolute right-[3px] top-1/2 block h-[11px] w-[11px] -translate-y-1/2 bg-white"
            style={{
              border: `1px solid ${MARKER_STROKE}`,
              backgroundColor: MARKER_FILL,
            }}
          />

          <span
            className="pointer-events-none absolute right-[14px] top-1/2 block h-0 w-0 -translate-y-1/2"
            style={{
              borderTop: "6px solid transparent",
              borderBottom: "6px solid transparent",
              borderRight:
                edge === "top"
                  ? `8px solid ${MARKER_STROKE}`
                  : "0 solid transparent",
              borderLeft:
                edge === "bottom"
                  ? `8px solid ${MARKER_STROKE}`
                  : "0 solid transparent",
            }}
          />
        </>
      ) : (
        <span
          className="pointer-events-none absolute right-[4px] top-1/2 h-px w-[18px] -translate-y-1/2"
          style={{
            backgroundColor: MARKER_STROKE,
            opacity: 0.35,
          }}
        />
      )}
    </button>
  );
}
