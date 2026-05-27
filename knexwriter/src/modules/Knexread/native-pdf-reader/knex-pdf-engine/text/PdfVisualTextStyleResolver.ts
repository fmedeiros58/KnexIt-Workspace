import type { KnexPdfTextBlock } from "../core/engineTypes";

export type KnexPdfVisualTextRole =
  | "body"
  | "title"
  | "heading"
  | "caption"
  | "page-number"
  | "unknown";

export type KnexPdfVisualTextStyle = {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: "normal" | "italic";
  lineHeight: number;
  letterSpacing?: number;
  color: string;
  opacity: number;
  visualRole: KnexPdfVisualTextRole;
};

type VisualTextBlockMetadata = Omit<
  KnexPdfTextBlock,
  | "fontFamily"
  | "fontName"
  | "fontWeight"
  | "fontStyle"
  | "lineHeight"
  | "letterSpacing"
  | "color"
  | "opacity"
  | "visualRole"
  | "confidence"
> & {
  fontFamily?: string;
  fontName?: string;
  sourceFontName?: string;
  fontWeight?: string | number;
  fontStyle?: string;
  lineHeight?: number;
  letterSpacing?: number;
  color?: string;
  opacity?: number;
  visualRole?: KnexPdfVisualTextRole | string;
  confidence?: number;
};

const DEFAULT_TEXT_COLOR = "#000000";
const DEFAULT_BODY_FONT_SIZE = 12;
const MIN_VISUAL_FONT_SIZE = 1;
const MAX_VISUAL_FONT_SIZE = 240;

const SANS_FALLBACK = `Arial, Helvetica, "Liberation Sans", sans-serif`;
const SERIF_FALLBACK = `"Times New Roman", Times, Georgia, serif`;
const MONO_FALLBACK = `"Courier New", Courier, Consolas, monospace`;
const SYMBOL_FALLBACK = `Symbol, "Segoe UI Symbol", serif`;

