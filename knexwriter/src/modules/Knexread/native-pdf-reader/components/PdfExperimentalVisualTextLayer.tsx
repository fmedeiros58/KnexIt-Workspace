"use client";

import type { KnexPdfTextBlock as PdfTextBlock } from "../knex-pdf-engine";
import { PdfTextLayer } from "./PdfTextLayer";

export function PdfExperimentalVisualTextLayer({
  blocks,
  pageNumber,
  pageWidth,
  pageHeight,
  highlightedBlockIds,
  forced = false,
  auditLabel,
}: {
  blocks: PdfTextBlock[];
  pageNumber: number;
  pageWidth: number;
  pageHeight: number;
  highlightedBlockIds?: Set<string>;
  forced?: boolean;
  auditLabel: string;
}) {
  return (
    <div
      className="absolute inset-0 z-30"
      data-knexread-page-visual-text-layer-wrapper="true"
      data-knexread-page-visual-text-layer-forced={forced ? "true" : "false"}
      data-knexread-page-visual-text-block-count={blocks.length}
      style={{
        width: `${pageWidth}px`,
        height: `${pageHeight}px`,
        overflow: "hidden",
      }}
    >
      {forced ? (
        <div
          className="absolute right-2 top-2 z-50 rounded bg-yellow-200 px-2 py-1 text-xs font-semibold text-zinc-900 shadow"
          data-knexread-page-visual-text-audit-badge="true"
        >
          {auditLabel} | blocks={blocks.length}
        </div>
      ) : null}

      {blocks.length > 0 ? (
        <div
          className="absolute left-0 top-0"
          data-knexread-page-visual-text-layer-css-wrapper="true"
          style={{
            width: `${pageWidth}px`,
            height: `${pageHeight}px`,
          }}
        >
          <PdfTextLayer
            blocks={blocks}
            mode="visual"
            pageNumber={pageNumber}
            highlightedBlockIds={highlightedBlockIds}
          />
        </div>
      ) : forced ? (
        <div
          className="absolute left-2 top-2 z-50 rounded bg-yellow-200 px-2 py-1 text-xs font-semibold text-zinc-900 shadow"
          data-knexread-page-visual-text-diagnostic-empty="true"
        >
          Vetorial ativo, mas blocks=0
        </div>
      ) : null}
    </div>
  );
}
