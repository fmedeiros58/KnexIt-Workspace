export type PdfZoomRenderPhase = string;

export type PdfZoomBasePageSize = {
  width: number;
  height: number;
};

export type PdfWheelDeltaMode = 0 | 1 | 2 | number;

export type PdfZoomFramePolicyInput = {
  zoom: number;
  basePageSize: PdfZoomBasePageSize;
  renderPhase: PdfZoomRenderPhase;
  isZooming: boolean;
  isScrolling: boolean;
  isWarmupPage: boolean;
  showTextLayer: boolean;
  enableSelection: boolean;
  modularPagePipelineEnabled: boolean;
  blueprintPagePipelineEnabled: boolean;
  minLayoutScale?: number;
  maxLayoutScale?: number;

  /**
   * Multiplicadores opcionais para interação via roda do mouse.
   *
   * Padrão:
   * - rolagem: 2x
   * - zoom: 2x
   */
  wheelScrollMultiplier?: number;
  wheelZoomMultiplier?: number;
};

export type PdfZoomFramePolicy = {
  layoutScale: number;
  pageCssWidth: number;
  pageCssHeight: number;

  pageSemanticDataAvailable: boolean;

  /**
   * A camada visual de texto pode continuar montada durante zoom.
   * Isso evita a sensação de o canvas crescer antes do texto.
   */
  canPresentVisualText: boolean;

  /**
   * Interações finas ficam suspensas durante zoom/scroll.
   */
  canInteractWithText: boolean;
  canRenderLinks: boolean;
  canRenderHighlights: boolean;

  /**
   * No blueprint/modular, a seleção nativa do navegador deve ser evitada.
   */
  canUseNativeSelection: boolean;
  shouldUseGeometrySelection: boolean;
  shouldClearNativeSelection: boolean;

  shouldKeepTextMountedDuringZoom: boolean;
  shouldSuspendSelectionDuringZoom: boolean;
  shouldSuspendLinksDuringZoom: boolean;
  shouldSuspendHighlightsDuringZoom: boolean;

  /**
   * Política de aceleração de wheel.
   *
   * Esses valores devem ser consumidos pelo hook/handler que escuta o evento
   * wheel. Este arquivo apenas centraliza a política.
   */
  wheelScrollMultiplier: number;
  wheelZoomMultiplier: number;
  maxWheelScrollStepPx: number;
  maxWheelZoomStepPercent: number;
};

const DEFAULT_MIN_LAYOUT_SCALE = 0.01;
const DEFAULT_MAX_LAYOUT_SCALE = 80;

const DEFAULT_WHEEL_SCROLL_MULTIPLIER = 2;
const DEFAULT_WHEEL_ZOOM_MULTIPLIER = 2;

const MIN_WHEEL_MULTIPLIER = 0.25;
const MAX_WHEEL_MULTIPLIER = 4;

/**
 * Limites de segurança.
 *
 * A rolagem pode ser rápida, mas não deve saltar blocos inteiros de página
 * por acidente. O zoom também não deve variar demais em um único evento wheel.
 */
const DEFAULT_MAX_WHEEL_SCROLL_STEP_PX = 180;
const DEFAULT_MAX_WHEEL_ZOOM_STEP_PERCENT = 24;

const DEFAULT_WHEEL_LINE_HEIGHT_PX = 16;
const DEFAULT_WHEEL_PAGE_HEIGHT_PX = 800;

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

function clampAbs(value: number, maxAbs: number): number {
  const safeMaxAbs = Math.max(0, safeNumber(maxAbs, 0));

  if (safeMaxAbs <= 0) return 0;

  return clamp(value, -safeMaxAbs, safeMaxAbs);
}

function resolveWheelMultiplier(
  value: number | null | undefined,
  fallback: number,
): number {
  return clamp(
    safeNumber(value, fallback),
    MIN_WHEEL_MULTIPLIER,
    MAX_WHEEL_MULTIPLIER,
  );
}

