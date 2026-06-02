"use client";

import { memo, useEffect, useMemo } from "react";
import type { CSSProperties } from "react";
import type { KnexPdfTextBlock as PdfTextBlock } from "../knex-pdf-engine";

export type PdfTextLayerMode = "semantic" | "visual" | "hybrid";

const TEXT_LAYER_STYLE_ELEMENT_ID = "knex-pdf-text-layer-global-style";

const DEFAULT_SELECTION_BACKGROUND = "transparent";
const VISIBLE_SELECTION_BACKGROUND = "rgba(80, 120, 255, 0.08)";
const DEFAULT_VISUAL_TEXT_COLOR = "rgb(0, 0, 0)";
const DEBUG_VISUAL_TEXT_COLOR = "rgb(220, 38, 38)";
const MIN_VISUAL_TEXT_FIT_SCALE_X = 0.92;
const MAX_VISUAL_TEXT_FIT_SCALE_X = 1.08;
const DEFAULT_VISUAL_TEXT_MAX_LETTER_SPACING_ADJUST = 0.85;
const DEFAULT_VISUAL_TEXT_OPACITY = 0.94;
const DEFAULT_VISUAL_TEXT_FONT_WEIGHT_CAP = 520;

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
    font-kerning: normal;
    font-variant-ligatures: normal;
    font-feature-settings: "kern" 1, "liga" 1;
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
    text-rendering: geometricPrecision !important;
    -webkit-font-smoothing: antialiased !important;
    -moz-osx-font-smoothing: grayscale !important;
    font-synthesis: none !important;
    font-kerning: normal !important;
    font-variant-ligatures: normal !important;
    font-feature-settings: "kern" 1, "liga" 1 !important;
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

function getGlobalString(key: string): string | undefined {
  const value = (globalThis as unknown as Record<string, unknown>)[key];

  if (typeof value === "string" && value.trim().length > 0) {
    return value.trim();
  }

  return undefined;
}

function getGlobalNumber(
  key: string,
  fallback: number,
  min = Number.NEGATIVE_INFINITY,
  max = Number.POSITIVE_INFINITY,
): number {
  const value = (globalThis as unknown as Record<string, unknown>)[key];
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.max(min, Math.min(max, parsed));
}

