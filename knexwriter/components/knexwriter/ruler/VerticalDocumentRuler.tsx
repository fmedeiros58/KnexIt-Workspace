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
  topOffsetPx?: number;
  showMargins: boolean;
  onChangeMargins: (nextMargins: PageMargins) => void;
  editableTopPx?: number;
  editableBottomPx?: number;

  headerDistanceFromTopPx?: number;
  headerHeightPx?: number;

  footerDistanceFromBottomPx?: number;
  footerHeightPx?: number;
  onChangeHeaderDistanceFromTopPx?: (nextDistancePx: number) => void;
  onChangeFooterDistanceFromBottomPx?: (nextDistancePx: number) => void;

  showHeaderFooterAreas?: boolean;
  showHeaderFooterRulerTicks?: boolean;
  onRightButtonGuideStart?: (point: VerticalRulerRightButtonGuidePoint) => void;
  onRightButtonGuideMove?: (point: VerticalRulerRightButtonGuidePoint) => void;
  onRightButtonGuideEnd?: () => void;
};

type VerticalRulerDragMode =
  | "none"
  | "margin-top"
  | "margin-bottom"
  | "header-distance-top"
  | "footer-distance-bottom";

type VerticalDragState = {
  mode: VerticalRulerDragMode;
  pageIndex: number;
  startClientY: number;
  hasMoved: boolean;
};

type VerticalRulerHandleEdge =
  | "top"
  | "bottom"
  | "header-top"
  | "footer-bottom";

type QuarterTick = {
  index: number;
  positionPx: number;
  cmValue: number;
  isCentimeter: boolean;
  isHalfCentimeter: boolean;
};

const WORD_RULER_BACKGROUND = "#eeeeee";
const WORD_RULER_BORDER = "#bfbfbf";
const WORD_RULER_WORKSPACE = "#EEF0F3";
const WORD_RULER_PAGE = "#ffffff";
const WORD_RULER_MARGIN = "#d8d8d8";
const WORD_RULER_MARGIN_DARK = "#9a9a9a";
const WORD_RULER_TICK = "#111111";
const WORD_RULER_TICK_MUTED = "#777777";
const WORD_RULER_NUMBER = "#111111";

const MARKER_STROKE = "#1f2937";

const MIN_MARGIN_PX = 0;
const MIN_PRINTABLE_HEIGHT_PX = cmToPx(3);
/**
 * Cabeçalho padrão de 3 cm.
 *
 * Observação importante:
 * - este valor é apenas o padrão inicial;
 * - se o documento já trouxer uma medida salva, a medida salva prevalece;
 * - se o usuário ajustar para 0 cm e o estado pai persistir esse 0, a régua
 *   continuará permitindo a página totalmente utilizável.
 */
const DEFAULT_HEADER_DISTANCE_PX = cmToPx(3);

/**
 * Rodapé padrão de 2 cm.
 */
const DEFAULT_FOOTER_DISTANCE_PX = cmToPx(2);

const TOP_OFFSET_EPSILON_PX = 1;

/**
 * Evita que um clique simples seja interpretado como arraste.
 */
const DRAG_START_THRESHOLD_PX = 3;

const WORD_LIKE_MARGIN_ARROW_WIDTH_PX = 15;
const WORD_LIKE_MARGIN_ARROW_HEIGHT_PX = 25;
const WORD_LIKE_MARGIN_ARROW_FILL = "#ffffff";
const WORD_LIKE_MARGIN_ARROW_STROKE = "#111111";
const WORD_LIKE_MARGIN_ARROW_STROKE_WIDTH = 0.9;

const VERTICAL_HANDLE_HITBOX_WIDTH_PX = 7;
const VERTICAL_HANDLE_HITBOX_HEIGHT_PX = 4;

const VERTICAL_HEADER_FOOTER_HITBOX_HEIGHT_PX = 8;
const VERTICAL_PRIMARY_TICK_WIDTH_PX = 12;
const SINGLE_PAGE_RULER_MODE = true;

function snapLinePosition(valuePx: number) {
  return Math.round(valuePx) + 0.5;
}

const DOTTED_HORIZONTAL_LINE =
  "repeating-linear-gradient(to right, rgba(82,82,91,0.88) 0 2px, transparent 2px 4px)";

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

