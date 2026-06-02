"use client";

import { useEffect, useMemo } from "react";
import type { KnexPdfBlueprintElement } from "../../core/KnexPdfBlueprintTypes";
import type { PdfVisualTextRun } from "../text/PdfVisualTextModelBuilder";
import {
  createPdfBlueprintTextDiagnostics,
  logPdfBlueprintTextDiagnostics,
} from "../text/PdfTextLayerDiagnostics";
import { KnexPdfBlueprintElementRenderer } from "./KnexPdfBlueprintElementRenderer";

export type PdfHtmlTextRendererProps = {
  elements: KnexPdfBlueprintElement[];
};

function isTextElement(
  element: KnexPdfBlueprintElement,
): element is PdfVisualTextRun & { type?: "text" } {
  return (
    (element as { type?: string }).type === "text" ||
    typeof (element as { text?: unknown }).text === "string"
  );
}

export function getBlueprintTextElements(
  elements: KnexPdfBlueprintElement[],
): Array<PdfVisualTextRun & { type?: "text" }> {
  return elements.filter(isTextElement);
}

export function PdfHtmlTextRenderer({ elements }: PdfHtmlTextRendererProps) {
  const textElements = getBlueprintTextElements(elements);
  const pageNumber = textElements[0]?.pageNumber ?? 0;
  const diagnostics = useMemo(
    () =>
      createPdfBlueprintTextDiagnostics({
        pageNumber,
        renderMode: "blueprint",
        runs: textElements,
      }),
    [pageNumber, textElements],
  );

  useEffect(() => {
    logPdfBlueprintTextDiagnostics({
      pageNumber,
      runs: textElements,
    });
  }, [pageNumber, textElements]);

  return (
    <div
      className="knex-pdf-blueprint-html-text-renderer"
      data-knexread-blueprint-html-text-renderer="true"
      data-knexread-blueprint-html-text-count={textElements.length}
      data-knexread-blueprint-html-missing-font-runs={
        diagnostics.missingFontFamilyRuns
      }
      data-knexread-blueprint-html-generic-ui-font-runs={
        diagnostics.genericUiFontRuns
      }
      data-knexread-blueprint-html-font-families={diagnostics.fontFamilies.join(
        " | ",
      )}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
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
      {textElements.map((element) => (
        <KnexPdfBlueprintElementRenderer
          key={element.id}
          element={element as KnexPdfBlueprintElement}
        />
      ))}
    </div>
  );
}
