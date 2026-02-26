"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import FileUploader from "./FileUploader";
import Toolbar from "./Toolbar";
import DualPaneViewer from "./DualPaneViewer";
import CitationActions from "./CitationActions";
import ReaderFooterBar from "./ReaderFooterBar";
import { useDocumentLoader } from "../hooks/useDocumentLoader";
import { useReaderState } from "../hooks/useReaderState";
import { useTranslation } from "../hooks/useTranslation";
import { useSelectionMapping } from "../hooks/useSelectionMapping";
import type { PageMapping, ReaderFitMode, SelectionMapping, TranslationPair } from "../lib/types";
import { clamp, makeCacheKey } from "../lib/utils";

type RailItem = {
  icon: string;
  label: string;
};

const RAIL_ITEMS: RailItem[] = [
  { icon: "S", label: "Selecionar" },
  { icon: "N", label: "Anotar" },
  { icon: "M", label: "Marcador" },
  { icon: "P", label: "Plugins" },
  { icon: "F", label: "Fixar" },
  { icon: "B", label: "Buscar" },
  { icon: "I", label: "Imprimir" },
  { icon: "C", label: "Configuracoes" },
];

const RULER_MINOR_STEP = 10;
const RULER_MAJOR_STEP = 100;
const RULER_MID_STEP = RULER_MAJOR_STEP / 2;
const ZOOM_MIN = 40;
const ZOOM_MAX = 240;
const ZOOM_DECIMAL_FACTOR = 10;
const ZOOM_WHEEL_MULTIPLIER = 0.005;
const ZOOM_WHEEL_MAX_STEP = 0.6;
const ZOOM_WHEEL_MIN_STEP = 0.05;

type RulerTick = {
  value: number;
  offset: number;
  level: "major" | "mid" | "minor";
};

