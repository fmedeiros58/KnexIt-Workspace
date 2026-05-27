"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { capturePdfSelectionFromRange } from "../hooks";
import type {
  PdfHighlightRecord,
  PdfRenderQualityMode,
  PdfTextSelection,
} from "../types";
import type { NativePdfSession } from "../services";
import {
  extractKnexPdfPageLinks,
  extractKnexPdfPageLinksWithBackend,
  extractKnexPdfTextBlocks,
  extractKnexPdfTextBlocksWithBackend,
  getKnexPdfDocumentHandleWithBackend,
  type KnexPdfRenderPhase,
  type KnexPdfPageLinkAnnotation as PdfPageLinkAnnotation,
  type KnexPdfRenderedPage as RenderedPdfPage,
  type KnexPdfTextBlock as PdfTextBlock,
  useKnexPdfEngine,
  useKnexPdfEngineState,
} from "../knex-pdf-engine";
import { PdfAnnotationLayer } from "./PdfAnnotationLayer";
import { PdfPageCanvas } from "./PdfPageCanvas";
import { PdfTextLayer } from "./PdfTextLayer";

type PdfPageBaseSize = {
  width: number;
  height: number;
};

const FALLBACK_PAGE_WIDTH_PT = 612;
const FALLBACK_PAGE_HEIGHT_PT = 792;
const MIN_LAYOUT_SCALE = 0.01;
const MAX_LAYOUT_SCALE = 40;

