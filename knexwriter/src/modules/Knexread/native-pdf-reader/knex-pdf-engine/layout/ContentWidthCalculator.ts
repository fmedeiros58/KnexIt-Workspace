import { KNEX_PDF_DEFAULT_PAGE_GAP } from "../core/engineConfig";

export function calculateKnexPdfContentWidth(input: {
  sourcePageWidth: number;
  mode: "single" | "sideBySide";
  translationPageWidth?: number;
  gap?: number;
}) {
  if (input.mode === "sideBySide") {
    return (
      input.sourcePageWidth +
      (input.gap ?? KNEX_PDF_DEFAULT_PAGE_GAP) +
      (input.translationPageWidth ?? input.sourcePageWidth)
    );
  }
  return input.sourcePageWidth;
}
