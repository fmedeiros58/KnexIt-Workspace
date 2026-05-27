"use client";

import { memo, useMemo } from "react";
import type { CSSProperties } from "react";
import type { KnexPdfTextBlock as PdfTextBlock } from "../knex-pdf-engine";
import {
  isKnexPdfVisualTextLayerEnabled,
  resolveKnexPdfVisualTextStyle,
} from "../knex-pdf-engine/text/PdfVisualTextStyleResolver";

type VisualTextBlockMetadata = PdfTextBlock &
  Partial<{
    fontName: string;
    sourceFontName: string;
    textRenderMode: string | number;
    opacity: number;
    confidence: number;
  }>;

const MIN_BLOCK_WIDTH = 0.5;
const MIN_BLOCK_HEIGHT = 0.5;
const DEFAULT_VISUAL_TEXT_OPACITY = 0.86;
const SMALL_TEXT_VISUAL_OPACITY = 0.78;
const VERY_SMALL_TEXT_VISUAL_OPACITY = 0.68;

function safeNumber(
  value: number | null | undefined,
  fallback = 0,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function clampNumber(
  value: number | null | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  const safe = safeNumber(value, fallback);
  return Math.min(max, Math.max(min, safe));
}

function px(value: number | null | undefined, fallback = 0): string {
  return `${safeNumber(value, fallback)}px`;
}

function positivePx(value: number | null | undefined, fallback = 1): string {
  return `${Math.max(1, safeNumber(value, fallback))}px`;
}

function isInvisibleTextBlock(block: VisualTextBlockMetadata): boolean {
  const renderMode: unknown = block.textRenderMode;

  if (typeof renderMode === "number") {
    return renderMode === 3;
  }

  if (typeof renderMode !== "string") {
    return false;
  }

  const normalized = renderMode.toLowerCase().trim();

  return (
    normalized === "3" ||
    normalized === "invisible" ||
    normalized === "hidden" ||
    normalized === "none"
  );
}

function shouldRenderVisualBlock(block: VisualTextBlockMetadata): boolean {
  if (!block.text || block.text.trim().length === 0) {
    return false;
  }

  if (safeNumber(block.width) < MIN_BLOCK_WIDTH) {
    return false;
  }

  if (safeNumber(block.height) < MIN_BLOCK_HEIGHT) {
    return false;
  }

  if (isInvisibleTextBlock(block)) {
    return false;
  }

  return true;
}

function resolveLayerOpacity(input: {
  fontSize: number;
  blockOpacity: number;
  confidence?: number;
  replacementMode: boolean;
}): number {
  const confidence = clampNumber(input.confidence, 0, 1, 1);

  if (input.replacementMode) {
    return clampNumber(input.blockOpacity * confidence, 0, 1, 1);
  }

  let baseOpacity = DEFAULT_VISUAL_TEXT_OPACITY;

  /**
   * Texto pequeno é justamente o mais sensível.
   * Se a camada visual ficar forte demais, ela engrossa a letra e parece
   * borrada/duplicada sobre o canvas. Por isso usamos opacidade menor.
   */
  if (input.fontSize <= 7) {
    baseOpacity = VERY_SMALL_TEXT_VISUAL_OPACITY;
  } else if (input.fontSize <= 10) {
    baseOpacity = SMALL_TEXT_VISUAL_OPACITY;
  }

  return clampNumber(
    baseOpacity * input.blockOpacity * confidence,
    0,
    1,
    baseOpacity,
  );
}

function resolveTextRendering(fontSize: number): CSSProperties["textRendering"] {
  /**
   * geometricPrecision pode deixar alguns textos pequenos com aparência pesada
   * ou irregular em certos navegadores. Para corpo pequeno, optimizeLegibility
   * costuma produzir leitura mais natural.
   */
  if (fontSize <= 12) {
    return "optimizeLegibility";
  }

  return "geometricPrecision";
}

function createVisualSpanStyle(
  block: VisualTextBlockMetadata,
  replacementMode: boolean,
): CSSProperties {
  const visualStyle = resolveKnexPdfVisualTextStyle(block);

  const fontSize = Math.max(1, safeNumber(visualStyle.fontSize, 12));
  const lineHeight = Math.max(1, safeNumber(visualStyle.lineHeight, fontSize));

  const blockOpacity = clampNumber(visualStyle.opacity, 0, 1, 1);
  const opacity = resolveLayerOpacity({
    fontSize,
    blockOpacity,
    confidence: block.confidence,
    replacementMode,
  });

  return {
    position: "absolute",
    left: px(block.x),
    top: px(block.y),
    width: positivePx(block.width),
    height: positivePx(block.height),
    minHeight: positivePx(block.height),

    margin: 0,
    padding: 0,
    border: 0,
    boxSizing: "border-box",

    overflow: "hidden",
    whiteSpace: "pre",

    fontFamily: visualStyle.fontFamily,
    fontSize: positivePx(fontSize),
    fontWeight: visualStyle.fontWeight,
    fontStyle: visualStyle.fontStyle,
    lineHeight: `${lineHeight}px`,

    letterSpacing:
      typeof visualStyle.letterSpacing === "number"
        ? `${visualStyle.letterSpacing}px`
        : undefined,

    color: visualStyle.color,
    opacity,

    textRendering: resolveTextRendering(fontSize),
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",

    fontKerning: "normal",
    fontVariantLigatures: "none",
    fontSynthesis: "none",

    userSelect: "none",
    WebkitUserSelect: "none",
    pointerEvents: "none",

    transform: "translateZ(0)",
    transformOrigin: "0 0",
    willChange: "auto",

    background: "transparent",
    textShadow: "none",
    mixBlendMode: "normal",
  };
}

export const PdfVisualTextLayer = memo(function PdfVisualTextLayer({
  blocks,
  enabled,
  replacementMode = false,
}: {
  blocks: PdfTextBlock[];
  enabled?: boolean;
  replacementMode?: boolean;
}) {
  const shouldRender = enabled ?? isKnexPdfVisualTextLayerEnabled();

  const visibleBlocks = useMemo(
    () =>
      blocks.filter((block) =>
        shouldRenderVisualBlock(block as VisualTextBlockMetadata),
      ),
    [blocks],
  );

  if (!shouldRender || visibleBlocks.length === 0) {
    return null;
  }

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      data-knexread-visual-text-layer="true"
      aria-hidden="true"
      style={{
        zIndex: 15,
        contain: "layout paint style",
        isolation: "isolate",
        pointerEvents: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        forcedColorAdjust: "none",
      }}
    >
      {visibleBlocks.map((block) => {
        const visualBlock = block as VisualTextBlockMetadata;
        const visualStyle = resolveKnexPdfVisualTextStyle(visualBlock);
        const style = createVisualSpanStyle(visualBlock, replacementMode);

        return (
          <span
            key={visualBlock.id}
            data-pdf-visual-block-id={visualBlock.id}
            data-pdf-visual-role={visualStyle.visualRole}
            data-pdf-visual-font-size={visualStyle.fontSize}
            data-pdf-visual-confidence={visualBlock.confidence ?? ""}
            style={style}
          >
            {visualBlock.text}
          </span>
        );
      })}
    </div>
  );
});