function getDefaultVisualTextFontFamily(): string {
  return (
    getGlobalString("KNEX_PDF_VISUAL_TEXT_DEFAULT_FONT_FAMILY") ??
    `"Times New Roman", Times, serif`
  );
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

function getCharacterSpacingDivisor(text: string): number {
  /*
   * letter-spacing é aplicado entre glifos. Para palavras curtas, usar
   * text.length - 1 pode criar saltos visuais exagerados. Este divisor
   * suaviza o ajuste e reduz serrilhado causado por scaleX.
   */
  const graphemeCount = Array.from(text).length;

  return Math.max(1, graphemeCount - 1);
}

function resolveVisualLetterSpacing(input: {
  block: PdfTextLayerBlock;
  text: string;
  targetWidth: number;
  measuredTextWidth: number;
}): number | undefined {
  if (typeof input.block.letterSpacing === "number" && Number.isFinite(input.block.letterSpacing)) {
    return input.block.letterSpacing;
  }

  const maxAdjust = getGlobalNumber(
    "KNEX_PDF_VISUAL_TEXT_MAX_LETTER_SPACING_ADJUST",
    DEFAULT_VISUAL_TEXT_MAX_LETTER_SPACING_ADJUST,
    0,
    3,
  );

  const divisor = getCharacterSpacingDivisor(input.text);
  const rawAdjust = (input.targetWidth - input.measuredTextWidth) / divisor;

  if (Math.abs(rawAdjust) < 0.005) {
    return undefined;
  }

  return clamp(rawAdjust, -maxAdjust, maxAdjust);
}

function shouldUseVisualScaleX(): boolean {
  /*
   * Transform scaleX em texto tende a gerar blur/serrilhado. Deixe desligado
   * por padrão e use letter-spacing para ajuste fino. Para diagnóstico:
   * globalThis.KNEX_PDF_VISUAL_TEXT_USE_SCALE_X = true
   */
  return getGlobalBoolean("KNEX_PDF_VISUAL_TEXT_USE_SCALE_X");
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

function isInternalFontDescriptor(value: string | undefined): boolean {
  if (!value) return true;

  const normalized = cleanPdfFontName(value)
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();

  if (!normalized) return true;

  return (
    normalized.includes("pdfium") ||
    normalized.includes("inferred") ||
    normalized.includes("unknown") ||
    normalized.includes("undefined") ||
    normalized.includes("null")
  );
}

function resolveFontFamily(block: PdfTextLayerBlock): string {
  /**
   * Permite diagnóstico rápido no navegador sem recompilar:
   * globalThis.KNEX_PDF_VISUAL_TEXT_FONT_FAMILY = '"Times New Roman", Times, serif'
   * ou
   * globalThis.KNEX_PDF_VISUAL_TEXT_FONT_FAMILY = 'Arial, Helvetica, sans-serif'
   */
  const forcedFontFamily = getGlobalString("KNEX_PDF_VISUAL_TEXT_FONT_FAMILY");

  if (forcedFontFamily) {
    return forcedFontFamily;
  }

  const rawFamily =
    typeof block.fontFamily === "string" && block.fontFamily.trim().length > 0
      ? block.fontFamily.trim()
      : "";

  const rawFontName =
    typeof block.fontName === "string" && block.fontName.trim().length > 0
      ? cleanPdfFontName(block.fontName)
      : "";

  const rawFont = !isInternalFontDescriptor(rawFontName)
    ? rawFontName
    : !isInternalFontDescriptor(rawFamily)
      ? rawFamily
      : "";

  if (!rawFont) {
    return getDefaultVisualTextFontFamily();
  }

  const normalized = rawFont.toLowerCase();

  if (normalized.includes("times") || normalized.includes("roman")) {
    return `"Times New Roman", Times, serif`;
  }

  if (normalized.includes("courier") || normalized.includes("mono")) {
    return `"Courier New", Courier, monospace`;
  }

  if (
    normalized.includes("helvetica") ||
    normalized.includes("arial") ||
    normalized.includes("calibri") ||
    normalized.includes("aptos") ||
    normalized.includes("segoe") ||
    normalized.includes("sans")
  ) {
    return getDefaultVisualTextFontFamily();
  }

  if (
    normalized.includes("cambria") ||
    normalized.includes("georgia") ||
    normalized.includes("garamond") ||
    normalized.includes("palatino") ||
    normalized.includes("serif")
  ) {
    return `${rawFont}, "Times New Roman", Times, serif`;
  }

  if (rawFont.includes(",")) {
    return rawFont;
  }

  if (rawFont.includes(" ")) {
    return `"${rawFont}", ${getDefaultVisualTextFontFamily()}`;
  }

  return `${rawFont}, ${getDefaultVisualTextFontFamily()}`;
}

function resolveFontWeight(
  block: PdfTextLayerBlock,
): CSSProperties["fontWeight"] {
  const fontDescriptor = `${block.fontName ?? ""} ${block.fontFamily ?? ""}`
    .toLowerCase()
    .trim();

  /*
   * Muitos backends preenchem fontWeight como "normal" mesmo quando
   * o nome real da fonte contém Bold/Semibold. Por isso a inferência pelo
   * nome da fonte vem antes do fallback explícito "normal".
   */
  if (
    fontDescriptor.includes("bold") ||
    fontDescriptor.includes("black") ||
    fontDescriptor.includes("heavy")
  ) {
    return 700;
  }

  if (
    fontDescriptor.includes("semibold") ||
    fontDescriptor.includes("demibold")
  ) {
    return 600;
  }

  if (fontDescriptor.includes("medium")) {
    return 500;
  }

  if (fontDescriptor.includes("light")) {
    return 300;
  }

  if (
    block.fontWeight &&
    block.fontWeight !== "normal" &&
    block.fontWeight !== 400
  ) {
    return block.fontWeight;
  }

  return 400;
}
function resolveVisualFontWeight(
  block: PdfTextLayerBlock,
): CSSProperties["fontWeight"] {
  const forcedWeight = getGlobalNumber(
    "KNEX_PDF_VISUAL_TEXT_FORCE_FONT_WEIGHT",
    Number.NaN,
    100,
    900,
  );

  if (Number.isFinite(forcedWeight)) {
    return Math.round(forcedWeight);
  }

  const resolved = resolveFontWeight(block);
  const numericWeight =
    typeof resolved === "number"
      ? resolved
      : typeof resolved === "string"
        ? Number(resolved)
        : Number.NaN;

  if (!Number.isFinite(numericWeight)) {
    return resolved;
  }

  /*
   * A camada visual fica muito parecida com negrito quando há fonte substituta,
   * antialiasing forte ou pequenos resíduos de sobreposição. Por padrão,
   * limitamos o peso visual. Se quiser preservar negritos fortes:
   *
   * globalThis.KNEX_PDF_VISUAL_TEXT_MAX_FONT_WEIGHT = 700
   */
  const maxWeight = getGlobalNumber(
    "KNEX_PDF_VISUAL_TEXT_MAX_FONT_WEIGHT",
    DEFAULT_VISUAL_TEXT_FONT_WEIGHT_CAP,
    300,
    900,
  );

  return Math.min(Math.round(numericWeight), Math.round(maxWeight));
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
  enableScaleX: boolean;
}): string | undefined {
  const transforms: string[] = [];

  const rotation = safeNumber(input.block.rotation, 0);
  const scaleY = safeNumber(input.block.scaleY, 1);
  const scaleX = input.enableScaleX
    ? clamp(
        input.fitScaleX,
        MIN_VISUAL_TEXT_FIT_SCALE_X,
        MAX_VISUAL_TEXT_FIT_SCALE_X,
      )
    : 1;

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
  const visualOpacity = getGlobalNumber("KNEX_PDF_VISUAL_TEXT_OPACITY", DEFAULT_VISUAL_TEXT_OPACITY, 0, 1);
  const fontFamily = resolveFontFamily(block);
  const fontWeight = resolveVisualFontWeight(block);
  const fontStyle = resolveFontStyle(block);

  /**
   * Ajustes controláveis em runtime para calibração fina sem recompilar.
   *
   * Exemplos no console:
   * globalThis.KNEX_PDF_VISUAL_TEXT_FONT_SCALE = 1.02
   * globalThis.KNEX_PDF_VISUAL_TEXT_Y_OFFSET = -0.5
   * globalThis.KNEX_PDF_VISUAL_TEXT_FIT_MIN = 0.65
   * globalThis.KNEX_PDF_VISUAL_TEXT_FIT_MAX = 1.5
   */
  const fontScale = getGlobalNumber(
    "KNEX_PDF_VISUAL_TEXT_FONT_SCALE",
    1,
    0.75,
    1.35,
  );
  const lineHeightScale = getGlobalNumber(
    "KNEX_PDF_VISUAL_TEXT_LINE_HEIGHT_SCALE",
    1,
    0.75,
    1.5,
  );
  const offsetX = getGlobalNumber("KNEX_PDF_VISUAL_TEXT_X_OFFSET", 0, -20, 20);
  const offsetY = getGlobalNumber("KNEX_PDF_VISUAL_TEXT_Y_OFFSET", 0, -20, 20);
  const minFitScaleX = getGlobalNumber(
    "KNEX_PDF_VISUAL_TEXT_FIT_MIN",
    MIN_VISUAL_TEXT_FIT_SCALE_X,
    0.4,
    1,
  );
  const maxFitScaleX = getGlobalNumber(
    "KNEX_PDF_VISUAL_TEXT_FIT_MAX",
    MAX_VISUAL_TEXT_FIT_SCALE_X,
    1,
    2.5,
  );

  const safeFontSize = Math.max(1, fontSize * fontScale);

  /**
   * Para o modo visual por palavra, o texto precisa caber na caixa local do PDF.
   *
   * A largura natural é medida com a fonte CSS resolvida. Depois o scaleX
   * ajusta a palavra para a caixa do PDF. Isso evita que o span fique
   * comprimido por width CSS e mantém o texto nítido.
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
    minFitScaleX,
    maxFitScaleX,
  );
  const enableScaleX = shouldUseVisualScaleX();
  const resolvedLetterSpacing = enableScaleX
    ? typeof block.letterSpacing === "number" && Number.isFinite(block.letterSpacing)
      ? block.letterSpacing
      : undefined
    : resolveVisualLetterSpacing({
        block,
        text: block.text,
        targetWidth,
        measuredTextWidth,
      });

  const safeLineHeight = Math.max(
    safeFontSize,
    safeNumber(lineHeight, safeFontSize) * lineHeightScale,
  );

  const visualHeight = Math.max(
    safeLineHeight,
    safeNumber(block.height, safeLineHeight),
  );

  const transform = resolveVisualTransform({
    block,
    fitScaleX,
    enableScaleX,
  });

  return {
    left: px(safeNumber(block.x) + offsetX),
    top: px(safeNumber(block.y) + offsetY),
    /*
     * Sem scaleX por padrão. O layout usa a largura-alvo do PDF e o ajuste
     * fino horizontal é feito por letter-spacing. Isso preserva o texto como
     * fonte vetorial real no navegador e reduz blur/serrilhado.
     */
    width: `${enableScaleX ? measuredTextWidth : targetWidth}px`,
    height: `${visualHeight}px`,
    minHeight: `${visualHeight}px`,
    fontFamily,
    fontSize: `${safeFontSize}px`,
    fontWeight,
    fontStyle,
    lineHeight: `${safeLineHeight}px`,
    letterSpacing:
      typeof resolvedLetterSpacing === "number" &&
      Number.isFinite(resolvedLetterSpacing)
        ? `${resolvedLetterSpacing}px`
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
    fontKerning: "normal",
    fontVariantLigatures: "normal",
    fontSynthesis: "none",
    textRendering: "geometricPrecision",
    WebkitFontSmoothing: "antialiased",
  };
}

