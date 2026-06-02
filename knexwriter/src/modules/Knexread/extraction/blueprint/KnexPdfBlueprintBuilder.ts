import type {
  KnexPdfBlueprintBuildResult,
  KnexPdfBlueprintBuilderConfig,
  KnexPdfBlueprintElement,
  KnexPdfFormField,
  KnexPdfPageBlueprint,
} from "../../core/KnexPdfBlueprintTypes";
import {
  KnexPdfCoordinateConverter,
  KnexPdfGeometryMath,
  type KnexPdfPageSizePt,
  type KnexPdfRotation,
} from "../../core/KnexPdfGeometry";
import type { KnexPdfTextBlock } from "../../native-pdf-reader/knex-pdf-engine";
import type { NativePdfSession } from "../../native-pdf-reader/services/pdfLoader.service";
import { runPdfOcrPipeline } from "../ocr/PdfOcrPipeline";
import { detectPdfOcrNeed } from "../ocr/PdfOcrNeedDetector";
import { extractPdfNativeText } from "../native-text/PdfNativeTextExtractor";
import { renderPdfiumPageNonTextToImageElement } from "../../backends/pdfium/PdfiumNonTextRenderer";
import { buildPdfVisualTextModel } from "../../rendering/text/PdfVisualTextModelBuilder";

type PdfJsViewport = {
  width: number;
  height: number;
  rotation?: number;
  convertToViewportRectangle?: (rect: number[]) => number[];
};

type PdfJsAnnotation = {
  id?: string;
  subtype?: string;
  fieldType?: string;
  fieldName?: string;
  fieldValue?: string;
  defaultFieldValue?: string;
  readOnly?: boolean;
  required?: boolean;
  maxLen?: number;
  rect?: number[];
  url?: string;
  dest?: unknown;
};

type PdfJsRenderTask = {
  promise: Promise<void>;
  cancel?: () => void;
};

type PdfJsPage = {
  getViewport: (params: { scale: number }) => PdfJsViewport;
  getAnnotations?: (params?: { intent?: "display" | "print" }) => Promise<
    PdfJsAnnotation[]
  >;
  render?: (params: {
    canvasContext: CanvasRenderingContext2D;
    canvas: HTMLCanvasElement;
    viewport: PdfJsViewport;
    intent?: "display" | "print";
    operationsFilter?: (fnId: number) => boolean;
  }) => PdfJsRenderTask;
};

type TextOperationFilterResult = {
  supported: boolean;
  reason: string;
  filter?: (fnId: number) => boolean;
};

type BlueprintNonTextExtractionResult = {
  elements: KnexPdfBlueprintElement[];
  imageCount: number;
  shapeCount: number;
  warnings: string[];
};

export type KnexPdfBlueprintBuildResultWithText =
  KnexPdfBlueprintBuildResult & {
    textBlocks: KnexPdfTextBlock[];
  };

export type BuildKnexPdfPageBlueprintInput = {
  session: NativePdfSession;
  pageNumber: number;
  cssWidth?: number;
  cssHeight?: number;
  scale?: number;
  signal?: AbortSignal;
  config?: Partial<KnexPdfBlueprintBuilderConfig>;
};

const DEFAULT_BLUEPRINT_CONFIG: KnexPdfBlueprintBuilderConfig = {
  extractNativeText: true,
  useOcr: true,
  extractImages: false,
  imageFormat: "png",
  jpegQuality: 100,
  extractShapes: false,
  extractFormFields: true,
  extractAnnotations: true,
  cacheBlueprint: true,
  extractionTimeout: 30000,
  verbose: false,
};

function normalizePdfiumNonTextImageFormat(
  format: KnexPdfBlueprintBuilderConfig["imageFormat"],
): "png" | "jpeg" {
  return format === "jpeg" ? "jpeg" : "png";
}

function getRotation(value: unknown): KnexPdfRotation {
  return value === 90 || value === 180 || value === 270 ? value : 0;
}

