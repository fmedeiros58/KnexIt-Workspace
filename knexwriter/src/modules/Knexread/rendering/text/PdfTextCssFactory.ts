import type { CSSProperties } from "react";
import type { PdfVisualTextRun } from "./PdfVisualTextModelBuilder";
import { resolvePdfFontFamily } from "./PdfTextFontResolver";

type PdfTextRunWithFallbackGeometry = PdfVisualTextRun & {
  x?: number;
  y?: number;
};

function safeNumber(
  value: number | null | undefined,
  fallback: number,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function safePositiveNumber(
  value: number | null | undefined,
  fallback: number,
): number {
  const safeValue = safeNumber(value, fallback);

  return safeValue > 0 ? safeValue : fallback;
}

function createPdfTextTransform(run: PdfVisualTextRun): string | undefined {
  if (!run.transform) return undefined;

  const [a, b, c, d] = run.transform;
  const fontSize = safePositiveNumber(run.fontSize, 1);

  const normalizedA = safeNumber(a, fontSize) / fontSize;
  const normalizedB = safeNumber(b, 0) / fontSize;
  const normalizedC = safeNumber(c, 0) / fontSize;
  const normalizedD = safeNumber(d, fontSize) / fontSize;

  const axisAligned =
    Math.abs(normalizedB) < 0.001 && Math.abs(normalizedC) < 0.001;

  const identityLike =
    axisAligned &&
    Math.abs(Math.abs(normalizedA) - 1) < 0.05 &&
    Math.abs(Math.abs(normalizedD) - 1) < 0.05;

  if (identityLike) return undefined;

  return `matrix(${normalizedA}, ${normalizedB}, ${normalizedC}, ${normalizedD}, 0, 0)`;
}

export function createPdfTextRunStyle(run: PdfVisualTextRun): CSSProperties {
  const runWithFallbackGeometry = run as PdfTextRunWithFallbackGeometry;

  const left = safeNumber(
    runWithFallbackGeometry.left,
    safeNumber(runWithFallbackGeometry.x, 0),
  );
  const top = safeNumber(
    runWithFallbackGeometry.top,
    safeNumber(runWithFallbackGeometry.y, 0),
  );

  const fontSize = safePositiveNumber(run.fontSize, 12);
  const width = safePositiveNumber(
    run.width,
    Math.max(1, run.text.length * fontSize * 0.5),
  );
  const height = safePositiveNumber(run.height, fontSize * 1.15);

  const lineHeight = safePositiveNumber(
    run.lineHeight,
    Math.max(height, fontSize * 1.05),
  );

  const letterSpacing = safeNumber(run.letterSpacing, 0);
  const wordSpacing = safeNumber(run.wordSpacing, 0);

  const fontFamily = resolvePdfFontFamily({
    fontFamily: run.fontFamily,
    fontName: run.fontName,
    text: run.text,
  });

  return {
    position: "absolute",
    left: `${left}px`,
    top: `${top}px`,
    width: `${Math.max(1, width)}px`,
    height: `${Math.max(1, height)}px`,

    display: "block",
    margin: 0,
    padding: 0,
    border: 0,
    boxSizing: "content-box",
    background: "transparent",

    fontFamily,
    fontSize: `${fontSize}px`,
    fontWeight: run.fontWeight ?? 400,
    fontStyle: run.fontStyle ?? "normal",
    lineHeight: `${lineHeight}px`,
    letterSpacing: `${letterSpacing}px`,
    wordSpacing: `${wordSpacing}px`,

    color: run.color ?? "rgb(0, 0, 0)",
    opacity: safeNumber(run.opacity, 1),

    whiteSpace: "pre",
    overflow: "visible",
    textAlign: "left",
    textTransform: "none",
    textIndent: 0,
    textDecoration: "none",

    transformOrigin: "0 0",
    transform: createPdfTextTransform(run),

    textRendering: "geometricPrecision",
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",

    pointerEvents: "auto",
    userSelect: "text",
    isolation: "isolate",
  };
}