function roundForVisualSignature(value: number, precision = 2): number {
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

function getVisualBlockSignature(block: PdfTextLayerBlock): string {
  return [
    block.text.replace(/\s+/g, " ").trim(),
    roundForVisualSignature(safeNumber(block.x), 1),
    roundForVisualSignature(safeNumber(block.y), 1),
    roundForVisualSignature(safeNumber(block.width), 1),
    roundForVisualSignature(safeNumber(block.height), 1),
    roundForVisualSignature(safeNumber(block.fontSize), 1),
  ].join("|");
}

function visualBlocksOverlap(a: PdfTextLayerBlock, b: PdfTextLayerBlock): boolean {
  const ax = safeNumber(a.x);
  const ay = safeNumber(a.y);
  const aw = safeNumber(a.width);
  const ah = safeNumber(a.height);
  const bx = safeNumber(b.x);
  const by = safeNumber(b.y);
  const bw = safeNumber(b.width);
  const bh = safeNumber(b.height);

  const overlapX = Math.max(0, Math.min(ax + aw, bx + bw) - Math.max(ax, bx));
  const overlapY = Math.max(0, Math.min(ay + ah, by + bh) - Math.max(ay, by));
  const overlapArea = overlapX * overlapY;
  const minArea = Math.max(1, Math.min(aw * ah, bw * bh));

  return overlapArea / minArea > 0.82;
}

function shouldDropAsVisualDuplicate(input: {
  candidate: PdfTextLayerBlock;
  accepted: PdfTextLayerBlock[];
}): boolean {
  const candidateText = input.candidate.text.replace(/\s+/g, " ").trim();

  if (!candidateText) return true;

  return input.accepted.some((accepted) => {
    const acceptedText = accepted.text.replace(/\s+/g, " ").trim();

    if (!acceptedText) return false;

    if (candidateText === acceptedText && visualBlocksOverlap(input.candidate, accepted)) {
      return true;
    }

    /*
     * Alguns PDFs entregam o mesmo texto duas vezes: uma como palavra/frase e
     * outra como bloco maior praticamente no mesmo retângulo. Nesse caso,
     * renderizar ambos dá aparência de negrito.
     */
    const textContains =
      acceptedText.includes(candidateText) || candidateText.includes(acceptedText);

    return textContains && visualBlocksOverlap(input.candidate, accepted);
  });
}

function dedupeVisualTextBlocks(blocks: PdfTextLayerBlock[]): PdfTextLayerBlock[] {
  const seen = new Set<string>();
  const accepted: PdfTextLayerBlock[] = [];

  for (const block of blocks) {
    const signature = getVisualBlockSignature(block);

    if (seen.has(signature)) {
      continue;
    }

    if (shouldDropAsVisualDuplicate({ candidate: block, accepted })) {
      continue;
    }

    seen.add(signature);
    accepted.push(block);
  }

  return accepted;
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

  const isVisualMode = mode === "visual" || mode === "hybrid";

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

  const renderBlocks = useMemo(
    () => (isVisualMode ? dedupeVisualTextBlocks(blocks) : blocks),
    [blocks, isVisualMode],
  );

  return (
    <div
      className={rootClassName}
      data-knexread-text-layer={mode}
      data-knexread-text-layer-mode={mode}
      data-knexread-visual-debug={visualDebug ? "true" : "false"}
      data-knexread-text-layer-block-count={blocks.length}
      data-knexread-text-layer-rendered-block-count={renderBlocks.length}
      data-pdf-page-number={pageNumber}
      aria-hidden={isVisualMode ? true : undefined}
      style={
        {
          "--knex-pdf-selection-background": selectionBackground,
          "--knex-pdf-visual-text-color": visualTextColor,
          "--knex-pdf-visual-text-opacity": isVisualMode
            ? getGlobalNumber(
                "KNEX_PDF_VISUAL_TEXT_OPACITY",
                DEFAULT_VISUAL_TEXT_OPACITY,
                0,
                1,
              )
            : 1,
        } as CSSProperties
      }
    >
      {renderBlocks.map((block) => {
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
            data-pdf-computed-font-family={
              isVisualMode ? String(style.fontFamily ?? "") : undefined
            }
            data-pdf-computed-font-weight={
              isVisualMode ? String(style.fontWeight ?? "") : undefined
            }
            data-pdf-computed-letter-spacing={
              isVisualMode ? String(style.letterSpacing ?? "") : undefined
            }
            data-pdf-computed-transform={
              isVisualMode ? String(style.transform ?? "") : undefined
            }
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