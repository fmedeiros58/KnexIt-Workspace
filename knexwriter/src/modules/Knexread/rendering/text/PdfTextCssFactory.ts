import type { CSSProperties } from "react";
import type { PdfVisualTextRun } from "./PdfVisualTextModelBuilder";

export function createPdfTextRunStyle(run: PdfVisualTextRun): CSSProperties {
  return {
    position: "absolute",
    left: `${run.left}px`,
    top: `${run.top}px`,
    width: `${Math.max(1, run.width)}px`,
    height: `${Math.max(1, run.height)}px`,
    fontFamily: run.fontFamily,
    fontSize: `${Math.max(1, run.fontSize)}px`,
    fontWeight: run.fontWeight,
    fontStyle: run.fontStyle,
    lineHeight: `${Math.max(1, run.lineHeight)}px`,
    letterSpacing: `${run.letterSpacing}px`,
    color: run.color,
    opacity: run.opacity,
    whiteSpace: "pre",
    overflow: "visible",
    transformOrigin: "0 0",
    textRendering: "geometricPrecision",
    WebkitFontSmoothing: "antialiased",
    MozOsxFontSmoothing: "grayscale",
    pointerEvents: "auto",
    userSelect: "text",
  };
}
