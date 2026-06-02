"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import {
  calculateRulerTicks,
  computeRulerMeasurementOrigin,
  computeRulerScrollSync,
} from "../knex-pdf-engine";
import { getKnexPdfRenderInteractionState } from "./PdfInteractionRenderGuard";

export type PdfReadingFrameMetrics = {
  viewportWidth: number;
  viewportHeight: number;
  contentWidth: number;
  contentHeight: number;
  contentLeft: number;
  viewportCenterX: number;
  pageCenterX: number;
};

type ViewportSnapshot = {
  width: number;
  height: number;
  outerWidth: number;
  outerHeight: number;
  rectLeft: number;
  rectTop: number;
  scrollLeft: number;
  scrollTop: number;
};

type ReadingFrameGeometry = {
  topRulerHeight: number;
  leftRulerWidth: number;
  stagePaddingX: number;
  stagePaddingY: number;
  frameLeftInset: number;
  availableWidth: number;

  /**
   * Posição absoluta da página dentro do sistema de coordenadas rolável.
   * Esta é a origem métrica da régua.
   */
  contentLeft: number;

  /**
   * Largura real da página/conjunto renderizado.
   */
  contentWidth: number;
  contentHeight: number;

  /**
   * Largura do trilho que estabiliza o layout.
   * Quando a página é menor que o viewport, o trilho tem a largura disponível.
   * Quando a página é maior, o trilho tem a largura da página.
   *
   * Isso evita depender de mx-auto e reduz saltos laterais ao cruzar o limite
   * entre página centralizada e página com overflow.
   */
  contentTrackWidth: number;

  /**
   * Deslocamento explícito da página dentro do trilho.
   * Substitui o uso de mx-auto.
   */
  pageOffsetWithinTrack: number;

  rulerZeroX: number;
  rulerContentWidth: number;
  layoutVersion: number;
};

const TOP_RULER_HEIGHT = 24;
const LEFT_RULER_WIDTH = 28;
const STAGE_PADDING_X = 20;
const STAGE_PADDING_Y = 20;
const FALLBACK_PX_PER_CENTIMETER = 96 / 2.54;
const SUBPIXEL_TOLERANCE = 0.5;
const RULER_TICK_BUFFER_VIEWPORTS = 0.75;

/**
 * O scrollzoom estava apresentando piscadas laterais.
 *
 * A causa provável é a combinação de:
 * - contentWidth mudando durante o gesto;
 * - centralização recalculada com frações de pixel;
 * - PdfReaderShell tentando preservar a âncora do zoom;
 * - PdfReadingFrame também escrevendo root.scrollLeft ao mesmo tempo.
 *
 * Para reduzir esse conflito, a geometria horizontal do frame é estabilizada em
 * pixels inteiros e a preservação imperativa de scrollLeft é desligada enquanto
 * o guard global de interação do PDF está ativo.
 */
const LAYOUT_PIXEL_GRID = 1;

