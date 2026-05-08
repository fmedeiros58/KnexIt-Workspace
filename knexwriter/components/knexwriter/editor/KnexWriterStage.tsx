"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { KnexWriterEditableBody } from "./KnexWriterEditableBody";
import { KnexWriterHeaderArea } from "./KnexWriterHeaderArea";
import { KnexWriterFooterArea } from "./KnexWriterFooterArea";
import {
  HorizontalDocumentRuler,
  RulerCornerBox,
  VerticalDocumentRuler,
  applyZoom,
  cmToPx,
} from "../ruler";
import {
  WRITING_HORIZONTAL_RULER_HEIGHT_PX,
  WRITING_VERTICAL_RULER_WIDTH_PX,
} from "../state/writerConstants";
import type { WriterRenderProps } from "../shell/KnexWriterShell";

export type KnexWriterPageMargins = {
  topPx: number;
  rightPx: number;
  bottomPx: number;
  leftPx: number;
};

export type KnexWriterPage = {
  id: string;
  bodyHtml?: string;
  headerHtml?: string;
  footerHtml?: string;
  sameHeaderAsPrevious?: boolean;
  sameFooterAsPrevious?: boolean;
};

export type KnexWriterStageProps = Pick<
  WriterRenderProps,
  "refs" | "layout" | "state" | "actions"
>;

type HeaderFooterTarget = "header" | "footer";

type HeaderFooterState = {
  headerHtml: string;
  footerHtml: string;
  isEditing: boolean;
  activeTarget: HeaderFooterTarget | null;
  activePageIndex: number | null;
};

type HeaderFooterActions = {
  handleOpenHeaderFooterEditor?: (
    target: HeaderFooterTarget,
    pageIndex: number,
  ) => void;
  handleCloseHeaderFooterEditor?: () => void;
  handleChangeHeaderHtml?: (html: string) => void;
  handleChangeFooterHtml?: (html: string) => void;
};

type StagePaginationGeometry = {
  pageWidthPx: number;
  pageHeightPx: number;
  pageGapPx: number;
  pageStridePx: number;
  marginTopPx: number;
  marginRightPx: number;
  marginBottomPx: number;
  marginLeftPx: number;
  headerTopPx: number;
  headerHeightPx: number;
  footerTopPx: number;
  footerHeightPx: number;
  bodyLeftPx: number;
  bodyTopPx: number;
  bodyRightPx: number;
  bodyBottomPx: number;
  bodyWidthPx: number;
  bodyHeightPx: number;
};

type HeaderFooterHit = {
  target: HeaderFooterTarget;
  pageIndex: number;
};

type RulerCrosshairState = {
  visible: boolean;
  xPx: number;
  yPx: number;
};

const WORKSPACE_BACKGROUND_COLOR = "#EEF0F3";
const RULER_BACKGROUND_COLOR = "#F7F7F8";
const RULER_BORDER_COLOR = "#C7CBD1";

const PAGE_BACKGROUND_COLOR = "#FFFFFF";
const PAGE_FRAME_COLOR = "#AEB4BE";
const PAGE_FRAME_WIDTH_PX = 1;

const CANVAS_SIDE_BREATHING_PX = 24;
const TOP_PAGE_CLEARANCE_PX = 18;

const HEADER_FOOTER_EXTRA_PADDING_PX = 10;
const MIN_BODY_HEIGHT_PX = 72;
const HEADER_FOOTER_OUTSIDE_CLICK_EXIT_THRESHOLD = 3;
const HEADER_FOOTER_OUTSIDE_CLICK_EXIT_WINDOW_MS = 1800;

function getHeaderFooterState(state: WriterRenderProps["state"]) {
  const candidate = (state as typeof state & { headerFooter?: HeaderFooterState })
    .headerFooter;

  return (
    candidate ?? {
      headerHtml: "",
      footerHtml: "",
      isEditing: false,
      activeTarget: null,
      activePageIndex: null,
    }
  );
}

function getHeaderFooterActions(actions: WriterRenderProps["actions"]) {
  return actions as typeof actions & HeaderFooterActions;
}

