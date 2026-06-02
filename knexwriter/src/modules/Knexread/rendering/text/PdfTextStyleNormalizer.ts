import type { KnexPdfTextBlock } from "../../native-pdf-reader/knex-pdf-engine";
import {
  isGenericPdfFontFamily,
  isUiFontFamily,
  resolvePdfFontFamily,
} from "./PdfTextFontResolver";

type KnexPdfTextBlockWithOptionalMetrics = KnexPdfTextBlock & {
  wordSpacing?: number | null;
  baseline?: number | null;
};

function safeNumber(value: number | null | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function safePositiveNumber(
  value: number | null | undefined,
  fallback: number,
): number {
  const safeValue = safeNumber(value, fallback);

  return safeValue > 0 ? safeValue : fallback;
}

function normalizeFontWeight(value: string | number | null | undefined): string {
  const normalized = value?.toString().trim().toLowerCase() ?? "";

  if (normalized === "bold") return "700";
  if (normalized === "normal") return "400";

  const numeric = Number.parseInt(normalized, 10);

  if (Number.isFinite(numeric)) {
    return String(Math.min(900, Math.max(100, Math.round(numeric / 100) * 100)));
  }

  return "400";
}

function normalizeFontStyle(value: unknown): "normal" | "italic" {
  return String(value ?? "").toLowerCase().includes("italic")
    ? "italic"
    : "normal";
}

export function normalizePdfTextRunMetrics(block: KnexPdfTextBlock): {
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: "normal" | "italic";
  lineHeight: number;
  letterSpacing: number;
  wordSpacing: number;
  baseline: number;
  missingFontFamily: boolean;
  usedUiFontFamily: boolean;
  styleSource: "pdf" | "pdf-fallback";
} {
  const blockWithOptionalMetrics = block as KnexPdfTextBlockWithOptionalMetrics;

  const boxHeight = safePositiveNumber(block.height, 12);

  /*
   * Quando o PDF não traz fontSize, usar a altura inteira da caixa como fonte
   * costuma inflar o texto. A estimativa 0.82 da altura visual mantém o texto
   * mais próximo da caixa e reduz o efeito de HTML comum.
   */
  const inferredFontSize = Math.max(1, boxHeight * 0.82);
  const fontSize = safePositiveNumber(block.fontSize, inferredFontSize);

  const rawLineHeight = safePositiveNumber(
    block.lineHeight,
    Math.max(boxHeight, fontSize * 1.05),
  );

  /*
   * Evita line-height global de UI, como 24px para fonte 16px, mas também
   * evita line-height menor que a fonte, que causa recorte e aspecto quebrado.
   */
  const lineHeight = Math.max(
    fontSize,
    Math.min(rawLineHeight, Math.max(boxHeight, fontSize * 1.18)),
  );

  const rawFontFamily = block.fontFamily;
  const fontFamily = resolvePdfFontFamily({
    fontFamily: rawFontFamily,
    fontName: block.fontName,
    text: block.text,
  });

  const missingFontFamily = isGenericPdfFontFamily(rawFontFamily);
  const usedUiFontFamily = isUiFontFamily(rawFontFamily);
  const hasPdfFontName = Boolean(block.fontName?.trim());

  const baseline = safeNumber(
    blockWithOptionalMetrics.baseline,
    block.y + Math.min(boxHeight, lineHeight),
  );

  return {
    fontFamily,
    fontSize,
    fontWeight: normalizeFontWeight(block.fontWeight),
    fontStyle: normalizeFontStyle(block.fontStyle),
    lineHeight,
    letterSpacing: safeNumber(block.letterSpacing, 0),
    wordSpacing: safeNumber(blockWithOptionalMetrics.wordSpacing, 0),
    baseline,
    missingFontFamily,
    usedUiFontFamily,
    styleSource:
      missingFontFamily || usedUiFontFamily || !hasPdfFontName
        ? "pdf-fallback"
        : "pdf",
  };
}
