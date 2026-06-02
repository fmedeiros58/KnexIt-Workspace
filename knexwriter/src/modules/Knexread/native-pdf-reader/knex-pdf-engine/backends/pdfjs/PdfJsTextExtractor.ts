import type { PdfBackendPageHandle } from "../PdfRenderBackend";
import type { KnexPdfSemanticTextBlock } from "../../core/engineTypes";
import { normalizePdfText } from "../../../utils";

type PdfMatrix = [number, number, number, number, number, number];

type PdfJsTextStyle = {
  fontFamily?: string;
  ascent?: number;
  descent?: number;
  vertical?: boolean;
};

type PdfJsTextItemLike = {
  str?: string;
  transform?: number[];
  width?: number;
  height?: number;
  fontName?: string;
  dir?: string;
};

type PdfJsTextContentLike = {
  items: PdfJsTextItemLike[];
  styles?: Record<string, PdfJsTextStyle>;
};

type PdfJsViewportLike = {
  width: number;
  height: number;
  scale: number;
  transform?: number[];
};

type PdfJsPageLike = {
  getViewport: (params: { scale: number }) => PdfJsViewportLike;
  getTextContent: (params?: {
    disableCombineTextItems?: boolean;
    normalizeWhitespace?: boolean;
  }) => Promise<PdfJsTextContentLike>;
};

type TextCandidate = {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: "normal" | "italic";
  lineHeight: number;
  transform: PdfMatrix;
  baselineY: number;
};

type LineCluster = {
  index: number;
  baselineY: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  candidates: TextCandidate[];
};

const MIN_FONT_SIZE = 1;
const MIN_TEXT_WIDTH = 1;
const MIN_TEXT_HEIGHT = 1;

export class PdfJsTextExtractor {
  async extract(
    page: PdfBackendPageHandle,
    scale: number,
  ): Promise<KnexPdfSemanticTextBlock[]> {
    const backendPage = page.backendPage as PdfJsPageLike;
    const viewport = backendPage.getViewport({
      scale: normalizeScale(scale),
    });

    /**
     * Para uma camada textual precisa, não devemos pedir ao PDF.js para combinar
     * itens demais.
     *
     * disableCombineTextItems: true preserva melhor a geometria original dos
     * fragmentos de texto. Isso é mais adequado para seleção, citações e uma
     * futura camada vetorial de texto.
     */
    const textContent = await backendPage.getTextContent({
      disableCombineTextItems: true,
      normalizeWhitespace: false,
    });

    const viewportMatrix = normalizePdfMatrix(viewport.transform);

    const candidates = (textContent.items ?? [])
      .map((item) =>
        createTextCandidate({
          item,
          styles: textContent.styles ?? {},
          viewport,
          viewportMatrix,
        }),
      )
      .filter(Boolean) as TextCandidate[];

    candidates.sort(compareTextCandidates);

    const lines = createLineClusters(candidates);

    return candidates.map((candidate, index) => {
      const lineIndex = findLineIndexForCandidate(lines, candidate);
      const paragraphIndex = lineIndex;

      return {
        id: `p${page.pageNumber}-text-${index + 1}`,
        pageNumber: page.pageNumber,
        text: candidate.text,
        x: candidate.x,
        y: candidate.y,
        width: candidate.width,
        height: candidate.height,
        fontFamily: candidate.fontFamily,
        fontSize: candidate.fontSize,
        fontWeight: candidate.fontWeight,
        fontStyle: candidate.fontStyle,
        color: "#111111",
        align: "left" as const,
        lineHeight: candidate.lineHeight,
        letterSpacing: 0,
        readingOrder: index,
        lineIndex,
        paragraphIndex,
      };
    });
  }
}

