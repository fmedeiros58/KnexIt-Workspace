"use client";

import { memo, useEffect } from "react";
import type { CSSProperties } from "react";
import type { KnexPdfTextBlock as PdfTextBlock } from "../knex-pdf-engine";

export type PdfTextLayerMode = "semantic" | "visual";

const TEXT_LAYER_STYLE_ELEMENT_ID = "knex-pdf-text-layer-global-style";

const DEFAULT_SELECTION_BACKGROUND = "transparent";
const VISIBLE_SELECTION_BACKGROUND = "rgba(80, 120, 255, 0.08)";
const DEFAULT_VISUAL_TEXT_COLOR = "rgb(17, 24, 39)";
const DEBUG_VISUAL_TEXT_COLOR = "rgb(220, 38, 38)";
const MIN_VISUAL_TEXT_FIT_SCALE_X = 0.35;
const MAX_VISUAL_TEXT_FIT_SCALE_X = 2.8;

type PdfTextLayerBlock = Omit<
  PdfTextBlock,
  | "fontName"
  | "fontFamily"
  | "fontWeight"
  | "fontStyle"
  | "lineHeight"
  | "letterSpacing"
  | "visualRole"
  | "textRenderMode"
  | "opacity"
  | "sourceBackend"
  | "confidence"
  | "color"
  | "rotation"
  | "scaleX"
  | "scaleY"
  | "transform"
> &
  Partial<{
    fontName: string;
    fontFamily: string;
    fontWeight: CSSProperties["fontWeight"];
    fontStyle: CSSProperties["fontStyle"];
    lineHeight: number;
    letterSpacing: number;
    visualRole: string;
    textRenderMode: string | number;
    opacity: number;
    sourceBackend: string;
    confidence: number;
    color: string;
    rotation: number;
    scaleX: number;
    scaleY: number;
    transform: [number, number, number, number, number, number] | number[];
  }>;

type PdfTextLayerProps = {
  blocks: PdfTextLayerBlock[];
  highlightedBlockIds?: Set<string>;

  /**
   * semantic:
   * camada transparente, usada para seleção, cópia, busca e ancoragem.
   *
   * visual:
   * camada vetorial visível, usada somente quando o canvas foi renderizado
   * sem texto rasterizado.
   */
  mode?: PdfTextLayerMode;

  /**
   * false:
   * seleção nativa sem máscara visual sobre o canvas.
   *
   * true:
   * seleção azul muito discreta.
   */
  showNativeSelectionOverlay?: boolean;

  pageNumber?: number;
  className?: string;
};

