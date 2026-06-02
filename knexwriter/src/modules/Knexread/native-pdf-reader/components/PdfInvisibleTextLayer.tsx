"use client";

import type { KnexPdfTextBlock as PdfTextBlock } from "../knex-pdf-engine";
import { PdfTextLayer } from "./PdfTextLayer";

export function PdfInvisibleTextLayer({
  blocks,
  pageNumber,
  pageWidth,
  pageHeight,
  highlightedBlockIds,
}: {
  blocks: PdfTextBlock[];
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  highlightedBlockIds?: Set<string>;
}) {
  return (
    <div
      className="absolute inset-0 z-40"
      data-knexread-page-text-layer-wrapper="true"
      data-knexread-page-invisible-text-layer="true"
      data-knexread-page-text-layer-semantic="true"
      style={{
        width: `${pageWidth}px`,
        height: `${pageHeight}px`,
        overflow: "hidden",
      }}
    >
      <div
        className="absolute left-0 top-0"
        data-knexread-page-semantic-text-layer-css-wrapper="true"
        style={{
          width: `${pageWidth}px`,
          height: `${pageHeight}px`,
        }}
      >
        <PdfTextLayer
          blocks={blocks}
          mode="semantic"
          pageNumber={pageNumber}
          highlightedBlockIds={highlightedBlockIds}
        />
      </div>
    </div>
  );
}