function createTextCandidate(input: {
  item: PdfJsTextItemLike;
  styles: Record<string, PdfJsTextStyle>;
  viewport: PdfJsViewportLike;
  viewportMatrix: PdfMatrix;
}): TextCandidate | null {
  const { item, styles, viewport, viewportMatrix } = input;

  if (typeof item.str !== "string") return null;

  /**
   * Para a camada semântica, ainda normalizamos o texto para evitar lixo
   * invisível. Mas evitamos juntar linhas aqui.
   */
  const text = normalizePdfText(item.str);

  if (!text) return null;

  const itemMatrix = normalizePdfMatrix(item.transform);
  const transform = multiplyPdfMatrices(viewportMatrix, itemMatrix);

  /**
   * Em PDF.js, depois da multiplicação pela viewport, transform[4]/[5]
   * indicam posição de baseline no viewport.
   */
  const baselineX = safeNumber(transform[4], 0);
  const baselineY = safeNumber(transform[5], 0);

  const style = styles[item.fontName ?? ""] ?? {};

  const fontSize = Math.max(
    MIN_FONT_SIZE,
    estimateFontSize({
      transform,
      itemHeight: item.height,
      viewportScale: viewport.scale,
    }),
  );

  const width = Math.max(
    MIN_TEXT_WIDTH,
    estimateTextWidth({
      itemWidth: item.width,
      viewportScale: viewport.scale,
      text,
      fontSize,
    }),
  );

  const height = Math.max(
    MIN_TEXT_HEIGHT,
    estimateTextHeight({
      style,
      itemHeight: item.height,
      viewportScale: viewport.scale,
      fontSize,
    }),
  );

  const x = clamp(baselineX, 0, Math.max(0, viewport.width - 1));

  /**
   * A posição Y armazenada nos blocos é top-left, não baseline.
   */
  const y = clamp(
    baselineY - height,
    0,
    Math.max(0, viewport.height - 1),
  );

  const boundedWidth = Math.max(
    MIN_TEXT_WIDTH,
    Math.min(width, Math.max(MIN_TEXT_WIDTH, viewport.width - x)),
  );

  const boundedHeight = Math.max(
    MIN_TEXT_HEIGHT,
    Math.min(height, Math.max(MIN_TEXT_HEIGHT, viewport.height - y)),
  );

  return {
    text,
    x,
    y,
    width: boundedWidth,
    height: boundedHeight,
    fontFamily: normalizeFontFamily(style.fontFamily),
    fontSize,
    fontWeight: inferFontWeight(item.fontName, style.fontFamily),
    fontStyle: inferFontStyle(item.fontName, style.fontFamily),
    lineHeight: Math.max(fontSize, boundedHeight),
    transform,
    baselineY,
  };
}

function normalizeScale(scale: number) {
  return Math.max(0.01, safeNumber(scale, 1));
}