function normalizeBlueprintScale(input: {
  scale?: number;
  cssWidth?: number;
  cssHeight?: number;
  baseViewport: PdfJsViewport;
}): number {
  if (typeof input.scale === "number" && Number.isFinite(input.scale)) {
    return KnexPdfGeometryMath.normalizeZoom(input.scale);
  }

  if (
    typeof input.cssWidth === "number" &&
    Number.isFinite(input.cssWidth) &&
    input.cssWidth > 0 &&
    input.baseViewport.width > 0
  ) {
    return KnexPdfGeometryMath.normalizeZoom(input.cssWidth / input.baseViewport.width);
  }

  if (
    typeof input.cssHeight === "number" &&
    Number.isFinite(input.cssHeight) &&
    input.cssHeight > 0 &&
    input.baseViewport.height > 0
  ) {
    return KnexPdfGeometryMath.normalizeZoom(input.cssHeight / input.baseViewport.height);
  }

  return 1;
}

function resolveCssPageSize(input: {
  cssWidth?: number;
  cssHeight?: number;
  viewport: PdfJsViewport;
}): { cssWidth: number; cssHeight: number } {
  return {
    cssWidth: Math.max(
      1,
      KnexPdfGeometryMath.roundCss(input.cssWidth ?? input.viewport.width),
    ),
    cssHeight: Math.max(
      1,
      KnexPdfGeometryMath.roundCss(input.cssHeight ?? input.viewport.height),
    ),
  };
}

function normalizeRect(input: {
  rect: number[] | undefined;
  pageSizePt: KnexPdfPageSizePt;
  scale: number;
  rotation: KnexPdfRotation;
}): { x: number; y: number; width: number; height: number } | null {
  if (!input.rect || input.rect.length < 4) return null;

  const rect = KnexPdfCoordinateConverter.pdfRectArrayToCss({
    rect: input.rect,
    pageSizePt: input.pageSizePt,
    zoom: input.scale,
    rotation: input.rotation,
  });

  if (!rect) return null;

  return {
    x: KnexPdfGeometryMath.roundCss(rect.x),
    y: KnexPdfGeometryMath.roundCss(rect.y),
    width: Math.max(1, KnexPdfGeometryMath.roundCss(rect.width)),
    height: Math.max(1, KnexPdfGeometryMath.roundCss(rect.height)),
  };
}

function toFormField(input: {
  annotation: PdfJsAnnotation;
  index: number;
  pageSizePt: KnexPdfPageSizePt;
  scale: number;
  rotation: KnexPdfRotation;
}): KnexPdfFormField | null {
  if (input.annotation.subtype !== "Widget" && !input.annotation.fieldType) {
    return null;
  }

  const rect = normalizeRect({
    rect: input.annotation.rect,
    pageSizePt: input.pageSizePt,
    scale: input.scale,
    rotation: input.rotation,
  });

  if (!rect) return null;

  const fieldType =
    input.annotation.fieldType === "Btn"
      ? "checkbox"
      : input.annotation.fieldType === "Ch"
        ? "select"
        : input.annotation.fieldType === "Sig"
          ? "signature"
          : "text";

  return {
    type: "form-field",
    id: input.annotation.id ?? `form-field-${input.index}`,
    fieldType,
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    name: input.annotation.fieldName ?? `field-${input.index}`,
    defaultValue:
      typeof input.annotation.fieldValue === "string"
        ? input.annotation.fieldValue
        : typeof input.annotation.defaultFieldValue === "string"
          ? input.annotation.defaultFieldValue
          : undefined,
    required: input.annotation.required === true,
    readOnly: input.annotation.readOnly === true,
    maxLength:
      typeof input.annotation.maxLen === "number"
        ? input.annotation.maxLen
        : undefined,
    fontSize: Math.max(10, Math.min(18, rect.height * 0.6)),
    fontColor: "#111827",
    backgroundColor: "rgba(255, 255, 255, 0.72)",
    border: {
      color: "rgba(17, 24, 39, 0.28)",
      width: 1,
      style: "solid",
    },
  };
}

async function extractFormFields(input: {
  page: PdfJsPage;
  pageSizePt: KnexPdfPageSizePt;
  scale: number;
  rotation: KnexPdfRotation;
  enabled: boolean;
}): Promise<KnexPdfFormField[]> {
  if (!input.enabled || !input.page.getAnnotations) return [];

  const annotations = await input.page.getAnnotations({ intent: "display" });

  return annotations
    .map((annotation, index) =>
      toFormField({
        annotation,
        index,
        pageSizePt: input.pageSizePt,
        scale: input.scale,
        rotation: input.rotation,
      }),
    )
    .filter((field): field is KnexPdfFormField => Boolean(field));
}