const GLOBAL_TEXT_LAYER_CSS = `
  .knex-pdf-text-layer {
    position: absolute;
    inset: 0;
    overflow: hidden;
    contain: layout paint style;
    isolation: isolate;
    forced-color-adjust: none;
    touch-action: auto;
    background: transparent !important;
    transition: none !important;
    animation: none !important;
    opacity: 1;
    visibility: visible;
    --knex-pdf-selection-background: transparent;
  }

  .knex-pdf-text-layer,
  .knex-pdf-text-layer * {
    box-sizing: border-box;
  }

  .knex-pdf-text-layer[data-knexread-text-layer-mode="semantic"] {
    z-index: 30;
    pointer-events: none;
    user-select: none;
    -webkit-user-select: none;
  }

  .knex-pdf-text-layer[data-knexread-text-layer-mode="visual"] {
    z-index: 25;
    pointer-events: none;
    user-select: none;
    -webkit-user-select: none;
  }

  .knex-pdf-text-layer__span {
    position: absolute;
    display: inline-block;
    margin: 0;
    padding: 0;
    border: 0;
    white-space: pre;
    line-height: 1;
    transform-origin: 0 0;
    font-synthesis: none;
    text-rendering: geometricPrecision;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    transition: none !important;
    animation: none !important;
    background: transparent !important;
    text-shadow: none !important;
    overflow: hidden;
  }

  .knex-pdf-text-layer[data-knexread-text-layer-mode="semantic"],
  .knex-pdf-text-layer[data-knexread-text-layer-mode="semantic"] * {
    color: transparent !important;
    -webkit-text-fill-color: transparent !important;
    text-shadow: none !important;
    caret-color: transparent !important;
    background: transparent !important;
    forced-color-adjust: none;
  }

  .knex-pdf-text-layer[data-knexread-text-layer-mode="semantic"]
  .knex-pdf-text-layer__span {
    cursor: text;
    pointer-events: auto;
    user-select: text;
    -webkit-user-select: text;
  }

  .knex-pdf-text-layer[data-knexread-text-layer-mode="visual"],
  .knex-pdf-text-layer[data-knexread-text-layer-mode="visual"] * {
    background: transparent !important;
    text-shadow: none !important;
  }

  .knex-pdf-text-layer[data-knexread-text-layer-mode="visual"] {
    z-index: 40 !important;
    opacity: 1 !important;
    visibility: visible !important;
    pointer-events: none !important;
    mix-blend-mode: normal !important;
  }

  .knex-pdf-text-layer[data-knexread-text-layer-mode="visual"]
  .knex-pdf-text-layer__span {
    cursor: default;
    pointer-events: none;
    user-select: none;
    -webkit-user-select: none;
    color: var(--knex-pdf-visual-text-color, rgb(17, 24, 39)) !important;
    -webkit-text-fill-color: var(--knex-pdf-visual-text-color, rgb(17, 24, 39)) !important;
    opacity: var(--knex-pdf-visual-text-opacity, 1) !important;
    visibility: visible !important;
    overflow: visible !important;
    z-index: 2 !important;
    mix-blend-mode: normal !important;
  }

  .knex-pdf-text-layer[data-knexread-text-layer-mode="visual"][data-knexread-visual-debug="true"]
  .knex-pdf-text-layer__span {
    outline: 1px solid rgba(220, 38, 38, 0.55) !important;
    background: rgba(255, 255, 0, 0.16) !important;
    color: rgb(220, 38, 38) !important;
    -webkit-text-fill-color: rgb(220, 38, 38) !important;
  }

  .knex-pdf-text-layer[data-knexread-text-layer-mode="semantic"]
  .knex-pdf-text-layer__span::selection,
  .knex-pdf-text-layer[data-knexread-text-layer-mode="semantic"] ::selection,
  .knex-pdf-text-layer[data-knexread-text-layer-mode="semantic"] *::selection {
    color: transparent !important;
    -webkit-text-fill-color: transparent !important;
    background: var(--knex-pdf-selection-background, transparent) !important;
    text-shadow: none !important;
  }

  .knex-pdf-text-layer[data-knexread-text-layer-mode="semantic"]
  .knex-pdf-text-layer__span::-moz-selection,
  .knex-pdf-text-layer[data-knexread-text-layer-mode="semantic"] ::-moz-selection,
  .knex-pdf-text-layer[data-knexread-text-layer-mode="semantic"] *::-moz-selection {
    color: transparent !important;
    background: var(--knex-pdf-selection-background, transparent) !important;
    text-shadow: none !important;
  }

  .knex-pdf-text-layer__highlight {
    background: transparent !important;
    border-radius: 0;
  }

  .knex-pdf-text-layer[data-knexread-text-layer-mode="visual"]
  .knex-pdf-text-layer__highlight {
    background: transparent !important;
  }
`;

function ensureGlobalTextLayerStyles() {
  if (typeof document === "undefined") return;

  const existing = document.getElementById(TEXT_LAYER_STYLE_ELEMENT_ID);

  /**
   * Importante para Fast Refresh/HMR:
   *
   * A versão anterior retornava imediatamente quando o <style> já existia.
   * Isso fazia o navegador continuar usando o CSS antigo da TextLayer, mesmo
   * depois de substituir o PdfTextLayer.tsx.
   *
   * Agora, se o style já existir, atualizamos o conteúdo dele.
   */
  if (existing instanceof HTMLStyleElement) {
    if (existing.textContent !== GLOBAL_TEXT_LAYER_CSS) {
      existing.textContent = GLOBAL_TEXT_LAYER_CSS;
    }

    return;
  }

  if (existing) {
    existing.remove();
  }

  const style = document.createElement("style");
  style.id = TEXT_LAYER_STYLE_ELEMENT_ID;
  style.textContent = GLOBAL_TEXT_LAYER_CSS;

  document.head.appendChild(style);
}

function getGlobalBoolean(key: string): boolean {
  const value = (globalThis as unknown as Record<string, unknown>)[key];

  return value === true || value === "true";
}

function clamp(value: number, min: number, max: number): number {
  const safeMin = safeNumber(min, 0);
  const safeMax = Math.max(safeMin, safeNumber(max, safeMin));
  const safeValue = safeNumber(value, safeMin);

  return Math.max(safeMin, Math.min(safeMax, safeValue));
}

