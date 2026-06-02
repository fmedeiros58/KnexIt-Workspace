"use client";

import type { ReactNode } from "react";
import type { KnexPdfPageBlueprint } from "../../core/KnexPdfBlueprintTypes";
import {
  getBlueprintTextElements,
  PdfHtmlTextRenderer,
} from "./PdfHtmlTextRenderer";
import {
  getBlueprintNonTextElements,
  PdfNonTextElementRenderer,
} from "./PdfNonTextElementRenderer";

export type PdfPagePresentationSurfaceProps = {
  blueprint: KnexPdfPageBlueprint | null;
  pageNumber: number;
  cssWidth: number;
  cssHeight: number;
  status: string;
  reason?: string;
  nonTextFallbackSurface?: ReactNode;
  interactiveFormFields?: boolean;
};

export function PdfPagePresentationSurface({
  blueprint,
  pageNumber,
  cssWidth,
  cssHeight,
  status,
  reason = "",
  nonTextFallbackSurface,
  interactiveFormFields = false,
}: PdfPagePresentationSurfaceProps) {
  const elements = blueprint?.elements ?? [];
  const textElements = getBlueprintTextElements(elements);
  const nonTextElements = getBlueprintNonTextElements(elements);
  const hasText = textElements.length > 0;
  const hasBlueprintNonText = nonTextElements.length > 0;
  const hasFallbackSurface = Boolean(nonTextFallbackSurface);

  /*
   * Blueprint presentation keeps the DOM text layer as the visible text source.
   * When the non-text fallback canvas is mounted, PdfBlueprintStage renders it
   * with renderText=false, so it can safely sit below the HTML text without
   * duplicating glyphs from the raster path.
   */
  const shouldMountFallbackSurface = hasFallbackSurface;
  const shouldMountBlueprintNonText = !hasFallbackSurface && hasBlueprintNonText;
  const shouldMountHtmlText = hasText;

  return (
    <div
      className="knex-pdf-page-presentation-surface"
      data-knexread-presentation-surface="blueprint"
      data-knexread-presentation-status={status}
      data-knexread-presentation-reason={reason}
      data-knexread-presentation-page-number={pageNumber}
      data-knexread-presentation-blueprint-ready={blueprint ? "true" : "false"}
      data-knexread-presentation-text-source={
        shouldMountHtmlText ? "html" : hasFallbackSurface ? "canvas" : "none"
      }
      data-knexread-presentation-text-visible={
        shouldMountHtmlText ? "true" : "false"
      }
      data-knexread-presentation-text-count={textElements.length}
      data-knexread-presentation-non-text-count={nonTextElements.length}
      data-knexread-presentation-total-element-count={elements.length}
      data-knexread-presentation-fallback-surface-mounted={
        shouldMountFallbackSurface ? "true" : "false"
      }
      data-knexread-presentation-html-text-disabled-by-canvas="false"
      data-knexread-presentation-blueprint-non-text-disabled-by-canvas={
        hasFallbackSurface && hasBlueprintNonText ? "true" : "false"
      }
      data-knexread-presentation-non-text-source={
        shouldMountFallbackSurface
          ? "fallback-canvas"
          : shouldMountBlueprintNonText
            ? "blueprint-dom"
            : "none"
      }
      style={{
        position: "absolute",
        inset: 0,
        width: `${cssWidth}px`,
        height: `${cssHeight}px`,
        overflow: "hidden",
        background: "#ffffff",
      }}
    >
      {shouldMountFallbackSurface ? (
        <div
          className="absolute inset-0 z-0"
          data-knexread-presentation-non-text-fallback-surface="true"
          data-knexread-presentation-visual-source="canvas"
        >
          {nonTextFallbackSurface}
        </div>
      ) : null}

      {shouldMountBlueprintNonText ? (
        <div
          className="absolute inset-0 z-[3]"
          data-knexread-presentation-non-text-dom-surface="true"
          data-knexread-presentation-non-text-dom-count={nonTextElements.length}
        >
          <PdfNonTextElementRenderer
            elements={nonTextElements}
            interactiveFormFields={interactiveFormFields}
          />
        </div>
      ) : null}

      {shouldMountHtmlText ? (
        <div
          className="absolute inset-0 z-[5]"
          data-knexread-presentation-html-text-surface="true"
          data-knexread-presentation-html-text-count={textElements.length}
        >
          <PdfHtmlTextRenderer elements={textElements} />
        </div>
      ) : null}
    </div>
  );
}