function resolvePdfJsTextOperationFilter(): TextOperationFilterResult {
  const ops = (globalThis as unknown as { pdfjsLib?: { OPS?: Record<string, number> } })
    .pdfjsLib?.OPS;

  if (!ops) {
    return {
      supported: false,
      reason: "pdfjs-ops-unavailable",
    };
  }

  const textOperationIds = [
    ops.beginText,
    ops.endText,
    ops.setCharSpacing,
    ops.setWordSpacing,
    ops.setHScale,
    ops.setLeading,
    ops.setFont,
    ops.setTextRenderingMode,
    ops.setTextRise,
    ops.moveText,
    ops.setLeadingMoveText,
    ops.setTextMatrix,
    ops.nextLine,
    ops.showText,
    ops.showSpacedText,
    ops.nextLineShowText,
    ops.nextLineSetSpacingShowText,
    ops.paintChar,
  ].filter((value): value is number => typeof value === "number");

  if (textOperationIds.length === 0) {
    return {
      supported: false,
      reason: "pdfjs-text-ops-unavailable",
    };
  }

  const blocked = new Set(textOperationIds);

  return {
    supported: true,
    reason: "pdfjs-ops-filter",
    filter: (fnId: number) => !blocked.has(fnId),
  };
}

function getNonTextRasterMimeType(config: KnexPdfBlueprintBuilderConfig): string {
  return config.imageFormat === "jpeg" ? "image/jpeg" : "image/png";
}

function getNonTextRasterDataUrl(input: {
  canvas: HTMLCanvasElement;
  config: KnexPdfBlueprintBuilderConfig;
}): string {
  const mimeType = getNonTextRasterMimeType(input.config);

  if (mimeType === "image/jpeg") {
    return input.canvas.toDataURL(
      mimeType,
      Math.max(0, Math.min(1, input.config.jpegQuality / 100)),
    );
  }

  return input.canvas.toDataURL(mimeType);
}

function eraseTextRegionsFromNonTextCanvas(input: {
  context: CanvasRenderingContext2D;
  textBlocks: KnexPdfTextBlock[];
  outputScale: number;
  cssWidth: number;
  cssHeight: number;
}) {
  if (input.textBlocks.length === 0) return;

  input.context.save();
  input.context.setTransform(1, 0, 0, 1, 0, 0);
  input.context.fillStyle = "#ffffff";

  for (const block of input.textBlocks) {
    const margin = 2;
    const x = Math.max(0, (block.x - margin) * input.outputScale);
    const y = Math.max(0, (block.y - margin) * input.outputScale);
    const width = Math.min(
      input.cssWidth * input.outputScale - x,
      Math.max(1, block.width + margin * 2) * input.outputScale,
    );
    const height = Math.min(
      input.cssHeight * input.outputScale - y,
      Math.max(1, block.height + margin * 2) * input.outputScale,
    );

    if (width <= 0 || height <= 0) continue;

    input.context.fillRect(x, y, width, height);
  }

  input.context.restore();
}

/**
 * Extrai uma superfície não textual como imagem raster filtrada.
 *
 * Esta rotina não tenta reconstruir cada imagem/forma individual do PDF.
 * Ela cria um fundo visual da página sem operações textuais via PDF.js
 * operationsFilter. Isso preserva imagens, formas, linhas, fundos e outros
 * elementos visuais quando o fallback canvas é ocultado para evitar duplicação
 * com o texto HTML do blueprint.
 */
