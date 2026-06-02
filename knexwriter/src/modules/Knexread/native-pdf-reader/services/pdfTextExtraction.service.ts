import { normalizePdfText } from "../utils";
import type { PdfTextAnchor } from "../types";
import type { KnexPdfTextBlock as PdfTextBlock } from "../knex-pdf-engine";
import type { NativePdfSession } from "./pdfLoader.service";

export function buildTextAnchorFromSelection(input: {
  pageNumber: number;
  selectedText: string;
  pageBlocks: PdfTextBlock[];
}): PdfTextAnchor {
  const selected = normalizePdfText(input.selectedText);
  const pageText = normalizePdfText(input.pageBlocks.map((item) => item.text).join(" "));
  const startOffset = pageText.toLowerCase().indexOf(selected.toLowerCase());
  const endOffset =
    startOffset >= 0 ? startOffset + selected.length : undefined;

  const textBefore =
    startOffset > 0
      ? pageText.slice(Math.max(0, startOffset - 60), startOffset).trim()
      : undefined;
  const textAfter =
    endOffset != null
      ? pageText.slice(endOffset, Math.min(pageText.length, endOffset + 60)).trim()
      : undefined;

  return {
    pageNumber: input.pageNumber,
    exactText: selected,
    textBefore,
    textAfter,
    startOffset: startOffset >= 0 ? startOffset : undefined,
    endOffset,
    confidence: startOffset >= 0 ? "high" : "medium",
  };
}

export async function probePdfTextLayer(input: {
  session: NativePdfSession;
  maxPages?: number;
  minCharsPerPage?: number;
}) {
  const maxPages = Math.max(1, input.maxPages ?? 3);
  const minCharsPerPage = Math.max(12, input.minCharsPerPage ?? 24);
  const limit = Math.min(input.session.pageCount, maxPages);

  let pagesWithText = 0;
  let inspectedPages = 0;

  for (let pageNumber = 1; pageNumber <= limit; pageNumber += 1) {
    inspectedPages += 1;
    const page = await input.session.pdf.getPage(pageNumber);
    const textContent = await page.getTextContent({
      disableCombineTextItems: false,
      normalizeWhitespace: false,
    });

    const text = normalizePdfText(
      (textContent.items ?? [])
        .map((item) => (typeof item.str === "string" ? item.str : ""))
        .join(" "),
    );

    if (text.length >= minCharsPerPage) {
      pagesWithText += 1;
    }
  }

  const hasTextLayer = pagesWithText > 0;
  const likelyImageOnly = !hasTextLayer;

  return {
    hasTextLayer,
    likelyImageOnly,
    inspectedPages,
    pagesWithText,
    ocrRecommended: likelyImageOnly,
    ocrAutomaticallyApplied: false,
  };
}