function safeNumber(value: number | null | undefined, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function clamp(value: number, min: number, max: number): number {
  const safeMin = safeNumber(min, 0);
  const safeMax = Math.max(safeMin, safeNumber(max, safeMin));
  const safeValue = safeNumber(value, safeMin);

  return Math.max(safeMin, Math.min(safeMax, safeValue));
}

function snapLayoutPixel(value: number): number {
  const grid = Math.max(0.25, LAYOUT_PIXEL_GRID);

  return Math.round(safeNumber(value, 0) / grid) * grid;
}

function isPdfViewportInteractionActive(): boolean {
  try {
    return getKnexPdfRenderInteractionState() !== "idle";
  } catch {
    return false;
  }
}

function nearlyEqual(
  a: number,
  b: number,
  tolerance = SUBPIXEL_TOLERANCE,
): boolean {
  return Math.abs(a - b) <= tolerance;
}

function createViewportSnapshot(root: HTMLDivElement): ViewportSnapshot {
  const rect = root.getBoundingClientRect();

  return {
    width: root.clientWidth,
    height: root.clientHeight,
    outerWidth: rect.width,
    outerHeight: rect.height,
    rectLeft: rect.left,
    rectTop: rect.top,
    scrollLeft: root.scrollLeft,
    scrollTop: root.scrollTop,
  };
}

function sameViewportSnapshot(
  current: ViewportSnapshot,
  next: ViewportSnapshot,
): boolean {
  return (
    nearlyEqual(current.width, next.width) &&
    nearlyEqual(current.height, next.height) &&
    nearlyEqual(current.outerWidth, next.outerWidth) &&
    nearlyEqual(current.outerHeight, next.outerHeight) &&
    nearlyEqual(current.rectLeft, next.rectLeft) &&
    nearlyEqual(current.rectTop, next.rectTop) &&
    nearlyEqual(current.scrollLeft, next.scrollLeft) &&
    nearlyEqual(current.scrollTop, next.scrollTop)
  );
}

function pointsToCentimeters(points?: number): number {
  return points && Number.isFinite(points) ? (points / 72) * 2.54 : 0;
}

function getReadingViewportCenterX(input: {
  viewportWidth: number;
  frameLeftInset: number;
}): number {
  const viewportWidth = Math.max(1, safeNumber(input.viewportWidth, 1));
  const frameLeftInset = Math.max(0, safeNumber(input.frameLeftInset, 0));

  return frameLeftInset + Math.max(0, viewportWidth - frameLeftInset) / 2;
}

function shouldPreserveHorizontalGeometry(
  previous: ReadingFrameGeometry,
  next: ReadingFrameGeometry,
): boolean {
  return (
    !nearlyEqual(previous.contentLeft, next.contentLeft) ||
    !nearlyEqual(previous.contentWidth, next.contentWidth) ||
    !nearlyEqual(previous.contentTrackWidth, next.contentTrackWidth) ||
    !nearlyEqual(previous.availableWidth, next.availableWidth) ||
    previous.layoutVersion !== next.layoutVersion
  );
}

/**
 * Preserva a posição visual horizontal quando a geometria da página muda.
 *
 * Problema que corrige:
 * - Ao aumentar/reduzir zoom, contentWidth muda.
 * - Ao cruzar o limite entre "cabe no viewport" e "não cabe", o layout mudava
 *   de mx-auto para alinhamento à esquerda.
 * - Isso gerava salto lateral.
 *
 * Estratégia:
 * - Captura onde o centro do viewport estava dentro da página antiga.
 * - Reposiciona scrollLeft para manter o mesmo ponto relativo da página
 *   no centro do viewport após a nova geometria.
 */
function preserveHorizontalPositionAfterGeometryChange(input: {
  root: HTMLDivElement;
  previous: ReadingFrameGeometry;
  next: ReadingFrameGeometry;
}): boolean {
  const { root, previous, next } = input;

  if (!shouldPreserveHorizontalGeometry(previous, next)) {
    return false;
  }

  if (root.clientWidth <= 0 || next.contentWidth <= 0) {
    return false;
  }

  const previousPageWidth = Math.max(1, previous.contentWidth);
  const viewportCenterBefore = root.scrollLeft + root.clientWidth / 2;

  let localRatio =
    (viewportCenterBefore - previous.contentLeft) / previousPageWidth;

  if (!Number.isFinite(localRatio)) {
    localRatio = 0.5;
  }

  localRatio = clamp(localRatio, 0, 1);

  const desiredScrollLeft =
    next.contentLeft + localRatio * next.contentWidth - root.clientWidth / 2;

  const maxScrollLeft = Math.max(0, root.scrollWidth - root.clientWidth);
  const nextScrollLeft = clamp(desiredScrollLeft, 0, maxScrollLeft);

  if (nearlyEqual(root.scrollLeft, nextScrollLeft)) {
    return false;
  }

  root.scrollLeft = nextScrollLeft;
  return true;
}

export function PdfReadingFrame({
  containerRef,
  contentWidth,
  contentHeight,
  rulerContentWidth = contentWidth,
  pageWidthPt,
  pageHeightPt,
  showRuler,
  showMargins,
  showViewportCenter,
  showPageCenter,
  leftMarginPx,
  rightMarginPx,
  onMetricsChange,
  children,
}: {
  containerRef: RefObject<HTMLDivElement | null>;
  contentWidth: number;
  contentHeight?: number;
  rulerContentWidth?: number;
  pageWidthPt?: number;
  pageHeightPt?: number;
  showRuler: boolean;
  showMargins: boolean;
  showViewportCenter: boolean;
  showPageCenter: boolean;
  leftMarginPx: number;
  rightMarginPx: number;
  onMetricsChange?: (metrics: PdfReadingFrameMetrics) => void;
  children: ReactNode;
}) {
  const horizontalRulerTrackRef = useRef<HTMLDivElement | null>(null);
  const horizontalViewportCenterRef = useRef<HTMLSpanElement | null>(null);
  const horizontalPageCenterRef = useRef<HTMLSpanElement | null>(null);

  const latestGeometryRef = useRef<ReadingFrameGeometry | null>(null);
  const previousGeometryRef = useRef<ReadingFrameGeometry | null>(null);
  const frameIdRef = useRef<number>(0);

  const [viewport, setViewport] = useState<ViewportSnapshot>({
    width: 0,
    height: 0,
    outerWidth: 0,
    outerHeight: 0,
    rectLeft: 0,
    rectTop: 0,
    scrollLeft: 0,
    scrollTop: 0,
  });

  const pageWidthCentimeters = pointsToCentimeters(pageWidthPt);
  const pageHeightCentimeters = pointsToCentimeters(pageHeightPt);

  const horizontalPxPerCentimeter =
    pageWidthCentimeters > 0 && rulerContentWidth > 0
      ? Math.max(6, rulerContentWidth / pageWidthCentimeters)
      : FALLBACK_PX_PER_CENTIMETER;

  const verticalPxPerCentimeter =
    pageHeightCentimeters > 0 && (contentHeight ?? 0) > 0
      ? Math.max(6, (contentHeight ?? 0) / pageHeightCentimeters)
      : horizontalPxPerCentimeter;

  const horizontalTickStep = horizontalPxPerCentimeter / 5;
  const verticalTickStep = verticalPxPerCentimeter / 5;
  const majorTickModulo = 5;

  const frameLeftInset = showRuler ? LEFT_RULER_WIDTH : 0;

  const availableWidth = snapLayoutPixel(
    Math.max(
      0,
      viewport.width - frameLeftInset - STAGE_PADDING_X * 2,
    ),
  );

  const normalizedContentWidth = snapLayoutPixel(
    Math.max(0, safeNumber(contentWidth, 0)),
  );
  const normalizedContentHeight = snapLayoutPixel(
    Math.max(0, safeNumber(contentHeight, 0)),
  );
  const normalizedRulerContentWidth = snapLayoutPixel(
    Math.max(0, safeNumber(rulerContentWidth, normalizedContentWidth)),
  );

  /**
   * Não usar mx-auto para centralização da página.
   * A centralização agora é explícita, calculada e estável.
   */
  const shouldCenter =
    normalizedContentWidth > 0 && normalizedContentWidth < availableWidth;

  const pageOffsetWithinTrack = shouldCenter
    ? snapLayoutPixel((availableWidth - normalizedContentWidth) / 2)
    : 0;

  const contentTrackWidth = snapLayoutPixel(
    Math.max(
      normalizedContentWidth,
      availableWidth,
    ),
  );

  const contentLeft = snapLayoutPixel(
    frameLeftInset + STAGE_PADDING_X + pageOffsetWithinTrack,
  );

  const rulerMeasurementOrigin = useMemo(
    () => computeRulerMeasurementOrigin({ sourcePageLeft: contentLeft }),
    [contentLeft],
  );

  const layoutVersion = useMemo(() => {
    /**
     * Versão geométrica local. Ela não substitui layoutVersion do engine.
     */
    return Math.round(
      contentLeft +
        normalizedContentWidth +
        normalizedContentHeight +
        normalizedRulerContentWidth +
        contentTrackWidth +
        viewport.width +
        viewport.height,
    );
  }, [
    contentLeft,
    contentTrackWidth,
    normalizedContentHeight,
    normalizedContentWidth,
    normalizedRulerContentWidth,
    viewport.height,
    viewport.width,
  ]);

  const currentGeometry = useMemo<ReadingFrameGeometry>(
    () => ({
      topRulerHeight: TOP_RULER_HEIGHT,
      leftRulerWidth: LEFT_RULER_WIDTH,
      stagePaddingX: STAGE_PADDING_X,
      stagePaddingY: STAGE_PADDING_Y,
      frameLeftInset,
      availableWidth,
      contentLeft,
      contentWidth: normalizedContentWidth,
      contentHeight: normalizedContentHeight,
      contentTrackWidth,
      pageOffsetWithinTrack,
      rulerZeroX: rulerMeasurementOrigin.rulerZeroX,
      rulerContentWidth: normalizedRulerContentWidth,
      layoutVersion,
    }),
    [
      availableWidth,
      contentLeft,
      contentTrackWidth,
      frameLeftInset,
      layoutVersion,
      normalizedContentHeight,
      normalizedContentWidth,
      normalizedRulerContentWidth,
      pageOffsetWithinTrack,
      rulerMeasurementOrigin.rulerZeroX,
    ],
  );

  const syncRulerImperatively = useCallback(() => {
    const root = containerRef.current;
    const geometry = latestGeometryRef.current;
    const track = horizontalRulerTrackRef.current;

    if (!root || !geometry || !track) return;

    const liveScrollLeft = root.scrollLeft;

    const rulerScrollState = computeRulerScrollSync({
      rulerZeroX: geometry.rulerZeroX,
      scrollLeft: liveScrollLeft,
      layoutVersion: geometry.layoutVersion,
    });

    /**
     * A régua lê o scrollLeft real do viewport, não o scrollLeft salvo no
     * estado React. Isso evita atraso visual e efeito elástico.
     */
    track.style.transform = `translate3d(${rulerScrollState.rulerTrackX}px, 0, 0)`;

    if (horizontalViewportCenterRef.current) {
      horizontalViewportCenterRef.current.style.left = `${getReadingViewportCenterX({
        viewportWidth: root.clientWidth,
        frameLeftInset: geometry.frameLeftInset,
      })}px`;
    }

    if (horizontalPageCenterRef.current) {
      horizontalPageCenterRef.current.style.left = `${
        geometry.contentLeft + geometry.contentWidth / 2 - liveScrollLeft
      }px`;
    }
  }, [containerRef]);

  useLayoutEffect(() => {
    const root = containerRef.current;

    const previousGeometry = previousGeometryRef.current;

    latestGeometryRef.current = currentGeometry;

    if (root && previousGeometry) {
      /**
       * Durante scrollzoom, o PdfReaderShell já preserva a âncora do zoom.
       * Se o PdfReadingFrame também escrever root.scrollLeft no mesmo período,
       * os dois controladores competem e a página pisca lateralmente.
       *
       * Portanto, durante uma interação ativa, este componente apenas atualiza
       * sua geometria e régua, mas não altera root.scrollLeft.
       */
      const shouldSkipHorizontalPreservation = isPdfViewportInteractionActive();

      if (!shouldSkipHorizontalPreservation) {
        const didPreserve = preserveHorizontalPositionAfterGeometryChange({
          root,
          previous: previousGeometry,
          next: currentGeometry,
        });

        if (didPreserve) {
          const nextSnapshot = createViewportSnapshot(root);

          setViewport((current) =>
            sameViewportSnapshot(current, nextSnapshot) ? current : nextSnapshot,
          );
        }
      }
    }

    previousGeometryRef.current = currentGeometry;

    syncRulerImperatively();
  }, [containerRef, currentGeometry, syncRulerImperatively]);

  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    setViewport((current) => {
      const next = createViewportSnapshot(root);
      return sameViewportSnapshot(current, next) ? current : next;
    });

    syncRulerImperatively();
  }, [containerRef, syncRulerImperatively]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const read = () => {
      frameIdRef.current = 0;

      const next = createViewportSnapshot(root);

      setViewport((current) =>
        sameViewportSnapshot(current, next) ? current : next,
      );
    };

    const scheduleRead = () => {
      if (frameIdRef.current) return;
      frameIdRef.current = window.requestAnimationFrame(read);
    };

    const handleScroll = () => {
      /**
       * Sincronização imediata, sem esperar o setState do React.
       */
      syncRulerImperatively();
      scheduleRead();
    };

    const observer = new ResizeObserver(() => {
      syncRulerImperatively();
      scheduleRead();
    });

    read();
    syncRulerImperatively();

    observer.observe(root);
    root.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      if (frameIdRef.current) {
        window.cancelAnimationFrame(frameIdRef.current);
      }

      observer.disconnect();
      root.removeEventListener("scroll", handleScroll);
    };
  }, [containerRef, syncRulerImperatively]);

  const rulerScrollState = useMemo(
    () =>
      computeRulerScrollSync({
        rulerZeroX: rulerMeasurementOrigin.rulerZeroX,
        scrollLeft: viewport.scrollLeft,
        layoutVersion,
      }),
    [layoutVersion, rulerMeasurementOrigin.rulerZeroX, viewport.scrollLeft],
  );

  const horizontalTicks = useMemo(() => {
    const pageLeft = contentLeft;

    const buffer = Math.max(0, viewport.width * RULER_TICK_BUFFER_VIEWPORTS);

    const visibleStartOnPage = Math.max(
      0,
      viewport.scrollLeft - pageLeft - buffer,
    );

    const visibleEndOnPage = Math.min(
      normalizedRulerContentWidth,
      Math.max(
        0,
        viewport.scrollLeft + viewport.width - pageLeft + buffer,
      ),
    );

    return calculateRulerTicks({
      visibleStart: visibleStartOnPage,
      visibleEnd: visibleEndOnPage,
      tickStep: horizontalTickStep,
      pxPerMajorUnit: horizontalPxPerCentimeter,
      majorTickModulo,
    }).map((tick) => ({
      ...tick,
      left: tick.position,
    }));
  }, [
    contentLeft,
    horizontalTickStep,
    horizontalPxPerCentimeter,
    majorTickModulo,
    normalizedRulerContentWidth,
    viewport.scrollLeft,
    viewport.width,
  ]);

  const verticalTicks = useMemo(() => {
    const rulerHeight = Math.max(0, viewport.height - TOP_RULER_HEIGHT);
    const visibleStart = Math.max(0, viewport.scrollTop);
    const end = visibleStart + rulerHeight;

    return calculateRulerTicks({
      visibleStart,
      visibleEnd: end,
      tickStep: verticalTickStep,
      pxPerMajorUnit: verticalPxPerCentimeter,
      majorTickModulo,
    }).map((tick) => ({
      ...tick,
      top: tick.position - viewport.scrollTop,
    }));
  }, [
    majorTickModulo,
    verticalTickStep,
    verticalPxPerCentimeter,
    viewport.height,
    viewport.scrollTop,
  ]);

  useEffect(() => {
    if (!onMetricsChange) return;

    const viewportCenterX = viewport.scrollLeft + viewport.width / 2;
    const pageCenterX = contentLeft + normalizedContentWidth / 2;

    onMetricsChange({
      viewportWidth: viewport.width,
      viewportHeight: viewport.height,
      contentWidth: normalizedContentWidth,
      contentHeight: normalizedContentHeight,
      contentLeft,
      viewportCenterX,
      pageCenterX,
    });
  }, [
    contentLeft,
    normalizedContentHeight,
    normalizedContentWidth,
    onMetricsChange,
    viewport.height,
    viewport.scrollLeft,
    viewport.width,
  ]);

  return (
    <div className="relative min-h-full min-w-0 w-full">
      {showRuler ? (
        <>
          <div
            className="pointer-events-none fixed z-40 box-border overflow-hidden border border-black bg-white [animation:none] [contain:layout_paint] [transition:none]"
            style={{
              top: `${viewport.rectTop}px`,
              left: `${viewport.rectLeft}px`,
              width: `${Math.max(0, viewport.width)}px`,
              height: `${TOP_RULER_HEIGHT}px`,
            }}
          >
            <div className="relative h-full">
              <div
                ref={horizontalRulerTrackRef}
                className="absolute inset-y-0 left-0 will-change-transform [animation:none] [transition:none]"
                style={{
                  width: `${normalizedRulerContentWidth}px`,
                  transform: `translate3d(${rulerScrollState.rulerTrackX}px, 0, 0)`,
                }}
              >
                {horizontalTicks.map((tick) => (
                  <div
                    key={`h-tick-${tick.value}-${tick.left}`}
                    className="absolute bottom-0 h-full [animation:none] [transition:none]"
                    style={{ left: `${tick.left}px` }}
                  >
                    <span
                      className="absolute bottom-0 bg-black"
                      style={{
                        width: "1px",
                        height: tick.major ? "8px" : "4px",
                      }}
                    />
                    {tick.major ? (
                      <span className="absolute left-0 top-[3px] -translate-x-1/2 text-[10px] leading-none text-black">
                        {tick.label}
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>

              {showViewportCenter ? (
                <span
                  ref={horizontalViewportCenterRef}
                  className="pointer-events-none absolute inset-y-0 w-px bg-blue-500/80"
                  style={{
                    left: `${getReadingViewportCenterX({
                      viewportWidth: viewport.width,
                      frameLeftInset,
                    })}px`,
                  }}
                />
              ) : null}

              {showPageCenter ? (
                <span
                  ref={horizontalPageCenterRef}
                  className="pointer-events-none absolute inset-y-0 w-px bg-emerald-500/80"
                  style={{
                    left: `${
                      contentLeft + normalizedContentWidth / 2 - viewport.scrollLeft
                    }px`,
                  }}
                />
              ) : null}
            </div>
          </div>

          <div
            className="pointer-events-none fixed z-50 box-border border border-black bg-white [animation:none] [transition:none]"
            style={{
              top: `${viewport.rectTop}px`,
              left: `${viewport.rectLeft}px`,
              width: `${LEFT_RULER_WIDTH}px`,
              height: `${TOP_RULER_HEIGHT}px`,
            }}
          />

          <div
            className="pointer-events-none fixed z-30 box-border overflow-hidden border border-black bg-white [animation:none] [transition:none]"
            style={{
              top: `${viewport.rectTop + TOP_RULER_HEIGHT}px`,
              left: `${viewport.rectLeft}px`,
              width: `${LEFT_RULER_WIDTH}px`,
              height: `${Math.max(
                0,
                viewport.height - TOP_RULER_HEIGHT,
              )}px`,
            }}
          >
            {verticalTicks.map((tick) => (
              <div
                key={`v-tick-${tick.value}-${tick.top}`}
                className="absolute right-0 w-full"
                style={{ top: `${tick.top}px` }}
              >
                <span
                  className="absolute right-0 top-0 bg-black"
                  style={{
                    width: tick.major ? "8px" : "4px",
                    height: "1px",
                  }}
                />
                {tick.major ? (
                  <span className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 -rotate-90 text-[10px] leading-none text-black">
                    {tick.label}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </>
      ) : null}

      <div
        style={{
          paddingLeft: `${frameLeftInset}px`,
        }}
      >
        <div
          className="relative min-h-full"
          style={{
            paddingTop: `${STAGE_PADDING_Y + (showRuler ? TOP_RULER_HEIGHT : 0)}px`,
            paddingRight: `${STAGE_PADDING_X}px`,
            paddingBottom: `${STAGE_PADDING_Y}px`,
            paddingLeft: `${STAGE_PADDING_X}px`,
          }}
        >
          <div
            className="relative min-h-full"
            style={{
              width: `${contentTrackWidth}px`,
            }}
          >
            <div
              className="relative min-h-full"
              style={
                normalizedContentWidth > 0
                  ? {
                      width: `${normalizedContentWidth}px`,
                      marginLeft: `${pageOffsetWithinTrack}px`,
                    }
                  : undefined
              }
            >
              {showMargins ? (
                <>
                  <span
                    className="pointer-events-none absolute inset-y-0 z-10 w-px bg-zinc-400/70"
                    style={{ left: `${leftMarginPx}px` }}
                  />
                  <span
                    className="pointer-events-none absolute inset-y-0 z-10 w-px bg-zinc-400/70"
                    style={{ right: `${rightMarginPx}px` }}
                  />
                </>
              ) : null}

              {showPageCenter ? (
                <span className="pointer-events-none absolute inset-y-0 left-1/2 z-10 w-px -translate-x-1/2 bg-emerald-500/80" />
              ) : null}

              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