export default function ReaderShell() {
  const {
    document,
    pageNumber,
    pageCount,
    sourceLanguage,
    targetLanguage,
    selected,
    translationCache,
    setDocument,
    setPageNumber,
    setPageCount,
    setSourceLanguage,
    setTargetLanguage,
    setSelected,
    addRecentDocument,
    clearForNewDocument,
  } = useReaderState();

  const { loadPdfFile, getPageMapping, renderPage, loading: documentLoading, error: documentError, hasTextLayer } =
    useDocumentLoader();

  const [pageMappingsByNumber, setPageMappingsByNumber] = useState<Record<number, PageMapping>>({});
  const [loadingPages, setLoadingPages] = useState<Record<number, boolean>>({});
  const [pageErrorsByNumber, setPageErrorsByNumber] = useState<Record<number, string | null>>({});
  const [pageJumpTarget, setPageJumpTarget] = useState<number | null>(null);
  const [pageJumpToken, setPageJumpToken] = useState(0);
  const [zoomPercent, setZoomPercent] = useState(100);
  const [fitMode, setFitMode] = useState<ReaderFitMode>("fit-pane");
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [docZoomArmed, setDocZoomArmed] = useState(false);

  const documentScrollRef = useRef<HTMLDivElement | null>(null);
  const rulerRafRef = useRef<number | null>(null);
  const loadingSetRef = useRef<Set<number>>(new Set());
  const [rulerScrollLeft, setRulerScrollLeft] = useState(0);
  const [rulerScrollTop, setRulerScrollTop] = useState(0);
  const [rulerViewport, setRulerViewport] = useState({ width: 0, height: 0 });

  const loadPage = useCallback(
    async (targetPage: number) => {
      if (!document) return;
      if (targetPage < 1 || targetPage > Math.max(1, pageCount)) return;
      if (pageMappingsByNumber[targetPage]) return;
      if (loadingSetRef.current.has(targetPage)) return;

      loadingSetRef.current.add(targetPage);
      setLoadingPages((prev) => ({
        ...prev,
        [targetPage]: true,
      }));
      setPageErrorsByNumber((prev) => ({
        ...prev,
        [targetPage]: null,
      }));

      try {
        const mapping = await getPageMapping(targetPage);
        setPageMappingsByNumber((prev) => (prev[targetPage] ? prev : { ...prev, [targetPage]: mapping }));
        if (!mapping.blocks.length) {
          setPageErrorsByNumber((prev) => ({
            ...prev,
            [targetPage]: "Esta pagina nao possui camada textual detectavel para traducao.",
          }));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao extrair texto da pagina.";
        if (message.includes("Nenhum documento PDF ativo")) {
          return;
        }
        setPageErrorsByNumber((prev) => ({
          ...prev,
          [targetPage]: message,
        }));
      } finally {
        loadingSetRef.current.delete(targetPage);
        setLoadingPages((prev) => ({
          ...prev,
          [targetPage]: false,
        }));
      }
    },
    [document, getPageMapping, pageCount, pageMappingsByNumber],
  );

  const requestPageJump = useCallback(
    (targetPage: number) => {
      const nextPage = clamp(Math.round(targetPage || 1), 1, Math.max(1, pageCount));
      setPageNumber(nextPage);
      setPageJumpTarget(nextPage);
      setPageJumpToken((prev) => prev + 1);
      void loadPage(nextPage);
    },
    [loadPage, pageCount, setPageNumber],
  );

  const normalizeZoom = useCallback((value: number) => {
    return clamp(Math.round(value * ZOOM_DECIMAL_FACTOR) / ZOOM_DECIMAL_FACTOR, ZOOM_MIN, ZOOM_MAX);
  }, []);

  const handleZoomChange = useCallback(
    (value: number) => {
      setZoomPercent(normalizeZoom(value));
    },
    [normalizeZoom],
  );

  const adjustZoomBy = useCallback(
    (delta: number) => {
      setZoomPercent((prev) => normalizeZoom(prev + delta));
    },
    [normalizeZoom],
  );

  const resolveInitialFitZoom = useCallback((pageWidth: number, pageHeight: number) => {
    const node = documentScrollRef.current;
    if (!node || pageWidth <= 0 || pageHeight <= 0) return 100;

    const availableWidth = Math.max(220, node.clientWidth - 20);
    const availableHeight = Math.max(220, node.clientHeight - 20);
    const fitScaleByWidth = availableWidth / pageWidth;
    const fitScaleByHeight = availableHeight / pageHeight;
    if (!Number.isFinite(fitScaleByWidth) || !Number.isFinite(fitScaleByHeight)) return 100;
    if (fitScaleByWidth <= 0 || fitScaleByHeight <= 0) return 100;

    const fitZoomFactor = Math.min(1, fitScaleByHeight / fitScaleByWidth);
    return clamp(Math.round(fitZoomFactor * 100), ZOOM_MIN, 100);
  }, []);

  const handleFileSelected = useCallback(
    async (file: File) => {
      try {
        const loaded = await loadPdfFile(file);
        const firstPageWarning = loaded.firstPageMapping.blocks.length
          ? null
          : "Esta pagina nao possui camada textual detectavel para traducao.";

        addRecentDocument({
          descriptor: loaded.descriptor,
          sizeBytes: file.size,
          lastModified: file.lastModified || null,
          sourceLabel: "Arquivo local",
        });

        setDocument(loaded.descriptor);
        clearForNewDocument();
        setPageCount(loaded.descriptor.pageCount);
        setPageNumber(1);
        setPageMappingsByNumber({ 1: loaded.firstPageMapping });
        setLoadingPages({});
        setPageErrorsByNumber(firstPageWarning ? { 1: firstPageWarning } : {});
        setPageJumpTarget(1);
        setPageJumpToken((prev) => prev + 1);
        setDocZoomArmed(false);
        handleZoomChange(resolveInitialFitZoom(loaded.firstPageMapping.page.width, loaded.firstPageMapping.page.height));
        setFitMode("fit-pane");
        loadingSetRef.current.clear();
      } catch {
        setPageMappingsByNumber({});
        setLoadingPages({});
        setPageErrorsByNumber({});
      }
    },
    [
      addRecentDocument,
      clearForNewDocument,
      handleZoomChange,
      loadPdfFile,
      resolveInitialFitZoom,
      setDocument,
      setPageCount,
      setPageNumber,
    ],
  );

  useEffect(() => {
    if (!document) return;
    void loadPage(pageNumber);
    void loadPage(pageNumber - 1);
    void loadPage(pageNumber + 1);
  }, [document, loadPage, pageNumber]);

  const activePageMapping = pageMappingsByNumber[pageNumber] ?? null;
  const activePageError = pageErrorsByNumber[pageNumber] ?? null;

  const translation = useTranslation({
    documentHash: document?.hash ?? null,
    pageMapping: activePageMapping,
    sourceLanguage,
    targetLanguage,
  });

  const translationsByPage = useMemo<Record<number, TranslationPair[]>>(() => {
    const byPage: Record<number, TranslationPair[]> = {};
    if (!document) return byPage;

    for (let page = 1; page <= Math.max(1, pageCount); page += 1) {
      const cacheKey = makeCacheKey([document.hash, page, targetLanguage]);
      const pairs = translationCache[cacheKey];
      if (pairs?.length) {
        byPage[page] = pairs;
      }
    }

    if (translation.cacheKey && translation.pairs.length) {
      byPage[pageNumber] = translation.pairs;
    }

    return byPage;
  }, [document, pageCount, pageNumber, targetLanguage, translation.cacheKey, translation.pairs, translationCache]);

  const selectedPageNumber = selected?.pageNumber ?? pageNumber;
  const selectedPageMapping = pageMappingsByNumber[selectedPageNumber] ?? null;
  const selectedPagePairs = translationsByPage[selectedPageNumber] ?? [];

  const selection = useSelectionMapping({
    pageNumber: selectedPageNumber,
    sourceLanguage,
    targetLanguage,
    selected,
    blocks: selectedPageMapping?.blocks ?? [],
    translationPairs: selectedPagePairs,
    onSelect: setSelected,
  });

  const handleSelectBlock = useCallback(
    (blockId: string, side: SelectionMapping["side"], blockPageNumber: number) => {
      selection.selectBlock(blockId, side, blockPageNumber);
      setPageNumber(blockPageNumber);
      void loadPage(blockPageNumber);
    },
    [loadPage, selection, setPageNumber],
  );

  const handleVisiblePageChange = useCallback(
    (visiblePageNumber: number) => {
      if (visiblePageNumber !== pageNumber) {
        setPageNumber(visiblePageNumber);
      }
    },
    [pageNumber, setPageNumber],
  );

  const syncRulersFromViewport = useCallback((node: HTMLDivElement) => {
    setRulerScrollLeft(node.scrollLeft);
    setRulerScrollTop(node.scrollTop);
    setRulerViewport({
      width: node.clientWidth,
      height: node.clientHeight,
    });
  }, []);

  useEffect(() => {
    const node = documentScrollRef.current;
    if (!node) return;

    syncRulersFromViewport(node);

    if (typeof ResizeObserver === "undefined") {
      const onResize = () => syncRulersFromViewport(node);
      window.addEventListener("resize", onResize);
      return () => window.removeEventListener("resize", onResize);
    }

    const observer = new ResizeObserver(() => syncRulersFromViewport(node));
    observer.observe(node);

    return () => observer.disconnect();
  }, [syncRulersFromViewport]);

  useEffect(() => {
    return () => {
      if (rulerRafRef.current !== null) {
        cancelAnimationFrame(rulerRafRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      const node = documentScrollRef.current;
      if (!node) return;
      if (!node.contains(event.target as Node)) {
        setDocZoomArmed(false);
      }
    };

    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const handleDocumentScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const node = event.currentTarget;
    if (rulerRafRef.current !== null) {
      cancelAnimationFrame(rulerRafRef.current);
    }
    rulerRafRef.current = requestAnimationFrame(() => {
      setRulerScrollLeft(node.scrollLeft);
      setRulerScrollTop(node.scrollTop);
      rulerRafRef.current = null;
    });
  }, []);

  const handleDocumentWheel = useCallback(
    (event: React.WheelEvent<HTMLDivElement>) => {
      const isCtrlZoomGesture = event.ctrlKey || event.metaKey;
      if (!isCtrlZoomGesture || !docZoomArmed) return;

      event.preventDefault();
      event.stopPropagation();

      const normalizedDelta =
        event.deltaMode === 1
          ? event.deltaY * 16
          : event.deltaMode === 2
            ? event.deltaY * 120
            : event.deltaY;
      const wheelStep = clamp(-normalizedDelta * ZOOM_WHEEL_MULTIPLIER, -ZOOM_WHEEL_MAX_STEP, ZOOM_WHEEL_MAX_STEP);
      if (Math.abs(wheelStep) < ZOOM_WHEEL_MIN_STEP) return;
      adjustZoomBy(wheelStep);
    },
    [adjustZoomBy, docZoomArmed],
  );

  const pagesForViewer = useMemo(() => {
    if (!document) return [];
    return Array.from({ length: Math.max(1, pageCount) }, (_, index) => {
      const currentPage = index + 1;
      const mapping = pageMappingsByNumber[currentPage];
      return {
        pageNumber: currentPage,
        blocks: mapping?.blocks ?? [],
        translations: translationsByPage[currentPage] ?? [],
        hasMapping: Boolean(mapping),
        loading: Boolean(loadingPages[currentPage]),
        error: pageErrorsByNumber[currentPage] ?? null,
      };
    });
  }, [document, loadingPages, pageCount, pageErrorsByNumber, pageMappingsByNumber, translationsByPage]);

  const hasAnyMappedPage = useMemo(() => Object.keys(pageMappingsByNumber).length > 0, [pageMappingsByNumber]);

  const topRulerTicks = useMemo(() => {
    const viewportWidth = rulerViewport.width;
    if (viewportWidth <= 0) return [] as RulerTick[];
    const start = Math.max(0, Math.floor(rulerScrollLeft / RULER_MINOR_STEP) * RULER_MINOR_STEP - RULER_MAJOR_STEP);
    const end = rulerScrollLeft + viewportWidth + RULER_MAJOR_STEP;
    const ticks: RulerTick[] = [];
    for (let value = start; value <= end; value += RULER_MINOR_STEP) {
      const major = value % RULER_MAJOR_STEP === 0;
      const mid = !major && value % RULER_MID_STEP === 0;
      ticks.push({
        value,
        offset: value - rulerScrollLeft,
        level: major ? "major" : mid ? "mid" : "minor",
      });
    }
    return ticks;
  }, [rulerScrollLeft, rulerViewport.width]);

  const leftRulerTicks = useMemo(() => {
    const viewportHeight = rulerViewport.height;
    if (viewportHeight <= 0) return [] as RulerTick[];
    const start = Math.max(0, Math.floor(rulerScrollTop / RULER_MINOR_STEP) * RULER_MINOR_STEP - RULER_MAJOR_STEP);
    const end = rulerScrollTop + viewportHeight + RULER_MAJOR_STEP;
    const ticks: RulerTick[] = [];
    for (let value = start; value <= end; value += RULER_MINOR_STEP) {
      const major = value % RULER_MAJOR_STEP === 0;
      const mid = !major && value % RULER_MID_STEP === 0;
      ticks.push({
        value,
        offset: value - rulerScrollTop,
        level: major ? "major" : mid ? "mid" : "minor",
      });
    }
    return ticks;
  }, [rulerScrollTop, rulerViewport.height]);

  return (
    <div className="reader-shell">
      <div className="reader-hidden-uploader" aria-hidden="true">
        <FileUploader loading={documentLoading} error={documentError} hasTextLayer={hasTextLayer} onSelectFile={handleFileSelected} />
      </div>

      <div className={`reader-shell-layout ${leftCollapsed ? "left-collapsed" : ""}`}>
        <aside className={`reader-left-sidebar ${leftCollapsed ? "collapsed" : ""}`} aria-label="Painel lateral">
          <div className="reader-left-sidebar-head">
            <button type="button" className="reader-left-tab active">
              Iniciar
            </button>
            {document ? (
              <button type="button" className="reader-left-tab" title={document.name}>
                {document.name}
              </button>
            ) : null}
          </div>

          <div className="reader-left-sidebar-body">
            <div className="reader-left-icon-rail">
              {RAIL_ITEMS.map((item, index) => (
                <button key={`rail-${index}`} type="button" className="reader-rail-btn" title={item.label}>
                  {item.icon}
                </button>
              ))}
            </div>

            <div className="reader-left-panel-content">
              <h3 className="reader-left-panel-title">Marcadores</h3>
              <input className="reader-left-search" placeholder="Pesquisar..." aria-label="Pesquisar marcadores" />
            </div>
          </div>

          <button
            type="button"
            className="reader-left-collapse-handle"
            aria-label={leftCollapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
            title={leftCollapsed ? "Expandir barra lateral" : "Colapsar barra lateral"}
            onClick={() => setLeftCollapsed((prev) => !prev)}
          >
            <span className="reader-left-collapse-arrow">{leftCollapsed ? ">" : "<"}</span>
          </button>
        </aside>

        <section className="reader-center-stage">
          <Toolbar
            sourceLanguage={sourceLanguage}
            targetLanguage={targetLanguage}
            fitMode={fitMode}
            translating={translation.loading}
            translateError={translation.error}
            onSourceLanguageChange={setSourceLanguage}
            onTargetLanguageChange={setTargetLanguage}
            onFitModeChange={setFitMode}
          />

          <div className="reader-workspace">
            {!document ? (
              <>{documentError ? <div className="reader-warning">{documentError}</div> : null}</>
            ) : (
              <>
                {activePageError ? <div className="reader-warning">{activePageError}</div> : null}

                <section className="reader-doc-viewport" aria-label="Viewport de visualizacao">
                  <div className="reader-ruler-corner" />
                  <div className="reader-ruler-top" aria-hidden="true">
                    {topRulerTicks.map((tick) => (
                      <span
                        key={`top-tick-${tick.value}`}
                        className={`reader-ruler-tick top ${tick.level}`}
                        style={{ left: `${tick.offset}px` }}
                      />
                    ))}
                    {topRulerTicks
                      .filter((tick) => tick.level === "major")
                      .map((tick) => (
                        <span key={`top-label-${tick.value}`} className="reader-ruler-label top" style={{ left: `${tick.offset + 2}px` }}>
                          {Math.round(tick.value / RULER_MAJOR_STEP)}
                        </span>
                      ))}
                  </div>
                  <div className="reader-ruler-left" aria-hidden="true">
                    {leftRulerTicks.map((tick) => (
                      <span
                        key={`left-tick-${tick.value}`}
                        className={`reader-ruler-tick left ${tick.level}`}
                        style={{ top: `${tick.offset}px` }}
                      />
                    ))}
                    {leftRulerTicks
                      .filter((tick) => tick.level === "major")
                      .map((tick) => (
                        <span key={`left-label-${tick.value}`} className="reader-ruler-label left" style={{ top: `${tick.offset + 6}px` }}>
                          {Math.round(tick.value / RULER_MAJOR_STEP)}
                        </span>
                      ))}
                  </div>
                  <div
                    ref={documentScrollRef}
                    className="reader-doc-scroll"
                    tabIndex={0}
                    onMouseDown={(event) => {
                      setDocZoomArmed(true);
                      event.currentTarget.focus();
                    }}
                    onBlur={() => setDocZoomArmed(false)}
                    onScroll={handleDocumentScroll}
                    onWheel={handleDocumentWheel}
                  >
                    {!hasAnyMappedPage ? null : (
                      <DualPaneViewer
                        pageNumber={pageNumber}
                        pageCount={pageCount}
                        pages={pagesForViewer}
                        selectedBlockId={selection.selectedBlock?.id ?? null}
                        selectedPageNumber={selected?.pageNumber ?? null}
                        translating={translation.loading}
                        zoomPercent={zoomPercent}
                        fitMode={fitMode}
                        pageJumpToken={pageJumpToken}
                        pageJumpTarget={pageJumpTarget}
                        scrollRootRef={documentScrollRef}
                        renderPage={renderPage}
                        onSelectBlock={handleSelectBlock}
                        onRequestPage={loadPage}
                        onVisiblePageChange={handleVisiblePageChange}
                      />
                    )}
                  </div>
                </section>
              </>
            )}
          </div>
        </section>

        <aside className="reader-right-aside">
          <CitationActions citationDirect={selection.citationDirect} citationIndirect={selection.citationIndirect} />
        </aside>
      </div>

      <ReaderFooterBar
        pageNumber={pageNumber}
        pageCount={pageCount}
        zoomPercent={zoomPercent}
        onPageChange={requestPageJump}
        onZoomChange={handleZoomChange}
      />
    </div>
  );
}