function getPaginationGeometry(
  state: WriterRenderProps["state"],
  layout: WriterRenderProps["layout"],
): StagePaginationGeometry {
  const candidate = (
    state as typeof state & {
      writingPaginationGeometry?: Partial<StagePaginationGeometry> | null;
    }
  ).writingPaginationGeometry;

  const marginLeftPx = state.pageSettings.margins.leftPx;
  const marginRightPx = state.pageSettings.margins.rightPx;
  const marginTopPx = state.pageSettings.margins.topPx;
  const marginBottomPx = state.pageSettings.margins.bottomPx;

  const pageWidthPx = candidate?.pageWidthPx ?? layout.pageWidthPx;
  const pageHeightPx = candidate?.pageHeightPx ?? layout.pageHeightPx;
  const pageGapPx = candidate?.pageGapPx ?? layout.pageGapPx;
  const pageStridePx = candidate?.pageStridePx ?? layout.pageStridePx;

  const headerTopPx = candidate?.headerTopPx ?? 0;
  const headerHeightPx = candidate?.headerHeightPx ?? cmToPx(3);

  const footerHeightPx = candidate?.footerHeightPx ?? cmToPx(2);
  const footerTopPx = candidate?.footerTopPx ?? pageHeightPx - footerHeightPx;

  const bodyLeftPx = candidate?.bodyLeftPx ?? marginLeftPx;
  const bodyRightPx = candidate?.bodyRightPx ?? marginRightPx;

  const bodyTopPx =
    candidate?.bodyTopPx ?? Math.max(marginTopPx, headerTopPx + headerHeightPx);

  const footerBodyLimitPx = Math.min(pageHeightPx - marginBottomPx, footerTopPx);

  const bodyBottomPx =
    candidate?.bodyBottomPx ??
    Math.max(marginBottomPx, pageHeightPx - footerBodyLimitPx);

  const bodyWidthPx =
    candidate?.bodyWidthPx ?? Math.max(1, pageWidthPx - bodyLeftPx - bodyRightPx);

  const bodyHeightPx =
    candidate?.bodyHeightPx ??
    Math.max(1, pageHeightPx - bodyTopPx - bodyBottomPx);

  return {
    pageWidthPx,
    pageHeightPx,
    pageGapPx,
    pageStridePx,
    marginTopPx: candidate?.marginTopPx ?? marginTopPx,
    marginRightPx: candidate?.marginRightPx ?? marginRightPx,
    marginBottomPx: candidate?.marginBottomPx ?? marginBottomPx,
    marginLeftPx: candidate?.marginLeftPx ?? marginLeftPx,
    headerTopPx,
    headerHeightPx,
    footerTopPx,
    footerHeightPx,
    bodyLeftPx,
    bodyTopPx,
    bodyRightPx,
    bodyBottomPx,
    bodyWidthPx,
    bodyHeightPx,
  };
}

function isHeaderFooterInsideClick(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return Boolean(
    target.closest('[data-knexwriter-header-area="true"]') ||
      target.closest('[data-knexwriter-footer-area="true"]'),
  );
}

function getPageHitFromScaledStage(args: {
  clientX: number;
  clientY: number;
  stageElement: HTMLElement;
  zoomScale: number;
  pageCount: number;
  geometry: StagePaginationGeometry;
}) {
  const { clientX, clientY, stageElement, zoomScale, pageCount, geometry } = args;

  const bounds = stageElement.getBoundingClientRect();

  const localXPx = (clientX - bounds.left) / zoomScale;
  const localYPx = (clientY - bounds.top) / zoomScale;

  if (localXPx < 0 || localYPx < 0 || localXPx > geometry.pageWidthPx) {
    return null;
  }

  const pageIndex = Math.floor(localYPx / geometry.pageStridePx);

  if (pageIndex < 0 || pageIndex >= pageCount) {
    return null;
  }

  const pageTopPx = pageIndex * geometry.pageStridePx;
  const yInsidePagePx = localYPx - pageTopPx;

  if (yInsidePagePx < 0 || yInsidePagePx > geometry.pageHeightPx) {
    return null;
  }

  return {
    pageIndex,
    xInsidePagePx: localXPx,
    yInsidePagePx,
  };
}

function getHeaderFooterHitFromPoint(args: {
  clientX: number;
  clientY: number;
  stageElement: HTMLElement;
  zoomScale: number;
  pageCount: number;
  geometry: StagePaginationGeometry;
}): HeaderFooterHit | null {
  const hit = getPageHitFromScaledStage(args);

  if (!hit) {
    return null;
  }

  const { pageIndex, yInsidePagePx } = hit;
  const { geometry } = args;

  const isInsideHeader =
    yInsidePagePx >= geometry.headerTopPx &&
    yInsidePagePx <= geometry.headerTopPx + geometry.headerHeightPx;

  if (isInsideHeader) {
    return {
      target: "header",
      pageIndex,
    };
  }

  const isInsideFooter =
    yInsidePagePx >= geometry.footerTopPx &&
    yInsidePagePx <= geometry.footerTopPx + geometry.footerHeightPx;

  if (isInsideFooter) {
    return {
      target: "footer",
      pageIndex,
    };
  }

  return null;
}

function updateMeasuredHeight(
  current: number,
  next: number,
  baseHeight: number,
) {
  const safeNext = Math.max(0, Math.ceil(next));
  const normalized = safeNext <= baseHeight ? 0 : safeNext;

  return Math.abs(current - normalized) < 1 ? current : normalized;
}