async function extractNonTextRasterElements(input: {
  page: PdfJsPage;
  pageNumber: number;
  scale: number;
  cssWidth: number;
  cssHeight: number;
  textBlocks: KnexPdfTextBlock[];
  config: KnexPdfBlueprintBuilderConfig;
  signal?: AbortSignal;
}): Promise<BlueprintNonTextExtractionResult> {
  if (!input.config.extractImages && !input.config.extractShapes) {
    return {
      elements: [],
      imageCount: 0,
      shapeCount: 0,
      warnings: [],
    };
  }

  const warnings: string[] = [];

  if (typeof document === "undefined") {
    return {
      elements: [],
      imageCount: 0,
      shapeCount: 0,
      warnings: ["blueprint-non-text-raster-document-unavailable"],
    };
  }

  if (!input.page.render) {
    return {
      elements: [],
      imageCount: 0,
      shapeCount: 0,
      warnings: ["blueprint-non-text-raster-render-unavailable"],
    };
  }

  const nonTextFilter = resolvePdfJsTextOperationFilter();

  if (!nonTextFilter.supported || !nonTextFilter.filter) {
    return {
      elements: [],
      imageCount: 0,
      shapeCount: 0,
      warnings: [`blueprint-non-text-raster-filter-unavailable:${nonTextFilter.reason}`],
    };
  }

  if (input.signal?.aborted) {
    throw new DOMException("Blueprint non-text extraction aborted.", "AbortError");
  }

  const outputScale = Math.min(
    2,
    Math.max(1, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1),
  );
  const canvas = document.createElement("canvas");
  const bitmapWidth = Math.max(1, Math.ceil(input.cssWidth * outputScale));
  const bitmapHeight = Math.max(1, Math.ceil(input.cssHeight * outputScale));
  const context = canvas.getContext("2d", { alpha: false });

  if (!context) {
    return {
      elements: [],
      imageCount: 0,
      shapeCount: 0,
      warnings: ["blueprint-non-text-raster-canvas-context-unavailable"],
    };
  }

  canvas.width = bitmapWidth;
  canvas.height = bitmapHeight;
  canvas.style.width = `${input.cssWidth}px`;
  canvas.style.height = `${input.cssHeight}px`;

  context.save();
  context.setTransform(1, 0, 0, 1, 0, 0);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, bitmapWidth, bitmapHeight);
  context.restore();

  const viewport = input.page.getViewport({
    scale: input.scale * outputScale,
  });

  const renderTask = input.page.render({
    canvasContext: context,
    canvas,
    viewport,
    intent: "display",
    operationsFilter: nonTextFilter.filter,
  });

  const abortHandler = () => {
    renderTask.cancel?.();
  };

  input.signal?.addEventListener("abort", abortHandler, { once: true });

  try {
    await renderTask.promise;
  } finally {
    input.signal?.removeEventListener("abort", abortHandler);
  }

  if (input.signal?.aborted) {
    throw new DOMException("Blueprint non-text extraction aborted.", "AbortError");
  }

  eraseTextRegionsFromNonTextCanvas({
    context,
    textBlocks: input.textBlocks,
    outputScale,
    cssWidth: input.cssWidth,
    cssHeight: input.cssHeight,
  });

  const dataUrl = getNonTextRasterDataUrl({
    canvas,
    config: input.config,
  });
  const mimeType = getNonTextRasterMimeType(input.config);

  const element = {
    type: "image",
    id: `non-text-raster-${input.pageNumber}`,
    pageNumber: input.pageNumber,
    x: 0,
    y: 0,
    left: 0,
    top: 0,
    width: input.cssWidth,
    height: input.cssHeight,
    src: dataUrl,
    dataUrl,
    url: dataUrl,
    imageUrl: dataUrl,
    mimeType,
    format: input.config.imageFormat,
    opacity: 1,
    zIndex: 0,
    sourceBackend: "pdfjs",
    sourceKind: "non-text-raster",
    textSuppressed: true,
    textSuppressionReason: nonTextFilter.reason,
    confidence: 0.75,
  } as unknown as KnexPdfBlueprintElement;

  warnings.push("blueprint-non-text-raster-extracted-with-pdfjs-filter");

  return {
    elements: [element],
    imageCount: 1,
    shapeCount: input.config.extractShapes ? 1 : 0,
    warnings,
  };
}

