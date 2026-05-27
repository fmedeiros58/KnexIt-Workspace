import {
  KNEX_PDF_MAX_CANVAS_PIXELS,
  KNEX_PDF_MAX_CANVAS_SIDE,
  KNEX_PDF_MAX_OUTPUT_SCALE,
  KNEX_PDF_QUALITY_MULTIPLIER,
} from "../core/engineConfig";
import type {
  KnexPdfDeviceCapabilities,
  KnexPdfRenderQuality,
  KnexPdfRenderQualityInput,
} from "../core/engineTypes";
import { detectKnexPdfDeviceCapabilities } from "../platform/DeviceCapabilities";

type KnexPdfResolvedQualityConfig = {
  quality: KnexPdfRenderQuality;
  preferredScale: number;
  maxCanvasPixels: number;
  maxCanvasSide: number;
  devicePixelRatio: number;
  memoryFactor: number;
  qualityMultiplier: number;
};

export type KnexPdfRenderPhase =
  | "interactive-preview"
  | "warmup-preview"
  | "settled-final";

export type KnexPdfRenderBackendKind = "pdfjs" | "pdfium" | "mupdf";

export const PDFIUM_INTERACTIVE_RENDER_BUDGET_MS = 120;
export const PDFIUM_FINAL_RENDER_WARNING_MS = 800;

/**
 * PDFium/MuPDF no Knexread passam por:
 * PDF WASM -> bitmap BGRA/RGBA -> ImageData/Canvas.
 *
 * Durante o gesto de zoom, a prioridade é fluidez.
 * Por isso o preview interativo fica em escala moderada.
 */
export const PDFIUM_INTERACTIVE_MIN_OUTPUT_SCALE = 1.5;
export const PDFIUM_INTERACTIVE_MAX_OUTPUT_SCALE = 2.25;
export const PDFIUM_WARMUP_MAX_OUTPUT_SCALE = 3;

/**
 * Piso final para página estabilizada.
 *
 * Este é o ponto crítico para impedir que o Knexread substitua um canvas
 * visualmente melhor por um bitmap final inferior após o scrollzoom.
 *
 * Se o settled-final voltar com outputScale baixo, o texto volta serrilhado.
 */
export const PDFIUM_FINAL_MIN_OUTPUT_SCALE = 5;

/**
 * Limite superior final.
 *
 * Deixamos o teto em 5, mas ele ainda respeita KNEX_PDF_MAX_OUTPUT_SCALE.
 * Se KNEX_PDF_MAX_OUTPUT_SCALE for 4 no engineConfig, o teto real continuará 4.
 */
export const PDFIUM_FINAL_MAX_OUTPUT_SCALE = 6;

/**
 * Qualidade final padrão para PDFium/MuPDF.
 *
 * Agora o settled-final usa "extreme" por padrão.
 * Isso é importante para testar a melhor nitidez possível antes de decidir
 * otimizações de memória/cache/tile rendering.
 */
export const PDFIUM_DEFAULT_FINAL_RENDER_QUALITY: KnexPdfRenderQuality =
  "extreme";

/**
 * Piso mínimo de pixels por qualidade.
 *
 * Esses valores impedem que o cálculo de outputScale economize demais o bitmap
 * final e produza texto serrilhado.
 */
const MIN_CANVAS_PIXELS_BY_QUALITY: Record<KnexPdfRenderQuality, number> = {
  draft: 8_000_000,
  standard: 14_000_000,
  high: 32_000_000,
  ultra: 64_000_000,
  extreme: 96_000_000,
};

/**
 * Piso mínimo de escala por qualidade.
 *
 * Este piso é decisivo para qualidade das letras. Mesmo em tela DPR 1, texto
 * pequeno no canvas precisa de bitmap interno maior que o tamanho CSS.
 */
const MIN_OUTPUT_SCALE_BY_QUALITY: Record<KnexPdfRenderQuality, number> = {
  draft: 1,
  standard: 1.25,
  high: 2,
  ultra: 2.75,
  extreme: 3.25,
};

/**
 * Redução progressiva por classe de máquina.
 * O objetivo é evitar travamento em máquina fraca, mas sem destruir a nitidez.
 */
const PERFORMANCE_MEMORY_FACTOR: Record<string, number> = {
  high: 1.25,
  medium: 1,
  low: 0.82,
};

