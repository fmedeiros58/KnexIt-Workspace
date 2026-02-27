"use client";

import { RefObject, useCallback, useEffect, useMemo, useRef } from "react";
import TranslatedPanel from "./TranslatedPanel";
import type { DocumentPage, LayoutBlock, ReaderFitMode, SelectionMapping, TranslationPair } from "../lib/types";

type ContinuousPage = {
  pageNumber: number;
  blocks: LayoutBlock[];
  translations: TranslationPair[];
  hasMapping: boolean;
  loading: boolean;
  error: string | null;
};

type Props = {
  pageNumber: number;
  pageCount: number;
  pages: ContinuousPage[];
  selectedBlockId: string | null;
  selectedPageNumber: number | null;
  translating: boolean;
  zoomPercent: number;
  fitMode: ReaderFitMode;
  pageJumpToken: number;
  pageJumpTarget: number | null;
  scrollRootRef: RefObject<HTMLDivElement | null>;
  renderPage: (pageNumber: number, canvas: HTMLCanvasElement) => Promise<DocumentPage>;
  onSelectBlock: (blockId: string, side: SelectionMapping["side"], pageNumber: number) => void;
  onRequestPage: (pageNumber: number) => void;
  onVisiblePageChange: (pageNumber: number) => void;
};

export default function DualPaneViewer({
  pageNumber,
  pageCount,
  pages,
  selectedBlockId,
  selectedPageNumber,
  translating,
  zoomPercent,
  fitMode,
  pageJumpToken,
  pageJumpTarget,
  scrollRootRef,
  renderPage,
  onSelectBlock,
  onRequestPage,
  onVisiblePageChange,
}: Props) {
  const pageNodeMapRef = useRef<Record<number, HTMLDivElement | null>>({});
  const shouldRenderPage = useCallback(
    (page: ContinuousPage) => {
      if (page.hasMapping || page.loading) return true;
      if (Math.abs(page.pageNumber - pageNumber) <= 1) return true;
      if (page.pageNumber === pageJumpTarget) return true;
      return false;
    },
    [pageJumpTarget, pageNumber],
  );

  useEffect(() => {
    if (!pageJumpTarget || !pageJumpToken) return;
    const targetNode = pageNodeMapRef.current[pageJumpTarget];
    if (!targetNode) return;
    onRequestPage(pageJumpTarget);
    targetNode.scrollIntoView({
      behavior: "smooth",
      block: "start",
      inline: "nearest",
    });
  }, [pageJumpTarget, pageJumpToken, onRequestPage]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const root = scrollRootRef.current;
    if (!root) return;

    const nodes = pages
      .map((page) => pageNodeMapRef.current[page.pageNumber])
      .filter((node): node is HTMLDivElement => Boolean(node));
    if (!nodes.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        let bestPage = 0;
        let bestRatio = 0;

        entries.forEach((entry) => {
          const pageNumberAttr = (entry.target as HTMLElement).dataset.pageNumber;
          const observedPage = Number(pageNumberAttr);
          if (!Number.isFinite(observedPage)) return;

          if (entry.isIntersecting) {
            onRequestPage(observedPage);
            if (entry.intersectionRatio >= bestRatio) {
              bestRatio = entry.intersectionRatio;
              bestPage = observedPage;
            }
          }
        });

        if (bestPage > 0 && bestRatio >= 0.25) {
          onVisiblePageChange(bestPage);
        }
      },
      {
        root,
        rootMargin: "220px 0px 220px 0px",
        threshold: [0.1, 0.25, 0.4, 0.6, 0.85],
      },
    );

    nodes.forEach((node) => observer.observe(node));
    return () => observer.disconnect();
  }, [onRequestPage, onVisiblePageChange, pages, scrollRootRef]);

  useEffect(() => {
    const current = pageNumber;
    onRequestPage(current);
    if (current > 1) onRequestPage(current - 1);
    if (current < pageCount) onRequestPage(current + 1);
  }, [onRequestPage, pageCount, pageNumber]);

  const emptyStateText = useMemo(() => {
    if (!pages.length) {
      return "Nenhuma pagina disponivel.";
    }
    if (translating) {
      return "Traduzindo pagina atual...";
    }
    return null;
  }, [pages.length, translating]);

  return (
    <section className="reader-dual-viewer">
      {emptyStateText ? <p className="reader-warning">{emptyStateText}</p> : null}
      <div className="reader-portrait-grid">
        <div className="reader-page-column">
          {pages.map((page) => (
            <div
              key={`single-${page.pageNumber}`}
              data-page-number={page.pageNumber}
              className="reader-page-stack-item"
              ref={(node) => {
                pageNodeMapRef.current[page.pageNumber] = node;
              }}
            >
              {page.error ? <div className="reader-page-inline-error">{page.error}</div> : null}
              {shouldRenderPage(page) ? (
                <TranslatedPanel
                  pageNumber={page.pageNumber}
                  blocks={page.blocks}
                  translations={page.translations}
                  selectedBlockId={selectedPageNumber === page.pageNumber ? selectedBlockId : null}
                  zoomPercent={zoomPercent}
                  fitMode={fitMode}
                  onSelectBlock={onSelectBlock}
                  renderPage={renderPage}
                />
              ) : (
                <div className="reader-page-placeholder">Pagina {page.pageNumber}</div>
              )}
              {!page.hasMapping || page.loading ? (
                <span className="reader-page-inline-loading">Carregando camada textual da pagina {page.pageNumber}...</span>
              ) : null}
              {page.hasMapping && !page.translations.length && translating && page.pageNumber === pageNumber ? (
                <span className="reader-page-inline-loading">Traduzindo pagina {page.pageNumber}...</span>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
