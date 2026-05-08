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
import type {
  PageMargins,
  ParagraphIndents,
  RulerDragMode,
  TabStop,
  TabStopType,
} from "./rulerTypes";

export type RulerRightButtonGuidePoint = {
  clientX: number;
  clientY: number;
};

type HorizontalDocumentRulerProps = {
  pageWidthPx: number;
  pageMargins: PageMargins;
  paragraphIndents: ParagraphIndents;
  tabStops: TabStop[];
  zoom: number;
  heightPx: number;
  showMargins: boolean;
  showIndentMarkers: boolean;
  showTabStops: boolean;

  /**
   * Mantido por compatibilidade com o componente pai.
   * Não é mais usado para criar novas marcas automaticamente ao clicar na régua.
   */
  insertTabStopType: TabStopType;

  onChangeMargins: (nextMargins: PageMargins) => void;
  onChangeIndents: (nextIndents: ParagraphIndents) => void;
  onChangeTabStops: (nextTabStops: TabStop[]) => void;
  onRightButtonGuideStart?: (point: RulerRightButtonGuidePoint) => void;
  onRightButtonGuideMove?: (point: RulerRightButtonGuidePoint) => void;
  onRightButtonGuideEnd?: () => void;
};

type HorizontalDragState = {
  mode: RulerDragMode;
  tabStopId?: string;
  /**
   * Região interna do marcador composto esquerdo.
   *
   * upper: zona superior. Usa o mesmo crosshair da zona inferior,
   * mas preserva o marcador de parágrafo compensando firstLinePx.
   *
   * lower: zona inferior. Move o conjunto normalmente.
   */
  leftCompositeRegion?: "upper" | "lower";
};

type MarginSide = "left" | "right";

type MarkerButtonProps = {
  x: number;
  y: number;
  rulerHeightPx: number;
  zoom: number;
  label: string;
  mode: RulerDragMode;
  min?: number;
  max?: number;
  value: number;
  onPointerDown: (
    event: ReactPointerEvent<Element>,
    mode: RulerDragMode,
    tabStopId?: string,
    leftCompositeRegion?: "upper" | "lower",
  ) => void;
};

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
const WORD_RULER_MARGIN_DARK = "#9a9a9a";
const WORD_RULER_TICK = "#111111";
const WORD_RULER_TICK_MUTED = "#777777";
const WORD_RULER_NUMBER = "#111111";

const MARKER_FILL = "#f8f8f8";
const MARKER_STROKE = "#1f2937";

/**
 * Captura SVG transparente.
 * Usada com pointerEvents="all" para capturar o path vetorial,
 * sem criar preenchimento visual nem sombra/borda indesejada.
 */
const SVG_CAPTURE_FILL = "transparent";

/**
 * Tamanho visual da seta que indica a zona de transição entre margem e texto.
 */
const MARGIN_HANDLE_ARROW_WIDTH_PX = 34;
const MARGIN_HANDLE_ARROW_HEIGHT_PX = 17;

/**
 * Área real de captura da margem.
 * Deve ser uma porção mínima e centralizada, não uma faixa vertical.
 */
const MARGIN_HANDLE_HITBOX_WIDTH_PX = 4;
const MARGIN_HANDLE_HITBOX_HEIGHT_PX = 7;

const MIN_MARGIN_OVERFLOW_PX = -cmToPx(3);

/**
 * Permite que os recuos ultrapassem as margens.
 *
 * Se quiser permitir avanço ainda maior para fora das margens,
 * aumente o módulo, por exemplo:
 *
 * -cmToPx(4)
 * -cmToPx(5)
 */
const MIN_INDENT_OVERFLOW_PX = -cmToPx(3);

const MIN_PRINTABLE_WIDTH_PX = cmToPx(3);
const MIN_PARAGRAPH_WIDTH_PX = cmToPx(2);
const TAB_STOP_REMOVE_OFFSET_PX = 18;

/**
 * Posição inicial do marcador superior de parágrafo.
 *
 * Se aumentar, o marcador desce.
 * Se diminuir, o marcador sobe e se aproxima da borda superior da régua.
 */
const TOP_INDENT_MARKER_TOP_PX = 1;

/**
 * Altura base de referência da régua.
 * Todos os marcadores escalam proporcionalmente a partir daqui.
 */
const RULER_BASE_HEIGHT_PX = 28;

type RulerMarkerVisualKind =
  | "firstLineIndent"
  | "leftIndentBase"
  | "rightIndent"
  | "tabLeft"
  | "tabCenter"
  | "tabRight"
  | "tabDecimal"
  | "tabBar";

type RulerMarkerVisualAdjustment = {
  offsetXPx: number;
  offsetYPx: number;
  svgOffsetXPx: number;
  svgOffsetYPx: number;
  buttonWidthPx: number;
  buttonHeightPx: number;
  svgWidthPx: number;
  svgHeightPx: number;
  zIndex: number;
};

