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

  /*
   * Tamanho da superfície no espaço de renderização recebido do
   * PdfBlueprintStage.
   *
   * Importante:
   * esta superfície não deve aplicar escala própria. A escala visual imediata
   * do zoom é aplicada uma única vez no PdfModularPageStage, envolvendo canvas,
   * blueprint, texto HTML e elementos não textuais juntos.
   */
  cssWidth: number;
  cssHeight: number;

  status: string;
  reason?: string;
  nonTextFallbackSurface?: ReactNode;
  interactiveFormFields?: boolean;
};

function safeDimension(value: number | null | undefined, fallback = 1): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.max(1, value)
    : fallback;
}

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

  const resolvedCssWidth = safeDimension(cssWidth);
  const resolvedCssHeight = safeDimension(cssHeight);

  /*
   * Regra de sincronização:
   *
   * Canvas fallback, texto HTML e elementos DOM do blueprint precisam ocupar
   * exatamente o mesmo espaço local. Não aplicamos scale/transform aqui.
   *
   * Se esta superfície também escalar o DOM, criamos dupla escala em relação ao
   * PdfModularPageStage e voltamos ao problema de texto desconectado do canvas.
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
      data-knexread-presentation-css-width={resolvedCssWidth}
      data-knexread-presentation-css-height={resolvedCssHeight}
      data-knexread-presentation-transform-owner="PdfModularPageStage"
      data-knexread-presentation-local-transform="none"
      style={{
        position: "absolute",
        inset: 0,
        width: `${resolvedCssWidth}px`,
        minWidth: `${resolvedCssWidth}px`,
        maxWidth: `${resolvedCssWidth}px`,
        height: `${resolvedCssHeight}px`,
        minHeight: `${resolvedCssHeight}px`,
        maxHeight: `${resolvedCssHeight}px`,
        flex: `0 0 ${resolvedCssWidth}px`,
        overflow: "hidden",
        background: "#ffffff",
        contain: "layout paint size",
        boxSizing: "border-box",
      }}
    >
      {shouldMountFallbackSurface ? (
        <div
          className="absolute inset-0 z-0"
          data-knexread-presentation-non-text-fallback-surface="true"
          data-knexread-presentation-visual-source="canvas"
          style={{
            width: `${resolvedCssWidth}px`,
            minWidth: `${resolvedCssWidth}px`,
            maxWidth: `${resolvedCssWidth}px`,
            height: `${resolvedCssHeight}px`,
            minHeight: `${resolvedCssHeight}px`,
            maxHeight: `${resolvedCssHeight}px`,
            overflow: "hidden",
            contain: "layout paint size",
          }}
        >
          {nonTextFallbackSurface}
        </div>
      ) : null}

      {shouldMountBlueprintNonText ? (
        <div
          className="absolute inset-0 z-[3]"
          data-knexread-presentation-non-text-dom-surface="true"
          data-knexread-presentation-non-text-dom-count={nonTextElements.length}
          style={{
            width: `${resolvedCssWidth}px`,
            height: `${resolvedCssHeight}px`,
          }}
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
          style={{
            width: `${resolvedCssWidth}px`,
            height: `${resolvedCssHeight}px`,
          }}
        >
          <PdfHtmlTextRenderer elements={textElements} />
        </div>
      ) : null}
    </div>
  );
}
