import type {
  KnexPdfSemanticTextBlock,
  KnexPdfVisualTextLayerMode,
} from "../core/engineTypes";

export type SemanticTextLayerVisibilityMode =
  | "hidden"
  | "semantic"
  | "visual"
  | "hybrid";

export type SemanticTextLayerModel = {
  pageNumber: number;
  blocks: KnexPdfSemanticTextBlock[];

  /**
   * Compatibilidade com o modelo antigo.
   *
   * Atenção: `visible` indica apenas que existe uma camada textual ativa.
   * A decisão sobre renderização visível deve usar `mode`, `semanticBlocks`
   * e `visualBlocks`.
   */
  visible: boolean;

  /**
   * Modo lógico de funcionamento da camada.
   */
  mode: SemanticTextLayerVisibilityMode;

  /**
   * Blocos usados para seleção, cópia, busca e acessibilidade.
   */
  semanticBlocks: KnexPdfSemanticTextBlock[];

  /**
   * Blocos candidatos à renderização visual HTML/CSS.
   */
  visualBlocks: KnexPdfSemanticTextBlock[];

  /**
   * Diagnóstico.
   */
  hasText: boolean;
  textBlockCount: number;
  semanticBlockCount: number;
  visualBlockCount: number;
};

function getGlobalValue(key: string): unknown {
  return (globalThis as unknown as Record<string, unknown>)[key];
}

function getGlobalBoolean(key: string): boolean | undefined {
  const value = getGlobalValue(key);

  if (value === true || value === "true" || value === "1") return true;
  if (value === false || value === "false" || value === "0") return false;

  return undefined;
}

function getGlobalVisualTextLayerMode(): KnexPdfVisualTextLayerMode {
  const forced = getGlobalBoolean("KNEX_PDF_FORCE_VISUAL_TEXT_LAYER");

  if (forced === true) {
    return "hybrid";
  }

  const value = getGlobalValue("KNEX_PDF_VISUAL_TEXT_LAYER");

  if (value === true || value === "true" || value === "1") {
    return "hybrid";
  }

  if (
    value === "disabled" ||
    value === "semantic" ||
    value === "visual" ||
    value === "hybrid"
  ) {
    return value;
  }

  return "semantic";
}

function normalizeTextLayerMode(
  mode: KnexPdfVisualTextLayerMode,
): SemanticTextLayerVisibilityMode {
  if (mode === "disabled") return "hidden";
  return mode;
}

function hasUsefulText(block: KnexPdfSemanticTextBlock): boolean {
  return typeof block.text === "string" && block.text.trim().length > 0;
}

function safeNumber(value: number | null | undefined, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function hasUsableGeometry(block: KnexPdfSemanticTextBlock): boolean {
  return (
    safeNumber(block.width, 0) > 0 &&
    safeNumber(block.height, 0) > 0 &&
    safeNumber(block.fontSize, 0) > 0
  );
}

function isVisualTextCandidate(block: KnexPdfSemanticTextBlock): boolean {
  if (!hasUsefulText(block)) return false;
  if (!hasUsableGeometry(block)) return false;
  if (block.decorative) return false;
  if (block.rasterized) return false;

  const confidence = safeNumber(block.confidence, 1);

  /**
   * Mantemos o limite relativamente baixo porque a reconstrução do PDFium
   * ainda pode ter metadados incompletos, mas não aceitamos blocos claramente
   * duvidosos para renderização visual.
   */
  if (confidence < 0.35) return false;

  return true;
}

function getBlockReadingOrder(block: KnexPdfSemanticTextBlock): number {
  return safeNumber(block.readingOrder, Number.MAX_SAFE_INTEGER);
}

function getBlockLineIndex(block: KnexPdfSemanticTextBlock): number {
  return safeNumber(block.lineIndex, Number.MAX_SAFE_INTEGER);
}

function sortTextBlocks(
  blocks: KnexPdfSemanticTextBlock[],
): KnexPdfSemanticTextBlock[] {
  return [...blocks].sort((a, b) => {
    const readingOrderDelta = getBlockReadingOrder(a) - getBlockReadingOrder(b);
    if (readingOrderDelta !== 0) return readingOrderDelta;

    const lineDelta = getBlockLineIndex(a) - getBlockLineIndex(b);
    if (lineDelta !== 0) return lineDelta;

    const yDelta = safeNumber(a.y, 0) - safeNumber(b.y, 0);
    if (Math.abs(yDelta) > 0.5) return yDelta;

    return safeNumber(a.x, 0) - safeNumber(b.x, 0);
  });
}

function normalizeBlockForMode(
  block: KnexPdfSemanticTextBlock,
  mode: SemanticTextLayerVisibilityMode,
): KnexPdfSemanticTextBlock {
  if (mode === "visual" || mode === "hybrid") {
    return {
      ...block,
      text: block.text.trim(),
      textRenderMode: mode,
    };
  }

  if (mode === "semantic") {
    return {
      ...block,
      text: block.text.trim(),
      textRenderMode: "semantic",
    };
  }

  return {
    ...block,
    text: block.text.trim(),
  };
}

function toSemanticBlock(
  block: KnexPdfSemanticTextBlock,
): KnexPdfSemanticTextBlock {
  return {
    ...block,
    textRenderMode: "semantic",
  };
}

function toVisualBlock(
  block: KnexPdfSemanticTextBlock,
  mode: SemanticTextLayerVisibilityMode,
): KnexPdfSemanticTextBlock {
  return {
    ...block,
    textRenderMode: mode === "hybrid" ? "hybrid" : "visual",
  };
}

export function createSemanticTextLayerModel(input: {
  pageNumber: number;
  blocks: KnexPdfSemanticTextBlock[];
  mode?: KnexPdfVisualTextLayerMode;
}): SemanticTextLayerModel {
  const requestedMode = input.mode ?? getGlobalVisualTextLayerMode();
  const mode = normalizeTextLayerMode(requestedMode);

  const blocks = sortTextBlocks(
    input.blocks
      .filter(hasUsefulText)
      .map((block) => normalizeBlockForMode(block, mode)),
  );

  const semanticBlocks =
    mode === "hidden" ? [] : blocks.map((block) => toSemanticBlock(block));

  const visualBlocks =
    mode === "visual" || mode === "hybrid"
      ? blocks.filter(isVisualTextCandidate).map((block) => toVisualBlock(block, mode))
      : [];

  return {
    pageNumber: input.pageNumber,
    blocks,
    visible: mode !== "hidden",
    mode,
    semanticBlocks,
    visualBlocks,
    hasText: blocks.length > 0,
    textBlockCount: blocks.length,
    semanticBlockCount: semanticBlocks.length,
    visualBlockCount: visualBlocks.length,
  };
}
