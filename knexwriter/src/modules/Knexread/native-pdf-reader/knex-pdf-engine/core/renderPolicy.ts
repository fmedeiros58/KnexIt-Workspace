import type {
  KnexPdfRenderMode,
  KnexPdfRenderQualityInput,
  KnexPdfTextLayerRenderMode,
} from "./engineTypes";
import type { KnexPdfRenderPhase } from "../rendering/RenderQualityController";

export type KnexPdfCanvasTextSuppressionStatus =
  | "unknown"
  | "ready"
  | "failed";

export type KnexPdfRenderPolicyInput = {
  activeBackend: string;
  preferredBackend?: string;
  zoom: number;
  devicePixelRatio?: number;
  renderPhase: KnexPdfRenderPhase;
  isZooming: boolean;
  isScrolling: boolean;
  isActivePage: boolean;
  isPageVisible: boolean;
  isWarmupPage: boolean;
  textBlockCount: number;
  averageTextConfidence?: number;
  requestedQuality: KnexPdfRenderQualityInput;
  cssWidth?: number;
  cssHeight?: number;
  canvasTextSuppressionStatus?: KnexPdfCanvasTextSuppressionStatus;
};

export type KnexPdfRenderPolicy = {
  renderMode: KnexPdfRenderMode;
  textLayerMode: KnexPdfTextLayerRenderMode;
  zoomBucket: number;
  devicePixelRatio: number;
  requestCanvasText: boolean;
  useSemanticTextLayer: boolean;
  useVisualTextLayer: boolean;
  visualTextLayerCandidate: boolean;
  maxBitmapPixels: number;
  shouldUseTileRendering: boolean;
  cacheKeyRenderMode: string;
  reason: string;
};

const VISUAL_TEXT_LAYER_ENABLE_FEATURE_FLAG =
  "KNEX_PDF_ENABLE_VISUAL_TEXT_LAYER";
const VISUAL_TEXT_LAYER_DISABLE_FEATURE_FLAG =
  "KNEX_PDF_DISABLE_VECTOR_TEXT_LAYER";
const LEGACY_VISUAL_TEXT_LAYER_FEATURE_FLAG = "KNEX_PDF_VISUAL_TEXT_LAYER";
const EXPERIMENTAL_VISUAL_TEXT_LAYER_FEATURE_FLAG =
  "KNEX_PDF_EXPERIMENTAL_VISUAL_TEXT_LAYER";

const MIN_VISUAL_TEXT_CONFIDENCE = 0.82;
const NORMAL_MAX_BITMAP_PIXELS = 64_000_000;
const HIGH_ZOOM_MAX_BITMAP_PIXELS = 96_000_000;
const TILE_RENDERING_ZOOM = 4;

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

function getRenderFeatureFlagValue(name: string): unknown {
  const globalFlag = (globalThis as unknown as Record<string, unknown>)[name];
  const envFlag =
    typeof process !== "undefined"
      ? process.env[`NEXT_PUBLIC_${name}`] ?? process.env[name]
      : undefined;

  return globalFlag ?? envFlag;
}

function isTrueFeatureFlag(value: unknown): boolean {
  return value === true || value === "true" || value === "1";
}

function isFalseFeatureFlag(value: unknown): boolean {
  return value === false || value === "false" || value === "0";
}

export function isKnexPdfVisualTextLayerPolicyEnabled(): boolean {
  if (
    !isTrueFeatureFlag(
      getRenderFeatureFlagValue(EXPERIMENTAL_VISUAL_TEXT_LAYER_FEATURE_FLAG),
    )
  ) {
    return false;
  }

  const legacyFlag = getRenderFeatureFlagValue(
    LEGACY_VISUAL_TEXT_LAYER_FEATURE_FLAG,
  );

  if (isFalseFeatureFlag(legacyFlag)) return false;
  if (isTrueFeatureFlag(legacyFlag)) return true;

  if (
    isTrueFeatureFlag(
      getRenderFeatureFlagValue(VISUAL_TEXT_LAYER_DISABLE_FEATURE_FLAG),
    )
  ) {
    return false;
  }

  return isTrueFeatureFlag(
    getRenderFeatureFlagValue(VISUAL_TEXT_LAYER_ENABLE_FEATURE_FLAG),
  );
}

export function normalizeKnexPdfZoomBucket(zoom: number): number {
  const scale = Math.max(0.01, safeNumber(zoom, 100) / 100);
  const step = scale < 2 ? 0.05 : scale < 4 ? 0.1 : 0.25;

  return Math.max(0.01, Math.round(scale / step) * step);
}

function resolveMaxBitmapPixels(zoomBucket: number): number {
  return zoomBucket >= TILE_RENDERING_ZOOM
    ? HIGH_ZOOM_MAX_BITMAP_PIXELS
    : NORMAL_MAX_BITMAP_PIXELS;
}

function hasReliableVisualText(input: KnexPdfRenderPolicyInput): boolean {
  if (input.textBlockCount <= 0) return false;

  const confidence = safeNumber(input.averageTextConfidence, 0);

  return confidence >= MIN_VISUAL_TEXT_CONFIDENCE;
}

export function resolveKnexPdfRenderPolicy(
  input: KnexPdfRenderPolicyInput,
): KnexPdfRenderPolicy {
  const zoomBucket = normalizeKnexPdfZoomBucket(input.zoom);
  const devicePixelRatio = clamp(safeNumber(input.devicePixelRatio, 1), 1, 4);
  const hasText = input.textBlockCount > 0;
  const visualPolicyEnabled = isKnexPdfVisualTextLayerPolicyEnabled();
  const visualTextLayerCandidate =
    visualPolicyEnabled &&
    hasReliableVisualText(input) &&
    input.renderPhase === "settled-final" &&
    !input.isZooming &&
    !input.isScrolling &&
    !input.isWarmupPage &&
    (input.isActivePage || input.isPageVisible);

  const suppressionStatus = input.canvasTextSuppressionStatus ?? "unknown";
  const useVisualTextLayer =
    visualTextLayerCandidate && suppressionStatus === "ready";

  const requestCanvasText =
    !visualTextLayerCandidate || suppressionStatus === "failed";

  const textLayerMode: KnexPdfTextLayerRenderMode = useVisualTextLayer
    ? "visual"
    : hasText
      ? "semantic"
      : "disabled";

  const renderMode: KnexPdfRenderMode = useVisualTextLayer
    ? "hybrid-visual"
    : hasText
      ? "hybrid-semantic"
      : "bitmap-only";

  const maxBitmapPixels = resolveMaxBitmapPixels(zoomBucket);

  return {
    renderMode,
    textLayerMode,
    zoomBucket,
    devicePixelRatio,
    requestCanvasText,
    useSemanticTextLayer: textLayerMode === "semantic",
    useVisualTextLayer,
    visualTextLayerCandidate,
    maxBitmapPixels,
    shouldUseTileRendering:
      zoomBucket >= TILE_RENDERING_ZOOM ||
      Math.max(1, safeNumber(input.cssWidth, 1)) *
        Math.max(1, safeNumber(input.cssHeight, 1)) *
        devicePixelRatio *
        devicePixelRatio >
        maxBitmapPixels,
    cacheKeyRenderMode: renderMode,
    reason: useVisualTextLayer
      ? "visual-text-layer-ready"
      : visualTextLayerCandidate
        ? `visual-text-layer-${suppressionStatus}`
        : hasText
          ? "semantic-text-layer"
          : "bitmap-only",
  };
}