async function extractNativeNonTextElements(input: {
  session: NativePdfSession;
  page: PdfJsPage;
  pageNumber: number;
  scale: number;
  cssWidth: number;
  cssHeight: number;
  textBlocks: KnexPdfTextBlock[];
  config: KnexPdfBlueprintBuilderConfig;
  signal?: AbortSignal;
}): Promise<BlueprintNonTextExtractionResult> {
  if (!input.config.extractImages && !input.config.extractShapes) {
    return {
      elements: [],
      imageCount: 0,
      shapeCount: 0,
      warnings: [],
    };
  }

  const warnings: string[] = [];

  try {
    const imageElement = await renderPdfiumPageNonTextToImageElement({
      session: input.session,
      pageNumber: input.pageNumber,
      scale: input.scale,
      cssWidth: input.cssWidth,
      cssHeight: input.cssHeight,
      imageFormat: normalizePdfiumNonTextImageFormat(input.config.imageFormat),
      jpegQuality: input.config.jpegQuality,
      maskTextBlocks: input.textBlocks,
      signal: input.signal,
    });

    if (imageElement) {
      return {
        elements: [imageElement],
        imageCount: 1,
        shapeCount: 0,
        warnings: ["pdfium-non-text-image-element-extracted"],
      };
    }

    warnings.push("pdfium-non-text-image-element-empty");
  } catch (error) {
    const reason =
      error instanceof Error
        ? error.message
        : "pdfium-non-text-image-element-failed";

    warnings.push(`pdfium-non-text-image-element-failed:${reason}`);
  }

  const fallback = await extractNonTextRasterElements({
    page: input.page,
    pageNumber: input.pageNumber,
    scale: input.scale,
    cssWidth: input.cssWidth,
    cssHeight: input.cssHeight,
    textBlocks: input.textBlocks,
    config: input.config,
    signal: input.signal,
  });

  return {
    ...fallback,
    warnings: [...warnings, ...fallback.warnings],
  };
}

function textBlocksToElements(input: {
  pageNumber: number;
  blocks: KnexPdfTextBlock[];
  source: "native" | "ocr" | "hybrid" | "empty";
}): KnexPdfBlueprintElement[] {
  return buildPdfVisualTextModel({
    pageNumber: input.pageNumber,
    blocks: input.blocks,
    source: input.source,
  }).runs.map(
    (run) =>
      ({
        ...run,
        type: "text",
        zIndex: 10,
      }) as KnexPdfBlueprintElement,
  );
}

function calculateConfidence(blocks: KnexPdfTextBlock[]): number {
  if (blocks.length === 0) return 0;

  const average =
    blocks.reduce((sum, block) => sum + (block.confidence ?? 0.85), 0) /
    blocks.length;

  return Math.round(average * 100);
}