/**
 * SISTEMA DE MICROAJUSTE DOS MARCADORES
 *
 * offsetXPx:
 * - positivo move o marcador inteiro para a direita.
 * - negativo move o marcador inteiro para a esquerda.
 *
 * offsetYPx:
 * - positivo desce o marcador inteiro.
 * - negativo sobe o marcador inteiro.
 *
 * svgOffsetXPx:
 * - move apenas o desenho do SVG no eixo X.
 * - não altera a área clicável.
 *
 * svgOffsetYPx:
 * - move apenas o desenho do SVG no eixo Y.
 * - não altera a área clicável.
 *
 * buttonWidthPx / buttonHeightPx:
 * - controlam a área clicável invisível.
 *
 * svgWidthPx / svgHeightPx:
 * - controlam o tamanho visual do desenho.
 *
 * zIndex:
 * - controla a camada visual.
 */
const RULER_MARKER_VISUAL_ADJUSTMENTS: Record<
  RulerMarkerVisualKind,
  RulerMarkerVisualAdjustment
> = {
  firstLineIndent: {
    offsetXPx: 0,
    offsetYPx: -0.95,
    svgOffsetXPx: 0,
    svgOffsetYPx: 0,
    buttonWidthPx: 17,
    buttonHeightPx: 10.4,
    svgWidthPx: 13.2,
    svgHeightPx: 10.4,
    zIndex: 60,
  },

  /**
   * Mantido acima do marcador de primeira linha para garantir
   * prioridade do marcador composto esquerdo no território vetorial dele.
   */
  leftIndentBase: {
    offsetXPx: 0,
    offsetYPx: 0,
    svgOffsetXPx: 0,
    svgOffsetYPx: 0,
    buttonWidthPx: 20,
    buttonHeightPx: 16,
    svgWidthPx: 15.4,
    svgHeightPx: 16,
    zIndex: 62,
  },

  rightIndent: {
    offsetXPx: 0,
    offsetYPx: 0,
    svgOffsetXPx: 0,
    svgOffsetYPx: 0,
    buttonWidthPx: 18,
    buttonHeightPx: 13.5,
    svgWidthPx: 13.6,
    svgHeightPx: 10.8,
    zIndex: 53,
  },

  tabLeft: {
    offsetXPx: 0,
    offsetYPx: 0,
    svgOffsetXPx: 0,
    svgOffsetYPx: 0,
    buttonWidthPx: 22,
    buttonHeightPx: 22,
    svgWidthPx: 15.25,
    svgHeightPx: 15.25,
    zIndex: 44,
  },

  tabCenter: {
    offsetXPx: 0,
    offsetYPx: 0,
    svgOffsetXPx: 0,
    svgOffsetYPx: 0,
    buttonWidthPx: 22,
    buttonHeightPx: 22,
    svgWidthPx: 15.25,
    svgHeightPx: 15.25,
    zIndex: 44,
  },

  tabRight: {
    offsetXPx: 0,
    offsetYPx: 0,
    svgOffsetXPx: 0,
    svgOffsetYPx: 0,
    buttonWidthPx: 22,
    buttonHeightPx: 22,
    svgWidthPx: 15.25,
    svgHeightPx: 15.25,
    zIndex: 44,
  },

  tabDecimal: {
    offsetXPx: 0,
    offsetYPx: 0,
    svgOffsetXPx: 0,
    svgOffsetYPx: 0,
    buttonWidthPx: 22,
    buttonHeightPx: 22,
    svgWidthPx: 15.25,
    svgHeightPx: 15.25,
    zIndex: 44,
  },

  tabBar: {
    offsetXPx: 0,
    offsetYPx: 0,
    svgOffsetXPx: 0,
    svgOffsetYPx: 0,
    buttonWidthPx: 22,
    buttonHeightPx: 22,
    svgWidthPx: 15.25,
    svgHeightPx: 15.25,
    zIndex: 44,
  },
};

function getRulerVisualScale(rulerHeightPx: number) {
  return rulerHeightPx / RULER_BASE_HEIGHT_PX;
}

function scaleMarkerValue(valuePx: number, rulerHeightPx: number) {
  return valuePx * getRulerVisualScale(rulerHeightPx);
}

/**
 * Mantém a caixa de texto sempre abaixo da régua.
 * Evita top negativo, que fazia a caixa se esconder sob a borda superior.
 */
function getMarkerTooltipTopPx(rulerHeightPx: number, markerY: number) {
  return Math.max(8, rulerHeightPx - markerY + 6);
}

function resolveMarkerVisualLayout({
  kind,
  x,
  y,
  rulerHeightPx,
  zoom,
}: {
  kind: RulerMarkerVisualKind;
  x: number;
  y: number;
  rulerHeightPx: number;
  zoom: number;
}) {
  const adjustment = RULER_MARKER_VISUAL_ADJUSTMENTS[kind];

  const buttonWidth = scaleMarkerValue(adjustment.buttonWidthPx, rulerHeightPx);
  const buttonHeight = scaleMarkerValue(
    adjustment.buttonHeightPx,
    rulerHeightPx,
  );
  const svgWidth = scaleMarkerValue(adjustment.svgWidthPx, rulerHeightPx);
  const svgHeight = scaleMarkerValue(adjustment.svgHeightPx, rulerHeightPx);

  return {
    buttonStyle: {
      left: x + adjustment.offsetXPx * zoom,
      top: y + scaleMarkerValue(adjustment.offsetYPx, rulerHeightPx),
      width: buttonWidth,
      height: buttonHeight,
      zIndex: adjustment.zIndex,
    },

    svgStyle: {
      width: svgWidth,
      height: svgHeight,
      left: `calc(50% + ${scaleMarkerValue(
        adjustment.svgOffsetXPx,
        rulerHeightPx,
      )}px)`,
      top: scaleMarkerValue(adjustment.svgOffsetYPx, rulerHeightPx),
    },
  };
}