export function getPdfLayoutScaleFromZoom(input: {
  zoom: number;
  minLayoutScale?: number;
  maxLayoutScale?: number;
}): number {
  return clamp(
    safeNumber(input.zoom, 100) / 100,
    safeNumber(input.minLayoutScale, DEFAULT_MIN_LAYOUT_SCALE),
    safeNumber(input.maxLayoutScale, DEFAULT_MAX_LAYOUT_SCALE),
  );
}

export function getPdfPageCssSizeFromZoom(input: {
  basePageSize: PdfZoomBasePageSize;
  layoutScale: number;
}): { pageCssWidth: number; pageCssHeight: number } {
  return {
    pageCssWidth: Math.max(
      1,
      Math.ceil(safeNumber(input.basePageSize.width, 1) * input.layoutScale),
    ),
    pageCssHeight: Math.max(
      1,
      Math.ceil(safeNumber(input.basePageSize.height, 1) * input.layoutScale),
    ),
  };
}

/**
 * Normaliza deltaY da roda do mouse para pixels.
 *
 * deltaMode:
 * - 0: pixels
 * - 1: linhas
 * - 2: páginas
 */
export function normalizePdfWheelDeltaToPixels(input: {
  deltaY: number;
  deltaMode?: PdfWheelDeltaMode;
  lineHeightPx?: number;
  pageHeightPx?: number;
}): number {
  const deltaY = safeNumber(input.deltaY, 0);
  const deltaMode = safeNumber(input.deltaMode, 0);
  const lineHeightPx = Math.max(
    1,
    safeNumber(input.lineHeightPx, DEFAULT_WHEEL_LINE_HEIGHT_PX),
  );
  const pageHeightPx = Math.max(
    1,
    safeNumber(input.pageHeightPx, DEFAULT_WHEEL_PAGE_HEIGHT_PX),
  );

  if (deltaMode === 1) {
    return deltaY * lineHeightPx;
  }

  if (deltaMode === 2) {
    return deltaY * pageHeightPx;
  }

  return deltaY;
}

/**
 * Retorna o deslocamento de rolagem acelerado.
 *
 * Uso previsto no handler de wheel:
 *
 * const deltaY = getAcceleratedPdfWheelScrollDelta({
 *   deltaY: event.deltaY,
 *   deltaMode: event.deltaMode,
 *   multiplier: zoomFrame.wheelScrollMultiplier,
 * });
 */
export function getAcceleratedPdfWheelScrollDelta(input: {
  deltaY: number;
  deltaMode?: PdfWheelDeltaMode;
  multiplier?: number;
  lineHeightPx?: number;
  pageHeightPx?: number;
  maxStepPx?: number;
}): number {
  const normalizedDelta = normalizePdfWheelDeltaToPixels({
    deltaY: input.deltaY,
    deltaMode: input.deltaMode,
    lineHeightPx: input.lineHeightPx,
    pageHeightPx: input.pageHeightPx,
  });

  const multiplier = resolveWheelMultiplier(
    input.multiplier,
    DEFAULT_WHEEL_SCROLL_MULTIPLIER,
  );

  const maxStepPx = Math.max(
    1,
    safeNumber(input.maxStepPx, DEFAULT_MAX_WHEEL_SCROLL_STEP_PX),
  );

  return clampAbs(normalizedDelta * multiplier, maxStepPx);
}

/**
 * Retorna o passo de zoom acelerado em pontos percentuais.
 *
 * Exemplo:
 * - retorno 8 significa aumentar 8 pontos percentuais no zoom;
 * - retorno -8 significa reduzir 8 pontos percentuais no zoom.
 *
 * O sinal é invertido em relação ao deltaY:
 * - wheel para cima tende a aproximar;
 * - wheel para baixo tende a afastar.
 */