function safeNumber(
  value: number | null | undefined,
  fallback = 0,
): number {
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

function getLayoutScaleFromZoom(zoom: number): number {
  return clamp(safeNumber(zoom, 100) / 100, MIN_LAYOUT_SCALE, MAX_LAYOUT_SCALE);
}

function getFallbackPageSize(): PdfPageBaseSize {
  return {
    width: FALLBACK_PAGE_WIDTH_PT,
    height: FALLBACK_PAGE_HEIGHT_PT,
  };
}

function getPageSizeFromRenderedPage(
  renderedPage: RenderedPdfPage | null,
): PdfPageBaseSize | null {
  if (!renderedPage) return null;

  const renderScale = Math.max(0.01, safeNumber(renderedPage.renderScale, 1));

  const width =
    safeNumber(renderedPage.pageWidthPt, 0) > 0
      ? renderedPage.pageWidthPt
      : safeNumber(renderedPage.width, FALLBACK_PAGE_WIDTH_PT) / renderScale;

  const height =
    safeNumber(renderedPage.pageHeightPt, 0) > 0
      ? renderedPage.pageHeightPt
      : safeNumber(renderedPage.height, FALLBACK_PAGE_HEIGHT_PT) / renderScale;

  return {
    width: Math.max(1, width),
    height: Math.max(1, height),
  };
}

/**
 * PdfPageView
 * ------------------------------------------------------------
 * Moldura geométrica estável de uma página PDF.
 *
 * Regras principais:
 * 1. O layout da página NÃO depende do bitmap físico do canvas.
 * 2. A página reserva width/height imediatamente com base no zoom lógico.
 * 3. Não usar CSS transform: scale() no wrapper da página.
 * 4. O canvas é renderizado dentro da caixa estável.
 * 5. TextLayer, AnnotationLayer e Canvas compartilham a mesma geometria CSS.
 * 6. Extrações antigas de texto/link não podem sobrescrever extrações novas.
 * 7. Durante gesto de zoom, somente páginas autorizadas pelo Shell renderizam.
 * 8. Durante gesto de zoom, TextLayer, seleção e extração semântica ficam pausadas.
 */
export function PdfPageView({
  session,
  pageNumber,
  zoom,
  highlights,
  onSelectText,
  onBlocksChange,
  onRendered,
  showTextLayer = true,
  enableSelection = true,
  renderQuality = "extreme",
  priority = false,
  onNavigateToPage,
  isActivePage = false,
  isZooming = false,
  isScrolling = false,
  shouldRenderCanvas = true,
  renderPhase = "settled-final",
  finalRenderVersion = 0,
  isWarmupPage = false,
  renderPriority,
}: {
  session: NativePdfSession;
  pageNumber: number;
  zoom: number;
  highlights: PdfHighlightRecord[];
  onSelectText: (
    selection: PdfTextSelection,
    position: { top: number; left: number },
  ) => void;
  onBlocksChange?: (
    pageNumber: number,
    blocks: PdfTextBlock[],
    renderScale: number,
  ) => void;
  onRendered?: (page: RenderedPdfPage) => void;
  showTextLayer?: boolean;
  enableSelection?: boolean;
  renderQuality?: PdfRenderQualityMode;
  priority?: boolean;
  onNavigateToPage?: (pageNumber: number) => void;

  /**
   * Props enviados pelo PdfReaderShell para tornar o zoom mais fluido.
   */
  isActivePage?: boolean;
  isZooming?: boolean;
  isScrolling?: boolean;
  shouldRenderCanvas?: boolean;
  renderPhase?: KnexPdfRenderPhase;
  finalRenderVersion?: number;
  isWarmupPage?: boolean;
  renderPriority?: number;
}) {
  const engine = useKnexPdfEngine();
  const engineState = useKnexPdfEngineState();
  const rootRef = useRef<HTMLDivElement | null>(null);
  const textExtractionTicketRef = useRef(0);
  const linkExtractionTicketRef = useRef(0);

  const [renderedPage, setRenderedPage] = useState<RenderedPdfPage | null>(null);
  const [blocks, setBlocks] = useState<PdfTextBlock[]>([]);
  const [links, setLinks] = useState<PdfPageLinkAnnotation[]>([]);
  const [isNearViewport, setIsNearViewport] = useState(priority);
  const [pageSize, setPageSize] = useState<PdfPageBaseSize | null>(null);

  const layoutScale = useMemo(
    () => getLayoutScaleFromZoom(zoom),
    [zoom],
  );

  /**
   * A geometria base da página vem, em ordem de preferência:
   * 1. getViewport({ scale: 1 }) do PDF.js;
   * 2. metadados retornados pelo render;
   * 3. fallback letter.
   */
  const basePageSize = useMemo<PdfPageBaseSize>(() => {
    const renderedSize = getPageSizeFromRenderedPage(renderedPage);
    return pageSize ?? renderedSize ?? getFallbackPageSize();
  }, [pageSize, renderedPage]);

  const pageCssWidth = useMemo(
    () => Math.max(1, Math.ceil(basePageSize.width * layoutScale)),
    [basePageSize.width, layoutScale],
  );

  const pageCssHeight = useMemo(
    () => Math.max(1, Math.ceil(basePageSize.height * layoutScale)),
    [basePageSize.height, layoutScale],
  );

  /**
   * Durante zoom, o Shell decide quem pode renderizar.
   * Fora do zoom, páginas próximas podem renderizar normalmente.
   */
  const canRenderCanvas =
    shouldRenderCanvas && (isActivePage || isNearViewport || priority);

  /**
   * A geometria real da página também deve ser carregada de forma preguiçosa.
   * Se carregarmos getPage() para todas as páginas de uma vez, PDFs grandes
   * travam a interface inteira.
   */
  const shouldLoadPageGeometry = isActivePage || isNearViewport || priority;

  /**
   * Durante zoom, pausamos a camada semântica para evitar custo de:
   * - extração de texto;
   * - reconstrução de blocos;
   * - extração de links;
   * - seleção DOM;
   * - persistência de blocos.
   */
  const semanticLayersEnabled =
    renderPhase === "settled-final" && !isZooming && !isScrolling;

  const effectiveShowTextLayer =
    semanticLayersEnabled && (showTextLayer || enableSelection);

  const shouldExtractText =
    semanticLayersEnabled &&
    canRenderCanvas &&
    isNearViewport &&
    (effectiveShowTextLayer || Boolean(onBlocksChange));

  const shouldExtractLinks =
    semanticLayersEnabled &&
    canRenderCanvas &&
    isNearViewport;

  const nearViewportRootMargin = useMemo(() => {
    if (engineState.activeBackend === "pdfjs") {
      return isZooming ? "300px 0px" : "1600px 0px";
    }

    return renderPhase === "interactive-preview" || isZooming || isScrolling
      ? "800px 0px 800px 0px"
      : "800px 0px 800px 0px";
  }, [engineState.activeBackend, isScrolling, isZooming, renderPhase]);

  /**
   * Carrega o tamanho lógico da página sob demanda.
   *
   * Importante:
   * Não carregar getPage() para todas as páginas ao mesmo tempo.
   * Isso foi a provável causa do travamento geral.
   *
   * A página usa fallback estável enquanto ainda não está ativa/próxima.
   */
  useEffect(() => {
    if (!shouldLoadPageGeometry) return;

    let cancelled = false;

    session.pdf
      .getPage(pageNumber)
      .then((pdfPage) => {
        if (cancelled) return;

        const viewport = pdfPage.getViewport({ scale: 1 });

        setPageSize({
          width: Math.max(1, viewport.width),
          height: Math.max(1, viewport.height),
        });
      })
      .catch(() => {
        if (!cancelled) {
          setPageSize((current) => current ?? getFallbackPageSize());
        }
      });

    return () => {
      cancelled = true;
    };
  }, [pageNumber, session, shouldLoadPageGeometry]);

  useEffect(() => {
    if (priority || isActivePage) {
      setIsNearViewport(true);
      return;
    }

    const root = rootRef.current;

    if (!root || typeof IntersectionObserver === "undefined") {
      setIsNearViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsNearViewport(Boolean(entry?.isIntersecting));
      },
      {
        root: null,
        rootMargin: nearViewportRootMargin,
        threshold: 0.01,
      },
    );

    observer.observe(root);

    return () => {
      observer.disconnect();
    };
  }, [isActivePage, nearViewportRootMargin, priority]);

  useEffect(() => {
    if (!shouldExtractText) {
      if (renderPhase === "settled-final" && !isZooming && !isScrolling) {
        setBlocks([]);
      }
      return;
    }

    let cancelled = false;
    const ticket = textExtractionTicketRef.current + 1;
    textExtractionTicketRef.current = ticket;

    const scale = layoutScale;

    const extractText = async () => {
      if (engineState.activeBackend === "pdfjs") {
        return extractKnexPdfTextBlocks({
          session,
          pageNumber,
          scale,
        });
      }

      const backend = engine.getBackend();

      try {
        const document = await getKnexPdfDocumentHandleWithBackend({
          backend,
          session,
        });

        return await extractKnexPdfTextBlocksWithBackend({
          backend,
          document,
          pageNumber,
          scale,
        });
      } catch (backendError) {
        const reason =
          backendError instanceof Error
            ? backendError.message
            : "Backend text extraction failed.";

        engine.reportBackendError({
          backend: engineState.activeBackend,
          reason,
          error: backendError,
        });

        return extractKnexPdfTextBlocks({
          session,
          pageNumber,
          scale,
        });
      }
    };

    extractText()
      .then((nextBlocks) => {
        if (cancelled || ticket !== textExtractionTicketRef.current) return;

        setBlocks(nextBlocks);
        onBlocksChange?.(pageNumber, nextBlocks, scale);
      })
      .catch(() => {
        if (cancelled || ticket !== textExtractionTicketRef.current) return;

        setBlocks([]);
        onBlocksChange?.(pageNumber, [], scale);
      });

    return () => {
      cancelled = true;
    };
  }, [
    engine,
    engineState.activeBackend,
    engineState.backendVersion,
    engineState.preferredBackend,
    isScrolling,
    isZooming,
    layoutScale,
    onBlocksChange,
    pageNumber,
    renderPhase,
    session,
    shouldExtractText,
  ]);

  useEffect(() => {
    if (!shouldExtractLinks) {
      if (renderPhase === "settled-final" && !isZooming && !isScrolling) {
        setLinks([]);
      }
      return;
    }

    let cancelled = false;
    const ticket = linkExtractionTicketRef.current + 1;
    linkExtractionTicketRef.current = ticket;

    const scale = layoutScale;

    const extractLinks = async () => {
      if (engineState.activeBackend === "pdfjs") {
        return extractKnexPdfPageLinks({
          session,
          pageNumber,
          scale,
        });
      }

      const backend = engine.getBackend();

      try {
        const document = await getKnexPdfDocumentHandleWithBackend({
          backend,
          session,
        });

        return await extractKnexPdfPageLinksWithBackend({
          backend,
          document,
          pageNumber,
          scale,
        });
      } catch (backendError) {
        const reason =
          backendError instanceof Error
            ? backendError.message
            : "Backend annotation extraction failed.";

        engine.reportBackendError({
          backend: engineState.activeBackend,
          reason,
          error: backendError,
        });

        return extractKnexPdfPageLinks({
          session,
          pageNumber,
          scale,
        });
      }
    };

    extractLinks()
      .then((nextLinks) => {
        if (cancelled || ticket !== linkExtractionTicketRef.current) return;
        setLinks(nextLinks);
      })
      .catch(() => {
        if (cancelled || ticket !== linkExtractionTicketRef.current) return;
        setLinks([]);
      });

    return () => {
      cancelled = true;
    };
  }, [
    engine,
    engineState.activeBackend,
    engineState.backendVersion,
    engineState.preferredBackend,
    isScrolling,
    isZooming,
    layoutScale,
    pageNumber,
    renderPhase,
    session,
    shouldExtractLinks,
  ]);

  const handleRendered = useCallback(
    (page: RenderedPdfPage) => {
      setRenderedPage(page);
      onRendered?.(page);
    },
    [onRendered],
  );

  const highlightBlockIds = useMemo(() => {
    if (!highlights.length || !blocks.length || isZooming) return undefined;

    const ids = new Set<string>();

    for (const highlight of highlights) {
      if (highlight.pageNumber !== pageNumber) continue;

      const normalizedText = highlight.normalizedText?.toLowerCase();
      if (!normalizedText) continue;

      for (const block of blocks) {
        if (block.text.toLowerCase().includes(normalizedText)) {
          ids.add(block.id);
        }
      }
    }

    return ids;
  }, [blocks, highlights, isZooming, pageNumber]);

  const handleMouseUp = useCallback(() => {
    if (!enableSelection || isZooming || renderPhase !== "settled-final") return;

    const root = rootRef.current;
    const selection = window.getSelection();

    if (
      !root ||
      !selection ||
      selection.isCollapsed ||
      selection.rangeCount === 0
    ) {
      return;
    }

    const range = selection.getRangeAt(0);

    if (!root.contains(range.commonAncestorContainer)) {
      return;
    }

    const capturedSelection = capturePdfSelectionFromRange({
      pageNumber,
      pageBlocks: blocks,
      range,
      pageElement: root,
    });

    if (!capturedSelection) return;

    const rects = range.getClientRects();
    const lastRect =
      rects.item(rects.length - 1) ?? range.getBoundingClientRect();

    const position = {
      top: lastRect.bottom + window.scrollY + 8,
      left: lastRect.left + window.scrollX,
    };

    onSelectText(capturedSelection, position);
  }, [blocks, enableSelection, isZooming, onSelectText, pageNumber, renderPhase]);

  const handleLinkClick = useCallback(
    async (link: PdfPageLinkAnnotation) => {
      if (isZooming || renderPhase !== "settled-final") return;

      if (link.url) {
        window.open(link.url, "_blank", "noopener,noreferrer");
        return;
      }

      if (!link.dest || !onNavigateToPage) return;

      try {
        if (typeof session.pdf.getDestination !== "function") return;
        if (typeof session.pdf.getPageIndex !== "function") return;

        const destination = Array.isArray(link.dest)
          ? link.dest
          : await session.pdf.getDestination(String(link.dest));

        const reference = destination?.[0];

        if (!reference) return;

        const pageIndex = await session.pdf.getPageIndex(reference);

        onNavigateToPage(pageIndex + 1);
      } catch {
        /**
         * Destinos inválidos do PDF são ignorados.
         * A anotação permanece visível.
         */
      }
    },
    [isZooming, onNavigateToPage, renderPhase, session],
  );

  return (
    <div
      ref={rootRef}
      className="relative block shrink-0"
      onMouseUp={handleMouseUp}
      data-knexread-page-number={pageNumber}
      data-knexread-page-active={isActivePage ? "true" : "false"}
      data-knexread-page-visible={isNearViewport ? "true" : "false"}
      data-knexread-page-warmup={isWarmupPage ? "true" : "false"}
      data-knexread-page-zooming={isZooming ? "true" : "false"}
      data-knexread-page-scrolling={isScrolling ? "true" : "false"}
      data-knexread-page-render-phase={renderPhase}
      data-knexread-page-render-priority={renderPriority ?? ""}
      style={{
        width: `${pageCssWidth}px`,
        height: `${pageCssHeight}px`,
        minWidth: `${pageCssWidth}px`,
        minHeight: `${pageCssHeight}px`,
        maxWidth: `${pageCssWidth}px`,
      }}
    >
      <div
        className="absolute inset-0 z-0"
        data-knexread-page-visual-layer="true"
        style={{
          width: `${pageCssWidth}px`,
          height: `${pageCssHeight}px`,
        }}
      >
        {canRenderCanvas ? (
          <PdfPageCanvas
            session={session}
            pageNumber={pageNumber}
            zoom={zoom}
            renderQuality={renderQuality}
            onRendered={handleRendered}
            isZooming={isZooming}
            isScrolling={isScrolling}
            renderPhase={renderPhase}
            finalRenderVersion={finalRenderVersion}
            isActivePage={isActivePage}
            isPageVisible={isActivePage || isNearViewport}
            isWarmupPage={isWarmupPage}
            renderPriority={renderPriority}
          />
        ) : (
          <div
            className="absolute inset-0 rounded border border-zinc-300 bg-white shadow-sm"
            style={{
              width: `${pageCssWidth}px`,
              height: `${pageCssHeight}px`,
            }}
          />
        )}
      </div>

      {canRenderCanvas && semanticLayersEnabled ? (
        <>
          <div
            className="absolute inset-0 z-10"
            data-knexread-page-annotation-layer="true"
            style={{
              width: `${pageCssWidth}px`,
              height: `${pageCssHeight}px`,
            }}
          >
            <PdfAnnotationLayer
              pageNumber={pageNumber}
              pageWidth={pageCssWidth}
              pageHeight={pageCssHeight}
              highlights={highlights}
              links={links}
              onClickLink={handleLinkClick}
            />
          </div>

          {effectiveShowTextLayer ? (
            <div
              className="absolute inset-0 z-20"
              data-knexread-page-text-layer-wrapper="true"
              style={{
                width: `${pageCssWidth}px`,
                height: `${pageCssHeight}px`,
              }}
            >
              <PdfTextLayer
                blocks={blocks}
                highlightedBlockIds={highlightBlockIds}
              />
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