function getTabStopVisualKind(type: TabStopType): RulerMarkerVisualKind {
  if (type === "center") return "tabCenter";
  if (type === "right") return "tabRight";
  if (type === "decimal") return "tabDecimal";
  if (type === "bar") return "tabBar";
  return "tabLeft";
}

function createQuarterTicks(widthPx: number): QuarterTick[] {
  const widthCm = Math.max(0, pxToCm(widthPx));
  const totalQuarters = Math.floor(widthCm * 4);

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

export function HorizontalDocumentRuler({
  pageWidthPx,
  pageMargins,
  paragraphIndents,
  tabStops,
  zoom,
  heightPx,
  showMargins,
  showIndentMarkers,
  showTabStops,
  insertTabStopType: _insertTabStopType,
  onChangeMargins,
  onChangeIndents,
  onChangeTabStops,
  onRightButtonGuideStart,
  onRightButtonGuideMove,
  onRightButtonGuideEnd,
}: HorizontalDocumentRulerProps) {
  const rulerRef = useRef<HTMLDivElement | null>(null);
  const dragStateRef = useRef<HorizontalDragState>({ mode: "none" });
  const rightButtonGuideActiveRef = useRef(false);
  const [activeDragMode, setActiveDragMode] = useState<RulerDragMode>("none");
  const [hoveredMarginSide, setHoveredMarginSide] = useState<MarginSide | null>(
    null,
  );

  const rulerHeightPx = Math.max(28, heightPx);
  const visualWidthPx = applyZoom(pageWidthPx, zoom);

  const printableWidthPx = Math.max(
    0,
    pageWidthPx - pageMargins.leftPx - pageMargins.rightPx,
  );

  const pageQuarterTicks = useMemo(() => {
    return createQuarterTicks(pageWidthPx);
  }, [pageWidthPx]);

  const printableQuarterTicks = useMemo(() => {
    return createQuarterTicks(printableWidthPx);
  }, [printableWidthPx]);

  useEffect(() => {
    return () => {
      document.body.style.userSelect = "";
    };
  }, []);

  const getRealPositionFromEvent = (
    event: ReactPointerEvent<HTMLDivElement>,
    allowOverflow = false,
  ) => {
    const rect = rulerRef.current?.getBoundingClientRect();

    if (!rect) {
      return 0;
    }

    const rawPositionPx = event.clientX - rect.left;
    const boundedPositionPx = clampNumber(rawPositionPx, 0, visualWidthPx);

    return removeZoom(allowOverflow ? rawPositionPx : boundedPositionPx, zoom);
  };

  const stopDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const hadDragMode = dragStateRef.current.mode !== "none";
    dragStateRef.current = { mode: "none" };
    setActiveDragMode("none");
    setHoveredMarginSide(null);
    document.body.style.userSelect = "";

    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture pode já ter sido liberado pelo navegador.
    }

    if (rightButtonGuideActiveRef.current && (event.buttons & 2) === 0) {
      rightButtonGuideActiveRef.current = false;
      onRightButtonGuideEnd?.();
    }

    if (hadDragMode) {
      onRightButtonGuideEnd?.();
    }
  };

  const startDrag = (
    event: ReactPointerEvent<Element>,
    mode: RulerDragMode,
    tabStopId?: string,
    leftCompositeRegion?: "upper" | "lower",
  ) => {
    event.preventDefault();
    event.stopPropagation();

    dragStateRef.current = { mode, tabStopId, leftCompositeRegion };
    setActiveDragMode(mode);
    setHoveredMarginSide(
      mode === "margin-left"
        ? "left"
        : mode === "margin-right"
          ? "right"
          : null,
    );
    document.body.style.userSelect = "none";

    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture é apenas uma melhoria.
    }
  };

  const handleRulerPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button === 2) {
      event.preventDefault();
      rightButtonGuideActiveRef.current = true;
      onRightButtonGuideStart?.({
        clientX: event.clientX,
        clientY: event.clientY,
      });
      return;
    }

    /**
     * Clique esquerdo na régua não cria mais marcas.
     * As marcas já existentes continuam arrastáveis.
     */
  };

  const handleRulerMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.button !== 2) return;

    event.preventDefault();
    rightButtonGuideActiveRef.current = true;
    onRightButtonGuideStart?.({
      clientX: event.clientX,
      clientY: event.clientY,
    });
  };

  const handleRulerMouseMove = (event: ReactMouseEvent<HTMLDivElement>) => {
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

  const handleRulerMouseUp = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (
      (event.button === 2 || (event.buttons & 2) === 0) &&
      rightButtonGuideActiveRef.current
    ) {
      rightButtonGuideActiveRef.current = false;
      onRightButtonGuideEnd?.();
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

    const positionPx = getRealPositionFromEvent(event);

    if (dragState.mode === "margin-left") {
      const overflowPositionPx = getRealPositionFromEvent(event, true);

      onChangeMargins({
        ...pageMargins,
        leftPx: clampNumber(
          overflowPositionPx,
          MIN_MARGIN_OVERFLOW_PX,
          pageWidthPx - pageMargins.rightPx - MIN_PRINTABLE_WIDTH_PX,
        ),
      });

      return;
    }

    if (dragState.mode === "margin-right") {
      const overflowPositionPx = getRealPositionFromEvent(event, true);
      const rightPx = pageWidthPx - overflowPositionPx;

      onChangeMargins({
        ...pageMargins,
        rightPx: clampNumber(
          rightPx,
          MIN_MARGIN_OVERFLOW_PX,
          pageWidthPx - pageMargins.leftPx - MIN_PRINTABLE_WIDTH_PX,
        ),
      });

      return;
    }

    const indentPositionPx = getRealPositionFromEvent(event, true);
    const printableLeftPx = pageMargins.leftPx;
    const printableRightPx = pageWidthPx - pageMargins.rightPx;
    const realPrintableWidthPx = printableRightPx - printableLeftPx;

    if (dragState.mode === "indent-left") {
      const nextLeftPx = clampNumber(
        indentPositionPx - printableLeftPx,
        MIN_INDENT_OVERFLOW_PX,
        realPrintableWidthPx - MIN_PARAGRAPH_WIDTH_PX,
      );

      if (dragState.leftCompositeRegion === "upper") {
        const leftDeltaPx = nextLeftPx - paragraphIndents.leftPx;

        const nextFirstLinePx = clampNumber(
          paragraphIndents.firstLinePx - leftDeltaPx,
          MIN_INDENT_OVERFLOW_PX,
          realPrintableWidthPx - nextLeftPx + cmToPx(2),
        );

        onChangeIndents({
          ...paragraphIndents,
          leftPx: nextLeftPx,
          firstLinePx: nextFirstLinePx,
        });

        return;
      }

      onChangeIndents({
        ...paragraphIndents,
        leftPx: nextLeftPx,
      });

      return;
    }

    if (dragState.mode === "indent-right") {
      onChangeIndents({
        ...paragraphIndents,
        rightPx: clampNumber(
          printableRightPx - indentPositionPx,
          MIN_INDENT_OVERFLOW_PX,
          realPrintableWidthPx - MIN_PARAGRAPH_WIDTH_PX,
        ),
      });

      return;
    }

    if (dragState.mode === "indent-first-line") {
      onChangeIndents({
        ...paragraphIndents,
        firstLinePx: clampNumber(
          indentPositionPx - printableLeftPx - paragraphIndents.leftPx,
          MIN_INDENT_OVERFLOW_PX,
          realPrintableWidthPx - paragraphIndents.leftPx + cmToPx(2),
        ),
      });

      return;
    }

    if (dragState.mode === "indent-hanging") {
      onChangeIndents({
        ...paragraphIndents,
        hangingPx: clampNumber(
          indentPositionPx - printableLeftPx - paragraphIndents.leftPx,
          MIN_INDENT_OVERFLOW_PX,
          realPrintableWidthPx - paragraphIndents.leftPx + cmToPx(2),
        ),
      });

      return;
    }

    if (dragState.mode === "tab-stop" && dragState.tabStopId) {
      const rulerRect = rulerRef.current?.getBoundingClientRect();

      const rawPositionPx = rulerRect
        ? removeZoom(event.clientX - rulerRect.left, zoom)
        : positionPx;

      const shouldRemove =
        event.clientY <
        (rulerRef.current?.getBoundingClientRect().top ?? 0) -
          TAB_STOP_REMOVE_OFFSET_PX;

      onChangeTabStops(
        shouldRemove
          ? tabStops.filter((tabStop) => tabStop.id !== dragState.tabStopId)
          : tabStops.map((tabStop) =>
              tabStop.id === dragState.tabStopId
                ? {
                    ...tabStop,
                    positionPx: clampNumber(
                      rawPositionPx,
                      -cmToPx(2),
                      pageWidthPx + cmToPx(2),
                    ),
                  }
                : tabStop,
            ),
      );
    }
  };

  const leftMarginX = applyZoom(pageMargins.leftPx, zoom);
  const rightMarginX = applyZoom(pageWidthPx - pageMargins.rightPx, zoom);
  const printableWidthX = Math.max(0, rightMarginX - leftMarginX);

  const leftIndentX = applyZoom(
    pageMargins.leftPx + paragraphIndents.leftPx,
    zoom,
  );

  const firstLineX = applyZoom(
    pageMargins.leftPx + paragraphIndents.leftPx + paragraphIndents.firstLinePx,
    zoom,
  );

  const rightIndentX = applyZoom(
    pageWidthPx - pageMargins.rightPx - paragraphIndents.rightPx,
    zoom,
  );

  /**
   * Gap em relação à borda inferior da régua.
   *
   * Se aumentar, sobe os marcadores inferiores.
   * Se diminuir, desce os marcadores inferiores.
   */
  const wordRulerBottomBorderGapPx = 1;

  const leftIndentBaseVisualHeightPx = scaleMarkerValue(
    RULER_MARKER_VISUAL_ADJUSTMENTS.leftIndentBase.svgHeightPx,
    rulerHeightPx,
  );

  const rightMarkerVisualHeightPx = scaleMarkerValue(
    RULER_MARKER_VISUAL_ADJUSTMENTS.rightIndent.svgHeightPx,
    rulerHeightPx,
  );

  const wordLeftBaseTopPx =
    rulerHeightPx - leftIndentBaseVisualHeightPx - wordRulerBottomBorderGapPx;

  const wordRightMarkerTopPx =
    rulerHeightPx - rightMarkerVisualHeightPx - wordRulerBottomBorderGapPx;

  const cursorClassName =
    activeDragMode === "none" ? "cursor-default" : "cursor-ew-resize";

  return (
    <div
      ref={rulerRef}
      className={`relative shrink-0 overflow-visible select-none ${cursorClassName}`}
      style={{
        width: visualWidthPx,
        height: rulerHeightPx,
        zIndex: 2,
        backgroundColor: WORD_RULER_BACKGROUND,
        borderColor: WORD_RULER_BORDER,
        fontFamily:
          'Arial, "Segoe UI", system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
      onPointerDown={handleRulerPointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onMouseDown={handleRulerMouseDown}
      onMouseMove={handleRulerMouseMove}
      onMouseUp={handleRulerMouseUp}
      onContextMenu={(event) => {
        if (rightButtonGuideActiveRef.current) {
          event.preventDefault();
        }
      }}
      aria-label="Régua horizontal do documento"
    >
      {showMargins ? (
        <>
          <div
            className="pointer-events-none absolute top-0"
            style={{
              left: 0,
              width: Math.max(0, leftMarginX),
              height: rulerHeightPx,
              backgroundColor: WORD_RULER_MARGIN,
              boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.12)",
            }}
          />

          <div
            className="pointer-events-none absolute top-0"
            style={{
              left: leftMarginX,
              width: printableWidthX,
              height: rulerHeightPx,
              backgroundColor: WORD_RULER_PAGE,
              boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.12)",
            }}
          />

          <div
            className="pointer-events-none absolute top-0"
            style={{
              left: rightMarginX,
              width: Math.max(0, visualWidthPx - rightMarginX),
              height: rulerHeightPx,
              backgroundColor: WORD_RULER_MARGIN,
              boxShadow: "inset 0 -1px 0 rgba(0,0,0,0.12)",
            }}
          />

          <div
            className="pointer-events-none absolute top-0 w-px"
            style={{
              left: leftMarginX,
              height: rulerHeightPx,
              backgroundColor: WORD_RULER_MARGIN_DARK,
            }}
          />

          <div
            className="pointer-events-none absolute top-0 w-px"
            style={{
              left: rightMarginX,
              height: rulerHeightPx,
              backgroundColor: WORD_RULER_MARGIN_DARK,
            }}
          />
        </>
      ) : null}

      {pageQuarterTicks.map((tick) => {
        const x = applyZoom(tick.positionPx, zoom);
        const isInsidePrintableArea = x >= leftMarginX && x <= rightMarginX;

        if (isInsidePrintableArea) {
          return null;
        }

        const tickHeight = tick.isCentimeter ? 7 : tick.isHalfCentimeter ? 5 : 3;

        return (
          <span
            key={`h-page-quarter-${tick.index}`}
            className="pointer-events-none absolute block w-px"
            style={{
              left: x,
              top: 2,
              height: tickHeight,
              backgroundColor: WORD_RULER_TICK_MUTED,
              opacity: 0.5,
            }}
          />
        );
      })}

      {printableQuarterTicks.map((tick) => {
        const x = leftMarginX + applyZoom(tick.positionPx, zoom);

        const tickHeight = tick.isCentimeter ? 8 : tick.isHalfCentimeter ? 5 : 3;
        const shouldShowNumber = tick.isCentimeter && tick.index > 0;
        const label = Math.round(tick.cmValue);

        return (
          <span
            key={`h-printable-quarter-${tick.index}`}
            className="pointer-events-none absolute block"
            style={{ left: x }}
          >
            <span
              className="absolute block w-px"
              style={{
                top: 2,
                height: tickHeight,
                backgroundColor: WORD_RULER_TICK,
                opacity: shouldShowNumber ? 0.9 : 0.72,
              }}
            />

            {shouldShowNumber ? (
              <span
                className="absolute -translate-x-1/2 whitespace-nowrap text-center"
                style={{
                  top: 15,
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

      {showMargins ? (
        <>
          <MarginHandle
            x={leftMarginX}
            y={0}
            rulerHeightPx={rulerHeightPx}
            label={`Mover margem esquerda ${pxToCm(pageMargins.leftPx).toFixed(
              1,
            )} cm`}
            mode="margin-left"
            side="left"
            displayLabel="Margem esquerda"
            valueCm={pxToCm(pageMargins.leftPx)}
            isVisible={
              hoveredMarginSide === "left" || activeDragMode === "margin-left"
            }
            isDragging={activeDragMode === "margin-left"}
            onHoverChange={setHoveredMarginSide}
            onPointerDown={startDrag}
          />

          <MarginHandle
            x={rightMarginX}
            y={0}
            rulerHeightPx={rulerHeightPx}
            label={`Mover margem direita ${pxToCm(pageMargins.rightPx).toFixed(
              1,
            )} cm`}
            mode="margin-right"
            side="right"
            displayLabel="Margem direita"
            valueCm={pxToCm(pageMargins.rightPx)}
            isVisible={
              hoveredMarginSide === "right" ||
              activeDragMode === "margin-right"
            }
            isDragging={activeDragMode === "margin-right"}
            onHoverChange={setHoveredMarginSide}
            onPointerDown={startDrag}
          />
        </>
      ) : null}

      {showIndentMarkers ? (
        <>
          <FirstLineIndentMarker
            x={firstLineX}
            y={TOP_INDENT_MARKER_TOP_PX}
            rulerHeightPx={rulerHeightPx}
            zoom={zoom}
            label="Recuo da primeira linha"
            mode="indent-first-line"
            min={-3}
            max={20}
            value={pxToCm(paragraphIndents.firstLinePx)}
            onPointerDown={startDrag}
          />

          <LeftIndentCompositeMarker
            x={leftIndentX}
            y={wordLeftBaseTopPx}
            rulerHeightPx={rulerHeightPx}
            zoom={zoom}
            label="Recuo esquerdo"
            leftValue={pxToCm(paragraphIndents.leftPx)}
            hangingValue={pxToCm(paragraphIndents.hangingPx)}
            onPointerDown={startDrag}
          />

          <RightIndentMarker
            x={rightIndentX}
            y={wordRightMarkerTopPx}
            rulerHeightPx={rulerHeightPx}
            zoom={zoom}
            label="Recuo direito"
            mode="indent-right"
            min={-3}
            max={20}
            value={pxToCm(paragraphIndents.rightPx)}
            onPointerDown={startDrag}
          />
        </>
      ) : null}

      {showTabStops
        ? tabStops.map((tabStop) => (
            <TabStopMarkerButton
              key={tabStop.id}
              tabStop={tabStop}
              zoom={zoom}
              rulerHeightPx={rulerHeightPx}
              onPointerDown={(event) =>
                startDrag(event, "tab-stop", tabStop.id)
              }
            />
          ))
        : null}
    </div>
  );
}

function MarginHandle({
  x,
  y,
  rulerHeightPx,
  label,
  mode,
  side,
  displayLabel,
  valueCm,
  isVisible,
  isDragging,
  onHoverChange,
  onPointerDown,
}: {
  x: number;
  y: number;
  rulerHeightPx: number;
  label: string;
  mode: RulerDragMode;
  side: MarginSide;
  displayLabel: string;
  valueCm: number;
  isVisible: boolean;
  isDragging: boolean;
  onHoverChange: (side: MarginSide | null) => void;
  onPointerDown: (
    event: ReactPointerEvent<Element>,
    mode: RulerDragMode,
    tabStopId?: string,
    leftCompositeRegion?: "upper" | "lower",
  ) => void;
}) {
  return (
    <button
      type="button"
      data-ruler-control="true"
      aria-label={label}
      className="absolute -translate-x-1/2 bg-transparent p-0"
      style={{
        left: x,
        top:
          y +
          Math.round(rulerHeightPx / 2) -
          MARGIN_HANDLE_HITBOX_HEIGHT_PX / 2,

        /**
         * Microzona real de captura da margem.
         * A seta bidirecional só aparece e funciona nesta porção central.
         */
        width: MARGIN_HANDLE_HITBOX_WIDTH_PX,
        height: MARGIN_HANDLE_HITBOX_HEIGHT_PX,

        /**
         * Pode ficar alto porque a área agora é mínima.
         */
        zIndex: 90,
        cursor: "ew-resize",
      }}
      onPointerEnter={() => onHoverChange(side)}
      onPointerLeave={() => {
        if (!isDragging) {
          onHoverChange(null);
        }
      }}
      onPointerDown={(event) => onPointerDown(event, mode)}
    >
      {isVisible ? (
        <>
          <span
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-sm border px-1.5 py-[2px] text-[10px] leading-none shadow-sm"
            style={{
              top: MARGIN_HANDLE_HITBOX_HEIGHT_PX + 8,
              borderColor: isDragging ? MARKER_STROKE : WORD_RULER_BORDER,
              backgroundColor: "#ffffff",
              color: WORD_RULER_NUMBER,
              fontWeight: isDragging ? 600 : 400,
              zIndex: 120,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {displayLabel} {valueCm.toFixed(1)} cm
          </span>

          {/*
            A seta é visualmente grande, mas não amplia a zona de captura.
            O pointer-events-none garante que só a microzona do botão capture.
          */}
          <span
            className="pointer-events-none absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
            style={{
              top: "50%",
              color: MARKER_STROKE,
            }}
          >
            <svg
              viewBox="0 0 24 12"
              aria-hidden="true"
              className="overflow-visible"
              style={{
                width: MARGIN_HANDLE_ARROW_WIDTH_PX,
                height: MARGIN_HANDLE_ARROW_HEIGHT_PX,
              }}
            >
              <path
                d="M2 6H22"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
              />
              <path
                d="M5.6 2L2 6l3.6 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M18.4 2L22 6l-3.6 4"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.9"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        </>
      ) : null}
    </button>
  );
}

function FirstLineIndentMarker({
  x,
  y,
  rulerHeightPx,
  zoom,
  label,
  mode,
  min = 0,
  max = 20,
  value,
  onPointerDown,
}: MarkerButtonProps) {
  const [isHovered, setIsHovered] = useState(false);

  const layout = resolveMarkerVisualLayout({
    kind: "firstLineIndent",
    x,
    y,
    rulerHeightPx,
    zoom,
  });

  return (
    <button
      type="button"
      data-ruler-control="true"
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Number(value.toFixed(2))}
      className="absolute -translate-x-1/2 bg-transparent p-0"
      style={{
        ...layout.buttonStyle,
        pointerEvents: "none",
      }}
    >
      {isHovered ? (
        <span
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-sm border px-1.5 py-[2px] text-[10px] leading-none shadow-sm"
          style={{
            top: getMarkerTooltipTopPx(rulerHeightPx, y),
            borderColor: WORD_RULER_BORDER,
            backgroundColor: "#ffffff",
            color: WORD_RULER_NUMBER,
            zIndex: 120,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          Recuo da primeira linha {value.toFixed(1)} cm
        </span>
      ) : null}

      <svg
        viewBox="0 0 16 13"
        aria-hidden="true"
        className="absolute -translate-x-1/2 overflow-visible"
        style={{
          ...layout.svgStyle,
          pointerEvents: "auto",
        }}
      >
        {/*
          Marcador de parágrafo.
          Aponta para baixo.
          Sem divisória interna.
          Um pouco mais baixo em altura.
        */}
        <path
          d="M3.35 1.15H12.65V6.55L8 11.55L3.35 6.55Z"
          fill={MARKER_FILL}
          stroke={MARKER_STROKE}
          strokeWidth="1"
          strokeLinejoin="round"
          pointerEvents="none"
        />

        {/*
          Zona vetorial real de captura do marcador de parágrafo.
          O path transparente captura somente o território vetorial do marcador.
        */}
        <path
          data-ruler-control="true"
          data-ruler-region="first-line-indent"
          d="M3.35 1.15H12.65V6.55L8 11.55L3.35 6.55Z"
          fill={SVG_CAPTURE_FILL}
          stroke="none"
          pointerEvents="all"
          onPointerEnter={() => setIsHovered(true)}
          onPointerLeave={() => setIsHovered(false)}
          onPointerDown={(event) => onPointerDown(event, mode)}
        />
      </svg>
    </button>
  );
}

function LeftIndentCompositeMarker({
  x,
  y,
  rulerHeightPx,
  zoom,
  label,
  leftValue,
  hangingValue,
  onPointerDown,
}: {
  x: number;
  y: number;
  rulerHeightPx: number;
  zoom: number;
  label: string;
  leftValue: number;
  hangingValue: number;
  onPointerDown: (
    event: ReactPointerEvent<Element>,
    mode: RulerDragMode,
    tabStopId?: string,
    leftCompositeRegion?: "upper" | "lower",
  ) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  const layout = resolveMarkerVisualLayout({
    kind: "leftIndentBase",
    x,
    y,
    rulerHeightPx,
    zoom,
  });

  return (
    <div
      data-ruler-control="true"
      className="absolute -translate-x-1/2 overflow-visible"
      style={{
        ...layout.buttonStyle,
        overflow: "visible",
        pointerEvents: "none",
      }}
    >
      {isHovered ? (
        <span
          className="pointer-events-none absolute left-1/2 -translate-x-1/2 whitespace-nowrap rounded-sm border px-1.5 py-[2px] text-[10px] leading-none shadow-sm"
          style={{
            top: getMarkerTooltipTopPx(rulerHeightPx, y),
            borderColor: WORD_RULER_BORDER,
            backgroundColor: "#ffffff",
            color: WORD_RULER_NUMBER,
            zIndex: 120,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          Recuo à esquerda {leftValue.toFixed(1)} cm
        </span>
      ) : null}

      <svg
        viewBox="0 0 16 16"
        aria-hidden="true"
        className="absolute left-1/2 top-0 -translate-x-1/2 overflow-visible"
        style={{
          ...layout.svgStyle,
          pointerEvents: "auto",
        }}
      >
        {/*
          Parte superior visual do marcador de recuo esquerdo.
          Não há seta visual aqui. A própria ponta do mouse movimenta.
        */}
        <path
          d="M8 0.65L12.65 5.05V8H3.35V5.05Z"
          fill={MARKER_FILL}
          stroke={MARKER_STROKE}
          strokeWidth="1"
          strokeLinejoin="round"
          pointerEvents="none"
        />

        {/*
          Base visual do marcador de recuo esquerdo.
          Não há seta visual aqui. A própria ponta do mouse movimenta.
        */}
        <path
          d="M3.35 8H12.65V14.85H3.35Z"
          fill={MARKER_FILL}
          stroke={MARKER_STROKE}
          strokeWidth="1"
          strokeLinejoin="round"
          pointerEvents="none"
        />

        {/*
          Zona vetorial real da parte superior.
          Mantém a funcionalidade upper.
        */}
        <path
          data-ruler-control="true"
          data-ruler-region="upper-left-indent"
          d="M8 0.65L12.65 5.05V8H3.35V5.05Z"
          fill={SVG_CAPTURE_FILL}
          stroke="none"
          pointerEvents="all"
          onPointerEnter={() => setIsHovered(true)}
          onPointerLeave={() => setIsHovered(false)}
          onPointerDown={(event) =>
            onPointerDown(event, "indent-left", undefined, "upper")
          }
        />

        {/*
          Zona vetorial real da base inferior.
          Mantém a funcionalidade lower.
        */}
        <path
          data-ruler-control="true"
          data-ruler-region="lower-left-indent"
          d="M3.35 8H12.65V14.85H3.35Z"
          fill={SVG_CAPTURE_FILL}
          stroke="none"
          pointerEvents="all"
          onPointerEnter={() => setIsHovered(true)}
          onPointerLeave={() => setIsHovered(false)}
          onPointerDown={(event) =>
            onPointerDown(event, "indent-left", undefined, "lower")
          }
        />
      </svg>
    </div>
  );
}

function RightIndentMarker({
  x,
  y,
  rulerHeightPx,
  zoom,
  label,
  mode,
  min = 0,
  max = 20,
  value,
  onPointerDown,
}: MarkerButtonProps) {
  const layout = resolveMarkerVisualLayout({
    kind: "rightIndent",
    x,
    y,
    rulerHeightPx,
    zoom,
  });

  return (
    <button
      type="button"
      data-ruler-control="true"
      role="slider"
      aria-label={label}
      aria-valuemin={min}
      aria-valuemax={max}
      aria-valuenow={Number(value.toFixed(2))}
      className="absolute -translate-x-1/2 cursor-ew-resize bg-transparent p-0"
      style={layout.buttonStyle}
      onPointerDown={(event) => onPointerDown(event, mode)}
    >
      <svg
        viewBox="0 0 16 13"
        aria-hidden="true"
        className="absolute -translate-x-1/2 overflow-visible"
        style={layout.svgStyle}
      >
        {/*
          Marcador de recuo direito.
          Aponta para cima.
          Sem divisória interna.
        */}
        <path
          d="M8 1.15L12.65 6.55V11.85H3.35V6.55Z"
          fill={MARKER_FILL}
          stroke={MARKER_STROKE}
          strokeWidth="1"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}

function TabStopMarkerButton({
  tabStop,
  zoom,
  rulerHeightPx,
  onPointerDown,
}: {
  tabStop: TabStop;
  zoom: number;
  rulerHeightPx: number;
  onPointerDown: (event: ReactPointerEvent<Element>) => void;
}) {
  const tabLabel =
    tabStop.type === "center"
      ? "Tabulação central"
      : tabStop.type === "right"
        ? "Tabulação direita"
        : tabStop.type === "decimal"
          ? "Tabulação decimal"
          : tabStop.type === "bar"
            ? "Tabulação barra"
            : "Tabulação esquerda";

  const visualKind = getTabStopVisualKind(tabStop.type);

  const tabVisualHeightPx = scaleMarkerValue(
    RULER_MARKER_VISUAL_ADJUSTMENTS[visualKind].svgHeightPx,
    rulerHeightPx,
  );

  /**
   * Se aumentar, o marcador de tabulação sobe.
   * Se diminuir, ele desce.
   */
  const tabBottomBorderGapPx = 1;

  const layout = resolveMarkerVisualLayout({
    kind: visualKind,
    x: applyZoom(tabStop.positionPx, zoom),
    y: rulerHeightPx - tabVisualHeightPx - tabBottomBorderGapPx,
    rulerHeightPx,
    zoom,
  });

  return (
    <button
      type="button"
      data-ruler-control="true"
      className="absolute -translate-x-1/2 cursor-ew-resize bg-transparent p-0"
      style={{
        ...layout.buttonStyle,
        color: MARKER_STROKE,
      }}
      title={`${tabLabel}. Arraste para mover. Arraste para cima para remover.`}
      aria-label={tabLabel}
      onPointerDown={(event) => onPointerDown(event)}
    >
      <svg
        viewBox="0 0 12 12"
        aria-hidden="true"
        className="absolute -translate-x-1/2 overflow-visible"
        style={layout.svgStyle}
      >
        <TabStopGlyph type={tabStop.type} />
      </svg>
    </button>
  );
}

function TabStopGlyph({ type }: { type: TabStopType }) {
  if (type === "center") {
    return (
      <>
        <path
          d="M6 0.95V11"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="square"
        />
        <path
          d="M2 10.7H10"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="square"
        />
      </>
    );
  }

  if (type === "right") {
    return (
      <>
        <path
          d="M9.05 0.95V11"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="square"
        />
        <path
          d="M2 10.7H9.05"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="square"
        />
      </>
    );
  }

  if (type === "decimal") {
    return (
      <>
        <path
          d="M5.8 0.95V8.2"
          stroke="currentColor"
          strokeWidth="1.25"
          strokeLinecap="square"
        />
        <circle cx="5.8" cy="10.35" r="1.1" fill="currentColor" />
      </>
    );
  }

  if (type === "bar") {
    return (
      <path
        d="M6 0.95V11"
        stroke="currentColor"
        strokeWidth="1.35"
        strokeLinecap="square"
      />
    );
  }

  return (
    <>
      <path
        d="M2.95 0.95V11"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="square"
      />
      <path
        d="M2.95 10.7H10"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinecap="square"
      />
    </>
  );
}