export function getAcceleratedPdfWheelZoomStep(input: {
  deltaY: number;
  deltaMode?: PdfWheelDeltaMode;
  multiplier?: number;
  baseStepPercent?: number;
  maxStepPercent?: number;
}): number {
  const normalizedDelta = normalizePdfWheelDeltaToPixels({
    deltaY: input.deltaY,
    deltaMode: input.deltaMode,
  });

  const multiplier = resolveWheelMultiplier(
    input.multiplier,
    DEFAULT_WHEEL_ZOOM_MULTIPLIER,
  );

  const baseStepPercent = Math.max(
    1,
    safeNumber(input.baseStepPercent, 6),
  );

  const maxStepPercent = Math.max(
    baseStepPercent,
    safeNumber(input.maxStepPercent, DEFAULT_MAX_WHEEL_ZOOM_STEP_PERCENT),
  );

  if (normalizedDelta === 0) return 0;

  const direction = normalizedDelta > 0 ? -1 : 1;
  const intensity = Math.min(3, Math.max(1, Math.abs(normalizedDelta) / 100));
  const rawStep = direction * baseStepPercent * multiplier * intensity;

  return clampAbs(rawStep, maxStepPercent);
}

export function resolvePdfZoomFramePolicy(
  input: PdfZoomFramePolicyInput,
): PdfZoomFramePolicy {
  const layoutScale = getPdfLayoutScaleFromZoom({
    zoom: input.zoom,
    minLayoutScale: input.minLayoutScale,
    maxLayoutScale: input.maxLayoutScale,
  });

  const { pageCssWidth, pageCssHeight } = getPdfPageCssSizeFromZoom({
    basePageSize: input.basePageSize,
    layoutScale,
  });

  const isSettledFinal = input.renderPhase === "settled-final";
  const isInteractionFrame = input.isZooming || input.isScrolling;

  /*
   * Ponto central:
   * O texto visual não deve depender de !isZooming.
   * Durante zoom/scroll, reaproveitamos a camada textual existente
   * e suspendemos apenas interação fina.
   */
  const pageSemanticDataAvailable =
    !input.isWarmupPage && (isSettledFinal || isInteractionFrame);

  const wantsTextLayer = input.showTextLayer || input.enableSelection;

  const canPresentVisualText =
    pageSemanticDataAvailable && wantsTextLayer;

  const canInteractWithText =
    isSettledFinal &&
    !input.isZooming &&
    !input.isScrolling &&
    !input.isWarmupPage &&
    input.enableSelection;

  const canRenderLinks =
    isSettledFinal &&
    !input.isZooming &&
    !input.isScrolling &&
    !input.isWarmupPage;

  const canRenderHighlights =
    isSettledFinal &&
    !input.isZooming &&
    !input.isScrolling &&
    !input.isWarmupPage;

  const isBlueprintOrModular =
    input.blueprintPagePipelineEnabled || input.modularPagePipelineEnabled;

  const canUseNativeSelection =
    canInteractWithText && !isBlueprintOrModular;

  const shouldUseGeometrySelection =
    canInteractWithText && isBlueprintOrModular;

  const shouldClearNativeSelection =
    isBlueprintOrModular &&
    (input.isZooming || input.isScrolling || shouldUseGeometrySelection);

  const wheelScrollMultiplier = resolveWheelMultiplier(
    input.wheelScrollMultiplier,
    DEFAULT_WHEEL_SCROLL_MULTIPLIER,
  );

  const wheelZoomMultiplier = resolveWheelMultiplier(
    input.wheelZoomMultiplier,
    DEFAULT_WHEEL_ZOOM_MULTIPLIER,
  );

  return {
    layoutScale,
    pageCssWidth,
    pageCssHeight,

    pageSemanticDataAvailable,
    canPresentVisualText,
    canInteractWithText,
    canRenderLinks,
    canRenderHighlights,

    canUseNativeSelection,
    shouldUseGeometrySelection,
    shouldClearNativeSelection,

    shouldKeepTextMountedDuringZoom:
      canPresentVisualText && input.isZooming,

    shouldSuspendSelectionDuringZoom:
      input.enableSelection && (input.isZooming || input.isScrolling),

    shouldSuspendLinksDuringZoom:
      input.isZooming || input.isScrolling,

    shouldSuspendHighlightsDuringZoom:
      input.isZooming || input.isScrolling,

    wheelScrollMultiplier,
    wheelZoomMultiplier,
    maxWheelScrollStepPx: DEFAULT_MAX_WHEEL_SCROLL_STEP_PX,
    maxWheelZoomStepPercent: DEFAULT_MAX_WHEEL_ZOOM_STEP_PERCENT,
  };
}