export function KnexWriterStage({
  refs,
  layout,
  state,
  actions,
}: KnexWriterStageProps) {
  const [rulerCrosshair, setRulerCrosshair] = useState<RulerCrosshairState>({
    visible: false,
    xPx: 0,
    yPx: 0,
  });

  const [measuredHeaderHeightPx, setMeasuredHeaderHeightPx] = useState(0);
  const [measuredFooterHeightPx, setMeasuredFooterHeightPx] = useState(0);
  const headerFooterOutsideClickCountRef = useRef(0);
  const headerFooterOutsideClickTimerRef = useRef<number | null>(null);

  const zoomScale = Math.max(0.5, state.writingCanvasZoomPercent / 100);
  const basePaginationGeometry = getPaginationGeometry(state, layout);

  const effectivePaginationGeometry = useMemo<StagePaginationGeometry>(() => {
    const requestedHeaderHeightPx = Math.max(
      basePaginationGeometry.headerHeightPx,
      measuredHeaderHeightPx > 0
        ? measuredHeaderHeightPx + HEADER_FOOTER_EXTRA_PADDING_PX
        : basePaginationGeometry.headerHeightPx,
    );

    const requestedFooterHeightPx = Math.max(
      basePaginationGeometry.footerHeightPx,
      measuredFooterHeightPx > 0
        ? measuredFooterHeightPx + HEADER_FOOTER_EXTRA_PADDING_PX
        : basePaginationGeometry.footerHeightPx,
    );

    const maxHeaderHeightPx = Math.max(
      basePaginationGeometry.headerHeightPx,
      basePaginationGeometry.pageHeightPx - requestedFooterHeightPx - MIN_BODY_HEIGHT_PX,
    );

    const effectiveHeaderHeightPx = Math.min(
      requestedHeaderHeightPx,
      maxHeaderHeightPx,
    );

    const maxFooterHeightPx = Math.max(
      basePaginationGeometry.footerHeightPx,
      basePaginationGeometry.pageHeightPx - effectiveHeaderHeightPx - MIN_BODY_HEIGHT_PX,
    );

    const effectiveFooterHeightPx = Math.min(
      requestedFooterHeightPx,
      maxFooterHeightPx,
    );

    const effectiveFooterTopPx = Math.max(
      0,
      basePaginationGeometry.pageHeightPx - effectiveFooterHeightPx,
    );

    const effectiveBodyTopPx = Math.max(
      basePaginationGeometry.bodyTopPx,
      basePaginationGeometry.headerTopPx + effectiveHeaderHeightPx,
    );

    const effectiveBodyBottomPx = Math.max(
      basePaginationGeometry.bodyBottomPx,
      basePaginationGeometry.pageHeightPx - effectiveFooterTopPx,
    );

    const effectiveBodyHeightPx = Math.max(
      1,
      basePaginationGeometry.pageHeightPx -
        effectiveBodyTopPx -
        effectiveBodyBottomPx,
    );

    return {
      ...basePaginationGeometry,
      headerHeightPx: effectiveHeaderHeightPx,
      footerTopPx: effectiveFooterTopPx,
      footerHeightPx: effectiveFooterHeightPx,
      bodyTopPx: effectiveBodyTopPx,
      bodyBottomPx: effectiveBodyBottomPx,
      bodyHeightPx: effectiveBodyHeightPx,
    };
  }, [basePaginationGeometry, measuredFooterHeightPx, measuredHeaderHeightPx]);

  const pageCount = Math.max(1, state.writingPageCount);

  const stageHeight = Math.max(
    effectivePaginationGeometry.pageHeightPx,
    pageCount * effectivePaginationGeometry.pageStridePx -
      effectivePaginationGeometry.pageGapPx,
  );

  const bodyLeftPx = effectivePaginationGeometry.bodyLeftPx;
  const bodyTopPx = effectivePaginationGeometry.bodyTopPx;
  const bodyBottomPx = effectivePaginationGeometry.bodyBottomPx;
  const bodyWidthPx = effectivePaginationGeometry.bodyWidthPx;

  const scaledPageWidthPx = applyZoom(effectivePaginationGeometry.pageWidthPx, zoomScale);
  const scaledPageHeightPx = applyZoom(effectivePaginationGeometry.pageHeightPx, zoomScale);
  const scaledStageHeightPx = applyZoom(stageHeight, zoomScale);
  const scaledTopPageClearancePx = TOP_PAGE_CLEARANCE_PX;

  const contentColumnMinWidthPx =
    scaledPageWidthPx + CANVAS_SIDE_BREATHING_PX * 2;

  const headerFooter = getHeaderFooterState(state);
  const headerFooterActions = getHeaderFooterActions(actions);

  const updateRulerCrosshairFromClient = useCallback(
    (clientX: number, clientY: number) => {
      const scroller = refs.writingScrollRef.current;
      if (!scroller) return;

      const rect = scroller.getBoundingClientRect();
      const xPx = clientX - rect.left + scroller.scrollLeft;
      const yPx = clientY - rect.top + scroller.scrollTop;

      setRulerCrosshair({
        visible: true,
        xPx: Math.max(0, xPx),
        yPx: Math.max(0, yPx),
      });
    },
    [refs.writingScrollRef],
  );

  const hideRulerCrosshair = useCallback(() => {
    setRulerCrosshair((current) =>
      current.visible ? { ...current, visible: false } : current,
    );
  }, []);

  const resetHeaderFooterOutsideClickIntent = useCallback(() => {
    headerFooterOutsideClickCountRef.current = 0;

    if (headerFooterOutsideClickTimerRef.current !== null) {
      window.clearTimeout(headerFooterOutsideClickTimerRef.current);
      headerFooterOutsideClickTimerRef.current = null;
    }
  }, []);

  const handleMeasureHeaderHeight = useCallback(
    (heightPx: number) => {
      setMeasuredHeaderHeightPx((current) =>
        updateMeasuredHeight(
          current,
          heightPx,
          basePaginationGeometry.headerHeightPx,
        ),
      );
    },
    [basePaginationGeometry.headerHeightPx],
  );

  const handleMeasureFooterHeight = useCallback(
    (heightPx: number) => {
      setMeasuredFooterHeightPx((current) =>
        updateMeasuredHeight(
          current,
          heightPx,
          basePaginationGeometry.footerHeightPx,
        ),
      );
    },
    [basePaginationGeometry.footerHeightPx],
  );

  const getHeaderFooterHitFromEvent = useCallback(
    (
      event:
        | ReactMouseEvent<HTMLDivElement>
        | ReactPointerEvent<HTMLDivElement>,
    ) => {
      return getHeaderFooterHitFromPoint({
        clientX: event.clientX,
        clientY: event.clientY,
        stageElement: event.currentTarget,
        zoomScale,
        pageCount,
        geometry: effectivePaginationGeometry,
      });
    },
    [effectivePaginationGeometry, pageCount, zoomScale],
  );

  const handleScaledStagePointerDownCapture = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (headerFooter.isEditing) {
        return;
      }

      const hit = getHeaderFooterHitFromEvent(event);

      if (!hit) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    },
    [getHeaderFooterHitFromEvent, headerFooter.isEditing],
  );

  const handleScaledStageClickCapture = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (headerFooter.isEditing) {
        return;
      }

      const hit = getHeaderFooterHitFromEvent(event);

      if (!hit) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
    },
    [getHeaderFooterHitFromEvent, headerFooter.isEditing],
  );

  const handleScaledStageDoubleClickCapture = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      if (headerFooter.isEditing) {
        return;
      }

      const hit = getHeaderFooterHitFromEvent(event);

      if (!hit) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      headerFooterActions.handleOpenHeaderFooterEditor?.(
        hit.target,
        hit.pageIndex,
      );
    },
    [getHeaderFooterHitFromEvent, headerFooter.isEditing, headerFooterActions],
  );

  useEffect(() => {
    if (!rulerCrosshair.visible) return;

    const clear = () => hideRulerCrosshair();

    window.addEventListener("pointerup", clear, true);
    window.addEventListener("contextmenu", clear, true);
    window.addEventListener("blur", clear);

    return () => {
      window.removeEventListener("pointerup", clear, true);
      window.removeEventListener("contextmenu", clear, true);
      window.removeEventListener("blur", clear);
    };
  }, [hideRulerCrosshair, rulerCrosshair.visible]);

  useEffect(() => {
    if (!headerFooter.isEditing) {
      resetHeaderFooterOutsideClickIntent();
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      const isPrimaryCloseIntent =
        event.pointerType === "touch" ||
        event.pointerType === "pen" ||
        event.button === 0;

      if (!isPrimaryCloseIntent) {
        return;
      }

      if (isHeaderFooterInsideClick(event.target)) {
        resetHeaderFooterOutsideClickIntent();
        return;
      }

      const nextOutsideClickCount = headerFooterOutsideClickCountRef.current + 1;
      headerFooterOutsideClickCountRef.current = nextOutsideClickCount;

      if (headerFooterOutsideClickTimerRef.current !== null) {
        window.clearTimeout(headerFooterOutsideClickTimerRef.current);
      }

      headerFooterOutsideClickTimerRef.current = window.setTimeout(() => {
        headerFooterOutsideClickCountRef.current = 0;
        headerFooterOutsideClickTimerRef.current = null;
      }, HEADER_FOOTER_OUTSIDE_CLICK_EXIT_WINDOW_MS);

      if (nextOutsideClickCount < HEADER_FOOTER_OUTSIDE_CLICK_EXIT_THRESHOLD) {
        return;
      }

      resetHeaderFooterOutsideClickIntent();
      headerFooterActions.handleCloseHeaderFooterEditor?.();
    };

    window.addEventListener("pointerdown", handlePointerDown, true);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, true);
      resetHeaderFooterOutsideClickIntent();
    };
  }, [
    headerFooter.isEditing,
    headerFooterActions,
    resetHeaderFooterOutsideClickIntent,
  ]);

  const isHeaderFooterPageEditing = (pageIndex: number) =>
    headerFooter.isEditing && headerFooter.activePageIndex === pageIndex;

  return (
    <div
      ref={refs.writingScrollRef}
      data-knexwriter-editor-scroll="true"
      className="relative isolate flex min-h-0 flex-1 overflow-auto [scrollbar-gutter:stable] [overflow-anchor:none]"
      style={{
        backgroundColor: WORKSPACE_BACKGROUND_COLOR,
      }}
    >
      <div
        data-knexwriter-editor-workspace="true"
        className="relative min-h-full min-w-full"
        style={{
          backgroundColor: WORKSPACE_BACKGROUND_COLOR,
          minHeight: `max(100%, ${
            scaledStageHeightPx +
            scaledTopPageClearancePx +
            WRITING_HORIZONTAL_RULER_HEIGHT_PX +
            layout.bottomClearancePx
          }px)`,
        }}
      >
        <div
          data-knexwriter-horizontal-ruler-shell="true"
          className="sticky top-0 grid w-full min-w-max overflow-visible border-b shadow-[0_1px_2px_rgba(0,0,0,0.18)]"
          style={{
            gridTemplateColumns: `${WRITING_VERTICAL_RULER_WIDTH_PX}px minmax(${contentColumnMinWidthPx}px, 1fr)`,
            height: WRITING_HORIZONTAL_RULER_HEIGHT_PX,
            zIndex: 10000,
            isolation: "isolate",
            transform: "translateZ(0)",
            backfaceVisibility: "hidden",
            backgroundColor: RULER_BACKGROUND_COLOR,
            borderColor: RULER_BORDER_COLOR,
          }}
        >
          <RulerCornerBox
            sizePx={WRITING_VERTICAL_RULER_WIDTH_PX}
            heightPx={WRITING_HORIZONTAL_RULER_HEIGHT_PX}
            tabStopType={state.tabStopInsertType}
            onCycleTabStopType={actions.handleCycleTabStopInsertType}
          />

          <div
            data-knexwriter-horizontal-ruler-track="true"
            className="relative overflow-visible"
            style={{
              minWidth: contentColumnMinWidthPx,
              zIndex: 2,
              backgroundColor: RULER_BACKGROUND_COLOR,
            }}
          >
            <div
              className="mx-auto"
              style={{
                width: scaledPageWidthPx,
                backgroundColor: RULER_BACKGROUND_COLOR,
              }}
            >
              <HorizontalDocumentRuler
                pageWidthPx={effectivePaginationGeometry.pageWidthPx}
                pageMargins={state.pageSettings.margins}
                paragraphIndents={state.paragraphIndents}
                tabStops={state.tabStops}
                zoom={zoomScale}
                heightPx={WRITING_HORIZONTAL_RULER_HEIGHT_PX}
                showMargins={state.rulerSettings.showMargins}
                showIndentMarkers={state.rulerSettings.showIndentMarkers}
                showTabStops={state.rulerSettings.showTabStops}
                insertTabStopType={state.tabStopInsertType}
                onChangeMargins={actions.handleChangePageMargins}
                onChangeIndents={actions.handleChangeParagraphIndents}
                onChangeTabStops={actions.handleChangeTabStops}
                onRightButtonGuideStart={(point) =>
                  updateRulerCrosshairFromClient(point.clientX, point.clientY)
                }
                onRightButtonGuideMove={(point) =>
                  updateRulerCrosshairFromClient(point.clientX, point.clientY)
                }
                onRightButtonGuideEnd={hideRulerCrosshair}
              />
            </div>
          </div>
        </div>

        <div
          data-knexwriter-stage-grid="true"
          className="relative grid min-w-max"
          style={{
            gridTemplateColumns: `${WRITING_VERTICAL_RULER_WIDTH_PX}px minmax(${contentColumnMinWidthPx}px, 1fr)`,
            zIndex: 0,
            backgroundColor: WORKSPACE_BACKGROUND_COLOR,
          }}
        >
          <div
            data-knexwriter-vertical-ruler-shell="true"
            className="sticky left-0 self-start border-r"
            style={{
              top: WRITING_HORIZONTAL_RULER_HEIGHT_PX,
              zIndex: 9000,
              backgroundColor: RULER_BACKGROUND_COLOR,
              borderColor: RULER_BORDER_COLOR,
            }}
          >
            <VerticalDocumentRuler
              pageHeightPx={effectivePaginationGeometry.pageHeightPx}
              pageMargins={state.pageSettings.margins}
              zoom={zoomScale}
              pageCount={pageCount}
              activePage={state.writingActivePage}
              pageGapPx={effectivePaginationGeometry.pageGapPx}
              widthPx={WRITING_VERTICAL_RULER_WIDTH_PX}
              horizontalRulerHeightPx={WRITING_HORIZONTAL_RULER_HEIGHT_PX}
              showMargins={state.rulerSettings.showMargins}
              onChangeMargins={actions.handleChangePageMargins}
              headerDistanceFromTopPx={effectivePaginationGeometry.headerTopPx}
              footerDistanceFromBottomPx={Math.max(
                0,
                effectivePaginationGeometry.pageHeightPx -
                  (effectivePaginationGeometry.footerTopPx +
                    effectivePaginationGeometry.footerHeightPx),
              )}
              showHeaderFooterAreas
              onRightButtonGuideStart={(point) =>
                updateRulerCrosshairFromClient(point.clientX, point.clientY)
              }
              onRightButtonGuideMove={(point) =>
                updateRulerCrosshairFromClient(point.clientX, point.clientY)
              }
              onRightButtonGuideEnd={hideRulerCrosshair}
            />
          </div>

          <div
            data-knexwriter-page-work-area="true"
            className="relative min-h-0"
            style={{
              minWidth: contentColumnMinWidthPx,
              zIndex: 0,
              backgroundColor: WORKSPACE_BACKGROUND_COLOR,
            }}
          >
            {state.importedDocument?.warning ? (
              <div className="mx-auto mb-3 mt-3 w-full max-w-[1180px] px-6">
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
                  {state.importedDocument.warning}
                </div>
              </div>
            ) : null}

            <div
              data-knexwriter-pages-viewport="true"
              className="w-full"
              style={{
                paddingTop: `${scaledTopPageClearancePx}px`,
                paddingBottom: `${layout.bottomClearancePx}px`,
                backgroundColor: WORKSPACE_BACKGROUND_COLOR,
              }}
            >
              <div
                data-knexwriter-pages-center-column="true"
                className="mx-auto overflow-visible"
                style={{
                  width: scaledPageWidthPx,
                  minWidth: scaledPageWidthPx,
                  minHeight: scaledStageHeightPx,
                }}
              >
                <div
                  ref={refs.writingPageRootRef}
                  data-knexwriter-page-root="true"
                  className="relative shrink-0"
                  style={{
                    width: `${scaledPageWidthPx}px`,
                    minWidth: `${scaledPageWidthPx}px`,
                    minHeight: `${scaledStageHeightPx}px`,
                    zIndex: 0,
                  }}
                >
                  <div
                    data-knexwriter-page-frame-layer="true"
                    className="pointer-events-none absolute left-0 top-0 z-[1]"
                    style={{
                      width: `${scaledPageWidthPx}px`,
                      minHeight: `${scaledStageHeightPx}px`,
                    }}
                  >
                    {Array.from(
                      { length: pageCount },
                      (_: unknown, index: number) => {
                        const pageTopPx = index * effectivePaginationGeometry.pageStridePx;
                        const scaledPageTopPx = applyZoom(pageTopPx, zoomScale);
                        const pageNumber = index + 1;

                        return (
                          <div
                            key={`page-frame-${pageNumber}`}
                            data-knexwriter-page-frame="true"
                            data-page-index={index}
                            data-page-number={pageNumber}
                            className="absolute left-0 top-0"
                            style={{
                              top: `${scaledPageTopPx}px`,
                              width: `${scaledPageWidthPx}px`,
                              height: `${scaledPageHeightPx}px`,
                              backgroundColor: PAGE_BACKGROUND_COLOR,
                              boxSizing: "border-box",
                            }}
                          >
                            <span
                              aria-hidden="true"
                              className="absolute left-0 top-0 block"
                              style={{
                                width: "100%",
                                height: PAGE_FRAME_WIDTH_PX,
                                backgroundColor: PAGE_FRAME_COLOR,
                              }}
                            />

                            <span
                              aria-hidden="true"
                              className="absolute bottom-0 left-0 block"
                              style={{
                                width: "100%",
                                height: PAGE_FRAME_WIDTH_PX,
                                backgroundColor: PAGE_FRAME_COLOR,
                              }}
                            />

                            <span
                              aria-hidden="true"
                              className="absolute left-0 top-0 block"
                              style={{
                                width: PAGE_FRAME_WIDTH_PX,
                                height: "100%",
                                backgroundColor: PAGE_FRAME_COLOR,
                              }}
                            />

                            <span
                              aria-hidden="true"
                              className="absolute right-0 top-0 block"
                              style={{
                                width: PAGE_FRAME_WIDTH_PX,
                                height: "100%",
                                backgroundColor: PAGE_FRAME_COLOR,
                              }}
                            />
                          </div>
                        );
                      },
                    )}
                  </div>

                  <div
                    data-knexwriter-scaled-stage="true"
                    className="absolute left-0 top-0 z-[2]"
                    style={{
                      width: `${effectivePaginationGeometry.pageWidthPx}px`,
                      minHeight: `${stageHeight}px`,
                      transform: `scale(${zoomScale})`,
                      transformOrigin: "top left",
                    }}
                    onPointerDownCapture={handleScaledStagePointerDownCapture}
                    onClickCapture={handleScaledStageClickCapture}
                    onDoubleClickCapture={handleScaledStageDoubleClickCapture}
                  >
                    {Array.from(
                      { length: pageCount },
                      (_: unknown, index: number) => {
                        const pageTopPx =
                          index * effectivePaginationGeometry.pageStridePx;
                        const isHeaderFooterEditingOnPage =
                          isHeaderFooterPageEditing(index);

                        return (
                          <div
                            key={`header-footer-page-${index + 1}`}
                            data-knexwriter-header-footer-page-layer="true"
                            data-page-index={index}
                            className="absolute left-0 top-0 z-[10]"
                            style={{
                              top: pageTopPx,
                              width: effectivePaginationGeometry.pageWidthPx,
                              height: effectivePaginationGeometry.pageHeightPx,
                              pointerEvents: "none",
                            }}
                          >
                            <KnexWriterHeaderArea
                              pageIndex={index}
                              pageNumber={index + 1}
                              pageCount={pageCount}
                              sectionIndex={0}
                              pageWidthPx={effectivePaginationGeometry.pageWidthPx}
                              bodyLeftPx={bodyLeftPx}
                              bodyWidthPx={bodyWidthPx}
                              headerTopPx={effectivePaginationGeometry.headerTopPx}
                              headerHeightPx={effectivePaginationGeometry.headerHeightPx}
                              headerHtml={headerFooter.headerHtml}
                              isEditing={isHeaderFooterEditingOnPage}
                              showGuide={isHeaderFooterEditingOnPage}
                              sameAsPrevious={false}
                              differentFirstPage={false}
                              differentOddEvenPages={false}
                              onMeasureHeaderHeight={handleMeasureHeaderHeight}
                              onOpenHeaderEditor={() =>
                                headerFooterActions.handleOpenHeaderFooterEditor?.(
                                  "header",
                                  index,
                                )
                              }
                              onChangeHeaderHtml={(html) =>
                                headerFooterActions.handleChangeHeaderHtml?.(html)
                              }
                            />

                            <KnexWriterFooterArea
                              pageIndex={index}
                              pageNumber={index + 1}
                              pageCount={pageCount}
                              sectionIndex={0}
                              pageWidthPx={effectivePaginationGeometry.pageWidthPx}
                              pageHeightPx={effectivePaginationGeometry.pageHeightPx}
                              bodyLeftPx={bodyLeftPx}
                              bodyWidthPx={bodyWidthPx}
                              footerTopPx={effectivePaginationGeometry.footerTopPx}
                              footerHeightPx={effectivePaginationGeometry.footerHeightPx}
                              footerHtml={headerFooter.footerHtml}
                              isEditing={isHeaderFooterEditingOnPage}
                              showGuide={isHeaderFooterEditingOnPage}
                              sameAsPrevious={false}
                              differentFirstPage={false}
                              differentOddEvenPages={false}
                              onMeasureFooterHeight={handleMeasureFooterHeight}
                              onOpenFooterEditor={() =>
                                headerFooterActions.handleOpenHeaderFooterEditor?.(
                                  "footer",
                                  index,
                                )
                              }
                              onChangeFooterHtml={(html) =>
                                headerFooterActions.handleChangeFooterHtml?.(html)
                              }
                            />
                          </div>
                        );
                      },
                    )}

                    <KnexWriterEditableBody
                      key={`knexwriter-editable-body-${state.editorDocumentVersion}`}
                      editor={state.editor}
                      editorVersion={state.editorDocumentVersion}
                      editorRef={refs.writingEditorRef}
                      pageIndex={0}
                      bodyLeftPx={bodyLeftPx}
                      bodyTopPx={bodyTopPx}
                      bodyWidthPx={bodyWidthPx}
                      bodyBottomPx={bodyBottomPx}
                      stageHeightPx={stageHeight}
                      pageWidthPx={effectivePaginationGeometry.pageWidthPx}
                      pageHeightPx={effectivePaginationGeometry.pageHeightPx}
                      pageGapPx={effectivePaginationGeometry.pageGapPx}
                      pageCount={pageCount}
                      paginationGeometry={effectivePaginationGeometry}
                      paragraphIndents={state.paragraphIndents}
                      defaultFontSizePt={12}
                      defaultLineHeight={1.5}
                      enableSoftPagination
                      editable={!headerFooter.isEditing}
                    />

                    <div
                      data-knexwriter-body-retention-mask-layer="true"
                      className="pointer-events-none absolute left-0 top-0 z-[9]"
                      style={{
                        left: effectivePaginationGeometry.bodyLeftPx,
                        width: effectivePaginationGeometry.bodyWidthPx,
                        minHeight: stageHeight,
                      }}
                      aria-hidden="true"
                    >
                      {Array.from({ length: pageCount }, (_unused, index) => {
                        const pageTopPx = index * effectivePaginationGeometry.pageStridePx;
                        const pageBottomPx = pageTopPx + effectivePaginationGeometry.pageHeightPx;
                        const isLastPage = index >= pageCount - 1;
                        const pageGapPx = Math.max(
                          0,
                          effectivePaginationGeometry.pageStridePx -
                            effectivePaginationGeometry.pageHeightPx,
                        );
                        const bodyTopLimitPx = pageTopPx + effectivePaginationGeometry.bodyTopPx;
                        const bodyBottomLimitPx =
                          pageTopPx +
                          effectivePaginationGeometry.pageHeightPx -
                          effectivePaginationGeometry.bodyBottomPx;

                        const topMaskHeightPx = Math.max(0, bodyTopLimitPx - pageTopPx);
                        const bottomMaskTopPx = Math.min(pageBottomPx, bodyBottomLimitPx);
                        const bottomMaskHeightPx = Math.max(0, pageBottomPx - bottomMaskTopPx);

                        return (
                          <div
                            key={`page-body-retention-mask-${index + 1}`}
                            className="absolute left-0 top-0"
                            style={{
                              width: effectivePaginationGeometry.bodyWidthPx,
                              height: isLastPage
                                ? effectivePaginationGeometry.pageHeightPx
                                : effectivePaginationGeometry.pageStridePx,
                              transform: `translateY(${pageTopPx}px)`,
                            }}
                          >
                            {topMaskHeightPx > 0.5 ? (
                              <div
                                className="absolute left-0 top-0"
                                style={{
                                  width: "100%",
                                  height: topMaskHeightPx,
                                  backgroundColor: PAGE_BACKGROUND_COLOR,
                                }}
                              />
                            ) : null}

                            {bottomMaskHeightPx > 0.5 ? (
                              <div
                                className="absolute left-0"
                                style={{
                                  top: bottomMaskTopPx - pageTopPx,
                                  width: "100%",
                                  height: bottomMaskHeightPx,
                                  backgroundColor: PAGE_BACKGROUND_COLOR,
                                }}
                              />
                            ) : null}

                            {!isLastPage && pageGapPx > 0.5 ? (
                              <div
                                className="absolute left-0"
                                style={{
                                  top: effectivePaginationGeometry.pageHeightPx,
                                  width: "100%",
                                  height: pageGapPx,
                                  backgroundColor: WORKSPACE_BACKGROUND_COLOR,
                                }}
                              />
                            ) : null}
                          </div>
                        );
                      })}
                    </div>

                    {pageCount > 1 ? (
                      <div
                        data-knexwriter-page-gap-mask-layer="true"
                        className="pointer-events-none absolute left-0 top-0 z-[8]"
                        style={{
                          width: effectivePaginationGeometry.pageWidthPx,
                          minHeight: stageHeight,
                        }}
                      >
                        {Array.from({ length: Math.max(0, pageCount - 1) }, (_unused, index) => {
                          const nextPageTopPx =
                            (index + 1) * effectivePaginationGeometry.pageStridePx;

                          return (
                            <div
                              key={`page-gap-mask-${index + 1}`}
                              className="absolute left-0"
                              style={{
                                top: nextPageTopPx - effectivePaginationGeometry.pageGapPx,
                                width: effectivePaginationGeometry.pageWidthPx,
                                height: effectivePaginationGeometry.pageGapPx,
                                backgroundColor: WORKSPACE_BACKGROUND_COLOR,
                              }}
                            />
                          );
                        })}
                      </div>
                    ) : null}

                    {state.rulerGuide.visible ? (
                      <div
                        data-knexwriter-ruler-guide-line="true"
                        aria-hidden="true"
                        className="pointer-events-none absolute inset-0 z-[11]"
                      >
                        <span
                          className="absolute top-0 h-full w-px"
                          style={{
                            left: state.rulerGuide.xPx,
                            background:
                              "repeating-linear-gradient(to bottom, rgba(82,82,91,0.88) 0 2px, transparent 2px 4px)",
                          }}
                        />
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {rulerCrosshair.visible ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-[12000]"
        >
          <span
            className="absolute top-0 h-full w-px"
            style={{
              left: `${rulerCrosshair.xPx}px`,
              background:
                "repeating-linear-gradient(to bottom, rgba(82,82,91,0.88) 0 2px, transparent 2px 4px)",
            }}
          />
          <span
            className="absolute left-0 h-px w-full"
            style={{
              top: `${rulerCrosshair.yPx}px`,
              background:
                "repeating-linear-gradient(to right, rgba(82,82,91,0.88) 0 2px, transparent 2px 4px)",
            }}
          />
        </div>
      ) : null}
    </div>
  );
}

export default KnexWriterStage;
