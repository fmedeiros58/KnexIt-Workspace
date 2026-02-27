"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PageCanvas from "./PageCanvas";
import TextLayer from "./TextLayer";
import HighlightOverlay from "./HighlightOverlay";
import type { DocumentPage, LayoutBlock, ReaderFitMode, SelectionMapping, TranslationPair } from "../lib/types";

type Props = {
  pageNumber: number;
  blocks: LayoutBlock[];
  translations: TranslationPair[];
  selectedBlockId: string | null;
  zoomPercent: number;
  fitMode: ReaderFitMode;
  onSelectBlock: (blockId: string, side: SelectionMapping["side"], pageNumber: number) => void;
  renderPage: (pageNumber: number, canvas: HTMLCanvasElement) => Promise<DocumentPage>;
};

export default function TranslatedPanel({
  pageNumber,
  blocks,
  translations,
  selectedBlockId,
  zoomPercent,
  fitMode,
  onSelectBlock,
  renderPage,
}: Props) {
  const [pageInfo, setPageInfo] = useState<DocumentPage | null>(null);
  const [measuredHeights, setMeasuredHeights] = useState<Record<string, number>>({});
  const [paneWidth, setPaneWidth] = useState(560);
  const paneRef = useRef<HTMLElement | null>(null);

  const selectedBlock = useMemo(
    () => blocks.find((block) => block.id === selectedBlockId) ?? null,
    [blocks, selectedBlockId],
  );

  const translationByBlockId = useMemo(() => {
    const map: Record<string, string> = {};
    translations.forEach((pair) => {
      map[pair.blockId] = pair.translatedText;
    });
    return map;
  }, [translations]);

  useEffect(() => {
    const paneNode = paneRef.current;
    if (!paneNode) return;

    const updateWidth = () => {
      const nextWidth = Math.max(260, Math.floor(paneNode.clientWidth - 12));
      setPaneWidth(nextWidth);
    };

    updateWidth();

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateWidth);
      return () => window.removeEventListener("resize", updateWidth);
    }

    const observer = new ResizeObserver(() => updateWidth());
    observer.observe(paneNode);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!selectedBlockId || !paneRef.current) return;
    const safeId = selectedBlockId.replace(/"/g, '\\"');
    const node = paneRef.current.querySelector(`[data-reader-block-id="${safeId}"]`) as HTMLElement | null;
    node?.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  }, [selectedBlockId, pageNumber]);

  const width = pageInfo?.width ?? 720;
  const pageHeight = pageInfo?.height ?? 960;

  const virtualHeight = useMemo(() => {
    let nextHeight = pageHeight;
    blocks.forEach((block) => {
      const measured = measuredHeights[block.id] ?? block.height;
      nextHeight = Math.max(nextHeight, block.y + measured + 10);
    });
    return Math.ceil(nextHeight);
  }, [blocks, measuredHeights, pageHeight]);

  const zoomFactor = Math.max(0.5, zoomPercent / 100);
  const baseWidth = fitMode === "fit-pane" ? paneWidth : width;
  const targetWidth = Math.max(220, Math.round(baseWidth * zoomFactor));
  const scale = width > 0 ? targetWidth / width : 1;
  const scaledHeight = Math.max(100, Math.round(virtualHeight * scale));

  return (
    <article className="reader-page-pane" ref={paneRef}>
      <header className="reader-page-pane-header" style={{ width: `${targetWidth}px` }}>
        <span>Traduzido</span>
        <span>Página original {pageNumber}</span>
      </header>
      <div className="reader-page-frame" style={{ width: `${targetWidth}px`, height: `${scaledHeight}px` }}>
        <div
          className="reader-page-inner"
          style={{
            width: `${width}px`,
            height: `${virtualHeight}px`,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
          }}
        >
          <div className="absolute left-0 top-0" style={{ width: `${width}px`, height: `${pageHeight}px` }}>
            <PageCanvas pageNumber={pageNumber} renderPage={renderPage} onRendered={setPageInfo} />
          </div>
          {virtualHeight > pageHeight ? (
            <div
              className="absolute left-0"
              style={{
                top: `${pageHeight}px`,
                width: `${width}px`,
                height: `${virtualHeight - pageHeight}px`,
                background: pageInfo?.backgroundColor ?? "#ffffff",
              }}
            />
          ) : null}

          <TextLayer
            side="translated"
            blocks={blocks}
            selectedBlockId={selectedBlockId}
            translatedById={translationByBlockId}
            maskColor={pageInfo?.backgroundColor ?? "#ffffff"}
            onSelectBlock={onSelectBlock}
            onMeasure={setMeasuredHeights}
          />
          <HighlightOverlay block={selectedBlock} />
        </div>
      </div>
    </article>
  );
}