function safeNumber(value: number | null | undefined, fallback = 0): number {
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

function stripPdfSubsetPrefix(value: string): string {
  return value.replace(/^[A-Z]{6}\+/, "");
}

function normalizeFontToken(value: string | null | undefined): string {
  if (!value) return "";

  return stripPdfSubsetPrefix(value)
    .replace(/["']/g, "")
    .replace(/-/g, " ")
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isInternalFontDescriptor(value: string | null | undefined): boolean {
  const normalized = normalizeFontToken(value).toLowerCase();

  if (!normalized) return true;

  return (
    normalized === "pdfium" ||
    normalized === "pdfium line inferred" ||
    normalized === "pdfium word inferred" ||
    normalized === "pdfjs" ||
    normalized === "pdf js" ||
    normalized.includes("inferred") ||
    normalized.includes("unknown") ||
    normalized.includes("undefined") ||
    normalized.includes("null")
  );
}

function splitFontFamilyStack(value: string | null | undefined): string[] {
  if (!value) return [];

  return value
    .split(",")
    .map((item) => normalizeFontToken(item))
    .filter((item) => item.length > 0 && !isInternalFontDescriptor(item));
}

function quoteFontFamilyName(value: string): string {
  const cleaned = normalizeFontToken(value);

  if (!cleaned) return "";
  if (/^(serif|sans-serif|monospace|cursive|fantasy|system-ui)$/i.test(cleaned)) {
    return cleaned.toLowerCase();
  }

  if (/^[a-zA-Z0-9]+$/.test(cleaned)) {
    return cleaned;
  }

  return `"${cleaned.replace(/"/g, "")}"`;
}

function uniqueValues(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const key = normalizeFontToken(value).toLowerCase();
    if (!key || seen.has(key)) continue;

    seen.add(key);
    result.push(value);
  }

  return result;
}

function getFontCandidates(block: VisualTextBlockMetadata): string[] {
  const fontNameCandidates = [block.fontName, block.sourceFontName]
    .filter((value): value is string => typeof value === "string")
    .map(normalizeFontToken)
    .filter((value) => value.length > 0 && !isInternalFontDescriptor(value));

  const familyCandidates = splitFontFamilyStack(block.fontFamily);

  return uniqueValues([...fontNameCandidates, ...familyCandidates]);
}

function getFontDescriptorForWeightAndStyle(
  block: VisualTextBlockMetadata,
): string {
  return [block.fontName, block.sourceFontName, block.fontFamily]
    .filter((value): value is string => typeof value === "string")
    .map(normalizeFontToken)
    .join(" ")
    .toLowerCase();
}

function isWordGranularityBlock(block: VisualTextBlockMetadata): boolean {
  const id = typeof block.id === "string" ? block.id.toLowerCase() : "";
  const text = typeof block.text === "string" ? block.text.trim() : "";

  if (id.includes("pdfium-word")) return true;
  if (!text) return false;

  /**
   * Na estratégia atual, a camada visual é preferencialmente por palavra.
   * Uma palavra isolada não deve virar heading só porque está em caixa alta.
   */
  return !/\s/.test(text) && text.length <= 32;
}

function normalizeVisualRole(
  role: VisualTextBlockMetadata["visualRole"],
): KnexPdfVisualTextRole | undefined {
  if (role === "body") return "body";
  if (role === "title") return "title";
  if (role === "heading" || role === "header" || role === "subtitle") {
    return "heading";
  }
  if (role === "caption" || role === "footer" || role === "table") {
    return "caption";
  }
  if (role === "page-number") return "page-number";
  if (role === "unknown") return "unknown";

  return undefined;
}

function inferVisualRole(block: VisualTextBlockMetadata): KnexPdfVisualTextRole {
  const text = block.text.trim();
  const fontSize = safeNumber(block.fontSize, DEFAULT_BODY_FONT_SIZE);
  const trimmedLength = text.length;
  const wordGranularity = isWordGranularityBlock(block);
  const isUpper =
    trimmedLength > 2 &&
    text === text.toUpperCase() &&
    /[A-ZÀ-Ý]/.test(text);

  if (!text) return "unknown";
  if (/^\d+$/.test(text) && fontSize <= 12) return "page-number";
  if (fontSize >= 24) return "title";

  /**
   * Com blocos por palavra, caixa alta sozinha não é sinal confiável de título.
   * Antes, quando o bloco era linha inteira, essa heurística fazia sentido.
   * Agora ela engrossa palavras soltas e muda a aparência em zoom baixo.
   */
  if (fontSize >= 18) return "heading";
  if (!wordGranularity && fontSize >= 16 && trimmedLength > 8) return "heading";
  if (!wordGranularity && isUpper && trimmedLength > 12) return "heading";
  if (fontSize <= 9) return "caption";

  return "body";
}

function classifyFontFamily(
  candidates: string[],
): "sans" | "serif" | "mono" | "symbol" | "unknown" {
  const normalized = candidates.join(" ").toLowerCase();

  if (
    normalized.includes("symbol") ||
    normalized.includes("wingdings") ||
    normalized.includes("zapf")
  ) {
    return "symbol";
  }

  if (
    normalized.includes("courier") ||
    normalized.includes("consolas") ||
    normalized.includes("monaco") ||
    normalized.includes("mono")
  ) {
    return "mono";
  }

  if (
    normalized.includes("times") ||
    normalized.includes("cambria") ||
    normalized.includes("georgia") ||
    normalized.includes("garamond") ||
    normalized.includes("palatino") ||
    normalized.includes("serif")
  ) {
    return "serif";
  }

  if (
    normalized.includes("arial") ||
    normalized.includes("helvetica") ||
    normalized.includes("calibri") ||
    normalized.includes("aptos") ||
    normalized.includes("segoe") ||
    normalized.includes("univers") ||
    normalized.includes("roboto") ||
    normalized.includes("sans")
  ) {
    return "sans";
  }

  return "unknown";
}

function fallbackForFamilyKind(
  kind: "sans" | "serif" | "mono" | "symbol" | "unknown",
): string {
  if (kind === "serif") return SERIF_FALLBACK;
  if (kind === "mono") return MONO_FALLBACK;
  if (kind === "symbol") return SYMBOL_FALLBACK;

  return SANS_FALLBACK;
}

function resolveFontFamily(block: VisualTextBlockMetadata): string {
  const forced = (globalThis as unknown as Record<string, unknown>)
    .KNEX_PDF_VISUAL_TEXT_FONT_FAMILY;

  if (typeof forced === "string" && forced.trim().length > 0) {
    return forced.trim();
  }

  const candidates = getFontCandidates(block);
  const kind = classifyFontFamily(candidates);
  const fallback = fallbackForFamilyKind(kind);

  if (candidates.length === 0) {
    return fallback;
  }

  const quotedCandidates = candidates
    .map(quoteFontFamilyName)
    .filter((value) => value.length > 0);

  if (quotedCandidates.length === 0) {
    return fallback;
  }

  return `${quotedCandidates.join(", ")}, ${fallback}`;
}

function resolveFontWeight(
  block: VisualTextBlockMetadata,
  role: KnexPdfVisualTextRole,
): string {
  const explicit = String(block.fontWeight ?? "").toLowerCase().trim();
  const descriptor = getFontDescriptorForWeightAndStyle(block);
  const wordGranularity = isWordGranularityBlock(block);

  if (
    explicit === "bold" ||
    explicit === "bolder" ||
    explicit === "600" ||
    explicit === "700" ||
    explicit === "800" ||
    explicit === "900" ||
    descriptor.includes("bold") ||
    descriptor.includes("black") ||
    descriptor.includes("heavy")
  ) {
    return "700";
  }

  if (
    explicit === "500" ||
    explicit === "medium" ||
    descriptor.includes("medium") ||
    descriptor.includes("semibold")
  ) {
    return "500";
  }

  if (
    explicit === "300" ||
    explicit === "200" ||
    explicit === "100" ||
    explicit === "lighter" ||
    descriptor.includes("light") ||
    descriptor.includes("thin")
  ) {
    return "300";
  }

  /**
   * No modo por palavra, não engrossar por inferência.
   * O negrito artificial altera a largura local da palavra e piora o ajuste
   * dentro da caixa extraída pelo PDFium.
   */
  if (wordGranularity) {
    return "400";
  }

  if (role === "title" || role === "heading") {
    return "500";
  }

  return "400";
}

function resolveFontStyle(block: VisualTextBlockMetadata): "normal" | "italic" {
  const explicit = String(block.fontStyle ?? "").toLowerCase().trim();
  const descriptor = getFontDescriptorForWeightAndStyle(block);

  if (
    explicit === "italic" ||
    explicit === "oblique" ||
    descriptor.includes("italic") ||
    descriptor.includes("oblique")
  ) {
    return "italic";
  }

  return "normal";
}

function resolveFontSize(block: VisualTextBlockMetadata): number {
  return clampNumber(
    block.fontSize,
    MIN_VISUAL_FONT_SIZE,
    MAX_VISUAL_FONT_SIZE,
    DEFAULT_BODY_FONT_SIZE,
  );
}

function resolveLineHeight(
  block: VisualTextBlockMetadata,
  fontSize: number,
): number {
  const explicitLineHeight = safeNumber(block.lineHeight, 0);
  const blockHeight = safeNumber(block.height, 0);
  const wordGranularity = isWordGranularityBlock(block);

  if (explicitLineHeight > 0) {
    return clampNumber(
      explicitLineHeight,
      Math.max(1, fontSize * 0.82),
      Math.max(1, fontSize * (wordGranularity ? 1.18 : 1.32)),
      fontSize,
    );
  }

  if (blockHeight > 0) {
    return clampNumber(
      blockHeight,
      Math.max(1, fontSize * 0.82),
      Math.max(1, fontSize * (wordGranularity ? 1.18 : 1.32)),
      fontSize,
    );
  }

  return Math.max(1, fontSize * (wordGranularity ? 1 : 1.05));
}

function resolveLetterSpacing(block: VisualTextBlockMetadata): number | undefined {
  const value = safeNumber(block.letterSpacing, 0);

  if (Math.abs(value) < 0.001) {
    return undefined;
  }

  /**
   * Em bloco por palavra, letter-spacing ruidoso fica muito perceptível.
   * Mantemos uma faixa mais conservadora.
   */
  return clampNumber(value, -1, 2, 0);
}

function resolveColor(block: VisualTextBlockMetadata): string {
  if (typeof block.color === "string" && block.color.trim().length > 0) {
    return block.color;
  }

  return DEFAULT_TEXT_COLOR;
}

function resolveOpacity(block: VisualTextBlockMetadata): number {
  return clampNumber(block.opacity, 0, 1, 1);
}

export function resolveKnexPdfVisualTextStyle(
  block: KnexPdfTextBlock,
): KnexPdfVisualTextStyle {
  const visualBlock = block as VisualTextBlockMetadata;
  const explicitRole = normalizeVisualRole(visualBlock.visualRole);
  const visualRole = explicitRole ?? inferVisualRole(visualBlock);
  const fontSize = resolveFontSize(visualBlock);

  return {
    fontFamily: resolveFontFamily(visualBlock),
    fontSize,
    fontWeight: resolveFontWeight(visualBlock, visualRole),
    fontStyle: resolveFontStyle(visualBlock),
    lineHeight: resolveLineHeight(visualBlock, fontSize),
    letterSpacing: resolveLetterSpacing(visualBlock),
    color: resolveColor(visualBlock),
    opacity: resolveOpacity(visualBlock),
    visualRole,
  };
}

export function isKnexPdfVisualTextLayerEnabled(): boolean {
  const experimental = (globalThis as unknown as Record<string, unknown>)
    .KNEX_PDF_EXPERIMENTAL_VISUAL_TEXT_LAYER;
  const value = (globalThis as unknown as Record<string, unknown>)
    .KNEX_PDF_VISUAL_TEXT_LAYER;
  const forced = (globalThis as unknown as Record<string, unknown>)
    .KNEX_PDF_FORCE_VISUAL_TEXT_LAYER;

  if (
    experimental !== true &&
    experimental !== "true" &&
    experimental !== "1"
  ) {
    return false;
  }

  return (
    value === true ||
    value === "true" ||
    value === "visual" ||
    value === "hybrid" ||
    forced === true ||
    forced === "true"
  );
}
