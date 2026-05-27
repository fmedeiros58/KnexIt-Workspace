"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import {
  usePdfAnnotations,
  usePdfDocument,
  usePdfHighlights,
  usePdfMetadata,
  usePdfPageNavigation,
  usePdfSearch,
  usePdfSelection,
  usePdfZoom,
} from "../hooks";
import type {
  PdfCitationRecord,
  PdfDocumentSource,
  PdfRenderQualityMode,
  PdfReaderRibbonTab,
  PdfReaderSidebarMode,
  PdfTextSelection,
  PdfTranslationBlockRecord,
  PdfTranslationStrategy,
  PdfTranslationViewMode,
  PdfZoomMode,
} from "../types";
import {
  createPdfCitationFromSelection,
  probePdfTextLayer,
  runOcrOnPageImage,
} from "../services";
import {
  calculateKnexPdfContentWidth,
  clampKnexPdfZoom,
  computeHorizontalOverflow,
  computeWheelZoom,
  type KnexPdfRenderPhase,
  type KnexPdfRenderedPage as RenderedPdfPage,
  type KnexPdfTextBlock as PdfTextBlock,
} from "../knex-pdf-engine";
import { pdfReaderController } from "../api";
import {
  KnexreadRibbon,
  KnexreadTabs,
} from "../ui";
import { PdfFileBackstage } from "./PdfFileBackstage";
import { PdfReadingFrame } from "./PdfReadingFrame";
import { PdfPageView } from "./PdfPageView";
import { PdfSearchPanel } from "./PdfSearchPanel";
import { PdfSidebar } from "./PdfSidebar";
import { PdfSourceInfoPanel } from "./PdfSourceInfoPanel";
import { PdfThumbnailsPanel } from "./PdfThumbnailsPanel";
import { PdfToolbar } from "./PdfToolbar";
import { PdfTranslationPage } from "./PdfTranslationPage";
import { KnexPdfEngineProvider } from "../knex-pdf-engine/KnexPdfEngineProvider";
import {
  beginKnexPdfRenderInteraction,
  clearKnexPdfRenderInteraction,
} from "./PdfInteractionRenderGuard";

type KnexreadShellProps = {
  file: File;
  projectId: string;
  documentId?: string;
  sourceId?: string;
  sourceName?: string;
  onClose?: () => void;
  presentation?: "modal" | "page";
  showShellHeader?: boolean;
  guidesBar?: ReactNode;
  onOpenPdfInNewGuide?: (input: {
    file: File;
    projectId: string;
    documentId?: string;
    sourceId?: string;
    sourceName?: string;
    pdfFileId?: string;
  }) => Promise<void> | void;
  onInsertCitation?: (input: {
    citation: PdfCitationRecord;
    citationText: string;
  }) => Promise<void> | void;
};

function sortTranslationBlocks(blocks: PdfTranslationBlockRecord[]) {
  return [...blocks].sort(
    (a, b) =>
      a.pageNumber - b.pageNumber ||
      a.bbox.y - b.bbox.y ||
      a.bbox.x - b.bbox.x,
  );
}

function normalizeTranslationViewMode(input: unknown): PdfTranslationViewMode {
  if (
    input === "normal" ||
    input === "side-by-side" ||
    input === "toggle" ||
    input === "focus-review"
  ) {
    return input;
  }
  return "normal";
}

function clampStageZoom(value: number) {
  return clampKnexPdfZoom(value / 100) * 100;
}

const AUTOMATIC_READER_RENDER_QUALITY: PdfRenderQualityMode = "extreme";

/**
 * No caminho por tiles, a fluidez vem da renderização progressiva e do cache,
 * não de rebaixar a resolução enquanto o usuário está lendo/zoomando.
 */
const ZOOM_GESTURE_RENDER_QUALITY: PdfRenderQualityMode = "extreme";
const ZOOM_GESTURE_SETTLE_MS = 120;
const VIEWPORT_INTERACTION_SETTLE_MS = 180;
const WHEEL_ZOOM_IMMEDIATE_FLUSH_MS = 8;

type ViewportInteractionReason = "wheel-zoom" | "scroll" | "resize";

type PdfRenderWindow = {
  activePageNumber: number;
  visiblePageNumbers: number[];
  warmupPageNumbers: number[];
  preloadPageNumbers: number[];
};

function areNumberSetsEqual(a: Set<number>, b: Set<number>) {
  if (a.size !== b.size) return false;

  for (const value of a) {
    if (!b.has(value)) return false;
  }

  return true;
}

function addBoundedPageNumber(
  target: Set<number>,
  pageNumber: number,
  pageCount: number,
) {
  if (pageNumber < 1 || pageNumber > pageCount) return;
  target.add(pageNumber);
}

function toSortedPageNumbers(values: Set<number>): number[] {
  return Array.from(values).sort((a, b) => a - b);
}

function createPdfRenderWindow(input: {
  activePageNumber: number;
  visiblePageNumbers: Set<number>;
  pageCount: number;
}): PdfRenderWindow {
  const pageCount = Math.max(1, input.pageCount);
  const visible = new Set<number>();
  const warmup = new Set<number>();
  const preload = new Set<number>();

  addBoundedPageNumber(visible, input.activePageNumber, pageCount);

  for (const pageNumber of input.visiblePageNumbers) {
    addBoundedPageNumber(visible, pageNumber, pageCount);
  }

  for (const pageNumber of visible) {
    for (const offset of [1, 2, 3, 4, 5]) {
      addBoundedPageNumber(warmup, pageNumber - offset, pageCount);
      addBoundedPageNumber(warmup, pageNumber + offset, pageCount);
    }

    for (const offset of [6, 7, 8, 9, 10]) {
      addBoundedPageNumber(preload, pageNumber - offset, pageCount);
      addBoundedPageNumber(preload, pageNumber + offset, pageCount);
    }
  }

  for (const pageNumber of visible) {
    warmup.delete(pageNumber);
    preload.delete(pageNumber);
  }

  for (const pageNumber of warmup) {
    preload.delete(pageNumber);
  }

  return {
    activePageNumber: input.activePageNumber,
    visiblePageNumbers: toSortedPageNumbers(visible),
    warmupPageNumbers: toSortedPageNumbers(warmup),
    preloadPageNumbers: toSortedPageNumbers(preload),
  };
}

function getPageRenderPriorityForWindow(input: {
  isActivePage: boolean;
  isVisiblePage: boolean;
  isWarmupPage: boolean;
  isPreloadPage: boolean;
}) {
  if (input.isActivePage) return 100;
  if (input.isVisiblePage) return 90;
  if (input.isWarmupPage) return 82;
  if (input.isPreloadPage) return 58;
  return 10;
}

function resolvePageRenderPhaseForWindow(input: {
  viewportPhase: KnexPdfRenderPhase;
  isActivePage: boolean;
  isVisiblePage: boolean;
  isWarmupPage: boolean;
  isPreloadPage: boolean;
}): KnexPdfRenderPhase {
  /**
   * Não rebaixar a geometria visual da página para interactive-preview.
   *
   * O PdfPageCanvas já recebe isZooming/isScrolling e sabe adiar a renderização
   * pesada durante o gesto. Se o Shell também troca a fase da página para
   * interactive-preview, a text layer pode ser desmontada e a página pode ficar
   * sem texto em zoom alto.
   *
   * Portanto, a fase de viewport continua servindo como sinal transacional no
   * Shell, mas a fase entregue à página visível permanece settled-final.
   */

  /**
   * Qualidade visual pós-zoom:
   *
   * O diagnóstico mostrou páginas visíveis no DOM ainda como warmup-preview/high
   * enquanto apenas a página ativa recebia settled-final/extreme.
   *
   * Como warmupPageNumbers representa páginas adjacentes às visíveis/ativas,
   * elas podem aparecer parcialmente ou totalmente no viewport, especialmente
   * em zoom baixo ou telas grandes. Depois que o viewport estabiliza, essas
   * páginas também devem receber render final para evitar serrilhado.
   */
  if (input.isActivePage || input.isVisiblePage || input.isWarmupPage) {
    return "settled-final";
  }

  if (input.isPreloadPage) {
    return "warmup-preview";
  }

  return "settled-final";
}