const QUALITY_RANK: Record<KnexPdfRenderQuality, number> = {
  draft: 1,
  standard: 2,
  high: 3,
  ultra: 4,
  extreme: 5,
};

const VALID_RENDER_QUALITIES: KnexPdfRenderQuality[] = [
  "draft",
  "standard",
  "high",
  "ultra",
  "extreme",
];

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

function clampOutputScale(input: {
  value: number;
  min: number;
  max: number;
}): number {
  const safeMax = Math.max(1, safeNumber(input.max, 1));
  const safeMin = Math.min(
    safeMax,
    Math.max(1, safeNumber(input.min, 1)),
  );

  return clamp(input.value, safeMin, safeMax);
}

function getGlobalValue(key: string): unknown {
  return (globalThis as unknown as Record<string, unknown>)[key];
}

function getGlobalString(key: string): string | undefined {
  const value = getGlobalValue(key);

  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : undefined;
}

function getGlobalNumber(key: string): number | undefined {
  const value = getGlobalValue(key);

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function normalizeGlobalRenderQuality(
  value: string | undefined,
): KnexPdfRenderQuality | undefined {
  if (!value) return undefined;

  return VALID_RENDER_QUALITIES.includes(value as KnexPdfRenderQuality)
    ? (value as KnexPdfRenderQuality)
    : undefined;
}

function getDevicePixelRatio(capabilities: KnexPdfDeviceCapabilities): number {
  return clamp(safeNumber(capabilities.devicePixelRatio, 1), 1, 4);
}

function getQualityMultiplier(quality: KnexPdfRenderQuality): number {
  const multiplier = KNEX_PDF_QUALITY_MULTIPLIER[quality];

  return Math.max(0.5, safeNumber(multiplier, 1));
}

function getConfiguredMaxCanvasPixels(quality: KnexPdfRenderQuality): number {
  const configured = KNEX_PDF_MAX_CANVAS_PIXELS[quality];
  const minimum = MIN_CANVAS_PIXELS_BY_QUALITY[quality];

  return Math.max(minimum, safeNumber(configured, minimum));
}

function resolveMemoryFactor(input: {
  quality: KnexPdfRenderQuality;
  capabilities: KnexPdfDeviceCapabilities;
}): number {
  const { quality, capabilities } = input;

  if (capabilities.platform === "mobile") {
    if (quality === "extreme") return 0.75;
    if (quality === "ultra") return 0.82;
    return 0.78;
  }

  const performanceFactor =
    PERFORMANCE_MEMORY_FACTOR[capabilities.performanceClass] ?? 0.95;

  if (quality === "extreme") {
    return Math.max(performanceFactor, 1.12);
  }

  if (quality === "ultra") {
    return Math.max(performanceFactor, 1.05);
  }

  if (quality === "high") {
    return Math.max(performanceFactor, 1);
  }

  return performanceFactor;
}

function computePreferredScale(input: {
  quality: KnexPdfRenderQuality;
  capabilities: KnexPdfDeviceCapabilities;
}): number {
  const dpr = getDevicePixelRatio(input.capabilities);
  const multiplier = getQualityMultiplier(input.quality);
  const minimumScale = MIN_OUTPUT_SCALE_BY_QUALITY[input.quality];

  return clamp(
    Math.max(minimumScale, dpr * multiplier),
    1,
    KNEX_PDF_MAX_OUTPUT_SCALE,
  );
}

export function normalizeKnexPdfRenderQuality(
  quality?: KnexPdfRenderQualityInput,
): KnexPdfRenderQuality {
  if (!quality || quality === "auto") return "extreme";
  if (quality === "economy") return "draft";
  if (quality === "very-high") return "ultra";

  return quality;
}

function capQualityAt(
  quality: KnexPdfRenderQuality,
  maxQuality: KnexPdfRenderQuality,
): KnexPdfRenderQuality {
  return QUALITY_RANK[quality] > QUALITY_RANK[maxQuality]
    ? maxQuality
    : quality;
}

function capQualityAtStandard(
  quality: KnexPdfRenderQuality,
): KnexPdfRenderQuality {
  return capQualityAt(quality, "standard");
}

function capQualityAtHigh(
  quality: KnexPdfRenderQuality,
): KnexPdfRenderQuality {
  return capQualityAt(quality, "high");
}

function resolveWasmFinalQualityCap(): KnexPdfRenderQuality {
  /**
   * Permite testar em console sem recompilar:
   *
   * globalThis.KNEX_PDFIUM_FINAL_RENDER_QUALITY = "high";
   * globalThis.KNEX_PDFIUM_FINAL_RENDER_QUALITY = "ultra";
   * globalThis.KNEX_PDFIUM_FINAL_RENDER_QUALITY = "extreme";
   *
   * Também aceitamos a chave genérica para MuPDF/PDFium.
   */
  return (
    normalizeGlobalRenderQuality(
      getGlobalString("KNEX_PDFIUM_FINAL_RENDER_QUALITY"),
    ) ??
    normalizeGlobalRenderQuality(
      getGlobalString("__KNEX_PDFIUM_FINAL_RENDER_QUALITY__"),
    ) ??
    normalizeGlobalRenderQuality(
      getGlobalString("KNEX_WASM_PDF_FINAL_RENDER_QUALITY"),
    ) ??
    PDFIUM_DEFAULT_FINAL_RENDER_QUALITY
  );
}

function isWasmPdfBackend(backend: KnexPdfRenderBackendKind): boolean {
  return backend === "pdfium" || backend === "mupdf";
}

export function resolveRenderQualityForPhase(input: {
  backend: KnexPdfRenderBackendKind;
  phase: KnexPdfRenderPhase;
  requestedQuality: KnexPdfRenderQualityInput;
  zoom: number;
}): KnexPdfRenderQuality {
  const requestedQuality = normalizeKnexPdfRenderQuality(input.requestedQuality);

  if (isWasmPdfBackend(input.backend)) {
    if (input.phase === "interactive-preview") {
      return capQualityAtStandard(requestedQuality);
    }

    if (input.phase === "warmup-preview") {
      return capQualityAtHigh(requestedQuality);
    }

    /**
     * Settled-final de PDFium/MuPDF:
     * usa "extreme" por padrão, salvo override global.
     */
    return capQualityAt(requestedQuality, resolveWasmFinalQualityCap());
  }

  if (input.phase === "settled-final") {
    return requestedQuality;
  }

  return capQualityAtHigh(requestedQuality);
}

function resolveWasmMaxOutputScaleForPhase(
  phase: KnexPdfRenderPhase,
): number {
  const genericOverride = getGlobalNumber("KNEX_WASM_PDF_MAX_OUTPUT_SCALE");

  if (phase === "interactive-preview") {
    return clamp(
      getGlobalNumber("KNEX_PDFIUM_INTERACTIVE_MAX_OUTPUT_SCALE") ??
        genericOverride ??
        PDFIUM_INTERACTIVE_MAX_OUTPUT_SCALE,
      1,
      KNEX_PDF_MAX_OUTPUT_SCALE,
    );
  }

  if (phase === "warmup-preview") {
    return clamp(
      getGlobalNumber("KNEX_PDFIUM_WARMUP_MAX_OUTPUT_SCALE") ??
        genericOverride ??
        PDFIUM_WARMUP_MAX_OUTPUT_SCALE,
      1,
      KNEX_PDF_MAX_OUTPUT_SCALE,
    );
  }

  return clamp(
    getGlobalNumber("KNEX_PDFIUM_MAX_OUTPUT_SCALE") ??
      getGlobalNumber("KNEX_PDFIUM_FINAL_MAX_OUTPUT_SCALE") ??
      genericOverride ??
      PDFIUM_FINAL_MAX_OUTPUT_SCALE,
    1,
    KNEX_PDF_MAX_OUTPUT_SCALE,
  );
}

function resolveWasmMinOutputScaleForPhase(
  phase: KnexPdfRenderPhase,
): number {
  const genericOverride = getGlobalNumber("KNEX_WASM_PDF_MIN_OUTPUT_SCALE");

  if (phase === "interactive-preview") {
    return clamp(
      getGlobalNumber("KNEX_PDFIUM_INTERACTIVE_MIN_OUTPUT_SCALE") ??
        genericOverride ??
        PDFIUM_INTERACTIVE_MIN_OUTPUT_SCALE,
      1,
      KNEX_PDF_MAX_OUTPUT_SCALE,
    );
  }

  if (phase === "warmup-preview") {
    return clamp(
      getGlobalNumber("KNEX_PDFIUM_WARMUP_MIN_OUTPUT_SCALE") ??
        genericOverride ??
        2,
      1,
      KNEX_PDF_MAX_OUTPUT_SCALE,
    );
  }

  return clamp(
    getGlobalNumber("KNEX_PDFIUM_FINAL_MIN_OUTPUT_SCALE") ??
      genericOverride ??
      PDFIUM_FINAL_MIN_OUTPUT_SCALE,
    1,
    KNEX_PDF_MAX_OUTPUT_SCALE,
  );
}

export function clampKnexPdfOutputScaleForRenderPhase(input: {
  backend: KnexPdfRenderBackendKind;
  phase: KnexPdfRenderPhase;
  outputScale: number;
}) {
  if (!isWasmPdfBackend(input.backend)) {
    return Math.max(1, safeNumber(input.outputScale, 1));
  }

  const maxOutputScale = resolveWasmMaxOutputScaleForPhase(input.phase);
  const minOutputScale = resolveWasmMinOutputScaleForPhase(input.phase);

  return clampOutputScale({
    value: safeNumber(input.outputScale, 1),
    min: minOutputScale,
    max: maxOutputScale,
  });
}

export function resolveKnexPdfQualityConfig(input: {
  quality?: KnexPdfRenderQualityInput;
  capabilities?: KnexPdfDeviceCapabilities;
}): KnexPdfResolvedQualityConfig {
  const quality = normalizeKnexPdfRenderQuality(input.quality);
  const capabilities = input.capabilities ?? detectKnexPdfDeviceCapabilities();
  const devicePixelRatio = getDevicePixelRatio(capabilities);
  const qualityMultiplier = getQualityMultiplier(quality);
  const memoryFactor = resolveMemoryFactor({
    quality,
    capabilities,
  });

  const configuredMaxCanvasPixels = getConfiguredMaxCanvasPixels(quality);

  return {
    quality,
    preferredScale: computePreferredScale({
      quality,
      capabilities,
    }),
    maxCanvasPixels: Math.max(
      MIN_CANVAS_PIXELS_BY_QUALITY[quality],
      Math.floor(configuredMaxCanvasPixels * memoryFactor),
    ),
    maxCanvasSide: Math.max(1024, safeNumber(KNEX_PDF_MAX_CANVAS_SIDE, 8192)),
    devicePixelRatio,
    memoryFactor,
    qualityMultiplier,
  };
}

/**
 * Calcula o outputScale final para o canvas.
 *
 * Regras:
 * - prioriza nitidez em HiDPI;
 * - respeita limite máximo de pixels;
 * - respeita limite máximo de lado;
 * - nunca usa CSS transform para compensar baixa resolução;
 * - nunca retorna NaN/Infinity;
 * - evita escala menor que 1;
 * - mantém piso maior para high/ultra/extreme, reduzindo serrilhado.
 */
export function computeKnexPdfOutputScale(input: {
  cssWidth: number;
  cssHeight: number;
  quality?: KnexPdfRenderQualityInput;
  capabilities?: KnexPdfDeviceCapabilities;
}) {
  const cssWidth = Math.max(1, Math.ceil(safeNumber(input.cssWidth, 1)));
  const cssHeight = Math.max(1, Math.ceil(safeNumber(input.cssHeight, 1)));

  const qualityConfig = resolveKnexPdfQualityConfig({
    quality: input.quality,
    capabilities: input.capabilities,
  });

  const cssPixels = Math.max(1, cssWidth * cssHeight);

  const maxScaleByPixels = Math.sqrt(
    qualityConfig.maxCanvasPixels / cssPixels,
  );

  const maxScaleBySide = Math.min(
    qualityConfig.maxCanvasSide / cssWidth,
    qualityConfig.maxCanvasSide / cssHeight,
  );

  const maxAllowedScale = Math.max(
    1,
    Math.min(
      KNEX_PDF_MAX_OUTPUT_SCALE,
      maxScaleByPixels,
      maxScaleBySide,
    ),
  );

  return clampOutputScale({
    value: qualityConfig.preferredScale,
    min: MIN_OUTPUT_SCALE_BY_QUALITY[qualityConfig.quality],
    max: maxAllowedScale,
  });
}

/**
 * Versão auxiliar para debug visual.
 * Pode ser usada temporariamente no console para entender por que uma página
 * ficou em determinado outputScale.
 */
export function explainKnexPdfOutputScale(input: {
  cssWidth: number;
  cssHeight: number;
  quality?: KnexPdfRenderQualityInput;
  capabilities?: KnexPdfDeviceCapabilities;
}) {
  const cssWidth = Math.max(1, Math.ceil(safeNumber(input.cssWidth, 1)));
  const cssHeight = Math.max(1, Math.ceil(safeNumber(input.cssHeight, 1)));
  const qualityConfig = resolveKnexPdfQualityConfig({
    quality: input.quality,
    capabilities: input.capabilities,
  });

  const cssPixels = Math.max(1, cssWidth * cssHeight);
  const maxScaleByPixels = Math.sqrt(
    qualityConfig.maxCanvasPixels / cssPixels,
  );
  const maxScaleBySide = Math.min(
    qualityConfig.maxCanvasSide / cssWidth,
    qualityConfig.maxCanvasSide / cssHeight,
  );

  const maxAllowedScale = Math.max(
    1,
    Math.min(
      KNEX_PDF_MAX_OUTPUT_SCALE,
      maxScaleByPixels,
      maxScaleBySide,
    ),
  );

  const outputScale = computeKnexPdfOutputScale({
    cssWidth,
    cssHeight,
    quality: input.quality,
    capabilities: input.capabilities,
  });

  return {
    cssWidth,
    cssHeight,
    cssPixels,
    quality: qualityConfig.quality,
    devicePixelRatio: qualityConfig.devicePixelRatio,
    qualityMultiplier: qualityConfig.qualityMultiplier,
    preferredScale: qualityConfig.preferredScale,
    minimumOutputScale: MIN_OUTPUT_SCALE_BY_QUALITY[qualityConfig.quality],
    maxCanvasPixels: qualityConfig.maxCanvasPixels,
    maxCanvasSide: qualityConfig.maxCanvasSide,
    maxScaleByPixels,
    maxScaleBySide,
    maxAllowedScale,
    maxOutputScale: KNEX_PDF_MAX_OUTPUT_SCALE,
    outputScale,
    bitmapWidth: Math.ceil(cssWidth * outputScale),
    bitmapHeight: Math.ceil(cssHeight * outputScale),
    bitmapPixels:
      Math.ceil(cssWidth * outputScale) *
      Math.ceil(cssHeight * outputScale),
  };
}

/**
 * Debug específico para fase/backend.
 * Útil para comparar se o valor calculado está sendo corretamente capado
 * quando o backend é PDFium/MuPDF.
 */
export function explainKnexPdfOutputScaleForRenderPhase(input: {
  backend: KnexPdfRenderBackendKind;
  phase: KnexPdfRenderPhase;
  cssWidth: number;
  cssHeight: number;
  quality?: KnexPdfRenderQualityInput;
  capabilities?: KnexPdfDeviceCapabilities;
}) {
  const base = explainKnexPdfOutputScale({
    cssWidth: input.cssWidth,
    cssHeight: input.cssHeight,
    quality: input.quality,
    capabilities: input.capabilities,
  });

  const clampedOutputScale = clampKnexPdfOutputScaleForRenderPhase({
    backend: input.backend,
    phase: input.phase,
    outputScale: base.outputScale,
  });

  return {
    ...base,
    backend: input.backend,
    phase: input.phase,
    wasmMinOutputScale: isWasmPdfBackend(input.backend)
      ? resolveWasmMinOutputScaleForPhase(input.phase)
      : undefined,
    wasmMaxOutputScale: isWasmPdfBackend(input.backend)
      ? resolveWasmMaxOutputScaleForPhase(input.phase)
      : undefined,
    unclampedOutputScale: base.outputScale,
    clampedOutputScale,
    phaseBitmapWidth: Math.ceil(base.cssWidth * clampedOutputScale),
    phaseBitmapHeight: Math.ceil(base.cssHeight * clampedOutputScale),
    phaseBitmapPixels:
      Math.ceil(base.cssWidth * clampedOutputScale) *
      Math.ceil(base.cssHeight * clampedOutputScale),
  };
}
