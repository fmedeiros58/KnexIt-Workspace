import { useCallback, useState } from "react";
import type { PdfTextSelection } from "../types";
import { toNormalizedRect } from "../utils";
import { buildTextAnchorFromSelection } from "../services";
import type { KnexPdfTextBlock as PdfTextBlock } from "../knex-pdf-engine";

export function usePdfSelection() {
  const [selection, setSelection] = useState<PdfTextSelection | null>(null);

  const clearSelection = useCallback(() => {
    setSelection(null);
    if (typeof window !== "undefined") {
      window.getSelection()?.removeAllRanges();
    }
  }, []);

  return {
    selection,
    setSelection,
    clearSelection,
  };
}

export function capturePdfSelectionFromRange(input: {
  pageNumber: number;
  pageBlocks: PdfTextBlock[];
  range: Range;
  pageElement: HTMLElement;
}): PdfTextSelection | null {
  const selectedText = input.range.toString().trim();
  if (!selectedText) return null;

  const pageRect = input.pageElement.getBoundingClientRect();
  const rects = Array.from(input.range.getClientRects())
    .map((clientRect) =>
      toNormalizedRect({
        pageNumber: input.pageNumber,
        pageWidth: pageRect.width,
        pageHeight: pageRect.height,
        x: clientRect.left - pageRect.left,
        y: clientRect.top - pageRect.top,
        width: clientRect.width,
        height: clientRect.height,
      }),
    )
    .filter((rect) => rect.width > 0 && rect.height > 0);

  if (!rects.length) return null;

  const anchor = buildTextAnchorFromSelection({
    pageNumber: input.pageNumber,
    selectedText,
    pageBlocks: input.pageBlocks,
  });

  return {
    pageNumber: input.pageNumber,
    selectedText,
    rects,
    anchor,
  };
}
