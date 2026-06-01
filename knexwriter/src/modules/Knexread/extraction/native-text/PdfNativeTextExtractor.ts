import type { KnexPdfTextBlock } from "../../native-pdf-reader/knex-pdf-engine";
import type { NativePdfSession } from "../../native-pdf-reader/services";
import { extractPdfiumPageText } from "../../backends/pdfium/PdfiumNonTextRenderer";

type PdfJsTextItem = {
  str?: string;
  width?: number;
  height?: number;
  transform?: number[];
  fontName?: string;
};

type PdfJsTextContent = {
  items?: PdfJsTextItem[];
  styles?: Record<
    string,
    {
      fontFamily?: string;
      ascent?: number;
      descent?: number;
      vertical?: boolean;
    }
  >;
};

type PdfJsViewport = {
  transform?: number[];
  width: number;
  height: number;
};

type PdfJsPage = {
  getViewport: (params: { scale: number }) => PdfJsViewport;
  getTextContent: (params?: {
    includeMarkedContent?: boolean;
    disableNormalization?: boolean;
  }) => Promise<PdfJsTextContent>;
};

export type PdfNativeTextExtractionResult = {
  pageNumber: number;
  scale: number;
  blocks: KnexPdfTextBlock[];
  confidence: number;
  source: "native";
};

function multiplyTransform(left: number[], right: number[]): number[] {
  return [
    left[0] * right[0] + left[2] * right[1],
    left[1] * right[0] + left[3] * right[1],
    left[0] * right[2] + left[2] * right[3],
    left[1] * right[2] + left[3] * right[3],
    left[0] * right[4] + left[2] * right[5] + left[4],
    left[1] * right[4] + left[3] * right[5] + left[5],
  ];
}

function safeTransform(transform: number[] | undefined): number[] {
  return transform && transform.length >= 6
    ? transform.slice(0, 6)
    : [1, 0, 0, 1, 0, 0];
}

function inferFontFamily(
  item: PdfJsTextItem,
  textContent: PdfJsTextContent,
): string {
  const family = item.fontName ? textContent.styles?.[item.fontName]?.fontFamily : "";
  if (family && family.trim().length > 0) return family;
  if (item.fontName?.toLowerCase().includes("serif")) return "serif";
  return "Arial, sans-serif";
}

function inferFontWeight(fontName: string | undefined): string {
  return fontName && /bold|black|heavy/i.test(fontName) ? "700" : "400";
}

function inferFontStyle(fontName: string | undefined): "normal" | "italic" {
  return fontName && /italic|oblique/i.test(fontName) ? "italic" : "normal";
}

function buildTextBlock(input: {
  item: PdfJsTextItem;
  textContent: PdfJsTextContent;
  viewport: PdfJsViewport;
  pageNumber: number;
  index: number;
  scale: number;
}): KnexPdfTextBlock | null {
  const text = input.item.str ?? "";
  if (text.trim().length === 0) return null;

  const viewportTransform = safeTransform(input.viewport.transform);
  const itemTransform = safeTransform(input.item.transform);
  const transform = multiplyTransform(viewportTransform, itemTransform);
  const fontSize = Math.max(1, Math.hypot(transform[2], transform[3]));
  const width = Math.max(1, (input.item.width ?? text.length * fontSize * 0.5) * input.scale);
  const height = Math.max(1, (input.item.height ?? fontSize) * input.scale);
  const x = transform[4];
  const y = transform[5] - height;

  return {
    id: `native-text-${input.pageNumber}-${input.index}`,
    pageNumber: input.pageNumber,
    text,
    x,
    y,
    width,
    height,
    fontFamily: inferFontFamily(input.item, input.textContent),
    fontName: input.item.fontName,
    fontSize,
    fontWeight: inferFontWeight(input.item.fontName),
    fontStyle: inferFontStyle(input.item.fontName),
    color: "rgb(0, 0, 0)",
    align: "left",
    lineHeight: height,
    letterSpacing: 0,
    readingOrder: input.index,
    lineIndex: input.index,
    paragraphIndex: input.index,
    sourceBackend: "pdfjs",
    visualRole: "body",
    textRenderMode: "hybrid",
    opacity: 1,
    rotation: 0,
    scaleX: 1,
    scaleY: 1,
    transform: transform as [number, number, number, number, number, number],
    confidence: 0.88,
    decorative: false,
    rasterized: false,
  };
}

export async function extractPdfNativeText(input: {
  session: NativePdfSession;
  pageNumber: number;
  scale: number;
  signal?: AbortSignal;
}): Promise<PdfNativeTextExtractionResult> {
  if (input.signal?.aborted) {
    throw new DOMException("Native text extraction aborted.", "AbortError");
  }

  try {
    const pdfiumBlocks = await extractPdfiumPageText({
      session: input.session,
      pageNumber: input.pageNumber,
      scale: input.scale,
      signal: input.signal,
    });

    if (pdfiumBlocks.length > 0) {
      const confidence =
        pdfiumBlocks.reduce(
          (sum, block) => sum + (block.confidence ?? 0.9),
          0,
        ) / pdfiumBlocks.length;

      return {
        pageNumber: input.pageNumber,
        scale: input.scale,
        blocks: pdfiumBlocks,
        confidence,
        source: "native",
      };
    }
  } catch {
    // PDFium is preferred, but PDF.js remains the compatibility extractor.
  }

  const page = (await input.session.pdf.getPage(input.pageNumber)) as PdfJsPage;
  const viewport = page.getViewport({ scale: input.scale });
  const textContent = await page.getTextContent({
    includeMarkedContent: false,
    disableNormalization: false,
  });

  if (input.signal?.aborted) {
    throw new DOMException("Native text extraction aborted.", "AbortError");
  }

  const blocks = (textContent.items ?? [])
    .map((item, index) =>
      buildTextBlock({
        item,
        textContent,
        viewport,
        pageNumber: input.pageNumber,
        index,
        scale: input.scale,
      }),
    )
    .filter((block): block is KnexPdfTextBlock => Boolean(block));

  const confidence =
    blocks.length > 0
      ? blocks.reduce((sum, block) => sum + (block.confidence ?? 0.88), 0) /
        blocks.length
      : 0;

  return {
    pageNumber: input.pageNumber,
    scale: input.scale,
    blocks,
    confidence,
    source: "native",
  };
}