function PdfReaderShellContent({
  file,
  projectId,
  documentId,
  sourceId,
  sourceName,
  onClose,
  presentation = "modal",
  showShellHeader = true,
  guidesBar,
  onOpenPdfInNewGuide,
  onInsertCitation,
}: KnexreadShellProps) {
  const { loading, error, session, pdfFile, metadata, openFile } = usePdfDocument();
  const {
    page,
    pageCount,
    setPageCount,
    goToPage,
  } = usePdfPageNavigation(1, 1);
  const {
    zoom: displayedStageZoom,
    zoomScale: stageZoomScale,
    setZoomScale: setStageZoomScale,
  } = usePdfZoom();
  const stageZoom = stageZoomScale * 100;
  const setStageZoom = useCallback(
    (value: number) => {
      setStageZoomScale(clampStageZoom(value) / 100);
    },
    [setStageZoomScale],
  );

  const { highlights, loadHighlights, addHighlight } = usePdfHighlights();
  const { annotations, loadAnnotations, addAnnotation } = usePdfAnnotations();
  const { referenceCandidate, setPdfMetadata, createReferenceCandidate } = usePdfMetadata();
  const { selection, setSelection, clearSelection } = usePdfSelection();

  const [sidebarMode, setSidebarMode] = useState<PdfReaderSidebarMode>("thumbnails");
  const [citations, setCitations] = useState<PdfCitationRecord[]>([]);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [fileBackstageSection, setFileBackstageSection] = useState<
    | "propriedades"
    | "criar"
    | "abrir"
    | "salvar"
    | "salvar-como"
    | "exportar"
    | "imprimir"
    | "compartilhar"
    | "fechar"
    | "preferencias"
  >("abrir");
  const [recentProjectFiles, setRecentProjectFiles] = useState<PdfDocumentSource[]>([]);
  const [textLayerNotice, setTextLayerNotice] = useState<string | null>(null);
  const [blocksByPage, setBlocksByPage] = useState<Record<number, PdfTextBlock[]>>({});
  const [translationBlocks, setTranslationBlocks] = useState<PdfTranslationBlockRecord[]>([]);
  const [activeRibbonTab, setActiveRibbonTab] = useState<PdfReaderRibbonTab>("inicio");
  const [translationViewMode, setTranslationViewMode] =
    useState<PdfTranslationViewMode>("normal");
  const [translationStrategy, setTranslationStrategy] =
    useState<PdfTranslationStrategy>("local-first");
  const [sourceLanguage, setSourceLanguage] = useState("auto");
  const [targetLanguage, setTargetLanguage] = useState("pt-BR");
  const [maskOpacity] = useState(0.92);
  const [focusedTranslationBlockId, setFocusedTranslationBlockId] = useState<string | undefined>(
    undefined,
  );
  const [toggleShowsTranslation, setToggleShowsTranslation] = useState(true);
  const renderQuality = AUTOMATIC_READER_RENDER_QUALITY;
  const [showTextLayer, setShowTextLayer] = useState(true);
  const [showRuler, setShowRuler] = useState(true);
  const [showMargins, setShowMargins] = useState(true);
  const [showViewportCenter, setShowViewportCenter] = useState(false);
  const [showPageCenter, setShowPageCenter] = useState(false);
  const [enableOcrLayer, setEnableOcrLayer] = useState(false);
  const [showOcrDebugBoxes, setShowOcrDebugBoxes] = useState(false);
  const [isDockSidebarCollapsed, setIsDockSidebarCollapsed] = useState(false);
  const [dockSidebarWidth, setDockSidebarWidth] = useState(320);
  const [pageRenderMetrics, setPageRenderMetrics] = useState<
    Record<
      number,
      {
        width: number;
        height: number;
        pageWidthPt: number;
        pageHeightPt: number;
        renderScale: number;
      }
    >
  >({});
  const openPdfInputRef = useRef<HTMLInputElement | null>(null);
  const stageScrollRef = useRef<HTMLDivElement | null>(null);
  const pageElementRefs = useRef<Record<number, HTMLDivElement | null>>({});
  const didInitialScrollRef = useRef(false);
  const currentZoomRef = useRef(stageZoom);
  const suppressAutoPageSyncRef = useRef(false);
  const horizontalOverflowLayoutKeyRef = useRef("");
  const wheelDeltaRef = useRef(0);
  const wheelFrameRef = useRef<number | null>(null);
  const lastWheelZoomFlushAtRef = useRef(0);
  const pendingZoomAnchorRef = useRef<{
    pageNumber: number;
    xPx: number;
    yPx: number;
    anchorViewportX: number;
    anchorViewportY: number;
  } | null>(null);
  const wheelAnchorPointRef = useRef<{ clientX: number; clientY: number } | null>(null);
  const zoomReleaseTimerRef = useRef<number | null>(null);

  /**
   * Estado de gesto de zoom.
   *
   * Quando true:
   * - renderizamos com qualidade temporária mais leve;
   * - priorizamos somente página ativa/visível;
   * - bloqueamos extração/persistência semântica pesada;
   * - deixamos a renderização extreme para quando o gesto estabilizar.
   */
  const zoomGestureSettleTimerRef = useRef<number | null>(null);
  const isZoomGestureActiveRef = useRef(false);
  const isViewportInteractingRef = useRef(false);
  const interactionSettleTimerRef = useRef<number | null>(null);
  const visiblePageNumbersRef = useRef<Set<number>>(new Set([1]));
  const activePageRef = useRef(page);
  const [isZoomGestureActive, setIsZoomGestureActive] = useState(false);
  const [isViewportInteracting, setIsViewportInteracting] = useState(false);
  const [finalRenderVersion, setFinalRenderVersion] = useState(0);
  const [visiblePageNumbers, setVisiblePageNumbers] = useState<Set<number>>(
    () => new Set([1]),
  );

  const [zoomMode, setZoomMode] = useState<PdfZoomMode>("manual");
  const [stageHasHorizontalOverflow, setStageHasHorizontalOverflow] = useState(false);

  useEffect(() => {
    const isPdfRenderCancellation = (reason: unknown) => {
      const maybe = reason as { name?: unknown; message?: unknown } | undefined;
      const name = typeof maybe?.name === "string" ? maybe.name : "";
      const message = typeof maybe?.message === "string" ? maybe.message : "";
      return (
        name === "AbortError" ||
        name === "RenderingCancelledException" ||
        /rendering cancelled|render canceled|render aborted|abort/i.test(message)
      );
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (!isPdfRenderCancellation(event.reason)) return;
      event.preventDefault();
    };

    const handleWindowError = (event: ErrorEvent) => {
      if (!isPdfRenderCancellation(event.error) && !isPdfRenderCancellation(event)) return;
      event.preventDefault();
    };

    window.addEventListener("unhandledrejection", handleUnhandledRejection);
    window.addEventListener("error", handleWindowError);
    return () => {
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
      window.removeEventListener("error", handleWindowError);
    };
  }, []);

  const allBlocks = useMemo(() => Object.values(blocksByPage).flat(), [blocksByPage]);
  const { query, setQuery, matches } = usePdfSearch(allBlocks);

  const resolvedDocumentId = useMemo(
    () => documentId ?? pdfFile?.documentId ?? `knexread-${projectId}`,
    [documentId, pdfFile?.documentId, projectId],
  );
  const pageNumbers = useMemo(
    () => Array.from({ length: Math.max(pageCount, 1) }, (_, index) => index + 1),
    [pageCount],
  );
  const sourceContentWidth = useMemo(() => {
    const widths = Object.values(pageRenderMetrics)
      .map((item) =>
        item.pageWidthPt
          ? item.pageWidthPt * (stageZoom / 100)
          : item.width * (stageZoom / Math.max(1, item.renderScale * 100)),
      )
      .filter(Boolean);
    return widths.length ? Math.max(...widths) : 612 * (stageZoom / 100);
  }, [pageRenderMetrics, stageZoom]);

  const readingContentWidth = useMemo(() => {
    return calculateKnexPdfContentWidth({
      sourcePageWidth: sourceContentWidth,
      mode: translationViewMode === "side-by-side" ? "sideBySide" : "single",
      translationPageWidth: sourceContentWidth,
    });
  }, [sourceContentWidth, translationViewMode]);

  const activePageRenderMetrics = useMemo(() => {
    return pageRenderMetrics[page] ?? Object.values(pageRenderMetrics)[0];
  }, [page, pageRenderMetrics]);

  const activePageContentHeight = useMemo(() => {
    if (!activePageRenderMetrics) return 792 * (stageZoom / 100);
    if (activePageRenderMetrics.pageHeightPt) {
      return activePageRenderMetrics.pageHeightPt * (stageZoom / 100);
    }
    return (
      activePageRenderMetrics.height *
      (stageZoom / Math.max(1, activePageRenderMetrics.renderScale * 100))
    );
  }, [activePageRenderMetrics, stageZoom]);

  const getPageDisplaySize = useCallback(
    (pageNumber: number) => {
      const metrics = pageRenderMetrics[pageNumber] ?? activePageRenderMetrics;
      if (!metrics) {
        return {
          width: 612 * (stageZoom / 100),
          height: 792 * (stageZoom / 100),
        };
      }

      const width = metrics.pageWidthPt
        ? metrics.pageWidthPt * (stageZoom / 100)
        : metrics.width * (stageZoom / Math.max(1, metrics.renderScale * 100));
      const height = metrics.pageHeightPt
        ? metrics.pageHeightPt * (stageZoom / 100)
        : metrics.height * (stageZoom / Math.max(1, metrics.renderScale * 100));

      return { width, height };
    },
    [activePageRenderMetrics, pageRenderMetrics, stageZoom],
  );

  useEffect(() => {
    let cancelled = false;

    const loadRecentProjectFiles = async () => {
      try {
        const items = await pdfReaderController.listProjectFiles(projectId);
        if (cancelled) return;
        setRecentProjectFiles(items.slice(0, 20));
      } catch {
        if (cancelled) return;
        setRecentProjectFiles([]);
      }
    };

    void loadRecentProjectFiles();

    return () => {
      cancelled = true;
    };
  }, [projectId, pdfFile?.id]);

  const setPageNodeRef = useCallback((pageNumber: number, node: HTMLDivElement | null) => {
    pageElementRefs.current[pageNumber] = node;
  }, []);

  const getPageAnchorElement = useCallback((pageNumber: number) => {
    const pageRoot = pageElementRefs.current[pageNumber];
    if (translationViewMode === "side-by-side") {
      return pageRoot ?? null;
    }

    if (translationViewMode === "toggle" && toggleShowsTranslation) {
      const translationPageRoot = pageRoot?.querySelector<HTMLElement>(
        `[data-knexread-translation-page-number="${pageNumber}"]`,
      );
      return translationPageRoot ?? pageRoot ?? null;
    }

    const pageCanvasRoot = pageRoot?.querySelector<HTMLElement>(
      `[data-knexread-page-number="${pageNumber}"]`,
    );
    return pageCanvasRoot ?? pageRoot ?? null;
  }, [toggleShowsTranslation, translationViewMode]);

  const getAnchorPageNumber = useCallback(
    (anchorPoint?: { clientX: number; clientY: number }) => {
      if (!anchorPoint) return page;

      let closestPageNumber = page;
      let closestDistance = Number.POSITIVE_INFINITY;

      for (const [pageKey] of Object.entries(pageElementRefs.current)) {
        const pageNumber = Number(pageKey);
        if (!Number.isFinite(pageNumber)) continue;

        const anchorElement = getPageAnchorElement(pageNumber);
        const rect = anchorElement?.getBoundingClientRect();

        if (!rect?.width || !rect.height) continue;

        const containsPoint =
          anchorPoint.clientX >= rect.left &&
          anchorPoint.clientX <= rect.right &&
          anchorPoint.clientY >= rect.top &&
          anchorPoint.clientY <= rect.bottom;

        if (containsPoint) {
          return pageNumber;
        }

        const nearestX = Math.max(
          rect.left,
          Math.min(rect.right, anchorPoint.clientX),
        );
        const nearestY = Math.max(
          rect.top,
          Math.min(rect.bottom, anchorPoint.clientY),
        );
        const distance =
          (nearestX - anchorPoint.clientX) ** 2 +
          (nearestY - anchorPoint.clientY) ** 2;

        if (distance < closestDistance) {
          closestDistance = distance;
          closestPageNumber = pageNumber;
        }
      }

      return closestPageNumber;
    },
    [getPageAnchorElement, page],
  );

  const goToPageAndScroll = useCallback(
    (nextPage: number, behavior: ScrollBehavior = "smooth") => {
      const safePage = Math.max(1, Math.min(pageCount || 1, nextPage));
      goToPage(safePage);
      const target = pageElementRefs.current[safePage];
      if (target) {
        target.scrollIntoView({ block: "start", behavior });
      }
    },
    [goToPage, pageCount],
  );

  const markViewportInteracting = useCallback(
    (reason: ViewportInteractionReason) => {
      beginKnexPdfRenderInteraction(
        reason === "wheel-zoom" ? "zoom" : "scroll",
        VIEWPORT_INTERACTION_SETTLE_MS,
      );

      if (!isViewportInteractingRef.current) {
        isViewportInteractingRef.current = true;
        setIsViewportInteracting(true);
      }

      if (interactionSettleTimerRef.current !== null) {
        window.clearTimeout(interactionSettleTimerRef.current);
      }

      interactionSettleTimerRef.current = window.setTimeout(() => {
        isViewportInteractingRef.current = false;
        setIsViewportInteracting(false);
        setFinalRenderVersion((version) => version + 1);
        clearKnexPdfRenderInteraction();
        interactionSettleTimerRef.current = null;
      }, VIEWPORT_INTERACTION_SETTLE_MS);
    },
    [],
  );

  const beginZoomGesture = useCallback(() => {
    if (zoomGestureSettleTimerRef.current !== null) {
      window.clearTimeout(zoomGestureSettleTimerRef.current);
      zoomGestureSettleTimerRef.current = null;
    }

    isZoomGestureActiveRef.current = true;
    setIsZoomGestureActive(true);
    markViewportInteracting("wheel-zoom");
  }, [markViewportInteracting]);

  const scheduleZoomGestureRelease = useCallback(() => {
    if (zoomGestureSettleTimerRef.current !== null) {
      window.clearTimeout(zoomGestureSettleTimerRef.current);
    }

    zoomGestureSettleTimerRef.current = window.setTimeout(() => {
      isZoomGestureActiveRef.current = false;
      setIsZoomGestureActive(false);

      /**
       * Assim que o zoom estabiliza, força uma nova rodada de render final.
       * Isso evita que o último buffer preview/warmup permaneça ativo.
       */
      setFinalRenderVersion((version) => version + 1);

      clearKnexPdfRenderInteraction("zoom");
      zoomGestureSettleTimerRef.current = null;
    }, ZOOM_GESTURE_SETTLE_MS);
  }, []);

  const beginScrollGesture = useCallback(() => {
    markViewportInteracting("scroll");
  }, [markViewportInteracting]);

  const shouldRenderPageDuringZoom = useCallback(
    (pageNumber: number) => {
      if (!isZoomGestureActive) return true;
      return (
        pageNumber === page ||
        visiblePageNumbers.has(pageNumber) ||
        Math.abs(pageNumber - page) <= 8
      );
    },
    [isZoomGestureActive, page, visiblePageNumbers],
  );

  const getPageRenderQuality = useCallback(
    (pageNumber: number): PdfRenderQualityMode => {
      if (!isZoomGestureActive) return renderQuality;
      return pageNumber === page
        ? ZOOM_GESTURE_RENDER_QUALITY
        : ZOOM_GESTURE_RENDER_QUALITY;
    },
    [isZoomGestureActive, page, renderQuality],
  );

  const applyZoomTransactional = useCallback(
    (
      nextZoomValue: number,
      mode: "manual" | "fit-width" | "fit-page" = "manual",
      anchorPoint?: { clientX: number; clientY: number },
    ) => {
      const root = stageScrollRef.current;
      const oldZoom = currentZoomRef.current;
      const nextZoom = clampStageZoom(nextZoomValue);

      if (nextZoom === oldZoom) return;

      beginZoomGesture();

      if (zoomReleaseTimerRef.current !== null) {
        window.clearTimeout(zoomReleaseTimerRef.current);
        zoomReleaseTimerRef.current = null;
      }

      if (root) {
        const rootRect = root.getBoundingClientRect();
        const rulerWidth = showRuler ? 28 : 0;
        const topRulerHeight = showRuler ? 24 : 0;

        const viewportWidth = Math.max(1, root.clientWidth - rulerWidth);
        const viewportHeight = Math.max(1, root.clientHeight - topRulerHeight);

        const anchorViewportX = anchorPoint
          ? Math.max(0, Math.min(root.clientWidth, anchorPoint.clientX - rootRect.left))
          : rulerWidth + viewportWidth / 2;

        const anchorViewportY = anchorPoint
          ? Math.max(0, Math.min(root.clientHeight, anchorPoint.clientY - rootRect.top))
          : topRulerHeight + viewportHeight / 2;

        const anchorPageNumber = getAnchorPageNumber(anchorPoint);
        const anchorElement = getPageAnchorElement(anchorPageNumber);
        const anchorRect = anchorElement?.getBoundingClientRect();

        if (anchorRect?.width && anchorRect.height) {
          const oldScale = Math.max(0.1, oldZoom / 100);

          const elementLeft = anchorRect.left - rootRect.left + root.scrollLeft;
          const elementTop = anchorRect.top - rootRect.top + root.scrollTop;

          const elementBaseWidth = anchorRect.width / oldScale;
          const elementBaseHeight = anchorRect.height / oldScale;

          const rawXPx = (root.scrollLeft + anchorViewportX - elementLeft) / oldScale;
          const rawYPx = (root.scrollTop + anchorViewportY - elementTop) / oldScale;

          pendingZoomAnchorRef.current = {
            pageNumber: anchorPageNumber,
            xPx: anchorPoint
              ? Math.max(0, Math.min(elementBaseWidth, rawXPx))
              : elementBaseWidth / 2,
            yPx: Math.max(0, Math.min(elementBaseHeight, rawYPx)),
            anchorViewportX,
            anchorViewportY,
          };
        } else {
          pendingZoomAnchorRef.current = null;
        }

        /**
         * Enquanto o zoom está em transação, nenhum outro efeito pode
         * sincronizar página ativa ou recentralizar scroll horizontal.
         */
        suppressAutoPageSyncRef.current = true;
      } else {
        pendingZoomAnchorRef.current = null;
      }

      currentZoomRef.current = nextZoom;
      setZoomMode(mode);
      setStageZoom(nextZoom);
      scheduleZoomGestureRelease();
    },
    [
      beginZoomGesture,
      getAnchorPageNumber,
      getPageAnchorElement,
      scheduleZoomGestureRelease,
      setStageZoom,
      showRuler,
    ],
  );

  const zoomInStage = useCallback(() => {
    applyZoomTransactional(currentZoomRef.current + 10, "manual");
  }, [applyZoomTransactional]);

  const zoomOutStage = useCallback(() => {
    applyZoomTransactional(currentZoomRef.current - 10, "manual");
  }, [applyZoomTransactional]);

  const setManualZoom = useCallback(
    (value: number) => {
      applyZoomTransactional(value, "manual");
    },
    [applyZoomTransactional],
  );

  const setFitWidthZoom = useCallback(() => {
    const root = stageScrollRef.current;
    const pageWidth =
      activePageRenderMetrics?.pageWidthPt ||
      (activePageRenderMetrics?.renderScale
        ? activePageRenderMetrics.width / activePageRenderMetrics.renderScale
        : 0);
    if (!root || !pageWidth) {
      applyZoomTransactional(140, "fit-width");
      return;
    }
    const rulerWidth = showRuler ? 28 : 0;
    const availableWidth = Math.max(320, root.clientWidth - rulerWidth - 56);
    applyZoomTransactional((availableWidth / pageWidth) * 100, "fit-width");
  }, [activePageRenderMetrics, applyZoomTransactional, showRuler]);

  const setFitPageZoom = useCallback(() => {
    const root = stageScrollRef.current;
    const pageWidth =
      activePageRenderMetrics?.pageWidthPt ||
      (activePageRenderMetrics?.renderScale
        ? activePageRenderMetrics.width / activePageRenderMetrics.renderScale
        : 0);
    const pageHeight =
      activePageRenderMetrics?.pageHeightPt ||
      (activePageRenderMetrics?.renderScale
        ? activePageRenderMetrics.height / activePageRenderMetrics.renderScale
        : 0);
    if (!root || !pageWidth || !pageHeight) {
      applyZoomTransactional(120, "fit-page");
      return;
    }
    const rulerWidth = showRuler ? 28 : 0;
    const rulerHeight = showRuler ? 24 : 0;
    const availableWidth = Math.max(320, root.clientWidth - rulerWidth - 56);
    const availableHeight = Math.max(320, root.clientHeight - rulerHeight - 56);
    applyZoomTransactional(
      Math.min(availableWidth / pageWidth, availableHeight / pageHeight) * 100,
      "fit-page",
    );
  }, [activePageRenderMetrics, applyZoomTransactional, showRuler]);

  const setActualSizeZoom = useCallback(() => {
    applyZoomTransactional(100, "manual");
  }, [applyZoomTransactional]);

  const mergePageTranslationBlocks = useCallback(
    (pageNumber: number, nextPageBlocks: PdfTranslationBlockRecord[]) => {
      setTranslationBlocks((current) => {
        const withoutPage = current.filter((block) => block.pageNumber !== pageNumber);
        return sortTranslationBlocks([...withoutPage, ...nextPageBlocks]);
      });
    },
    [],
  );

  const currentPageTranslationBlocks = useMemo(
    () =>
      sortTranslationBlocks(
        translationBlocks.filter((block) => block.pageNumber === page),
      ),
    [page, translationBlocks],
  );

  const focusedTranslationBlock = useMemo(() => {
    if (focusedTranslationBlockId) {
      const match = translationBlocks.find((block) => block.id === focusedTranslationBlockId);
      if (match) return match;
    }
    return currentPageTranslationBlocks[0];
  }, [currentPageTranslationBlocks, focusedTranslationBlockId, translationBlocks]);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      setStatusError(null);
      try {
        const opened = await openFile({
          file,
          projectId,
          documentId,
          sourceId,
        });

        if (cancelled) return;

        setPageCount(opened.session.pageCount);
        setPdfMetadata(opened.metadata);
        setTextLayerNotice(null);

        void probePdfTextLayer({
          session: opened.session,
          maxPages: 3,
        })
          .then((probe) => {
            if (cancelled) return;
            if (probe.likelyImageOnly) {
              setTextLayerNotice(
                "PDF likely image-based. Automatic OCR is not active yet; text selection and extraction may be limited.",
              );
              return;
            }
            setTextLayerNotice(
              `Text layer detected (${probe.pagesWithText}/${probe.inspectedPages} pages analyzed).`,
            );
          })
          .catch(() => {
            if (cancelled) return;
            setTextLayerNotice(
              "Could not verify PDF text layer.",
            );
          });

        let readerSession = await pdfReaderController.getSession(opened.pdfFile.id);
        if (!readerSession) {
          const created = await pdfReaderController.open({
            file,
            projectId,
            documentId,
            sourceId,
          });
          readerSession = created.session;
        }

        if (!cancelled && readerSession) {
          goToPage(readerSession.currentPage || 1);
          setZoomMode(readerSession.zoomMode ?? "manual");
          setStageZoom(clampStageZoom(readerSession.zoom || 130));
          setSidebarMode(readerSession.sidebarMode ?? "thumbnails");
          setTranslationViewMode(
            normalizeTranslationViewMode(readerSession.translationViewMode),
          );
          setTranslationStrategy(readerSession.translationStrategy ?? "local-first");
          setSourceLanguage(readerSession.sourceLanguage ?? "auto");
          setTargetLanguage(readerSession.targetLanguage ?? "pt-BR");
          setFocusedTranslationBlockId(readerSession.focusedBlockId);
        }

        if (!cancelled) {
          const [
            loadedCitations,
            loadedTranslationBlocks,
            preferences,
          ] = await Promise.all([
            pdfReaderController.listCitations(opened.pdfFile.id),
            pdfReaderController.listTranslationBlocks(opened.pdfFile.id),
            pdfReaderController.getReaderPreferences({
              projectId,
              documentId: resolvedDocumentId,
            }),
            loadHighlights(opened.pdfFile.id),
            loadAnnotations(opened.pdfFile.id),
          ]);
          setCitations(loadedCitations);
          setTranslationBlocks(sortTranslationBlocks(loadedTranslationBlocks));
          setTranslationViewMode(
            normalizeTranslationViewMode(preferences.translationViewMode),
          );
          setTranslationStrategy(preferences.translationStrategy);
          setSourceLanguage(preferences.sourceLanguage);
          setTargetLanguage(preferences.targetLanguage);
          setZoomMode(preferences.zoomMode ?? "manual");
          setShowTextLayer(preferences.showTextLayer ?? true);
          setShowRuler(Boolean(preferences.showRuler));
          setShowMargins(Boolean(preferences.showMargins));
          setShowViewportCenter(Boolean(preferences.showViewportCenter));
          setShowPageCenter(Boolean(preferences.showPageCenter));
          setEnableOcrLayer(Boolean(preferences.enableOcrLayer));
          setShowOcrDebugBoxes(Boolean(preferences.showOcrDebugBoxes));
        }
      } catch (openError) {
        if (cancelled) return;
        setStatusError(
          openError instanceof Error
            ? openError.message
            : "Falha ao abrir PDF no Knexread.",
        );
      }
    };

    void bootstrap();

    return () => {
      cancelled = true;
    };
  }, [
    documentId,
    file,
    goToPage,
    loadAnnotations,
    loadHighlights,
    openFile,
    projectId,
    resolvedDocumentId,
    setPageCount,
    setPdfMetadata,
    setStageZoom,
    sourceId,
  ]);

  useEffect(() => {
    if (!pdfFile?.id || isZoomGestureActive) return;
    const timeoutId = window.setTimeout(() => {
      void pdfReaderController.updateSession(pdfFile.id, {
        currentPage: page,
        zoom: stageZoom,
        zoomMode,
        renderQuality,
        sidebarMode,
        viewMode: "continuous",
        translationViewMode,
        translationStrategy,
        sourceLanguage,
        targetLanguage,
        focusedBlockId: focusedTranslationBlock?.id,
        documentId: resolvedDocumentId,
      });
    }, 180);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    focusedTranslationBlock?.id,
    isZoomGestureActive,
    page,
    pdfFile?.id,
    resolvedDocumentId,
    sidebarMode,
    stageZoom,
    sourceLanguage,
    targetLanguage,
    zoomMode,
    renderQuality,
    translationStrategy,
    translationViewMode,
  ]);

  useEffect(() => {
    if (!pdfFile) return;
    const timeoutId = window.setTimeout(() => {
      void pdfReaderController.updateReaderPreferences({
        projectId,
        documentId: resolvedDocumentId,
        patch: {
          zoomMode,
          renderQuality,
          sourceLanguage,
          targetLanguage,
          translationStrategy,
          translationViewMode,
          maskOpacity,
          showTextLayer,
          showRuler,
          showMargins,
          showViewportCenter,
          showPageCenter,
          enableOcrLayer,
          showOcrDebugBoxes,
        },
      });
    }, 240);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [
    maskOpacity,
    pdfFile,
    projectId,
    zoomMode,
    renderQuality,
    resolvedDocumentId,
    showMargins,
    showOcrDebugBoxes,
    showPageCenter,
    showRuler,
    showTextLayer,
    showViewportCenter,
    sourceLanguage,
    targetLanguage,
    enableOcrLayer,
    translationStrategy,
    translationViewMode,
  ]);

  useEffect(() => {
    currentZoomRef.current = stageZoom;
  }, [stageZoom]);

  useEffect(() => {
    activePageRef.current = page;

    const nextVisible = new Set(visiblePageNumbersRef.current);
    nextVisible.add(page);
    visiblePageNumbersRef.current = nextVisible;

    setVisiblePageNumbers((current) =>
      areNumberSetsEqual(current, nextVisible) ? current : new Set(nextVisible),
    );
  }, [page]);

  useEffect(() => {
    return () => {
      if (zoomGestureSettleTimerRef.current !== null) {
        window.clearTimeout(zoomGestureSettleTimerRef.current);
      }

      if (zoomReleaseTimerRef.current !== null) {
        window.clearTimeout(zoomReleaseTimerRef.current);
      }

      if (interactionSettleTimerRef.current !== null) {
        window.clearTimeout(interactionSettleTimerRef.current);
      }

      clearKnexPdfRenderInteraction();
    };
  }, []);

  useLayoutEffect(() => {
    const root = stageScrollRef.current;
    if (!root) return;

    let frameId = 0;

    const layoutKey = [
      dockSidebarWidth,
      readingContentWidth,
      showRuler ? "ruler" : "no-ruler",
      stageZoom,
      translationViewMode,
    ].join(":");

    const readOverflow = () => {
      frameId = 0;

      const rulerWidth = showRuler ? 28 : 0;
      const stagePaddingX = 20;
      const availableWidth = Math.max(
        0,
        root.clientWidth - rulerWidth - stagePaddingX * 2,
      );

      const shouldCenter =
        readingContentWidth > 0 && readingContentWidth < availableWidth;

      const centeredOffset = shouldCenter
        ? (availableWidth - readingContentWidth) / 2
        : 0;

      /**
       * Este contentLeft precisa bater com o cálculo do PdfReadingFrame.
       * Antes ele ignorava o centeredOffset. Isso podia gerar centro errado.
       */
      const contentLeft = rulerWidth + stagePaddingX + centeredOffset;

      const overflowState = computeHorizontalOverflow({
        viewportWidth: availableWidth,
        realContentWidth: readingContentWidth,
        activeContentCenterX: contentLeft + readingContentWidth / 2,
      });

      const hasOverflow = overflowState.hasOverflow;

      setStageHasHorizontalOverflow((current) =>
        current === hasOverflow ? current : hasOverflow,
      );

      /**
       * Ponto crítico:
       * Este efeito NÃO deve escrever root.scrollLeft.
       *
       * O salto lateral acontecia porque este efeito competia com a restauração
       * de âncora do zoom. Durante e depois do zoom, quem deve controlar
       * scrollLeft é a transação de zoom/pendingZoomAnchorRef.
       *
       * Aqui só calculamos se há overflow para a UI. O navegador já cuida da
       * barra horizontal quando usamos overflow-x-auto.
       */
      horizontalOverflowLayoutKeyRef.current = layoutKey;
    };

    const scheduleRead = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(readOverflow);
    };

    const scheduleInteractionRead = () => {
      markViewportInteracting("resize");
      scheduleRead();
    };

    readOverflow();

    const observer = new ResizeObserver(scheduleRead);
    observer.observe(root);
    window.addEventListener("resize", scheduleInteractionRead);

    return () => {
      if (frameId) {
        window.cancelAnimationFrame(frameId);
      }
      observer.disconnect();
      window.removeEventListener("resize", scheduleInteractionRead);
    };
  }, [
    dockSidebarWidth,
    markViewportInteracting,
    readingContentWidth,
    showRuler,
    stageZoom,
    translationViewMode,
  ]);

  useLayoutEffect(() => {
    const anchor = pendingZoomAnchorRef.current;
    if (!anchor) return;

    const root = stageScrollRef.current;
    if (!root) return;

    let cancelled = false;
    let firstFrame = 0;
    let secondFrame = 0;

    const clampScroll = (value: number, max: number) =>
      Math.max(0, Math.min(Math.max(0, max), Number.isFinite(value) ? value : 0));

    const restoreAnchor = () => {
      if (cancelled) return;

      const currentAnchor = pendingZoomAnchorRef.current;
      if (!currentAnchor) return;

      const anchorElement = getPageAnchorElement(currentAnchor.pageNumber);
      const anchorRect = anchorElement?.getBoundingClientRect();

      if (anchorRect?.width && anchorRect.height) {
        const rootRect = root.getBoundingClientRect();
        const nextScale = Math.max(0.1, stageZoom / 100);

        const elementLeft = anchorRect.left - rootRect.left + root.scrollLeft;
        const elementTop = anchorRect.top - rootRect.top + root.scrollTop;

        const targetScrollLeft =
          elementLeft + currentAnchor.xPx * nextScale - currentAnchor.anchorViewportX;

        const targetScrollTop =
          elementTop + currentAnchor.yPx * nextScale - currentAnchor.anchorViewportY;

        const maxScrollLeft = Math.max(0, root.scrollWidth - root.clientWidth);
        const maxScrollTop = Math.max(0, root.scrollHeight - root.clientHeight);

        const nextScrollLeft =
          maxScrollLeft > 1 ? clampScroll(targetScrollLeft, maxScrollLeft) : 0;

        const nextScrollTop =
          maxScrollTop > 1 ? clampScroll(targetScrollTop, maxScrollTop) : 0;

        if (Math.abs(root.scrollLeft - nextScrollLeft) > 0.5) {
          root.scrollLeft = nextScrollLeft;
        }

        if (Math.abs(root.scrollTop - nextScrollTop) > 0.5) {
          root.scrollTop = nextScrollTop;
        }
      }
    };

    /**
     * Primeiro restore: logo após commit do layout React.
     */
    restoreAnchor();

    /**
     * Segundo restore: no frame seguinte, quando canvas/page wrappers podem ter
     * estabilizado dimensões. Isso reduz salto residual sem permitir que o
     * HorizontalOverflowController sobrescreva scrollLeft.
     */
    firstFrame = window.requestAnimationFrame(() => {
      restoreAnchor();

      secondFrame = window.requestAnimationFrame(() => {
        restoreAnchor();

        pendingZoomAnchorRef.current = null;

        if (zoomReleaseTimerRef.current !== null) {
          window.clearTimeout(zoomReleaseTimerRef.current);
        }

        zoomReleaseTimerRef.current = window.setTimeout(() => {
          suppressAutoPageSyncRef.current = false;
          zoomReleaseTimerRef.current = null;
        }, 120);
      });
    });

    return () => {
      cancelled = true;

      if (firstFrame) {
        window.cancelAnimationFrame(firstFrame);
      }

      if (secondFrame) {
        window.cancelAnimationFrame(secondFrame);
      }
    };
  }, [getPageAnchorElement, stageZoom]);

  useEffect(() => {
    const stageRoot = stageScrollRef.current;
    if (!stageRoot) return;

    const normalizeWheelDeltaToPixels = (event: WheelEvent) => {
      if (event.deltaMode === 1) return event.deltaY * 16;
      if (event.deltaMode === 2) return event.deltaY * 800;
      return event.deltaY;
    };

    const getWheelZoomTime = () =>
      typeof performance !== "undefined" &&
      typeof performance.now === "function"
        ? performance.now()
        : Date.now();

    const flushWheelZoom = () => {
      const delta = wheelDeltaRef.current;
      const anchorPoint = wheelAnchorPointRef.current;

      wheelDeltaRef.current = 0;
      wheelAnchorPointRef.current = null;
      wheelFrameRef.current = null;

      if (delta === 0) return;
      lastWheelZoomFlushAtRef.current = getWheelZoomTime();

      /**
       * Zoom suave exponencial, em vez de pulo fixo de 5%.
       * Isso reduz a sensação de salto no scroll zoom.
       */
      const nextZoom =
        computeWheelZoom({
          currentZoom: currentZoomRef.current / 100,
          deltaY: delta,
          deltaMode: 0,
        }) * 100;

      applyZoomTransactional(
        nextZoom,
        "manual",
        anchorPoint ?? undefined,
      );
    };

    const handleCtrlWheel = (event: WheelEvent) => {
      if (!event.ctrlKey) return;

      const target = event.target as Node | null;
      if (target && !stageRoot.contains(target)) return;

      event.preventDefault();
      markViewportInteracting("wheel-zoom");

      wheelDeltaRef.current += normalizeWheelDeltaToPixels(event);
      wheelAnchorPointRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
      };

      if (wheelFrameRef.current == null) {
        const elapsedSinceFlush =
          getWheelZoomTime() - lastWheelZoomFlushAtRef.current;

        if (elapsedSinceFlush >= WHEEL_ZOOM_IMMEDIATE_FLUSH_MS) {
          flushWheelZoom();
        } else {
          wheelFrameRef.current = window.requestAnimationFrame(flushWheelZoom);
        }
      }
    };

    /**
     * Preferir stageRoot em vez de window reduz interferência externa.
     */
    stageRoot.addEventListener("wheel", handleCtrlWheel, { passive: false });

    return () => {
      if (wheelFrameRef.current != null) {
        window.cancelAnimationFrame(wheelFrameRef.current);
      }

      wheelFrameRef.current = null;
      wheelDeltaRef.current = 0;
      wheelAnchorPointRef.current = null;
      lastWheelZoomFlushAtRef.current = 0;

      stageRoot.removeEventListener("wheel", handleCtrlWheel);
    };
  }, [applyZoomTransactional, markViewportInteracting]);

  useEffect(() => {
    const stageRoot = stageScrollRef.current;
    if (!stageRoot) return;

    const handleScroll = () => {
      beginScrollGesture();
    };

    stageRoot.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      stageRoot.removeEventListener("scroll", handleScroll);
    };
  }, [beginScrollGesture]);

  useEffect(() => {
    if (!session || didInitialScrollRef.current) return;
    const timeoutId = window.setTimeout(() => {
      goToPageAndScroll(page, "auto");
      didInitialScrollRef.current = true;
    }, 80);
    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [goToPageAndScroll, page, session]);

  useEffect(() => {
    didInitialScrollRef.current = false;
  }, [session?.id]);

  useEffect(() => {
    const root = stageScrollRef.current;
    if (!root || !session) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const nextVisible = new Set(visiblePageNumbersRef.current);
        let mostVisible: IntersectionObserverEntry | null = null;

        for (const entry of entries) {
          const pageNumber = Number(
            (entry.target as HTMLElement).dataset.pageNumber ?? 0,
          );

          if (!pageNumber) continue;

          if (entry.isIntersecting) {
            nextVisible.add(pageNumber);

            if (
              !mostVisible ||
              entry.intersectionRatio > mostVisible.intersectionRatio
            ) {
              mostVisible = entry;
            }
          } else {
            nextVisible.delete(pageNumber);
          }
        }

        /**
         * A página ativa sempre permanece como candidata a render imediato,
         * mesmo se o IntersectionObserver atrasar um frame durante zoom.
         */
        nextVisible.add(activePageRef.current);
        visiblePageNumbersRef.current = nextVisible;

        setVisiblePageNumbers((current) =>
          areNumberSetsEqual(current, nextVisible)
            ? current
            : new Set(nextVisible),
        );

        if (suppressAutoPageSyncRef.current) return;

        if (!mostVisible || mostVisible.intersectionRatio < 0.55) return;

        const pageNumber = Number(
          (mostVisible.target as HTMLElement).dataset.pageNumber ?? 0,
        );

        if (!pageNumber || pageNumber === page) return;

        goToPage(pageNumber);
      },
      {
        root,
        threshold: [0.4, 0.55, 0.7, 0.85],
      },
    );

    for (const pageNumber of pageNumbers) {
      const node = pageElementRefs.current[pageNumber];
      if (node) observer.observe(node);
    }

    return () => {
      observer.disconnect();
    };
  }, [goToPage, page, pageNumbers, session]);

  const closeSelectionActions = useCallback(() => {
    window.getSelection()?.removeAllRanges();
  }, []);

  const handleSelectedText = useCallback(
    (nextSelection: PdfTextSelection, _position: { top: number; left: number }) => {
      setSelection(nextSelection);
      setStatusNotice(null);
      setStatusError(null);
    },
    [setSelection],
  );

  const handleBlocksChange = useCallback(
    (pageNumber: number, blocks: PdfTextBlock[], renderScale?: number) => {
      setBlocksByPage((current) => ({
        ...current,
        [pageNumber]: blocks,
      }));
      if (!pdfFile || !blocks.length) return;

      void (async () => {
        try {
          const scaleFactor = Math.max(
            0.5,
            renderScale ?? stageZoom / 100,
          );
          const normalizedBlocks = blocks.map((item) => ({
            ...item,
            x: item.x / scaleFactor,
            y: item.y / scaleFactor,
            width: item.width / scaleFactor,
            height: item.height / scaleFactor,
            fontSize: item.fontSize / scaleFactor,
            lineHeight: item.lineHeight / scaleFactor,
          }));
          const computedPageHeight = Math.max(
            1,
            ...normalizedBlocks.map((item) => item.y + item.height),
          );
          const geoBlocks = await pdfReaderController.persistPageGeoBlocks({
            pdfFileId: pdfFile.id,
            projectId: pdfFile.projectId,
            documentId: resolvedDocumentId,
            pageNumber,
            pageHeight: computedPageHeight,
            blocks: normalizedBlocks,
          });
          const ensured = await pdfReaderController.ensureTranslationLayerForPage({
            pdfFileId: pdfFile.id,
            projectId: pdfFile.projectId,
            documentId: resolvedDocumentId,
            pageNumber,
            sourceLanguage,
            targetLanguage,
            geoBlocks,
          });
          mergePageTranslationBlocks(pageNumber, ensured);
        } catch (geoError) {
          setStatusError(
            geoError instanceof Error
              ? geoError.message
              : "Failed to map geolocated page blocks.",
          );
        }
      })();
    },
    [
      mergePageTranslationBlocks,
      pdfFile,
      resolvedDocumentId,
      stageZoom,
      sourceLanguage,
      targetLanguage,
    ],
  );

  const ensureHighlightFromSelection = useCallback(
    async (currentSelection: PdfTextSelection | null) => {
      if (!currentSelection || !pdfFile) return null;
      return addHighlight({
        pdfFileId: pdfFile.id,
        projectId: pdfFile.projectId,
        documentId: resolvedDocumentId,
        selection: currentSelection,
        color: "yellow",
      });
    },
    [addHighlight, pdfFile, resolvedDocumentId],
  );

  const handleCreateHighlight = useCallback(async () => {
    const highlight = await ensureHighlightFromSelection(selection);
    if (!highlight) return;

    setStatusNotice("Destaque salvo no Knexread.");
    closeSelectionActions();
    clearSelection();
  }, [clearSelection, closeSelectionActions, ensureHighlightFromSelection, selection]);

  const handleCreateCommentFromSelection = useCallback(async () => {
    if (!selection || !pdfFile) return;
    const content = window.prompt("Comentário para o trecho selecionado");
    if (content === null) return;
    const trimmedContent = content.trim();
    if (!trimmedContent) return;

    const highlight = await ensureHighlightFromSelection(selection);
    await addAnnotation({
      pdfFileId: pdfFile.id,
      projectId: pdfFile.projectId,
      documentId: resolvedDocumentId,
      pageNumber: selection.pageNumber,
      content: trimmedContent,
      annotationType: "comment",
      highlightId: highlight?.id,
    });

    setStatusNotice("Comentário salvo no Knexread.");
    closeSelectionActions();
    clearSelection();
  }, [
    addAnnotation,
    clearSelection,
    closeSelectionActions,
    ensureHighlightFromSelection,
    pdfFile,
    resolvedDocumentId,
    selection,
  ]);

  const handleCopySelection = useCallback(async () => {
    if (!selection?.selectedText) return;
    await navigator.clipboard?.writeText?.(selection.selectedText);
    setStatusNotice("Trecho copiado.");
    closeSelectionActions();
  }, [closeSelectionActions, selection?.selectedText]);

  const handleCreateCitation = useCallback(
    async (citationType: "direct" | "indirect") => {
      if (!selection || !pdfFile) return;

      const highlight = await ensureHighlightFromSelection(selection);
      const citation = await createPdfCitationFromSelection({
        pdfFileId: pdfFile.id,
        projectId: pdfFile.projectId,
        documentId: resolvedDocumentId,
        highlightId: highlight?.id,
        citationType,
        pageNumber: selection.pageNumber,
        selectedText: selection.selectedText,
      });

      setCitations((current) => [...current, citation]);
      const citationText =
        citation.citationTextAbnt ||
        citation.citationTextApa ||
        citation.quotedText ||
        citation.paraphrase ||
        selection.selectedText;

      if (onInsertCitation) {
        await onInsertCitation({ citation, citationText });
        await pdfReaderController.insertCitationIntoDocument(citation.id);
      }

      setStatusNotice(
        citationType === "direct"
          ? "Direct citation created."
          : "Indirect citation created.",
      );
      closeSelectionActions();
      clearSelection();
    },
    [
      clearSelection,
      closeSelectionActions,
      ensureHighlightFromSelection,
      onInsertCitation,
      pdfFile,
      resolvedDocumentId,
      selection,
    ],
  );

  const handleCreateReferenceCandidate = useCallback(async () => {
    if (!pdfFile || !metadata) return;
    const candidate = await createReferenceCandidate(pdfFile.id, metadata);
    if (!candidate) return;
    setStatusNotice("Reference candidate created.");
  }, [createReferenceCandidate, metadata, pdfFile]);

  const handlePageRendered = useCallback((pageData: RenderedPdfPage) => {
    setPageRenderMetrics((current) => {
      const existing = current[pageData.pageNumber];
      const hasStablePageBox =
        pageData.pageWidthPt > 0 && pageData.pageHeightPt > 0;

      if (
        existing &&
        existing.pageWidthPt === pageData.pageWidthPt &&
        existing.pageHeightPt === pageData.pageHeightPt &&
        (hasStablePageBox ||
          (existing.width === pageData.width &&
            existing.height === pageData.height &&
            existing.renderScale === pageData.renderScale))
      ) {
        return current;
      }
      return {
        ...current,
        [pageData.pageNumber]: {
          width: pageData.width,
          height: pageData.height,
          pageWidthPt: pageData.pageWidthPt,
          pageHeightPt: pageData.pageHeightPt,
          renderScale: pageData.renderScale,
        },
      };
    });
  }, []);

  const handleUpdateTranslationBlock = useCallback(
    async (translationBlockId: string, text: string) => {
      const updated = await pdfReaderController.updateTranslationBlockText({
        translationBlockId,
        text,
        reason: "manual-edit",
        status: "edited",
      });
      if (!updated) return;
      setTranslationBlocks((current) =>
        sortTranslationBlocks(
          current.map((block) => (block.id === updated.id ? updated : block)),
        ),
      );
    },
    [],
  );

  const handleTranslatePage = useCallback(async () => {
    if (!pdfFile) return;
    const updated = await pdfReaderController.translatePage({
      pdfFileId: pdfFile.id,
      pageNumber: page,
      strategy: translationStrategy,
      sourceLanguage,
      targetLanguage,
      onlyPending: false,
    });
    mergePageTranslationBlocks(page, updated);
    setStatusNotice(`Page ${page} traduzida (${updated.length} blocos).`);
  }, [
    mergePageTranslationBlocks,
    page,
    pdfFile,
    sourceLanguage,
    targetLanguage,
    translationStrategy,
  ]);

  const handleTranslateDocument = useCallback(async () => {
    if (!pdfFile) return;
    await pdfReaderController.translateDocument({
      pdfFileId: pdfFile.id,
      strategy: translationStrategy,
      sourceLanguage,
      targetLanguage,
      onlyPending: false,
    });
    const allUpdated = await pdfReaderController.listTranslationBlocks(pdfFile.id);
    setTranslationBlocks(sortTranslationBlocks(allUpdated));
    setStatusNotice(`Documento traduzido (${allUpdated.length} blocos).`);
  }, [pdfFile, sourceLanguage, targetLanguage, translationStrategy]);

  const handleTranslateSelection = useCallback(async () => {
    if (!selection || !pdfFile) return;
    const pageBlocks = translationBlocks.filter((block) => block.pageNumber === selection.pageNumber);
    const matched = pageBlocks.find((block) =>
      block.originalText.toLowerCase().includes(selection.selectedText.toLowerCase()),
    );
    if (matched) {
      setFocusedTranslationBlockId(matched.id);
    }
    await handleTranslatePage();
    setStatusNotice("Selection sent to page translation.");
    closeSelectionActions();
  }, [closeSelectionActions, handleTranslatePage, pdfFile, selection, translationBlocks]);

  const orderedTranslationBlocks = useMemo(
    () => sortTranslationBlocks(translationBlocks),
    [translationBlocks],
  );

  const handleNextReviewBlock = useCallback(() => {
    if (!orderedTranslationBlocks.length) return;
    const currentIndex = focusedTranslationBlock
      ? orderedTranslationBlocks.findIndex((block) => block.id === focusedTranslationBlock.id)
      : -1;
    const next = orderedTranslationBlocks[(currentIndex + 1) % orderedTranslationBlocks.length];
    setFocusedTranslationBlockId(next.id);
    goToPageAndScroll(next.pageNumber);
  }, [focusedTranslationBlock, goToPageAndScroll, orderedTranslationBlocks]);

  const handlePreviousReviewBlock = useCallback(() => {
    if (!orderedTranslationBlocks.length) return;
    const currentIndex = focusedTranslationBlock
      ? orderedTranslationBlocks.findIndex((block) => block.id === focusedTranslationBlock.id)
      : 0;
    const prevIndex =
      (currentIndex - 1 + orderedTranslationBlocks.length) % orderedTranslationBlocks.length;
    const previous = orderedTranslationBlocks[prevIndex];
    setFocusedTranslationBlockId(previous.id);
    goToPageAndScroll(previous.pageNumber);
  }, [focusedTranslationBlock, goToPageAndScroll, orderedTranslationBlocks]);

  const handleMarkFocusedAsReviewed = useCallback(async () => {
    if (!focusedTranslationBlock) return;
    const updated = await pdfReaderController.updateTranslationBlockText({
      translationBlockId: focusedTranslationBlock.id,
      text: focusedTranslationBlock.translatedText,
      reason: "review",
      status: "reviewed",
      reviewedBy: "user",
    });
    if (!updated) return;
    setTranslationBlocks((current) =>
      sortTranslationBlocks(
        current.map((block) => (block.id === updated.id ? updated : block)),
      ),
    );
    setStatusNotice("Bloco marcado como revisado.");
  }, [focusedTranslationBlock]);

  const handleRebuildFocusedBlock = useCallback(async () => {
    if (!focusedTranslationBlock) return;
    const updated = await pdfReaderController.updateTranslationBlockText({
      translationBlockId: focusedTranslationBlock.id,
      text: focusedTranslationBlock.translatedText,
      status: "edited",
      reason: "restore-automatic",
    });
    if (!updated) return;
    setTranslationBlocks((current) =>
      sortTranslationBlocks(
        current.map((block) => (block.id === updated.id ? updated : block)),
      ),
    );
    setStatusNotice("Bloco reajustado no reconstruction engine.");
  }, [focusedTranslationBlock]);

  const handleClose = useCallback(() => {
    closeSelectionActions();
    clearSelection();
    onClose?.();
  }, [clearSelection, closeSelectionActions, onClose]);

  const handleExportTranslated = useCallback(() => {
    setStatusNotice("Translated copy export prepared (initial mock).");
  }, []);

  const handleExportBilingual = useCallback(() => {
    setStatusNotice("Bilingual export prepared (initial mock).");
  }, []);

  const handleExportWithAnnotations = useCallback(() => {
    setStatusNotice("Annotations export prepared (initial mock).");
  }, []);

  const hydrateOpenedPdfState = useCallback(
    async (input: {
      opened: Awaited<ReturnType<typeof openFile>>;
      selectedFile: File;
      contextDocumentId?: string;
      contextSourceId?: string;
    }) => {
      const { opened, selectedFile, contextDocumentId, contextSourceId } = input;
      const preferencesDocumentId =
        contextDocumentId ?? opened.pdfFile.documentId ?? resolvedDocumentId;

      setPageCount(opened.session.pageCount);
      setPdfMetadata(opened.metadata);
      setTextLayerNotice(null);

      void probePdfTextLayer({
        session: opened.session,
        maxPages: 3,
      })
        .then((probe) => {
          if (probe.likelyImageOnly) {
            setTextLayerNotice(
              "PDF likely image-based. Automatic OCR is not active yet; text selection and extraction may be limited.",
            );
            return;
          }
          setTextLayerNotice(
            `Text layer detected (${probe.pagesWithText}/${probe.inspectedPages} pages analyzed).`,
          );
        })
        .catch(() => {
          setTextLayerNotice("Could not verify PDF text layer.");
        });

      let readerSession = await pdfReaderController.getSession(opened.pdfFile.id);
      if (!readerSession) {
        const created = await pdfReaderController.open({
          file: selectedFile,
          projectId,
          documentId: contextDocumentId,
          sourceId: contextSourceId,
        });
        readerSession = created.session;
      }

      if (readerSession) {
        goToPage(readerSession.currentPage || 1);
        setZoomMode(readerSession.zoomMode ?? "manual");
        setStageZoom(clampStageZoom(readerSession.zoom || 130));
        setSidebarMode(readerSession.sidebarMode ?? "thumbnails");
        setTranslationViewMode(
          normalizeTranslationViewMode(readerSession.translationViewMode),
        );
        setTranslationStrategy(readerSession.translationStrategy ?? "local-first");
        setSourceLanguage(readerSession.sourceLanguage ?? "auto");
        setTargetLanguage(readerSession.targetLanguage ?? "pt-BR");
        setFocusedTranslationBlockId(readerSession.focusedBlockId);
      }

      const [loadedCitations, loadedTranslationBlocks, preferences] = await Promise.all([
        pdfReaderController.listCitations(opened.pdfFile.id),
        pdfReaderController.listTranslationBlocks(opened.pdfFile.id),
        pdfReaderController.getReaderPreferences({
          projectId,
          documentId: preferencesDocumentId,
        }),
        loadHighlights(opened.pdfFile.id),
        loadAnnotations(opened.pdfFile.id),
      ]);
      setCitations(loadedCitations);
      setTranslationBlocks(sortTranslationBlocks(loadedTranslationBlocks));
      setTranslationViewMode(
        normalizeTranslationViewMode(preferences.translationViewMode),
      );
      setTranslationStrategy(preferences.translationStrategy);
      setSourceLanguage(preferences.sourceLanguage);
      setTargetLanguage(preferences.targetLanguage);
      setZoomMode(preferences.zoomMode ?? "manual");
      setShowTextLayer(preferences.showTextLayer ?? true);
      setShowRuler(Boolean(preferences.showRuler));
      setShowMargins(Boolean(preferences.showMargins));
      setShowViewportCenter(Boolean(preferences.showViewportCenter));
      setShowPageCenter(Boolean(preferences.showPageCenter));
      setEnableOcrLayer(Boolean(preferences.enableOcrLayer));
      setShowOcrDebugBoxes(Boolean(preferences.showOcrDebugBoxes));
    },
    [
      goToPage,
      loadAnnotations,
      loadHighlights,
      projectId,
      resolvedDocumentId,
      setPageCount,
      setPdfMetadata,
      setStageZoom,
    ],
  );

  const openSelectedPdf = useCallback(
    async (
      selectedFile: File,
      context?: {
        documentId?: string;
        sourceId?: string;
        sourceName?: string;
        pdfFileId?: string;
      },
    ) => {
      setStatusError(null);
      if (onOpenPdfInNewGuide) {
        await onOpenPdfInNewGuide({
          file: selectedFile,
          projectId,
          documentId: context?.documentId ?? documentId,
          sourceId: context?.sourceId ?? sourceId,
          sourceName: context?.sourceName ?? selectedFile.name,
          pdfFileId: context?.pdfFileId,
        });
        return;
      }

      try {
        const opened = await openFile({
          file: selectedFile,
          projectId,
          documentId: context?.documentId ?? documentId,
          sourceId: context?.sourceId ?? sourceId,
        });
        await hydrateOpenedPdfState({
          opened,
          selectedFile,
          contextDocumentId: context?.documentId ?? documentId,
          contextSourceId: context?.sourceId ?? sourceId,
        });
        setStatusNotice(`PDF aberto: ${selectedFile.name}`);
      } catch (openError) {
        setStatusError(
          openError instanceof Error
            ? openError.message
            : "Falha ao abrir PDF no Knexread.",
        );
      }
    },
    [
      documentId,
      hydrateOpenedPdfState,
      openFile,
      onOpenPdfInNewGuide,
      projectId,
      sourceId,
    ],
  );

  const handleHiddenOpenInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const selectedFile = event.target.files?.[0];
      event.currentTarget.value = "";
      if (!selectedFile) return;
      void openSelectedPdf(selectedFile);
    },
    [openSelectedPdf],
  );

  const handleOpenRecentPdf = useCallback(
    async (pdfFileId: string) => {
      setStatusError(null);
      try {
        const [storedFile, storedRecord] = await Promise.all([
          pdfReaderController.resolveStoredFile(pdfFileId),
          pdfReaderController.getFile(pdfFileId),
        ]);
        if (!storedFile || !storedRecord) {
          setStatusError("Nao foi possivel carregar o arquivo recente selecionado.");
          return;
        }
        await openSelectedPdf(storedFile, {
          documentId: storedRecord.documentId,
          sourceId: storedRecord.sourceId,
          sourceName: storedRecord.fileName ?? storedFile.name,
          pdfFileId: storedRecord.id,
        });
      } catch (openError) {
        setStatusError(
          openError instanceof Error
            ? openError.message
            : "Falha ao abrir arquivo recente.",
        );
      }
    },
    [openSelectedPdf],
  );

  const handleRequestOpenPdf = useCallback(() => {
    openPdfInputRef.current?.click();
  }, []);

  const handleRunPageOcr = useCallback(async () => {
    const metrics = pageRenderMetrics[page];
    if (!metrics) {
      setStatusError("Render current page before running OCR.");
      return;
    }

    await runOcrOnPageImage({
      pageNumber: page,
      pageWidth: metrics.width,
      pageHeight: metrics.height,
      languageHint: sourceLanguage === "auto" ? undefined : sourceLanguage,
    });
    setEnableOcrLayer(true);
    setStatusNotice(
      `OCR page ${page} prepared in isolated layer mode. Original PDF remained untouched.`,
    );
  }, [page, pageRenderMetrics, sourceLanguage]);

  const handleRunDocumentOcr = useCallback(() => {
    setEnableOcrLayer(true);
    setStatusNotice(
      "OCR document pipeline prepared with normalized coordinates and no visual overwrite.",
    );
  }, []);

  /**
   * Apenas o gesto real de zoom deve rebaixar a renderização para preview.
   *
   * Scroll, resize e restauração de âncora não podem manter a página visível
   * presa em interactive-preview/warmup depois que o zoom estabiliza.
   */
  const renderPhase: KnexPdfRenderPhase = isZoomGestureActive
    ? "interactive-preview"
    : "settled-final";
  const renderWindow = useMemo(
    () =>
      createPdfRenderWindow({
        activePageNumber: page,
        visiblePageNumbers,
        pageCount,
      }),
    [page, pageCount, visiblePageNumbers],
  );
  const visibleRenderPageNumbers = useMemo(
    () => new Set(renderWindow.visiblePageNumbers),
    [renderWindow.visiblePageNumbers],
  );
  const warmupRenderPageNumbers = useMemo(
    () => new Set(renderWindow.warmupPageNumbers),
    [renderWindow.warmupPageNumbers],
  );
  const preloadRenderPageNumbers = useMemo(
    () => new Set(renderWindow.preloadPageNumbers),
    [renderWindow.preloadPageNumbers],
  );
  const title = sourceName || pdfFile?.fileName || file.name;
  const isPagePresentation = presentation === "page";
  const canClose = typeof onClose === "function";
  const isFileTab = activeRibbonTab === "arquivo";
  const isBackstageTab = isFileTab;
  const showReaderWorkspace = !isBackstageTab;
  const showLeftDockSidebar = showReaderWorkspace;

  const showTranslationPageInMain =
    translationViewMode === "toggle" && toggleShowsTranslation;
  const showTextLayerInMain = showTextLayer && !showTranslationPageInMain;

  const readerSurface = (
    <section
      className={`relative flex min-h-0 flex-1 flex-col overflow-hidden border border-zinc-300 bg-white shadow-2xl ${
        isPagePresentation
          ? "h-full rounded-none border-x-0 border-b-0 border-t-0 shadow-none"
          : "rounded-xl"
      }`}
    >
      {showShellHeader ? (
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-3 py-2">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-zinc-100">Knexread</p>
            <p className="truncate text-xs text-zinc-300">{title}</p>
          </div>
        </div>
      ) : null}

      <KnexreadTabs activeTab={activeRibbonTab} onTabChange={setActiveRibbonTab} />
      {!isBackstageTab ? (
        <KnexreadRibbon
          activeTab={activeRibbonTab}
          translationViewMode={translationViewMode}
          translationStrategy={translationStrategy}
          sourceLanguage={sourceLanguage}
          targetLanguage={targetLanguage}
          showRuler={showRuler}
          showMargins={showMargins}
          showViewportCenter={showViewportCenter}
          showPageCenter={showPageCenter}
          showTextLayer={showTextLayer}
          showOcrDebugBoxes={showOcrDebugBoxes}
          hasSelection={Boolean(selection?.selectedText)}
          onOpenPdf={handleRequestOpenPdf}
          onClosePdf={canClose ? handleClose : () => {}}
          onSaveSession={() => setStatusNotice("Session saved locally.")}
          onZoomIn={zoomInStage}
          onZoomOut={zoomOutStage}
          onFitWidth={setFitWidthZoom}
          onFitPage={setFitPageZoom}
          onActualSize={setActualSizeZoom}
          onTranslateSelection={() => {
            void handleTranslateSelection();
          }}
          onHighlightSelection={() => {
            void handleCreateHighlight();
          }}
          onCommentSelection={() => {
            void handleCreateCommentFromSelection();
          }}
          onCopySelection={() => {
            void handleCopySelection();
          }}
          onCreateDirectCitation={() => {
            void handleCreateCitation("direct");
          }}
          onCreateIndirectCitation={() => {
            void handleCreateCitation("indirect");
          }}
          onCreateReferenceFromSelection={() => {
            void handleCreateReferenceCandidate();
          }}
          onTranslatePage={() => {
            void handleTranslatePage();
          }}
          onTranslateDocument={() => {
            void handleTranslateDocument();
          }}
          onTranslationStrategyChange={setTranslationStrategy}
          onSourceLanguageChange={setSourceLanguage}
          onTargetLanguageChange={setTargetLanguage}
          onTranslationViewModeChange={setTranslationViewMode}
          onToggleRuler={() => setShowRuler((value) => !value)}
          onToggleMargins={() => setShowMargins((value) => !value)}
          onToggleViewportCenter={() => setShowViewportCenter((value) => !value)}
          onTogglePageCenter={() => setShowPageCenter((value) => !value)}
          onToggleTextLayer={() => setShowTextLayer((value) => !value)}
          onToggleOcrDebugBoxes={() => setShowOcrDebugBoxes((value) => !value)}
          onRunPageOcr={() => {
            void handleRunPageOcr();
          }}
          onRunDocumentOcr={handleRunDocumentOcr}
          onNextReviewBlock={handleNextReviewBlock}
          onPreviousReviewBlock={handlePreviousReviewBlock}
          onMarkFocusedAsReviewed={() => {
            void handleMarkFocusedAsReviewed();
          }}
          onRebuildFocusedBlock={() => {
            void handleRebuildFocusedBlock();
          }}
          onExportTranslated={handleExportTranslated}
          onExportBilingual={handleExportBilingual}
          onExportWithAnnotations={handleExportWithAnnotations}
        />
      ) : null}
      {!isFileTab ? guidesBar : null}

      <div className="relative min-h-0 flex-1">
        <div
          className={`absolute inset-0 flex min-h-0 flex-1 overflow-hidden transition-opacity duration-75 ${
            isFileTab ? "pointer-events-none opacity-0" : "opacity-100"
          }`}
          aria-hidden={isFileTab}
        >
          {showLeftDockSidebar ? (
            <PdfSidebar
              mode={sidebarMode}
              onModeChange={setSidebarMode}
              collapsed={isDockSidebarCollapsed || sidebarMode === "none"}
              panelWidth={dockSidebarWidth}
              onPanelWidthChange={setDockSidebarWidth}
              onToggleCollapsed={() =>
                setIsDockSidebarCollapsed((value) => {
                  const next = !value;
                  if (!next && sidebarMode === "none") {
                    setSidebarMode("thumbnails");
                  }
                  return next;
                })
              }
              highlights={highlights}
              annotations={annotations}
              citations={citations}
              translationBlocks={translationBlocks}
              onSelectPage={(nextPage) => goToPageAndScroll(nextPage)}
              renderThumbnails={() => (
                <PdfThumbnailsPanel
                  session={session ?? undefined}
                  pageCount={pageCount}
                  currentPage={page}
                  onGoToPage={(nextPage) => goToPageAndScroll(nextPage)}
                />
              )}
              renderSearch={() => (
                <PdfSearchPanel
                  query={query}
                  matches={matches}
                  onQueryChange={setQuery}
                  onSelectMatch={(match) => goToPageAndScroll(match.pageNumber)}
                />
              )}
              renderSourceInfo={() => (
                <PdfSourceInfoPanel
                  metadata={metadata}
                  candidate={referenceCandidate}
                  onCreateReferenceCandidate={() => {
                    void handleCreateReferenceCandidate();
                  }}
                />
              )}
            />
          ) : null}

          <div
            ref={stageScrollRef}
            className="relative isolate min-h-0 flex-1 overflow-y-auto overflow-x-auto overscroll-contain bg-zinc-200 [overflow-anchor:none] [scrollbar-gutter:stable]"
          >
            <PdfReadingFrame
              containerRef={stageScrollRef}
              contentWidth={readingContentWidth}
              contentHeight={activePageContentHeight}
              rulerContentWidth={sourceContentWidth}
              pageWidthPt={activePageRenderMetrics?.pageWidthPt}
              pageHeightPt={activePageRenderMetrics?.pageHeightPt}
              showRuler={showRuler}
              showMargins={showMargins}
              showViewportCenter={showViewportCenter}
              showPageCenter={showPageCenter}
              leftMarginPx={48}
              rightMarginPx={48}
            >
          {translationViewMode === "toggle" ? (
            <div className="mb-3 flex items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => setToggleShowsTranslation(false)}
                className={`rounded border px-2 py-1 text-xs ${
                  !toggleShowsTranslation
                    ? "border-[#c23616] bg-[#c23616] text-white"
                    : "border-zinc-200 bg-white text-zinc-700"
                }`}
              >
                Original
              </button>
              <button
                type="button"
                onClick={() => setToggleShowsTranslation(true)}
                className={`rounded border px-2 py-1 text-xs ${
                  toggleShowsTranslation
                    ? "border-[#c23616] bg-[#c23616] text-white"
                    : "border-zinc-200 bg-white text-zinc-700"
                }`}
              >
                Translation
              </button>
            </div>
          ) : null}

          <div
            className={`${
              translationViewMode === "focus-review"
                ? "flex min-h-full items-start justify-start gap-4"
                : "min-h-full"
            }`}
          >
            {session ? (
              translationViewMode === "side-by-side" ? (
                <div className="flex w-fit min-w-full flex-col gap-5">
                  <div className="grid grid-cols-1 gap-3 px-2 xl:grid-cols-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                      Original
                    </p>
                    <p className="text-xs font-semibold uppercase tracking-wide text-zinc-600">
                      Tradução editável
                    </p>
                  </div>
                  {pageNumbers.map((pageNumber) => {
                    const isActivePage = pageNumber === page;
                    const isVisiblePage =
                      visibleRenderPageNumbers.has(pageNumber);
                    const isWarmupPage =
                      warmupRenderPageNumbers.has(pageNumber);
                    const isPreloadPage =
                      preloadRenderPageNumbers.has(pageNumber);
                    const pageRenderPhase = resolvePageRenderPhaseForWindow({
                      viewportPhase: renderPhase,
                      isActivePage,
                      isVisiblePage,
                      isWarmupPage,
                      isPreloadPage,
                    });
                    const pageRenderPriority = getPageRenderPriorityForWindow({
                      isActivePage,
                      isVisiblePage,
                      isWarmupPage,
                      isPreloadPage,
                    });
                    const persistPageBlocks =
                      activeRibbonTab === "traducao" ||
                      activeRibbonTab === "revisao";
                    const translationPageSize = getPageDisplaySize(pageNumber);

                    const shouldRenderPageNow = shouldRenderPageDuringZoom(pageNumber);
                    const pageRenderQuality = getPageRenderQuality(pageNumber);
                    const isRenderInteractionActive =
                      isZoomGestureActive ||
                      isViewportInteracting ||
                      pageRenderPhase === "interactive-preview";
                    const shouldAllowTextLayerNow =
                      showTextLayer &&
                      isActivePage;
                    const shouldAllowSelectionNow =
                      pageRenderPhase === "settled-final" &&
                      !isRenderInteractionActive;
                    const shouldPersistPageBlocksNow =
                      !isRenderInteractionActive &&
                      persistPageBlocks;
                    const shouldRenderCanvasNow =
                      isActivePage ||
                      isVisiblePage ||
                      isWarmupPage ||
                      isPreloadPage ||
                      shouldRenderPageNow;

                    return (
                      <div
                        key={`knexread-sbs-page-${pageNumber}`}
                        ref={(node) => setPageNodeRef(pageNumber, node)}
                        data-page-number={pageNumber}
                        data-knexread-page-pair-number={pageNumber}
                        className="flex w-fit min-w-full items-start justify-center gap-6"
                      >
                        <div className="flex flex-col">
                          <PdfPageView
                            session={session}
                            pdfFileId={pdfFile?.id}
                            pageNumber={pageNumber}
                            zoom={stageZoom}
                            renderQuality={pageRenderQuality}
                            highlights={highlights}
                            onSelectText={handleSelectedText}
                            onBlocksChange={
                              shouldPersistPageBlocksNow ? handleBlocksChange : undefined
                            }
                            onRendered={handlePageRendered}
                            showTextLayer={shouldAllowTextLayerNow}
                            enableSelection={shouldAllowSelectionNow}
                            priority={isActivePage}
                            isActivePage={isActivePage}
                            isZooming={isZoomGestureActive}
                            isScrolling={isViewportInteracting && !isZoomGestureActive}
                            renderPhase={pageRenderPhase}
                            finalRenderVersion={finalRenderVersion}
                            isWarmupPage={isWarmupPage}
                            renderPriority={pageRenderPriority}
                            shouldRenderCanvas={shouldRenderCanvasNow}
                            onNavigateToPage={(nextPage) => goToPageAndScroll(nextPage)}
                          />
                        </div>
                        <div className="flex flex-col">
                          <PdfTranslationPage
                            pageNumber={pageNumber}
                            width={translationPageSize.width}
                            height={translationPageSize.height}
                            status="blank"
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <>
                  <div className="flex w-fit min-w-full flex-col gap-5">
                    {pageNumbers.map((pageNumber) => {
                      const isActivePage = pageNumber === page;
                      const isVisiblePage =
                        visibleRenderPageNumbers.has(pageNumber);
                      const isWarmupPage =
                        warmupRenderPageNumbers.has(pageNumber);
                      const isPreloadPage =
                        preloadRenderPageNumbers.has(pageNumber);
                      const pageRenderPhase = resolvePageRenderPhaseForWindow({
                        viewportPhase: renderPhase,
                        isActivePage,
                        isVisiblePage,
                        isWarmupPage,
                        isPreloadPage,
                      });
                      const pageRenderPriority = getPageRenderPriorityForWindow({
                        isActivePage,
                        isVisiblePage,
                        isWarmupPage,
                        isPreloadPage,
                      });
                      const persistPageBlocks =
                        activeRibbonTab === "traducao" ||
                        activeRibbonTab === "revisao" ||
                        translationViewMode === "focus-review";
                      const translationPageSize = getPageDisplaySize(pageNumber);

                      const shouldRenderPageNow = shouldRenderPageDuringZoom(pageNumber);
                      const pageRenderQuality = getPageRenderQuality(pageNumber);
                      const isRenderInteractionActive =
                        isZoomGestureActive ||
                        isViewportInteracting ||
                        pageRenderPhase === "interactive-preview";
                      const shouldAllowTextLayerNow =
                        showTextLayerInMain &&
                        isActivePage;
                      const shouldAllowSelectionNow =
                        pageRenderPhase === "settled-final" &&
                        !isRenderInteractionActive;
                      const shouldPersistPageBlocksNow =
                        !isRenderInteractionActive &&
                        persistPageBlocks;
                      const shouldRenderCanvasNow =
                        isActivePage ||
                        isVisiblePage ||
                        isWarmupPage ||
                        isPreloadPage ||
                        shouldRenderPageNow;

                      return (
                        <div
                          key={`knexread-page-${pageNumber}`}
                          ref={(node) => setPageNodeRef(pageNumber, node)}
                          data-page-number={pageNumber}
                          className="relative scroll-mt-4"
                        >
                          {showTranslationPageInMain ? (
                            <PdfTranslationPage
                              pageNumber={pageNumber}
                              width={translationPageSize.width}
                              height={translationPageSize.height}
                              status="blank"
                            />
                          ) : (
                            <PdfPageView
                              session={session}
                              pdfFileId={pdfFile?.id}
                              pageNumber={pageNumber}
                              zoom={stageZoom}
                              renderQuality={pageRenderQuality}
                              highlights={highlights}
                              onSelectText={handleSelectedText}
                              onBlocksChange={
                                shouldPersistPageBlocksNow ? handleBlocksChange : undefined
                              }
                              onRendered={handlePageRendered}
                              showTextLayer={shouldAllowTextLayerNow}
                              enableSelection={shouldAllowSelectionNow}
                              priority={isActivePage}
                              isActivePage={isActivePage}
                              isZooming={isZoomGestureActive}
                              isScrolling={isViewportInteracting && !isZoomGestureActive}
                              renderPhase={pageRenderPhase}
                              finalRenderVersion={finalRenderVersion}
                              isWarmupPage={isWarmupPage}
                              renderPriority={pageRenderPriority}
                              shouldRenderCanvas={shouldRenderCanvasNow}
                              onNavigateToPage={(nextPage) => goToPageAndScroll(nextPage)}
                            />
                          )}
                          <p className="mt-1 text-center text-xs text-zinc-600">
                            Página {pageNumber} / {pageCount}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  {translationViewMode === "focus-review" ? (
                    <aside className="w-[360px] shrink-0 rounded border border-zinc-200 bg-white p-3 shadow-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                        Focus Review
                      </p>
                      {focusedTranslationBlock ? (
                        <div className="mt-2 space-y-2 text-xs">
                          <p className="rounded border border-zinc-200 bg-zinc-50 p-2 text-zinc-700">
                            <span className="mb-1 block font-semibold text-zinc-500">Original</span>
                            {focusedTranslationBlock.originalText}
                          </p>
                          <label className="block">
                            <span className="mb-1 block font-semibold text-zinc-500">Translation</span>
                            <textarea
                              defaultValue={focusedTranslationBlock.translatedText}
                              className="h-32 w-full rounded border border-zinc-300 p-2 text-xs"
                              onBlur={(event) => {
                                void handleUpdateTranslationBlock(
                                  focusedTranslationBlock.id,
                                  event.currentTarget.value,
                                );
                              }}
                            />
                          </label>
                          <div className="flex items-center justify-between">
                            <span className="rounded bg-zinc-100 px-2 py-1 text-[11px] text-zinc-600">
                              p.{focusedTranslationBlock.pageNumber}
                            </span>
                            <span
                              className={`rounded px-2 py-1 text-[11px] ${
                                focusedTranslationBlock.status === "overflow"
                                  ? "bg-rose-100 text-rose-700"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {focusedTranslationBlock.status}
                            </span>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-zinc-500">
                          No translated block available on this page.
                        </p>
                      )}
                    </aside>
                  ) : null}
                </>
              )
            ) : (
              <div className="rounded border border-zinc-300 bg-white px-4 py-3 text-sm text-zinc-700">
                {loading ? "Carregando PDF..." : "Selecione um PDF para abrir."}
              </div>
            )}
          </div>
            </PdfReadingFrame>
          </div>
        </div>
        {isFileTab ? (
          <div className="absolute inset-0 z-10">
            <PdfFileBackstage
              sourceName={title}
              currentPdfFileId={pdfFile?.id}
              recentFiles={recentProjectFiles}
              activeSection={fileBackstageSection}
              onSectionChange={setFileBackstageSection}
              onOpenComputer={handleRequestOpenPdf}
              onOpenRecent={(pdfFileId) => {
                void handleOpenRecentPdf(pdfFileId);
              }}
              onCloseReader={canClose ? handleClose : () => {}}
            />
          </div>
        ) : null}
      </div>
      

      {showReaderWorkspace ? (
        <PdfToolbar
          page={page}
          pageCount={pageCount}
          zoom={displayedStageZoom}
          sidebarMode={sidebarMode}
          onGoToPreviousPage={() => goToPageAndScroll(page - 1)}
          onGoToNextPage={() => goToPageAndScroll(page + 1)}
          onGoToPage={(nextPage) => goToPageAndScroll(nextPage)}
          onZoomIn={zoomInStage}
          onZoomOut={zoomOutStage}
          onZoomChange={setManualZoom}
          onSidebarModeChange={setSidebarMode}
          onClose={canClose ? handleClose : () => {}}
          showCloseButton={canClose}
        />
      ) : null}

      <input
        ref={openPdfInputRef}
        type="file"
        accept=".pdf,application/pdf"
        className="hidden"
        onChange={handleHiddenOpenInputChange}
      />

      {(error || statusError || statusNotice) && (
        <div className="border-t border-zinc-200 px-3 py-2 text-xs">
          {error || statusError ? <p className="text-rose-700">{statusError || error}</p> : null}
          {statusNotice ? <p className="text-emerald-700">{statusNotice}</p> : null}
        </div>
      )}
      {showReaderWorkspace && enableOcrLayer ? (
        <div className="border-t border-zinc-200 px-3 py-1 text-[11px] text-zinc-600">
          OCR layer enabled in isolated mode (no overwrite on original canvas).
        </div>
      ) : null}

    </section>
  );

  if (isPagePresentation) {
    return <div className="flex h-full min-h-0 flex-1 overflow-hidden">{readerSurface}</div>;
  }

  return (
    <div className="fixed inset-0 z-[5000] bg-zinc-950/55">
      <div className="absolute inset-0" onClick={handleClose} />
      <div className="relative z-[5001] m-6 flex h-[calc(100%-3rem)] min-h-0 flex-col overflow-hidden">
        {readerSurface}
      </div>
    </div>
  );
}

export function PdfReaderShell(props: KnexreadShellProps) {
  return (
    <KnexPdfEngineProvider>
      <PdfReaderShellContent {...props} />
    </KnexPdfEngineProvider>
  );
}

export const KnexreadShell = PdfReaderShell;