function normalizeTextKey(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

function rectanglesLikelyOverlap(
  first: KnexPdfTextBlock,
  second: KnexPdfTextBlock,
): boolean {
  const left = Math.max(first.x, second.x);
  const top = Math.max(first.y, second.y);
  const right = Math.min(first.x + first.width, second.x + second.width);
  const bottom = Math.min(first.y + first.height, second.y + second.height);
  const overlapWidth = Math.max(0, right - left);
  const overlapHeight = Math.max(0, bottom - top);
  const overlapArea = overlapWidth * overlapHeight;
  const firstArea = Math.max(1, first.width * first.height);
  const secondArea = Math.max(1, second.width * second.height);
  const smallerArea = Math.min(firstArea, secondArea);

  return overlapArea / smallerArea >= 0.55;
}

function textBlocksLikelyDuplicate(
  first: KnexPdfTextBlock,
  second: KnexPdfTextBlock,
): boolean {
  const firstText = normalizeTextKey(first.text);
  const secondText = normalizeTextKey(second.text);

  if (!firstText || !secondText) return false;

  if (firstText === secondText) {
    return rectanglesLikelyOverlap(first, second);
  }

  if (
    firstText.length >= 8 &&
    secondText.length >= 8 &&
    (firstText.includes(secondText) || secondText.includes(firstText))
  ) {
    return rectanglesLikelyOverlap(first, second);
  }

  return false;
}

function mergeNativeAndOcrTextBlocks(input: {
  nativeBlocks: KnexPdfTextBlock[];
  ocrBlocks: KnexPdfTextBlock[];
}): KnexPdfTextBlock[] {
  if (input.nativeBlocks.length === 0) return input.ocrBlocks;
  if (input.ocrBlocks.length === 0) return input.nativeBlocks;

  const merged = [...input.nativeBlocks];

  for (const ocrBlock of input.ocrBlocks) {
    const duplicate = merged.some((nativeBlock) =>
      textBlocksLikelyDuplicate(nativeBlock, ocrBlock),
    );

    if (!duplicate) {
      merged.push(ocrBlock);
    }
  }

  return merged.sort((first, second) => {
    if (first.pageNumber !== second.pageNumber) {
      return first.pageNumber - second.pageNumber;
    }

    return (
      first.readingOrder - second.readingOrder ||
      first.y - second.y ||
      first.x - second.x
    );
  });
}

function getSourceBackend(blocks: KnexPdfTextBlock[]): KnexPdfPageBlueprint["sourceBackend"] {
  const first = blocks.find((block) => block.sourceBackend)?.sourceBackend;
  return first === "pdfium" || first === "pdfjs" ? first : blocks.length > 0 ? "hybrid" : undefined;
}

export async function buildKnexPdfPageBlueprintFromSession(
  input: BuildKnexPdfPageBlueprintInput,
): Promise<KnexPdfBlueprintBuildResultWithText> {
  const startTime = performance.now();
  const config = { ...DEFAULT_BLUEPRINT_CONFIG, ...input.config };
  const warnings: string[] = [];
  const errors: string[] = [];
  const pageNumber = Math.max(1, Math.floor(input.pageNumber));
  const pageIndex = pageNumber - 1;

  try {
    if (input.signal?.aborted) {
      throw new DOMException("Blueprint build aborted.", "AbortError");
    }

    const page = (await input.session.pdf.getPage(pageNumber)) as PdfJsPage;
    const baseViewport = page.getViewport({ scale: 1 });
    const rotation = getRotation(baseViewport.rotation);
    const pageSizePt: KnexPdfPageSizePt = {
      width: Math.max(1, KnexPdfGeometryMath.roundCss(baseViewport.width)),
      height: Math.max(1, KnexPdfGeometryMath.roundCss(baseViewport.height)),
    };
    const scale = normalizeBlueprintScale({
      scale: input.scale,
      cssWidth: input.cssWidth,
      cssHeight: input.cssHeight,
      baseViewport,
    });
    const viewport = page.getViewport({ scale });
    const { cssWidth, cssHeight } = resolveCssPageSize({
      cssWidth: input.cssWidth,
      cssHeight: input.cssHeight,
      viewport,
    });

    let textBlocks: KnexPdfTextBlock[] = [];
    let extractionMode: KnexPdfPageBlueprint["extractionMode"] = "digital";
    let textSource: "native" | "ocr" | "hybrid" | "empty" = "empty";

    if (config.extractNativeText) {
      const nativeText = await extractPdfNativeText({
        session: input.session,
        pageNumber,
        scale,
        signal: input.signal,
      });

      textBlocks = nativeText.blocks;
      textSource = textBlocks.length > 0 ? "native" : "empty";

      const ocrNeed = detectPdfOcrNeed({
        nativeTextBlockCount: nativeText.blocks.length,
        nativeTextConfidence: nativeText.confidence,
      });

      if (config.useOcr && ocrNeed.shouldRunOcr) {
        const ocr = await runPdfOcrPipeline({
          session: input.session,
          pageNumber,
          scale,
          shouldRun: true,
          reason: ocrNeed.reason,
          signal: input.signal,
        });

        if (ocr.blocks.length > 0) {
          const mergedTextBlocks = mergeNativeAndOcrTextBlocks({
            nativeBlocks: nativeText.blocks,
            ocrBlocks: ocr.blocks,
          });
          const addedOcrBlocks =
            mergedTextBlocks.length > nativeText.blocks.length;

          textBlocks = mergedTextBlocks;
          textSource =
            nativeText.blocks.length === 0
              ? "ocr"
              : addedOcrBlocks
                ? "hybrid"
                : "native";
          extractionMode =
            nativeText.blocks.length === 0
              ? "ocr"
              : addedOcrBlocks
                ? "hybrid"
                : "digital";
        } else if (ocr.status === "error") {
          warnings.push(ocr.reason);
        }
      }
    }

    const textElements = textBlocksToElements({
      pageNumber,
      blocks: textBlocks,
      source: textSource,
    });
    const formFields = await extractFormFields({
      page,
      pageSizePt,
      scale,
      rotation,
      enabled: config.extractFormFields,
    });
    const nonTextExtraction = await extractNativeNonTextElements({
      session: input.session,
      page,
      pageNumber,
      scale,
      cssWidth,
      cssHeight,
      textBlocks,
      config,
      signal: input.signal,
    });

    if (nonTextExtraction.warnings.length > 0) {
      warnings.push(...nonTextExtraction.warnings);
    }

    const elements: KnexPdfBlueprintElement[] = [
      ...nonTextExtraction.elements,
      ...textElements,
      ...formFields,
    ];
    const buildTimeMs = Math.round(performance.now() - startTime);
    const blueprint: KnexPdfPageBlueprint = {
      pageIndex,
      blueprintId: [
        "blueprint",
        input.session.id ?? input.session.fingerprint,
        pageNumber,
        Math.round(scale * 1000),
        textBlocks.length,
        nonTextExtraction.imageCount,
        nonTextExtraction.shapeCount,
        formFields.length,
      ].join(":"),
      cssWidth,
      cssHeight,
      pageWidthPt: pageSizePt.width,
      pageHeightPt: pageSizePt.height,
      aspectRatio: cssWidth / Math.max(1, cssHeight),
      rotation,
      elements,
      extractionMode,
      confidence: calculateConfidence(textBlocks),
      sourceBackend: getSourceBackend(textBlocks),
      extractedAt: Date.now(),
      blueprintVersion: "1.0",
      suggestedRenderMode: "blueprint",
      isScannedOnly: textBlocks.length === 0,
      hasFormFields: formFields.length > 0,
      hasAnnotations: false,
      canRenderAsCanvas: nonTextExtraction.elements.length > 0,
      requiresDomComposition: true,
      suggestLayeredRendering: elements.length > 80,
      debug: {
        extractionTimeMs: buildTimeMs,
        textBlockCount: textBlocks.length,
        imageCount: nonTextExtraction.imageCount,
        shapeCount: nonTextExtraction.shapeCount,
        formFieldCount: formFields.length,
        errorLog: warnings.length > 0 ? warnings : undefined,
      },
    };

    return {
      blueprint,
      warnings,
      errors,
      buildTimeMs,
      textBlocks,
      success: true,
    };
  } catch (error) {
    const reason =
      error instanceof Error ? error.message : "blueprint-build-failed";
    errors.push(reason);

    const buildTimeMs = Math.round(performance.now() - startTime);
    const blueprint: KnexPdfPageBlueprint = {
      pageIndex,
      blueprintId: `blueprint-error:${pageNumber}:${buildTimeMs}`,
      cssWidth: Math.max(1, KnexPdfGeometryMath.roundCss(input.cssWidth ?? 1)),
      cssHeight: Math.max(1, KnexPdfGeometryMath.roundCss(input.cssHeight ?? 1)),
      pageWidthPt: Math.max(1, KnexPdfGeometryMath.roundCss(input.cssWidth ?? 1)),
      pageHeightPt: Math.max(1, KnexPdfGeometryMath.roundCss(input.cssHeight ?? 1)),
      aspectRatio:
        Math.max(1, input.cssWidth ?? 1) / Math.max(1, input.cssHeight ?? 1),
      rotation: 0,
      elements: [],
      extractionMode: "digital",
      confidence: 0,
      extractedAt: Date.now(),
      blueprintVersion: "1.0",
      suggestedRenderMode: "blueprint",
      isScannedOnly: false,
      hasFormFields: false,
      hasAnnotations: false,
      canRenderAsCanvas: false,
      requiresDomComposition: true,
      suggestLayeredRendering: false,
      debug: {
        extractionTimeMs: buildTimeMs,
        textBlockCount: 0,
        imageCount: 0,
        shapeCount: 0,
        formFieldCount: 0,
        errorLog: errors,
      },
    };

    return {
      blueprint,
      warnings,
      errors,
      buildTimeMs,
      textBlocks: [],
      success: false,
    };
  }
}

export async function buildKnexPdfPageBlueprint(
  session: NativePdfSession,
  pageIndex: number,
  config: Partial<KnexPdfBlueprintBuilderConfig> = {},
): Promise<KnexPdfBlueprintBuildResultWithText> {
  return buildKnexPdfPageBlueprintFromSession({
    session,
    pageNumber: pageIndex + 1,
    config,
  });
}

export async function buildKnexPdfBlueprintsForRange(
  session: NativePdfSession,
  startPage: number,
  endPage: number,
  config: Partial<KnexPdfBlueprintBuilderConfig> = {},
): Promise<KnexPdfBlueprintBuildResultWithText[]> {
  const results: KnexPdfBlueprintBuildResultWithText[] = [];
  const lastPageIndex = Math.min(endPage, session.pageCount - 1);

  for (let pageIndex = startPage; pageIndex <= lastPageIndex; pageIndex += 1) {
    results.push(await buildKnexPdfPageBlueprint(session, pageIndex, config));
  }

  return results;
}
