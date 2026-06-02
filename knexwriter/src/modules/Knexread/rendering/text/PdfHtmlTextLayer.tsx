"use client";

import { createPdfTextRunStyle } from "./PdfTextCssFactory";
import type { PdfVisualTextModel } from "./PdfVisualTextModelBuilder";

export type PdfHtmlTextLayerProps = {
  model: PdfVisualTextModel;
  highlightedRunIds?: Set<string>;
  className?: string;
};

export function PdfHtmlTextLayer({
  model,
  highlightedRunIds,
  className,
}: PdfHtmlTextLayerProps) {
  return (
    <div
      className={["knex-pdf-html-text-layer", className]
        .filter(Boolean)
        .join(" ")}
      data-knexread-html-text-layer="true"
      data-knexread-html-text-over-canvas="true"
      data-knexread-html-text-page-number={model.pageNumber}
      data-knexread-html-text-source={model.source}
      data-knexread-html-text-run-count={model.runs.length}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "auto",
        userSelect: "text",
        fontFamily: '"Times New Roman", Times, serif',
        fontSize: "1px",
        fontWeight: 400,
        fontStyle: "normal",
        lineHeight: 1,
        letterSpacing: 0,
        wordSpacing: 0,
        textAlign: "left",
        textTransform: "none",
        textDecoration: "none",
        color: "rgb(0, 0, 0)",
      }}
    >
      {model.runs.map((run) => {
        const highlighted = highlightedRunIds?.has(run.id) ?? false;

        return (
          <span
            key={run.id}
            data-pdf-block-id={run.id}
            data-pdf-source-backend={run.sourceBackend}
            data-pdf-text-render-mode="hybrid"
            data-pdf-confidence={run.confidence}
            data-knexread-html-text-run="true"
            data-knexread-html-text-font-family={run.fontFamily}
            data-knexread-html-text-font-name={run.fontName ?? ""}
            data-knexread-html-text-style-source={run.styleSource}
            data-knexread-html-text-missing-font-family={
              run.missingFontFamily ? "true" : "false"
            }
            data-knexread-html-text-used-ui-font-family={
              run.usedUiFontFamily ? "true" : "false"
            }
            data-knexread-html-text-highlighted={highlighted ? "true" : "false"}
            style={{
              ...createPdfTextRunStyle(run),
              backgroundColor: highlighted ? "rgba(250, 204, 21, 0.32)" : "transparent",
            }}
          >
            {run.text}
          </span>
        );
      })}
    </div>
  );
}