let textMeasureCanvas: HTMLCanvasElement | null = null;

function getTextMeasureContext(): CanvasRenderingContext2D | null {
  if (typeof document === "undefined") return null;

  if (!textMeasureCanvas) {
    textMeasureCanvas = document.createElement("canvas");
  }

  return textMeasureCanvas.getContext("2d");
}

function cssFontWeightToCanvasValue(
  value: CSSProperties["fontWeight"],
): string {
  if (typeof value === "number") return String(value);
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return "400";
}

function cssFontStyleToCanvasValue(
  value: CSSProperties["fontStyle"],
): string {
  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return "normal";
}

function estimateFallbackTextWidth(input: {
  text: string;
  fontSize: number;
}): number {
  const fontSize = Math.max(1, input.fontSize);
  let factor = 0;

  for (const char of input.text) {
    if (/[ilI\.,:;!'|]/.test(char)) {
      factor += 0.28;
    } else if (/[mwMW@#%&]/.test(char)) {
      factor += 0.9;
    } else if (/[A-ZÁÀÂÃÉÊÍÓÔÕÚÇ]/.test(char)) {
      factor += 0.64;
    } else if (/\s/.test(char)) {
      factor += 0.32;
    } else {
      factor += 0.52;
    }
  }

  return Math.max(1, factor * fontSize);
}

function measureVisualTextWidth(input: {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: CSSProperties["fontWeight"];
  fontStyle: CSSProperties["fontStyle"];
}): number {
  const context = getTextMeasureContext();

  if (!context) {
    return estimateFallbackTextWidth({
      text: input.text,
      fontSize: input.fontSize,
    });
  }

  const fontStyle = cssFontStyleToCanvasValue(input.fontStyle);
  const fontWeight = cssFontWeightToCanvasValue(input.fontWeight);

  context.font = `${fontStyle} ${fontWeight} ${Math.max(
    1,
    input.fontSize,
  )}px ${input.fontFamily}`;

  const metrics = context.measureText(input.text);

  return Math.max(
    1,
    Number.isFinite(metrics.width) ? metrics.width : 0,
  );
}

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

function cleanPdfFontName(fontName: string): string {
  return fontName.replace(/^[A-Z]{6}\+/, "").trim();
}

function resolveFontFamily(block: PdfTextLayerBlock): string {
  const rawFont =
    typeof block.fontFamily === "string" && block.fontFamily.trim().length > 0
      ? block.fontFamily.trim()
      : typeof block.fontName === "string" && block.fontName.trim().length > 0
        ? cleanPdfFontName(block.fontName)
        : "";

  if (!rawFont) {
    return "Arial, Helvetica, sans-serif";
  }

  const normalized = rawFont.toLowerCase();

  if (normalized.includes("times")) {
    return `"Times New Roman", Times, serif`;
  }

  if (normalized.includes("courier")) {
    return `"Courier New", Courier, monospace`;
  }

  if (
    normalized.includes("helvetica") ||
    normalized.includes("arial") ||
    normalized.includes("sans")
  ) {
    return "Arial, Helvetica, sans-serif";
  }

  if (rawFont.includes(",")) {
    return rawFont;
  }

  if (rawFont.includes(" ")) {
    return `"${rawFont}", Arial, Helvetica, sans-serif`;
  }

  return `${rawFont}, Arial, Helvetica, sans-serif`;
}

function resolveFontWeight(
  block: PdfTextLayerBlock,
): CSSProperties["fontWeight"] {
  if (block.fontWeight) {
    return block.fontWeight;
  }

  const fontName = `${block.fontName ?? ""} ${block.fontFamily ?? ""}`
    .toLowerCase()
    .trim();

  if (fontName.includes("bold") || fontName.includes("black")) {
    return 700;
  }

  if (fontName.includes("semibold") || fontName.includes("demibold")) {
    return 600;
  }

  if (fontName.includes("medium")) {
    return 500;
  }

  if (fontName.includes("light")) {
    return 300;
  }

  return "normal";
}

function resolveFontStyle(block: PdfTextLayerBlock): CSSProperties["fontStyle"] {
  if (block.fontStyle) {
    return block.fontStyle;
  }

  const fontName = `${block.fontName ?? ""} ${block.fontFamily ?? ""}`
    .toLowerCase()
    .trim();

  if (
    fontName.includes("italic") ||
    fontName.includes("oblique") ||
    fontName.includes("it")
  ) {
    return "italic";
  }

  return "normal";
}

function resolveVisualTextColor(block: PdfTextLayerBlock): string {
  if (getGlobalBoolean("KNEX_PDF_DEBUG_VISUAL_TEXT_COLOR")) {
    return DEBUG_VISUAL_TEXT_COLOR;
  }

  if (typeof block.color === "string" && block.color.trim().length > 0) {
    return block.color;
  }

  return DEFAULT_VISUAL_TEXT_COLOR;
}

function isInvisibleTextBlock(block: PdfTextLayerBlock): boolean {
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

function shouldRenderBlock(
  block: PdfTextLayerBlock,
  mode: PdfTextLayerMode,
): boolean {
  if (!block.text) {
    return false;
  }

  if (safeNumber(block.width) <= 0 || safeNumber(block.height) <= 0) {
    return false;
  }

  if (mode === "visual" && isInvisibleTextBlock(block)) {
    return false;
  }

  return true;
}

function resolveVisualTransform(input: {
  block: PdfTextLayerBlock;
  fitScaleX: number;
}): string | undefined {
  const transforms: string[] = [];

  const rotation = safeNumber(input.block.rotation, 0);
  const scaleY = safeNumber(input.block.scaleY, 1);
  const scaleX = clamp(
    input.fitScaleX,
    MIN_VISUAL_TEXT_FIT_SCALE_X,
    MAX_VISUAL_TEXT_FIT_SCALE_X,
  );

  if (Math.abs(rotation) > 0.001) {
    transforms.push(`rotate(${rotation}deg)`);
  }

  if (Math.abs(scaleX - 1) > 0.001 || Math.abs(scaleY - 1) > 0.001) {
    transforms.push(`scale(${scaleX}, ${scaleY})`);
  }

  return transforms.length > 0 ? transforms.join(" ") : undefined;
}

function resolveSemanticSpanStyle(
  block: PdfTextLayerBlock,
  fontSize: number,
  lineHeight: number,
): CSSProperties {
  return {
    left: px(block.x),
    top: px(block.y),
    width: positivePx(block.width),
    height: positivePx(block.height),
    minHeight: positivePx(block.height),
    fontFamily: resolveFontFamily(block),
    fontSize: `${fontSize}px`,
    fontWeight: resolveFontWeight(block),
    fontStyle: resolveFontStyle(block),
    lineHeight: `${lineHeight}px`,
    letterSpacing:
      typeof block.letterSpacing === "number" &&
      Number.isFinite(block.letterSpacing)
        ? `${block.letterSpacing}px`
        : undefined,
    color: "transparent",
    WebkitTextFillColor: "transparent",
    opacity: 1,
    userSelect: "text",
    WebkitUserSelect: "text",
    pointerEvents: "auto",
  };
}

function resolveVisualSpanStyle(
  block: PdfTextLayerBlock,
  fontSize: number,
  lineHeight: number,
): CSSProperties {
  const visualColor = resolveVisualTextColor(block);
  const visualOpacity = clampNumber(block.opacity, 0, 1, 1);
  const fontFamily = resolveFontFamily(block);
  const fontWeight = resolveFontWeight(block);
  const fontStyle = resolveFontStyle(block);
  const safeFontSize = Math.max(1, fontSize);

  /**
   * Para o modo visual, o texto precisa caber exatamente na caixa do PDF.
   *
   * A estratégia anterior usava scaleX inferido no extractor. Isso causa
   * perda de espaçamento, palavras coladas e desalinhamento quando a fonte
   * HTML não tem a mesma métrica da fonte do PDF.
   *
   * Aqui medimos a largura real do texto no navegador e escalamos o span
   * para caber na largura do bloco extraído do PDF.
   */
  const measuredTextWidth = measureVisualTextWidth({
    text: block.text,
    fontFamily,
    fontSize: safeFontSize,
    fontWeight,
    fontStyle,
  });

  const targetWidth = Math.max(1, safeNumber(block.width, measuredTextWidth));
  const fitScaleX = clamp(
    targetWidth / measuredTextWidth,
    MIN_VISUAL_TEXT_FIT_SCALE_X,
    MAX_VISUAL_TEXT_FIT_SCALE_X,
  );

  const safeLineHeight = Math.max(
    safeFontSize,
    safeNumber(lineHeight, safeFontSize),
  );

  const visualHeight = Math.max(
    safeLineHeight,
    safeNumber(block.height, safeLineHeight),
  );

  const transform = resolveVisualTransform({
    block,
    fitScaleX,
  });

  return {
    left: px(block.x),
    top: px(block.y),
    /**
     * A largura layout do span é a largura natural medida.
     * O transform scaleX ajusta visualmente para a largura do PDF.
     */
    width: `${measuredTextWidth}px`,
    height: `${visualHeight}px`,
    minHeight: `${visualHeight}px`,
    fontFamily,
    fontSize: `${safeFontSize}px`,
    fontWeight,
    fontStyle,
    lineHeight: `${safeLineHeight}px`,
    letterSpacing:
      typeof block.letterSpacing === "number" &&
      Number.isFinite(block.letterSpacing)
        ? `${block.letterSpacing}px`
        : undefined,
    color: visualColor,
    WebkitTextFillColor: visualColor,
    opacity: visualOpacity,
    visibility: "visible",
    userSelect: "none",
    WebkitUserSelect: "none",
    pointerEvents: "none",
    transform,
    transformOrigin: "0 0",
    overflow: "visible",
    zIndex: 2,
  };
}

/**
 * PdfTextLayer
 *
 * Camada textual dupla:
 *
 * semantic:
 *   invisível, usada para seleção, cópia, busca e ancoragem.
 *
 * visual:
 *   visível, usada somente no modo profissional real:
 *   canvas sem texto rasterizado + texto HTML/CSS.
 */
export const PdfTextLayer = memo(function PdfTextLayer({
  blocks,
  highlightedBlockIds,
  mode = "semantic",
  showNativeSelectionOverlay = false,
  pageNumber,
  className,
}: PdfTextLayerProps) {
  useEffect(() => {
    ensureGlobalTextLayerStyles();
  }, []);

  const isVisualMode = mode === "visual";

  const selectionBackground = showNativeSelectionOverlay
    ? VISIBLE_SELECTION_BACKGROUND
    : DEFAULT_SELECTION_BACKGROUND;

  const rootClassName = className
    ? `knex-pdf-text-layer ${className}`
    : "knex-pdf-text-layer";

  const visualDebug =
    isVisualMode && getGlobalBoolean("KNEX_PDF_DEBUG_VISUAL_TEXT_BOXES");
  const visualTextColor = getGlobalBoolean("KNEX_PDF_DEBUG_VISUAL_TEXT_COLOR")
    ? DEBUG_VISUAL_TEXT_COLOR
    : DEFAULT_VISUAL_TEXT_COLOR;

  return (
    <div
      className={rootClassName}
      data-knexread-text-layer={mode}
      data-knexread-text-layer-mode={mode}
      data-knexread-visual-debug={visualDebug ? "true" : "false"}
      data-knexread-text-layer-block-count={blocks.length}
      data-pdf-page-number={pageNumber}
      aria-hidden={isVisualMode ? true : undefined}
      style={
        {
          "--knex-pdf-selection-background": selectionBackground,
          "--knex-pdf-visual-text-color": visualTextColor,
          "--knex-pdf-visual-text-opacity": 1,
        } as CSSProperties
      }
    >
      {blocks.map((block) => {
        if (!shouldRenderBlock(block, mode)) {
          return null;
        }

        const isHighlighted = highlightedBlockIds?.has(block.id) ?? false;

        const fontSize = Math.max(1, safeNumber(block.fontSize, 1));

        const lineHeight = Math.max(
          1,
          safeNumber(block.lineHeight, fontSize),
        );

        const style = isVisualMode
          ? resolveVisualSpanStyle(block, fontSize, lineHeight)
          : resolveSemanticSpanStyle(block, fontSize, lineHeight);

        return (
          <span
            key={block.id}
            data-pdf-block-id={block.id}
            data-pdf-source-backend={block.sourceBackend}
            data-pdf-visual-role={block.visualRole}
            data-pdf-text-render-mode={block.textRenderMode}
            data-pdf-confidence={block.confidence}
            data-pdf-font-name={block.fontName}
            data-pdf-font-family={block.fontFamily}
            data-pdf-scale-x={block.scaleX}
            data-pdf-scale-y={block.scaleY}
            data-pdf-rotation={block.rotation}
            data-pdf-x={block.x}
            data-pdf-y={block.y}
            data-pdf-width={block.width}
            data-pdf-height={block.height}
            data-pdf-font-size={block.fontSize}
            data-pdf-layer-mode={mode}
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
  );
});