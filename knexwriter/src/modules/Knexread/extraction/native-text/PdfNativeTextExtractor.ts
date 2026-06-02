import {
  KnexPdfGeometryMath,
} from "../../core/KnexPdfGeometry";
import { normalizeKnexPdfTextStyle } from "../../core/KnexPdfStyle";
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

type NativeTextCandidateSource = "pdfjs" | "pdfium";

type NativeTextCandidate = {
  source: NativeTextCandidateSource;
  blocks: KnexPdfTextBlock[];
  confidence: number;
  score: number;
  reason: string;
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

function safeNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function normalizeExtractionScale(scale: number): number {
  /*
   * O scale que chega aqui deve representar a escala CSS final da página.
   * Usamos o núcleo canônico de geometria para aceitar tanto 1/1.25 quanto
   * 100/125, evitando inconsistência entre blueprint, HTML e canvas.
   */
  return KnexPdfGeometryMath.normalizeZoom(scale);
}

function roundCss(value: number): number {
  return KnexPdfGeometryMath.roundCss(value);
}

function clampCss(value: number, min: number, max: number): number {
  return KnexPdfGeometryMath.clamp(value, min, max);
}

function inferFontFamily(
  item: PdfJsTextItem,
  textContent: PdfJsTextContent,
): string {
  const family = item.fontName
    ? textContent.styles?.[item.fontName]?.fontFamily
    : "";

  if (family && family.trim().length > 0) return family;
  if (item.fontName?.toLowerCase().includes("serif")) return "serif";

  return "Arial, sans-serif";
}

function getStyleMetrics(input: {
  item: PdfJsTextItem;
  textContent: PdfJsTextContent;
}): {
  ascent: number;
  descent: number;
} {
  const style = input.item.fontName
    ? input.textContent.styles?.[input.item.fontName]
    : undefined;

  const ascent =
    typeof style?.ascent === "number" && Number.isFinite(style.ascent)
      ? style.ascent
      : 0.9;
  const descent =
    typeof style?.descent === "number" && Number.isFinite(style.descent)
      ? style.descent
      : -0.22;

  return {
    ascent: clampCss(ascent, 0.2, 1.4),
    descent: clampCss(descent, -0.8, 0.4),
  };
}

function normalizeTextBlockStyle(input: {
  text: string;
  fontFamily?: string;
  fontName?: string;
  fontSize: number;
  fontWeight?: string | number;
  fontStyle?: string;
  color?: string;
  lineHeight: number;
  letterSpacing?: number;
  wordSpacing?: number;
  opacity?: number;
  rasterized?: boolean;
}) {
  return normalizeKnexPdfTextStyle({
    text: input.text,
    fontFamily: input.fontFamily,
    fontName: input.fontName,
    fontSize: input.fontSize,
    fontWeight: input.fontWeight,
    fontStyle: input.fontStyle,
    color: input.color,
    lineHeight: input.lineHeight,
    letterSpacing: input.letterSpacing,
    wordSpacing: input.wordSpacing,
    opacity: input.opacity,
    source: input.rasterized ? "ocr" : "pdf",
  });
}


function buildPdfJsTextBlock(input: {
  item: PdfJsTextItem;
  textContent: PdfJsTextContent;
  viewport: PdfJsViewport;
  pageNumber: number;
  index: number;
  scale: number;
}): KnexPdfTextBlock | null {
  const text = input.item.str ?? "";
  if (text.trim().length === 0) return null;

  const scale = normalizeExtractionScale(input.scale);
  const viewportTransform = safeTransform(input.viewport.transform);
  const itemTransform = safeTransform(input.item.transform);
  const transform = multiplyTransform(viewportTransform, itemTransform);

  /*
   * transform já está no espaço CSS do viewport escalado.
   * outputScale/DPR não entram aqui. Esses fatores pertencem apenas ao bitmap.
   */
  const fontSize = Math.max(1, Math.hypot(transform[2], transform[3]));
  const metrics = getStyleMetrics({
    item: input.item,
    textContent: input.textContent,
  });

  const rawWidth = safeNumber(
    input.item.width,
    text.length * fontSize * 0.48,
  );
  const width = Math.max(1, roundCss(rawWidth * scale));

  const itemHeight = safeNumber(input.item.height, fontSize / scale);
  const metricHeight = Math.max(
    fontSize * 0.85,
    fontSize * Math.max(0.8, metrics.ascent - metrics.descent),
  );
  const height = Math.max(1, roundCss(Math.max(metricHeight, itemHeight * scale)));

  const x = clampCss(
    roundCss(transform[4]),
    -input.viewport.width * 0.05,
    input.viewport.width * 1.05,
  );
  const baselineY = transform[5];
  const y = clampCss(
    roundCss(baselineY - fontSize * metrics.ascent),
    -input.viewport.height * 0.05,
    input.viewport.height * 1.05,
  );
  const lineHeight = Math.max(height, roundCss(fontSize));
  const style = normalizeTextBlockStyle({
    text,
    fontFamily: inferFontFamily(input.item, input.textContent),
    fontName: input.item.fontName,
    fontSize: roundCss(fontSize),
    lineHeight,
    color: "rgb(0, 0, 0)",
    letterSpacing: 0,
    wordSpacing: 0,
    opacity: 1,
  });

  return {
    id: `native-text-${input.pageNumber}-${input.index}`,
    pageNumber: input.pageNumber,
    text,
    x,
    y,
    width,
    height,
    fontFamily: style.fontFamily,
    fontName: style.fontName ?? input.item.fontName,
    fontSize: style.fontSize,
    fontWeight: style.fontWeight,
    fontStyle: style.fontStyle,
    color: style.color,
    align: "left",
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    wordSpacing: style.wordSpacing,
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
    confidence: 0.9,
    decorative: false,
    rasterized: false,
  };
}

function isValidTextBlock(block: KnexPdfTextBlock): boolean {
  return (
    typeof block.text === "string" &&
    block.text.trim().length > 0 &&
    Number.isFinite(block.x) &&
    Number.isFinite(block.y) &&
    Number.isFinite(block.width) &&
    Number.isFinite(block.height) &&
    block.width > 0 &&
    block.height > 0
  );
}

function normalizeTextBlocks(input: {
  blocks: KnexPdfTextBlock[];
  pageNumber: number;
  sourceBackend: "pdfjs" | "pdfium";
  viewport?: PdfJsViewport;
}): KnexPdfTextBlock[] {
  const viewportWidth = input.viewport?.width ?? Number.POSITIVE_INFINITY;
  const viewportHeight = input.viewport?.height ?? Number.POSITIVE_INFINITY;

  const sorted = input.blocks
    .filter(isValidTextBlock)
    .map((block) => {
      const x = clampCss(
        roundCss(block.x),
        -viewportWidth * 0.05,
        viewportWidth * 1.05,
      );
      const y = clampCss(
        roundCss(block.y),
        -viewportHeight * 0.05,
        viewportHeight * 1.05,
      );
      const width = Math.max(1, roundCss(block.width));
      const height = Math.max(1, roundCss(block.height));
      const fontSize = Math.max(1, roundCss(block.fontSize ?? height));
      const lineHeight = Math.max(1, roundCss(block.lineHeight ?? height));
      const style = normalizeTextBlockStyle({
        text: block.text,
        fontFamily: block.fontFamily,
        fontName: block.fontName,
        fontSize,
        fontWeight: block.fontWeight,
        fontStyle: block.fontStyle,
        color: block.color,
        lineHeight,
        letterSpacing: block.letterSpacing,
        wordSpacing: block.wordSpacing,
        opacity: block.opacity,
        rasterized: block.rasterized,
      });

      return {
        ...block,
        x,
        y,
        width,
        height,
        fontFamily: style.fontFamily,
        fontName: style.fontName ?? block.fontName,
        fontSize: style.fontSize,
        fontWeight: style.fontWeight,
        fontStyle: style.fontStyle,
        color: style.color,
        opacity: style.opacity,
        lineHeight: style.lineHeight,
        letterSpacing: style.letterSpacing,
        wordSpacing: style.wordSpacing,
        styleSource: style.styleSource,
        missingFontFamily: style.missingFontFamily,
        usedUiFontFamily: style.usedUiFontFamily,
      };
    })
    .sort((first, second) => {
      const yDelta = first.y - second.y;

      if (
        Math.abs(yDelta) >
        Math.max(2, Math.min(first.height, second.height) * 0.65)
      ) {
        return yDelta;
      }

      return first.x - second.x;
    });

  let currentLine = -1;
  let previousY = Number.NaN;

  return sorted.map((block, index) => {
    if (
      !Number.isFinite(previousY) ||
      Math.abs(block.y - previousY) > Math.max(3, block.height * 0.75)
    ) {
      currentLine += 1;
      previousY = block.y;
    }

    return {
      ...block,
      id: block.id || `${input.sourceBackend}-text-${input.pageNumber}-${index}`,
      pageNumber: input.pageNumber,
      readingOrder: index,
      lineIndex: currentLine,
      paragraphIndex: block.paragraphIndex ?? currentLine,
      sourceBackend: input.sourceBackend,
      confidence: block.confidence ?? (input.sourceBackend === "pdfjs" ? 0.9 : 0.86),
      rasterized: block.rasterized ?? false,
      decorative: block.decorative ?? false,
    };
  });
}

function analyzeTextBlocks(blocks: KnexPdfTextBlock[]): {
  totalChars: number;
  avgRunLength: number;
  shortRunRatio: number;
  invalidRatio: number;
  averageConfidence: number;
} {
  if (blocks.length === 0) {
    return {
      totalChars: 0,
      avgRunLength: 0,
      shortRunRatio: 1,
      invalidRatio: 1,
      averageConfidence: 0,
    };
  }

  const validBlocks = blocks.filter(isValidTextBlock);
  const totalChars = blocks.reduce(
    (sum, block) => sum + block.text.trim().length,
    0,
  );
  const shortRuns = blocks.filter((block) => {
    const length = block.text.trim().length;

    return length > 0 && length <= 3;
  }).length;
  const averageConfidence =
    blocks.reduce((sum, block) => sum + (block.confidence ?? 0.85), 0) /
    blocks.length;

  return {
    totalChars,
    avgRunLength: totalChars / Math.max(1, blocks.length),
    shortRunRatio: shortRuns / Math.max(1, blocks.length),
    invalidRatio: 1 - validBlocks.length / Math.max(1, blocks.length),
    averageConfidence,
  };
}

function scoreCandidate(input: {
  source: NativeTextCandidateSource;
  blocks: KnexPdfTextBlock[];
  baseConfidence: number;
}): NativeTextCandidate {
  const analysis = analyzeTextBlocks(input.blocks);
  const confidence =
    input.blocks.length > 0 ? analysis.averageConfidence : input.baseConfidence;

  let score = confidence * 100;
  score += Math.min(28, analysis.totalChars / 25);
  score += Math.min(20, analysis.avgRunLength * 1.5);
  score -= analysis.shortRunRatio * 35;
  score -= analysis.invalidRatio * 45;

  /*
   * O PDF.js costuma fornecer transformações já alinhadas ao viewport usado
   * pela camada HTML. Quando a qualidade é semelhante, damos pequena preferência
   * a ele para melhorar fidelidade geométrica.
   */
  if (input.source === "pdfjs" && input.blocks.length > 0) {
    score += 6;
  }

  if (analysis.totalChars < 30) score -= 15;
  if (analysis.avgRunLength < 3.5) score -= 15;
  if (analysis.shortRunRatio > 0.5) score -= 20;

  return {
    source: input.source,
    blocks: input.blocks,
    confidence: clampCss(confidence, 0, 1),
    score,
    reason: [
      `source=${input.source}`,
      `blocks=${input.blocks.length}`,
      `chars=${analysis.totalChars}`,
      `avgRun=${analysis.avgRunLength.toFixed(2)}`,
      `shortRatio=${analysis.shortRunRatio.toFixed(2)}`,
      `invalidRatio=${analysis.invalidRatio.toFixed(2)}`,
      `score=${score.toFixed(2)}`,
    ].join(";"),
  };
}

function chooseBestCandidate(input: {
  pdfjs: NativeTextCandidate;
  pdfium: NativeTextCandidate;
}): NativeTextCandidate {
  if (input.pdfjs.blocks.length === 0) return input.pdfium;
  if (input.pdfium.blocks.length === 0) return input.pdfjs;

  /*
   * Se os candidatos estão próximos, preferimos PDF.js porque a geometria vem
   * diretamente do viewport/transform usado pela apresentação HTML.
   */
  if (input.pdfjs.score >= input.pdfium.score - 8) {
    return input.pdfjs;
  }

  return input.pdfium;
}

async function extractPdfJsTextBlocks(input: {
  session: NativePdfSession;
  pageNumber: number;
  scale: number;
  signal?: AbortSignal;
}): Promise<{
  blocks: KnexPdfTextBlock[];
  confidence: number;
}> {
  const scale = normalizeExtractionScale(input.scale);
  const page = (await input.session.pdf.getPage(input.pageNumber)) as PdfJsPage;
  const viewport = page.getViewport({ scale });
  const textContent = await page.getTextContent({
    includeMarkedContent: false,
    disableNormalization: false,
  });

  if (input.signal?.aborted) {
    throw new DOMException("Native text extraction aborted.", "AbortError");
  }

  const blocks = normalizeTextBlocks({
    pageNumber: input.pageNumber,
    sourceBackend: "pdfjs",
    viewport,
    blocks: (textContent.items ?? [])
      .map((item, index) =>
        buildPdfJsTextBlock({
          item,
          textContent,
          viewport,
          pageNumber: input.pageNumber,
          index,
          scale,
        }),
      )
      .filter((block): block is KnexPdfTextBlock => Boolean(block)),
  });

  const confidence =
    blocks.length > 0
      ? blocks.reduce((sum, block) => sum + (block.confidence ?? 0.9), 0) /
        blocks.length
      : 0;

  return {
    blocks,
    confidence,
  };
}

async function extractPdfiumTextBlocks(input: {
  session: NativePdfSession;
  pageNumber: number;
  scale: number;
  signal?: AbortSignal;
}): Promise<{
  blocks: KnexPdfTextBlock[];
  confidence: number;
}> {
  const scale = normalizeExtractionScale(input.scale);
  const blocks = normalizeTextBlocks({
    pageNumber: input.pageNumber,
    sourceBackend: "pdfium",
    blocks: await extractPdfiumPageText({
      session: input.session,
      pageNumber: input.pageNumber,
      scale,
      signal: input.signal,
    }),
  });

  const confidence =
    blocks.length > 0
      ? blocks.reduce((sum, block) => sum + (block.confidence ?? 0.86), 0) /
        blocks.length
      : 0;

  return {
    blocks,
    confidence,
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

  const scale = normalizeExtractionScale(input.scale);
  let pdfjsBlocks: KnexPdfTextBlock[] = [];
  let pdfjsConfidence = 0;
  let pdfiumBlocks: KnexPdfTextBlock[] = [];
  let pdfiumConfidence = 0;

  /*
   * Extraímos os dois quando possível. Antes, qualquer resultado do PDFium era
   * aceito automaticamente, mesmo que a geometria ficasse inferior. Agora a
   * seleção considera densidade textual, fragmentação, confiança e validade
   * geométrica.
   */
  try {
    const pdfjs = await extractPdfJsTextBlocks({
      session: input.session,
      pageNumber: input.pageNumber,
      scale,
      signal: input.signal,
    });

    pdfjsBlocks = pdfjs.blocks;
    pdfjsConfidence = pdfjs.confidence;
  } catch {
    pdfjsBlocks = [];
    pdfjsConfidence = 0;
  }

  try {
    const pdfium = await extractPdfiumTextBlocks({
      session: input.session,
      pageNumber: input.pageNumber,
      scale,
      signal: input.signal,
    });

    pdfiumBlocks = pdfium.blocks;
    pdfiumConfidence = pdfium.confidence;
  } catch {
    pdfiumBlocks = [];
    pdfiumConfidence = 0;
  }

  if (input.signal?.aborted) {
    throw new DOMException("Native text extraction aborted.", "AbortError");
  }

  const pdfjsCandidate = scoreCandidate({
    source: "pdfjs",
    blocks: pdfjsBlocks,
    baseConfidence: pdfjsConfidence,
  });
  const pdfiumCandidate = scoreCandidate({
    source: "pdfium",
    blocks: pdfiumBlocks,
    baseConfidence: pdfiumConfidence,
  });
  const selected = chooseBestCandidate({
    pdfjs: pdfjsCandidate,
    pdfium: pdfiumCandidate,
  });

  return {
    pageNumber: input.pageNumber,
    scale,
    blocks: selected.blocks,
    confidence: selected.confidence,
    source: "native",
  };
}
