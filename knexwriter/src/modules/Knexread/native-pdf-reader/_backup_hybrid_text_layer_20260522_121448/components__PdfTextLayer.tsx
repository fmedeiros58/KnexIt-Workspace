"use client";

import { memo, useMemo } from "react";
import type { CSSProperties } from "react";
import type { KnexPdfTextBlock as PdfTextBlock } from "../knex-pdf-engine";

const DEFAULT_SELECTION_BACKGROUND = "transparent";
const VISIBLE_SELECTION_BACKGROUND = "rgba(80, 120, 255, 0.08)";

function safeNumber(
  value: number | null | undefined,
  fallback = 0,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function px(value: number | null | undefined, fallback = 0): string {
  return `${safeNumber(value, fallback)}px`;
}

function positivePx(value: number | null | undefined, fallback = 1): string {
  return `${Math.max(1, safeNumber(value, fallback))}px`;
}

/**
 * PdfTextLayer
 * ------------------------------------------------------------
 * Camada semântica de texto.
 *
 * Importante:
 * - Esta camada NÃO deve tentar melhorar visualmente o PDF.
 * - A qualidade visual do PDF vem do Canvas/HiDPI renderer.
 * - Esta camada deve servir para seleção, cópia, citações, localização textual
 *   e highlights.
 *
 * Por isso, o texto continua transparente por padrão.
 * Se o texto da TextLayer ficar visível, ele pode criar o problema de texto
 * duplicado/deslocado por cima do canvas original.
 */
export const PdfTextLayer = memo(function PdfTextLayer({
  blocks,
  highlightedBlockIds,
  showNativeSelectionOverlay = false,
}: {
  blocks: PdfTextBlock[];
  highlightedBlockIds?: Set<string>;

  /**
   * false:
   *   seleção nativa sem máscara visual sobre o canvas.
   *
   * true:
   *   seleção azul muito discreta.
   *
   * Recomendo manter false. A seleção visual ideal deve ser uma camada própria
   * de overlay, não o ::selection da TextLayer.
   */
  showNativeSelectionOverlay?: boolean;
}) {
  const selectionBackground = showNativeSelectionOverlay
    ? VISIBLE_SELECTION_BACKGROUND
    : DEFAULT_SELECTION_BACKGROUND;

  const css = useMemo(
    () => `
      .knex-pdf-text-layer {
        position: absolute;
        inset: 0;
        z-index: 20;
        overflow: hidden;
        contain: layout paint style;
        isolation: isolate;
        user-select: text;
        -webkit-user-select: text;
        forced-color-adjust: none;
        touch-action: manipulation;
      }

      .knex-pdf-text-layer,
      .knex-pdf-text-layer * {
        color: transparent !important;
        -webkit-text-fill-color: transparent !important;
        text-shadow: none !important;
        caret-color: transparent !important;
        background: transparent !important;
        forced-color-adjust: none;
      }

      .knex-pdf-text-layer__span {
        position: absolute;
        display: block;
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        border: 0;
        overflow: hidden;
        white-space: pre;
        line-height: 1;
        transform-origin: 0 0;
        font-synthesis: none;
        text-rendering: geometricPrecision;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        cursor: text;
        user-select: text;
        -webkit-user-select: text;
      }

      .knex-pdf-text-layer__span::selection,
      .knex-pdf-text-layer ::selection,
      .knex-pdf-text-layer *::selection {
        color: transparent !important;
        -webkit-text-fill-color: transparent !important;
        background: ${selectionBackground} !important;
        text-shadow: none !important;
      }

      .knex-pdf-text-layer__span::-moz-selection,
      .knex-pdf-text-layer ::-moz-selection,
      .knex-pdf-text-layer *::-moz-selection {
        color: transparent !important;
        background: ${selectionBackground} !important;
        text-shadow: none !important;
      }

      .knex-pdf-text-layer__highlight {
        background: rgba(255, 230, 0, 0.20) !important;
        border-radius: 2px;
      }
    `,
    [selectionBackground],
  );

  return (
    <>
      <style>{css}</style>

      <div
        className="knex-pdf-text-layer"
        data-knexread-text-layer="semantic"
      >
        {blocks.map((block) => {
          const isHighlighted = highlightedBlockIds?.has(block.id) ?? false;

          const lineHeight = Math.max(
            1,
            safeNumber(block.lineHeight, safeNumber(block.fontSize, 1)),
          );

          const style: CSSProperties = {
            left: px(block.x),
            top: px(block.y),
            width: positivePx(block.width),
            height: positivePx(block.height),
            minHeight: positivePx(block.height),
            fontFamily: block.fontFamily,
            fontSize: positivePx(block.fontSize),
            fontWeight: block.fontWeight,
            fontStyle: block.fontStyle,
            lineHeight: `${lineHeight}px`,
            color: "transparent",
            WebkitTextFillColor: "transparent",
            userSelect: "text",
            WebkitUserSelect: "text",
          };

          return (
            <span
              key={block.id}
              data-pdf-block-id={block.id}
              className={`knex-pdf-text-layer__span ${
                isHighlighted ? "knex-pdf-text-layer__highlight" : ""
              }`}
              style={style}
            >
              {block.text}
            </span>
          );
        })}
      </div>
    </>
  );
});