function WordLikeVerticalResizeArrow() {
  return (
    <svg
      viewBox="0 0 15 25"
      aria-hidden="true"
      className="overflow-visible"
      style={{
        width: WORD_LIKE_MARGIN_ARROW_WIDTH_PX,
        height: WORD_LIKE_MARGIN_ARROW_HEIGHT_PX,
        display: "block",
      }}
    >
      <path
        d="
          M7.5 0.95
          L12.55 6.05
          L8.65 6.05
          L8.65 18.95
          L12.55 18.95
          L7.5 24.05
          L2.45 18.95
          L6.35 18.95
          L6.35 6.05
          L2.45 6.05
          Z
        "
        fill={WORD_LIKE_MARGIN_ARROW_FILL}
        stroke={WORD_LIKE_MARGIN_ARROW_STROKE}
        strokeWidth={WORD_LIKE_MARGIN_ARROW_STROKE_WIDTH}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export function VerticalDocumentRuler({
  pageHeightPx,
  pageMargins,
  zoom,
  pageCount,
  activePage,
  pageGapPx,
  widthPx,
  topOffsetPx = 0,
  showMargins,
  onChangeMargins,
  editableTopPx,
  editableBottomPx,
  headerDistanceFromTopPx: headerDistanceFromTopPxProp,
  headerHeightPx,
  footerDistanceFromBottomPx = DEFAULT_FOOTER_DISTANCE_PX,
  footerHeightPx,
  onChangeHeaderDistanceFromTopPx,
  onChangeFooterDistanceFromBottomPx,
  showHeaderFooterAreas = true,
  showHeaderFooterRulerTicks = false,
  onRightButtonGuideStart,
  onRightButtonGuideMove,
  onRightButtonGuideEnd,
}: VerticalDocumentRulerProps) {
  const rulerRef = useRef<HTMLDivElement | null>(null);
  const rightButtonGuideActiveRef = useRef(false);

  const dragStateRef = useRef<VerticalDragState>({
    mode: "none",
    pageIndex: 0,
    startClientY: 0,
    hasMoved: false,
  });

  const [activeDragMode, setActiveDragMode] =
    useState<VerticalRulerDragMode>("none");

  const [hoveredMarginEdge, setHoveredMarginEdge] =
    useState<VerticalRulerHandleEdge | null>(null);

  const safePageCount = Math.max(1, pageCount);
  const activePageIndex = clampNumber(activePage - 1, 0, safePageCount - 1);
  const isDragging = activeDragMode !== "none";
  const lockedPageIndex =
    isDragging && dragStateRef.current.mode !== "none"
      ? dragStateRef.current.pageIndex
      : activePageIndex;
  const renderPageIndexes = SINGLE_PAGE_RULER_MODE
    ? [lockedPageIndex]
    : Array.from({ length: safePageCount }, (_: unknown, index: number) => index);

  const safeTopOffsetPx = Math.max(0, topOffsetPx);
  const topOffsetRealPx = removeZoom(safeTopOffsetPx, zoom);

  const visualPageHeightPx = applyZoom(pageHeightPx, zoom);
  const visualPageGapPx = applyZoom(pageGapPx, zoom);

  const visiblePageCount = SINGLE_PAGE_RULER_MODE ? 1 : safePageCount;
  const visualPagesHeightPx =
    visiblePageCount * visualPageHeightPx +
    Math.max(0, visiblePageCount - 1) * visualPageGapPx;

  const visualHeightPx = safeTopOffsetPx + visualPagesHeightPx;

  const hasHeaderHandle =
    showHeaderFooterAreas && Boolean(onChangeHeaderDistanceFromTopPx);

  const hasFooterHandle =
    showHeaderFooterAreas && Boolean(onChangeFooterDistanceFromBottomPx);

  const shouldRenderTopMarginHandle = !hasHeaderHandle;
  const shouldRenderBottomMarginHandle = !hasFooterHandle;

  const pageQuarterTicks = useMemo(() => {
    return createQuarterTicks(pageHeightPx);
  }, [pageHeightPx]);

  const topMarginBoundaryPx = clampNumber(pageMargins.topPx, 0, pageHeightPx);

  const bottomMarginBoundaryPx = clampNumber(
    pageHeightPx - pageMargins.bottomPx,
    0,
    pageHeightPx,
  );

  const removeTopOffsetLeak = (valuePx: number) => {
    const looksLikeOnlyTopOffset =
      topOffsetRealPx > 0 &&
      valuePx > 0 &&
      valuePx <= topOffsetRealPx + TOP_OFFSET_EPSILON_PX;

    return clampNumber(looksLikeOnlyTopOffset ? 0 : valuePx, 0, pageHeightPx);
  };

  const rawEditableTopBoundaryPx = removeTopOffsetLeak(
    editableTopPx ?? topMarginBoundaryPx,
  );

  /**
   * Resolve o problema do cabeçalho abrindo sempre zerado.
   *
   * Antes, quando o Stage enviava headerDistanceFromTopPx = 0, a régua
   * assumia esse 0 como valor real e ignorava o editableTopPx/bodyTopPx.
   * Isso fazia a área branca começar no topo da folha mesmo em documento novo.
   *
   * Agora a regra é:
   * - se existe uma medida útil vinda de headerDistanceFromTopPx, ela prevalece;
   * - se headerDistanceFromTopPx vem 0, mas editableTopPx/bodyTopPx indica uma
   *   área superior real, usamos esse valor como padrão visual inicial;
   * - se ambos forem 0, respeitamos 0, permitindo uso de 100% da página após
   *   ajuste/salvamento.
   */
  const normalizedHeaderDistancePx = clampNumber(
    removeTopOffsetLeak(headerDistanceFromTopPxProp ?? DEFAULT_HEADER_DISTANCE_PX),
    0,
    pageHeightPx,
  );

  const headerDistanceLooksUnset =
    hasHeaderHandle &&
    (headerDistanceFromTopPxProp == null ||
      normalizedHeaderDistancePx <= TOP_OFFSET_EPSILON_PX) &&
    rawEditableTopBoundaryPx > TOP_OFFSET_EPSILON_PX;

  const headerDistanceBoundaryPx = clampNumber(
    headerDistanceLooksUnset
      ? rawEditableTopBoundaryPx
      : normalizedHeaderDistancePx,
    0,
    pageHeightPx,
  );

  const headerTopBoundaryPx = hasHeaderHandle
    ? 0
    : headerDistanceBoundaryPx;

  const editableTopBoundaryPx = clampNumber(
    hasHeaderHandle ? headerDistanceBoundaryPx : rawEditableTopBoundaryPx,
    0,
    pageHeightPx,
  );

  /**
   * O rodapé agora segue a mesma lógica do cabeçalho.
   *
   * Quando há controle de rodapé, a transição inferior da área branca
   * vem de footerDistanceFromBottomPx, e não de editableBottomPx.
   */
  const rawFooterDistanceBoundaryPx = clampNumber(
    footerDistanceFromBottomPx,
    0,
    pageHeightPx,
  );

  const footerDistanceLooksUnset =
    hasFooterHandle &&
    rawFooterDistanceBoundaryPx <= TOP_OFFSET_EPSILON_PX &&
    editableBottomPx != null &&
    editableBottomPx < pageHeightPx - TOP_OFFSET_EPSILON_PX;

  const footerDistanceBoundaryPx = clampNumber(
    footerDistanceLooksUnset
      ? Math.max(0, pageHeightPx - editableBottomPx)
      : rawFooterDistanceBoundaryPx,
    0,
    pageHeightPx,
  );

  const editableBottomBoundaryPx = clampNumber(
    hasFooterHandle
      ? pageHeightPx - footerDistanceBoundaryPx
      : editableBottomPx ?? bottomMarginBoundaryPx,
    editableTopBoundaryPx,
    pageHeightPx,
  );

  const effectiveHeaderHeightPx = Math.max(
    0,
    hasHeaderHandle
      ? Math.max(0, editableTopBoundaryPx - headerTopBoundaryPx)
      : headerHeightPx ?? Math.max(0, editableTopBoundaryPx - headerTopBoundaryPx),
  );

  const effectiveFooterHeightPx = Math.max(
    0,
    hasFooterHandle
      ? Math.max(0, pageHeightPx - editableBottomBoundaryPx)
      : footerHeightPx ?? Math.max(0, pageHeightPx - editableBottomBoundaryPx),
  );

  const headerBottomBoundaryPx = clampNumber(
    headerTopBoundaryPx + effectiveHeaderHeightPx,
    headerTopBoundaryPx,
    pageHeightPx,
  );

  const footerTopBoundaryPx = hasFooterHandle
    ? editableBottomBoundaryPx
    : clampNumber(
        pageHeightPx - effectiveFooterHeightPx,
        0,
        pageHeightPx,
      );

  const footerBottomBoundaryPxClamped = hasFooterHandle
    ? pageHeightPx
    : clampNumber(
        footerTopBoundaryPx + effectiveFooterHeightPx,
        footerTopBoundaryPx,
        pageHeightPx,
      );

  const headerDistanceLabelPx = clampNumber(
    editableTopBoundaryPx,
    0,
    pageHeightPx,
  );

  /**
   * O rótulo do rodapé agora representa a distância real entre
   * o fim da área branca e a borda inferior da folha.
   */
  const footerDistanceLabelPx = clampNumber(
    pageHeightPx - editableBottomBoundaryPx,
    0,
    pageHeightPx,
  );

  const editableQuarterTicks = useMemo(
    () =>
      createQuarterTicks(
        Math.max(0, editableBottomBoundaryPx - editableTopBoundaryPx),
      ),
    [editableBottomBoundaryPx, editableTopBoundaryPx],
  );

  const headerQuarterTicks = useMemo(
    () =>
      createQuarterTicks(
        Math.max(0, headerBottomBoundaryPx - headerTopBoundaryPx),
      ),
    [headerBottomBoundaryPx, headerTopBoundaryPx],
  );

  const footerQuarterTicks = useMemo(
    () =>
      createQuarterTicks(
        Math.max(0, footerBottomBoundaryPxClamped - footerTopBoundaryPx),
      ),
    [footerBottomBoundaryPxClamped, footerTopBoundaryPx],
  );

  useEffect(() => {
    return () => {
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
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

    const visualYInsidePages = clampNumber(
      visualY - safeTopOffsetPx,
      0,
      visualPagesHeightPx,
    );
    const pageStrideVisualPx = visualPageHeightPx + visualPageGapPx;

    const pageIndex = SINGLE_PAGE_RULER_MODE
      ? lockedPageIndex
      : clampNumber(
          Math.floor(visualYInsidePages / pageStrideVisualPx),
          0,
          Math.max(0, safePageCount - 1),
        );

    const pageTopVisualPx = SINGLE_PAGE_RULER_MODE
      ? 0
      : (pageIndex as number) * pageStrideVisualPx;

    return {
      pageIndex,
      positionPx: removeZoom(
        clampNumber(
          visualYInsidePages - pageTopVisualPx,
          0,
          visualPageHeightPx,
        ),
        zoom,
      ),
    };
  };

  const stopDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragStateRef.current = {
      mode: "none",
      pageIndex: 0,
      startClientY: 0,
      hasMoved: false,
    };

    setActiveDragMode("none");
    setHoveredMarginEdge(null);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture pode já ter sido liberado pelo navegador.
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
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    dragStateRef.current = {
      mode,
      pageIndex,
      startClientY: event.clientY,
      hasMoved: false,
    };

    setActiveDragMode(mode);

    setHoveredMarginEdge(
      mode === "margin-top"
        ? "top"
        : mode === "margin-bottom"
          ? "bottom"
          : mode === "header-distance-top"
            ? "header-top"
            : mode === "footer-distance-bottom"
              ? "footer-bottom"
              : null,
    );

    document.body.style.userSelect = "none";
    document.body.style.cursor = "none";

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture é apenas uma melhoria.
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (rightButtonGuideActiveRef.current && (event.buttons & 2) !== 0) {
      event.preventDefault();
      event.stopPropagation();

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

    event.preventDefault();
    event.stopPropagation();

    if (!dragState.hasMoved) {
      const movementY = Math.abs(event.clientY - dragState.startClientY);

      if (movementY < DRAG_START_THRESHOLD_PX) {
        return;
      }

      dragStateRef.current = {
        ...dragState,
        hasMoved: true,
      };
    }

    const { positionPx } = getRealPositionFromEvent(event);

    if (dragStateRef.current.mode === "margin-top") {
      const nextTopMarginPx = clampNumber(
        positionPx,
        MIN_MARGIN_PX,
        pageHeightPx - pageMargins.bottomPx - MIN_PRINTABLE_HEIGHT_PX,
      );

      onChangeMargins({
        ...pageMargins,
        topPx: nextTopMarginPx,
      });

      if (showHeaderFooterAreas && onChangeHeaderDistanceFromTopPx) {
        onChangeHeaderDistanceFromTopPx(nextTopMarginPx);
      }

      return;
    }

    if (dragStateRef.current.mode === "margin-bottom") {
      const nextBottomPx = pageHeightPx - positionPx;

      const nextBottomMarginPx = clampNumber(
        nextBottomPx,
        MIN_MARGIN_PX,
        pageHeightPx - pageMargins.topPx - MIN_PRINTABLE_HEIGHT_PX,
      );

      onChangeMargins({
        ...pageMargins,
        bottomPx: nextBottomMarginPx,
      });

      if (showHeaderFooterAreas && onChangeFooterDistanceFromBottomPx) {
        onChangeFooterDistanceFromBottomPx(nextBottomMarginPx);
      }

      return;
    }

    if (dragStateRef.current.mode === "header-distance-top") {
      if (!onChangeHeaderDistanceFromTopPx) return;

      const minEditableTopPx = 0;

      const maxEditableTopPx = Math.max(
        minEditableTopPx,
        editableBottomBoundaryPx - MIN_PRINTABLE_HEIGHT_PX,
      );

      const nextEditableTopPx = clampNumber(
        positionPx,
        minEditableTopPx,
        maxEditableTopPx,
      );

      const nextTopMarginPx = clampNumber(
        nextEditableTopPx,
        0,
        pageHeightPx - pageMargins.bottomPx - MIN_PRINTABLE_HEIGHT_PX,
      );

      const nextHeaderDistancePx = clampNumber(
        nextEditableTopPx,
        0,
        pageHeightPx,
      );

      onChangeMargins({
        ...pageMargins,
        topPx: nextTopMarginPx,
      });

      onChangeHeaderDistanceFromTopPx(nextHeaderDistancePx);

      return;
    }

    if (dragStateRef.current.mode === "footer-distance-bottom") {
      if (!onChangeFooterDistanceFromBottomPx) return;

      const minEditableBottomPx = Math.max(
        editableTopBoundaryPx + MIN_PRINTABLE_HEIGHT_PX,
        0,
      );

      const maxEditableBottomPx = pageHeightPx;

      const nextEditableBottomPx = clampNumber(
        positionPx,
        minEditableBottomPx,
        maxEditableBottomPx,
      );

      const nextBottomMarginPx = clampNumber(
        pageHeightPx - nextEditableBottomPx,
        0,
        pageHeightPx - pageMargins.topPx - MIN_PRINTABLE_HEIGHT_PX,
      );

      const nextFooterDistancePx = clampNumber(
        pageHeightPx - nextEditableBottomPx,
        0,
        pageHeightPx,
      );

      onChangeMargins({
        ...pageMargins,
        bottomPx: nextBottomMarginPx,
      });

      onChangeFooterDistanceFromBottomPx(nextFooterDistancePx);
    }
  };

  const handleMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 2) return;

    event.preventDefault();
    event.stopPropagation();

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

    event.preventDefault();
    event.stopPropagation();

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
    if (
      (event.button === 2 || (event.buttons & 2) === 0) &&
      rightButtonGuideActiveRef.current
    ) {
      event.preventDefault();
      event.stopPropagation();

      rightButtonGuideActiveRef.current = false;
      onRightButtonGuideEnd?.();
    }
  };

  const rulerCursorStyle =
    activeDragMode !== "none" || hoveredMarginEdge !== null
      ? "none"
      : "default";

  return (
    <div
      ref={rulerRef}
      className="relative shrink-0 overflow-visible select-none border-r"
      style={{
        width: widthPx,
        height: visualHeightPx,
        zIndex: 2,
        cursor: rulerCursorStyle,
        backgroundColor: WORD_RULER_WORKSPACE,
        borderColor: WORD_RULER_BORDER,
        fontFamily:
          'Arial, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
      onPointerDown={(event) => {
        if (event.button === 2) {
          event.preventDefault();
          event.stopPropagation();

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
          event.stopPropagation();
        }
      }}
      aria-label="Régua vertical do documento"
    >
      {safeTopOffsetPx > 0 ? (
        <div
          className="pointer-events-none absolute left-0 right-0 top-0"
          data-vertical-ruler-top-offset-mask="true"
          style={{
            height: safeTopOffsetPx,
            backgroundColor: WORD_RULER_BACKGROUND,
            borderBottom: `1px solid ${WORD_RULER_BORDER}`,
          }}
        />
      ) : null}

      {renderPageIndexes.map((pageIndex: number, renderIndex: number) => {
        const isActivePage = pageIndex === lockedPageIndex;

        const pageTop =
          safeTopOffsetPx + renderIndex * (visualPageHeightPx + visualPageGapPx);

        const topMarginY = applyZoom(topMarginBoundaryPx, zoom);
        const bottomMarginY = applyZoom(bottomMarginBoundaryPx, zoom);
        const editableTopY = applyZoom(editableTopBoundaryPx, zoom);
        const editableBottomY = applyZoom(editableBottomBoundaryPx, zoom);
        const headerTopY = applyZoom(headerTopBoundaryPx, zoom);
        const headerBottomY = applyZoom(headerBottomBoundaryPx, zoom);
        const footerTopY = applyZoom(footerTopBoundaryPx, zoom);
        const footerBottomY = applyZoom(footerBottomBoundaryPxClamped, zoom);

        const visualTopMarginHeight = Math.max(
          0,
          showHeaderFooterAreas ? editableTopY : topMarginY,
        );

        const visualBottomMarginHeight = Math.max(
          0,
          showHeaderFooterAreas
            ? visualPageHeightPx - editableBottomY
            : visualPageHeightPx - bottomMarginY,
        );

        const visualBodyHeight = Math.max(0, editableBottomY - editableTopY);

        const rawHeaderAreaTopY = 0;
        const visualHeaderHeight = Math.max(
          0,
          editableTopY - rawHeaderAreaTopY,
        );

        const rawFooterAreaTopY = editableBottomY;
        const visualFooterHeight = Math.max(
          0,
          visualPageHeightPx - rawFooterAreaTopY,
        );

        const alignedTopMarginY = snapLinePosition(topMarginY);
        const alignedBottomMarginY = snapLinePosition(bottomMarginY);
        const alignedEditableTopY = snapLinePosition(editableTopY);
        const alignedEditableBottomY = snapLinePosition(editableBottomY);

        const isTopIntersectionActive =
          hoveredMarginEdge === "top" ||
          activeDragMode === "margin-top" ||
          hoveredMarginEdge === "header-top" ||
          activeDragMode === "header-distance-top";

        const isBottomIntersectionActive =
          hoveredMarginEdge === "bottom" ||
          activeDragMode === "margin-bottom" ||
          hoveredMarginEdge === "footer-bottom" ||
          activeDragMode === "footer-distance-bottom";

        const isTopMarginBoundaryActive =
          hoveredMarginEdge === "top" || activeDragMode === "margin-top";

        const isBottomMarginBoundaryActive =
          hoveredMarginEdge === "bottom" || activeDragMode === "margin-bottom";

        const showTopMarginLine = !showHeaderFooterAreas;
        const showBottomMarginLine = !showHeaderFooterAreas;

        return (
          <div
            key={`vertical-ruler-page-${pageIndex}`}
            className="absolute left-0 right-0 overflow-visible"
            style={{
              top: pageTop,
              height: visualPageHeightPx,
              backgroundColor: WORD_RULER_BACKGROUND,
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
                    top: editableTopY,
                    height: visualBodyHeight,
                    backgroundColor: WORD_RULER_PAGE,
                    boxShadow: "inset -1px 0 0 rgba(0,0,0,0.12)",
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

                {showTopMarginLine ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 h-px"
                    style={{
                      top: alignedTopMarginY,
                      background: isTopMarginBoundaryActive
                        ? DOTTED_HORIZONTAL_LINE
                        : `linear-gradient(to right, ${WORD_RULER_MARGIN_DARK}, ${WORD_RULER_MARGIN_DARK})`,
                    }}
                  />
                ) : null}

                {showBottomMarginLine ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 h-px"
                    style={{
                      top: alignedBottomMarginY,
                      background: isBottomMarginBoundaryActive
                        ? DOTTED_HORIZONTAL_LINE
                        : `linear-gradient(to right, ${WORD_RULER_MARGIN_DARK}, ${WORD_RULER_MARGIN_DARK})`,
                    }}
                  />
                ) : null}
              </>
            ) : null}

            {showHeaderFooterAreas ? (
              <>
                {visualHeaderHeight > 0 ? (
                  <div
                    className="pointer-events-none absolute inset-x-0"
                    title="Área de cabeçalho"
                    style={{
                      top: rawHeaderAreaTopY,
                      height: visualHeaderHeight,
                      backgroundColor: WORD_RULER_MARGIN,
                      boxShadow: "inset -1px 0 0 rgba(0,0,0,0.08)",
                    }}
                  />
                ) : null}

                {visualFooterHeight > 0 ? (
                  <div
                    className="pointer-events-none absolute inset-x-0"
                    title="Área de rodapé"
                    style={{
                      top: rawFooterAreaTopY,
                      height: visualFooterHeight,
                      backgroundColor: WORD_RULER_MARGIN,
                      boxShadow: "inset -1px 0 0 rgba(0,0,0,0.08)",
                    }}
                  />
                ) : null}

                {isTopIntersectionActive ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 h-px"
                    style={{
                      top: alignedEditableTopY,
                      background: DOTTED_HORIZONTAL_LINE,
                    }}
                  />
                ) : null}

                {isBottomIntersectionActive ? (
                  <div
                    className="pointer-events-none absolute inset-x-0 h-px"
                    style={{
                      top: alignedEditableBottomY,
                      background: DOTTED_HORIZONTAL_LINE,
                    }}
                  />
                ) : null}
              </>
            ) : null}

            {pageQuarterTicks.map((tick: QuarterTick) => {
              const top = applyZoom(tick.positionPx, zoom);
              const alignedTop = snapLinePosition(top);

              const isInsideEditableArea =
                top >= editableTopY && top <= editableBottomY;

              const isInsideHeaderFooterArea =
                showHeaderFooterRulerTicks &&
                ((top >= headerTopY && top <= headerBottomY) ||
                  (top >= footerTopY && top <= footerBottomY));

              if (isInsideEditableArea || isInsideHeaderFooterArea) {
                return null;
              }

              const tickWidth = tick.isCentimeter
                ? VERTICAL_PRIMARY_TICK_WIDTH_PX
                : tick.isHalfCentimeter
                  ? 8
                  : 4;

              return (
                <span
                  key={`v-page-quarter-${pageIndex}-${tick.index}`}
                  className="pointer-events-none absolute left-1/2 block h-px -translate-x-1/2"
                  style={{ top: alignedTop }}
                >
                  <span
                    className="absolute left-1/2 block h-px -translate-x-1/2"
                    style={{
                      width: tickWidth,
                      backgroundColor: WORD_RULER_TICK_MUTED,
                      opacity: 0.5,
                    }}
                  />
                </span>
              );
            })}

            {editableQuarterTicks.map((tick: QuarterTick) => {
              const top = editableTopY + applyZoom(tick.positionPx, zoom);
              const alignedTop = snapLinePosition(top);

              const tickWidth = tick.isCentimeter
                ? VERTICAL_PRIMARY_TICK_WIDTH_PX
                : tick.isHalfCentimeter
                  ? 8
                  : 4;

              const shouldShowNumber = tick.isCentimeter && tick.index > 0;
              const label = Math.round(tick.cmValue);
              const shouldShowTick = !shouldShowNumber;

              return (
                <span
                  key={`v-primary-quarter-${pageIndex}-${tick.index}`}
                  className="pointer-events-none absolute left-1/2 block h-px -translate-x-1/2"
                  style={{ top: alignedTop }}
                >
                  {shouldShowTick ? (
                    <span
                      className="absolute left-1/2 block h-px -translate-x-1/2"
                      style={{
                        width: tickWidth,
                        backgroundColor: WORD_RULER_TICK,
                        opacity: 0.72,
                      }}
                    />
                  ) : null}

                  {shouldShowNumber ? (
                    <span
                      className="absolute whitespace-nowrap text-center"
                      style={{
                        left: 0,
                        top: 0,
                        transform: "translate(-50%, -50%)",
                        minWidth: 12,
                        fontSize: 9,
                        lineHeight: "9px",
                        fontWeight: 400,
                        color: WORD_RULER_NUMBER,
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      <span
                        className="block origin-center"
                        style={{ transform: "rotate(-90deg)" }}
                      >
                        {label}
                      </span>
                    </span>
                  ) : null}
                </span>
              );
            })}

            {showHeaderFooterRulerTicks
              ? headerQuarterTicks.map((tick: QuarterTick) => {
                  const top = headerTopY + applyZoom(tick.positionPx, zoom);
                  const alignedTop = snapLinePosition(top);

                  const tickWidth = tick.isCentimeter
                    ? VERTICAL_PRIMARY_TICK_WIDTH_PX
                    : tick.isHalfCentimeter
                      ? 8
                      : 4;

                  return (
                    <span
                      key={`v-header-quarter-${pageIndex}-${tick.index}`}
                      className="pointer-events-none absolute left-1/2 block h-px -translate-x-1/2"
                      style={{ top: alignedTop }}
                    >
                      <span
                        className="absolute left-1/2 block h-px -translate-x-1/2"
                        style={{
                          width: tickWidth,
                          backgroundColor: WORD_RULER_TICK,
                          opacity: 0.72,
                        }}
                      />
                    </span>
                  );
                })
              : null}

            {showHeaderFooterRulerTicks
              ? footerQuarterTicks.map((tick: QuarterTick) => {
                  const top = footerTopY + applyZoom(tick.positionPx, zoom);
                  const alignedTop = snapLinePosition(top);

                  const tickWidth = tick.isCentimeter
                    ? VERTICAL_PRIMARY_TICK_WIDTH_PX
                    : tick.isHalfCentimeter
                      ? 8
                      : 4;

                  return (
                    <span
                      key={`v-footer-quarter-${pageIndex}-${tick.index}`}
                      className="pointer-events-none absolute left-1/2 block h-px -translate-x-1/2"
                      style={{ top: alignedTop }}
                    >
                      <span
                        className="absolute left-1/2 block h-px -translate-x-1/2"
                        style={{
                          width: tickWidth,
                          backgroundColor: WORD_RULER_TICK,
                          opacity: 0.72,
                        }}
                      />
                    </span>
                  );
                })
              : null}

            {isActivePage ? (
              <>
                {showMargins && shouldRenderTopMarginHandle ? (
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
                    isDragging={activeDragMode === "margin-top"}
                    onHoverChange={setHoveredMarginEdge}
                    onPointerDown={(event, mode) =>
                      startDrag(event, mode, pageIndex)
                    }
                  />
                ) : null}

                {showMargins && shouldRenderBottomMarginHandle ? (
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
                    isDragging={activeDragMode === "margin-bottom"}
                    onHoverChange={setHoveredMarginEdge}
                    onPointerDown={(event, mode) =>
                      startDrag(event, mode, pageIndex)
                    }
                  />
                ) : null}

                {showHeaderFooterAreas && onChangeHeaderDistanceFromTopPx ? (
                  <VerticalMarginHandle
                    y={alignedEditableTopY}
                    label={`Mover distância do cabeçalho ${pxToCm(
                      headerDistanceLabelPx,
                    ).toFixed(1)} cm`}
                    mode="header-distance-top"
                    edge="header-top"
                    displayLabel="Cabeçalho (superior)"
                    valueCm={pxToCm(headerDistanceLabelPx)}
                    isVisible={
                      hoveredMarginEdge === "header-top" ||
                      activeDragMode === "header-distance-top"
                    }
                    isDragging={activeDragMode === "header-distance-top"}
                    hitboxWidthPx={widthPx}
                    hitboxHeightPx={VERTICAL_HEADER_FOOTER_HITBOX_HEIGHT_PX}
                    onHoverChange={setHoveredMarginEdge}
                    onPointerDown={(event, mode) =>
                      startDrag(event, mode, pageIndex)
                    }
                  />
                ) : null}

                {showHeaderFooterAreas && onChangeFooterDistanceFromBottomPx ? (
                  <VerticalMarginHandle
                    y={alignedEditableBottomY}
                    label={`Mover distância do rodapé ${pxToCm(
                      footerDistanceLabelPx,
                    ).toFixed(1)} cm`}
                    mode="footer-distance-bottom"
                    edge="footer-bottom"
                    displayLabel="Rodapé (inferior)"
                    valueCm={pxToCm(footerDistanceLabelPx)}
                    isVisible={
                      hoveredMarginEdge === "footer-bottom" ||
                      activeDragMode === "footer-distance-bottom"
                    }
                    isDragging={activeDragMode === "footer-distance-bottom"}
                    hitboxWidthPx={widthPx}
                    hitboxHeightPx={VERTICAL_HEADER_FOOTER_HITBOX_HEIGHT_PX}
                    onHoverChange={setHoveredMarginEdge}
                    onPointerDown={(event, mode) =>
                      startDrag(event, mode, pageIndex)
                    }
                  />
                ) : null}
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
  isDragging,
  hitboxWidthPx,
  hitboxHeightPx,
  onHoverChange,
  onPointerDown,
}: {
  y: number;
  label: string;
  mode: Exclude<VerticalRulerDragMode, "none">;
  edge: VerticalRulerHandleEdge;
  displayLabel: string;
  valueCm: number;
  isVisible: boolean;
  isDragging: boolean;
  hitboxWidthPx?: number;
  hitboxHeightPx?: number;
  onHoverChange: (edge: VerticalRulerHandleEdge | null) => void;
  onPointerDown: (
    event: ReactPointerEvent<HTMLButtonElement>,
    mode: Exclude<VerticalRulerDragMode, "none">,
  ) => void;
}) {
  return (
    <button
      type="button"
      data-ruler-control="true"
      data-ruler-vertical-handle={edge}
      aria-label={label}
      className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 bg-transparent p-0"
      style={{
        top: y,
        width: hitboxWidthPx ?? VERTICAL_HANDLE_HITBOX_WIDTH_PX,
        height: hitboxHeightPx ?? VERTICAL_HANDLE_HITBOX_HEIGHT_PX,
        zIndex: 90,
        cursor: "none",
        touchAction: "none",
      }}
      onPointerEnter={() => {
        document.body.style.cursor = "none";
        onHoverChange(edge);
      }}
      onPointerLeave={() => {
        if (!isDragging) {
          document.body.style.cursor = "";
          onHoverChange(null);
        }
      }}
      onPointerDown={(event) => {
        if (event.button !== 0) {
          return;
        }

        event.preventDefault();
        event.stopPropagation();

        document.body.style.cursor = "none";
        onHoverChange(edge);
        onPointerDown(event, mode);
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onDoubleClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
    >
      {isVisible ? (
        <>
          <span
            className="pointer-events-none absolute top-1/2 -translate-y-1/2 whitespace-nowrap rounded-sm border px-1.5 py-[2px] text-[10px] leading-none shadow-sm"
            style={{
              left: "calc(100% + 8px)",
              borderColor: isDragging ? MARKER_STROKE : WORD_RULER_BORDER,
              backgroundColor: "#ffffff",
              color: WORD_RULER_NUMBER,
              fontWeight: isDragging ? 600 : 400,
              fontVariantNumeric: "tabular-nums",
              zIndex: 120,
            }}
          >
            {displayLabel} {valueCm.toFixed(1)} cm
          </span>

          <span
            className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              color: WORD_LIKE_MARGIN_ARROW_STROKE,
              zIndex: 130,
            }}
          >
            <WordLikeVerticalResizeArrow />
          </span>
        </>
      ) : null}
    </button>
  );
}