function safeNumber(
  value: number | null | undefined,
  fallback = 0,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function clamp(value: number, min: number, max: number): number {
  const safeMin = safeNumber(min, 0);
  const safeMax = Math.max(safeMin, safeNumber(max, safeMin));
  const safeValue = safeNumber(value, safeMin);

  return Math.max(safeMin, Math.min(safeMax, safeValue));
}

function normalizeFontFamily(fontFamily?: string) {
  const value = fontFamily?.trim();

  if (!value) {
    return "serif";
  }

  return value;
}

function estimateFontSize(input: {
  transform: PdfMatrix;
  itemHeight?: number;
  viewportScale: number;
}) {
  const fromMatrix = Math.hypot(input.transform[2], input.transform[3]);

  if (Number.isFinite(fromMatrix) && fromMatrix > 0) {
    return fromMatrix;
  }

  const fromItemHeight = safeNumber(input.itemHeight, 0) * input.viewportScale;

  if (fromItemHeight > 0) {
    return fromItemHeight;
  }

  return 12 * input.viewportScale;
}

function estimateTextWidth(input: {
  itemWidth?: number;
  viewportScale: number;
  text: string;
  fontSize: number;
}) {
  const fromItem = safeNumber(input.itemWidth, 0) * input.viewportScale;

  if (fromItem > 0) {
    return fromItem;
  }

  /**
   * Fallback aproximado para PDFs que não informam width.
   */
  return input.text.length * input.fontSize * 0.5;
}

function estimateTextHeight(input: {
  style: PdfJsTextStyle;
  itemHeight?: number;
  viewportScale: number;
  fontSize: number;
}) {
  const itemHeight = safeNumber(input.itemHeight, 0) * input.viewportScale;

  if (itemHeight > 0) {
    return itemHeight;
  }

  const ascent = safeNumber(input.style.ascent, 0);
  const descent = safeNumber(input.style.descent, 0);

  if (ascent || descent) {
    const fontBox = Math.abs(ascent) + Math.abs(descent);
    if (fontBox > 0) {
      return Math.max(input.fontSize, input.fontSize * fontBox);
    }
  }

  return input.fontSize * 1.15;
}

function compareTextCandidates(a: TextCandidate, b: TextCandidate) {
  const yDelta = a.y - b.y;

  if (Math.abs(yDelta) > Math.max(1.5, Math.min(a.fontSize, b.fontSize) * 0.25)) {
    return yDelta;
  }

  return a.x - b.x;
}

function createLineClusters(candidates: TextCandidate[]) {
  const lines: LineCluster[] = [];

  for (const candidate of candidates) {
    const tolerance = Math.max(2, candidate.fontSize * 0.35);

    const line = lines.find(
      (current) => Math.abs(current.baselineY - candidate.baselineY) <= tolerance,
    );

    if (!line) {
      lines.push({
        index: lines.length,
        baselineY: candidate.baselineY,
        minX: candidate.x,
        maxX: candidate.x + candidate.width,
        minY: candidate.y,
        maxY: candidate.y + candidate.height,
        candidates: [candidate],
      });

      continue;
    }

    line.candidates.push(candidate);
    line.baselineY =
      (line.baselineY * (line.candidates.length - 1) + candidate.baselineY) /
      line.candidates.length;
    line.minX = Math.min(line.minX, candidate.x);
    line.maxX = Math.max(line.maxX, candidate.x + candidate.width);
    line.minY = Math.min(line.minY, candidate.y);
    line.maxY = Math.max(line.maxY, candidate.y + candidate.height);
  }

  lines.sort((a, b) => {
    if (Math.abs(a.minY - b.minY) > 1.5) return a.minY - b.minY;
    return a.minX - b.minX;
  });

  lines.forEach((line, index) => {
    line.index = index;
    line.candidates.sort((a, b) => a.x - b.x);
  });

  return lines;
}

function findLineIndexForCandidate(
  lines: LineCluster[],
  candidate: TextCandidate,
) {
  const line = lines.find((current) => current.candidates.includes(candidate));

  return line?.index ?? 0;
}

function normalizePdfMatrix(input: unknown): PdfMatrix {
  if (!Array.isArray(input) || input.length < 6) {
    return [1, 0, 0, 1, 0, 0];
  }

  return [
    Number(input[0]) || 0,
    Number(input[1]) || 0,
    Number(input[2]) || 0,
    Number(input[3]) || 0,
    Number(input[4]) || 0,
    Number(input[5]) || 0,
  ];
}

function multiplyPdfMatrices(first: PdfMatrix, second: PdfMatrix): PdfMatrix {
  return [
    first[0] * second[0] + first[2] * second[1],
    first[1] * second[0] + first[3] * second[1],
    first[0] * second[2] + first[2] * second[3],
    first[1] * second[2] + first[3] * second[3],
    first[0] * second[4] + first[2] * second[5] + first[4],
    first[1] * second[4] + first[3] * second[5] + first[5],
  ];
}

function inferFontWeight(fontName?: string, fontFamily?: string) {
  const normalized = `${fontName ?? ""} ${fontFamily ?? ""}`.toLowerCase();

  if (
    normalized.includes("bold") ||
    normalized.includes("black") ||
    normalized.includes("heavy") ||
    normalized.includes("semibold") ||
    normalized.includes("demibold")
  ) {
    return "700";
  }

  return "400";
}

function inferFontStyle(
  fontName?: string,
  fontFamily?: string,
): "normal" | "italic" {
  const normalized = `${fontName ?? ""} ${fontFamily ?? ""}`.toLowerCase();

  return normalized.includes("italic") || normalized.includes("oblique")
    ? "italic"
    : "normal";
}
