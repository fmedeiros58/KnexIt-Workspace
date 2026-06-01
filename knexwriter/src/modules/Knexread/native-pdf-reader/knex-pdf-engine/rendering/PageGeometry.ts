import {
  KNEX_PDF_MAX_CANVAS_SIDE,
  KNEX_PDF_MAX_OUTPUT_SCALE,
} from "../core/engineConfig";
import type {
  KnexPdfDeviceCapabilities,
  KnexPdfPageGeometry,
  KnexPdfPageRotation,
  KnexPdfRenderQualityInput,
} from "../core/engineTypes";
import {
  clampKnexPdfOutputScaleForRenderPhase,
  computeKnexPdfOutputScale,
  explainKnexPdfOutputScale,
  type KnexPdfRenderBackendKind,
  type KnexPdfRenderPhase,
} from "./RenderQualityController";

export type BuildKnexPdfPageGeometryInput = {
  pageNumber: number;
  baseWidth: number;
  baseHeight: number;
  zoom: number;
  rotation?: number;
  quality?: KnexPdfRenderQualityInput;
  capabilities?: KnexPdfDeviceCapabilities;
  minimumOutputScale?: number;
  maxBitmapPixels?: number;
  maxBitmapSide?: number;
  maxOutputScale?: number;
  backend?: KnexPdfRenderBackendKind;
  renderPhase?: KnexPdfRenderPhase;
};

const MIN_PAGE_SIDE = 1;
const MIN_ZOOM = 0.01;
const MIN_OUTPUT_SCALE = 1;

/**
 * Typographic raster policy.
 *
 * The PDF visual layer is a bitmap rendered by the backend. Small letters become
 * serrated when their visual CSS height receives too few physical bitmap pixels.
 *
 * Approximation:
 * physical text pixels = text CSS px * outputScale
 *
 * Important architectural adjustment:
 * PDFium and PDF.js should not use the same outputScale policy.
 *
 * PDFium needed a very aggressive floor because its WASM rasterization produced
 * harder small text in our tests. PDF.js already renders text better in the
 * browser, but it becomes heavy and can flicker during scrollzoom if we force
 * the same scale used for PDFium.
 *
 * Therefore:
 * - PDFium may keep a high final floor.
 * - PDF.js receives a lower, browser-friendly floor.
 * - Interactive preview is deliberately light to keep scrollzoom fluid.
 */
const KNEX_PDF_ASSUMED_SMALL_TEXT_CSS_PX = 5;

/**
 * PDFium policy:
 * settled-final: 24 / 5 = 4.8
 * preview:       14 / 5 = 2.8
 */
const KNEX_PDF_PDFIUM_TARGET_TEXT_PHYSICAL_PX_SETTLED = 24;
const KNEX_PDF_PDFIUM_TARGET_TEXT_PHYSICAL_PX_PREVIEW = 14;
const KNEX_PDF_PDFIUM_MAX_OUTPUT_SCALE = Math.min(
  5,
  KNEX_PDF_MAX_OUTPUT_SCALE,
);

/**
 * PDF.js policy:
 * settled-final:       17 / 5 = 3.4
 * warmup-preview:      11 / 5 = 2.2
 * interactive-preview:  8 / 5 = 1.6
 *
 * This is intentionally lower than PDFium to reduce scrollzoom stalls, bitmap
 * churn and double-buffer flicker while preserving good text quality.
 */
const KNEX_PDF_PDFJS_TARGET_TEXT_PHYSICAL_PX_SETTLED = 17;
const KNEX_PDF_PDFJS_TARGET_TEXT_PHYSICAL_PX_WARMUP = 11;
const KNEX_PDF_PDFJS_TARGET_TEXT_PHYSICAL_PX_INTERACTIVE = 8;
const KNEX_PDF_PDFJS_MAX_OUTPUT_SCALE = Math.min(
  4,
  KNEX_PDF_MAX_OUTPUT_SCALE,
);

/**
 * Generic backend fallback policy.
 */
const KNEX_PDF_GENERIC_TARGET_TEXT_PHYSICAL_PX_SETTLED = 20;
const KNEX_PDF_GENERIC_TARGET_TEXT_PHYSICAL_PX_PREVIEW = 12;
const KNEX_PDF_GENERIC_MAX_OUTPUT_SCALE = Math.min(
  4.5,
  KNEX_PDF_MAX_OUTPUT_SCALE,
);

/**
 * Safety limits.
 *
 * A very high outputScale can generate huge canvases. These limits keep the
 * final render aggressive enough for reading while avoiding unbounded memory
 * use and scrollzoom jank.
 *
 * 64M pixels ~= 256 MB for one RGBA bitmap.
 * 40M pixels ~= 160 MB for one RGBA bitmap.
 * 24M pixels ~= 96 MB for one RGBA bitmap.
 * 12M pixels ~= 48 MB for one RGBA bitmap.
 */
const KNEX_PDF_PDFIUM_SETTLED_FINAL_MAX_BITMAP_PIXELS = 64_000_000;
const KNEX_PDF_PDFIUM_INTERACTIVE_MAX_BITMAP_PIXELS = 24_000_000;

const KNEX_PDF_PDFJS_SETTLED_FINAL_MAX_BITMAP_PIXELS = 40_000_000;
const KNEX_PDF_PDFJS_WARMUP_MAX_BITMAP_PIXELS = 18_000_000;
const KNEX_PDF_PDFJS_INTERACTIVE_MAX_BITMAP_PIXELS = 12_000_000;

const KNEX_PDF_GENERIC_SETTLED_FINAL_MAX_BITMAP_PIXELS = 48_000_000;
const KNEX_PDF_GENERIC_INTERACTIVE_MAX_BITMAP_PIXELS = 18_000_000;

function safeNumber(
  value: number | null | undefined,
  fallback = 0,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function clamp(value: number, min: number, max: number): number {
  const safeMin = safeNumber(min, MIN_OUTPUT_SCALE);
  const safeMax = Math.max(safeMin, safeNumber(max, safeMin));
  const safeValue = safeNumber(value, safeMin);

  return Math.max(safeMin, Math.min(safeMax, safeValue));
}

function resolveTypographicOutputScaleFloor(input: {
  backend?: KnexPdfRenderBackendKind;
  renderPhase?: KnexPdfRenderPhase;
}): number {
  if (input.backend === "pdfjs") {
    const targetPhysicalPixels =
      input.renderPhase === "interactive-preview"
        ? KNEX_PDF_PDFJS_TARGET_TEXT_PHYSICAL_PX_INTERACTIVE
        : input.renderPhase === "warmup-preview"
          ? KNEX_PDF_PDFJS_TARGET_TEXT_PHYSICAL_PX_WARMUP
          : KNEX_PDF_PDFJS_TARGET_TEXT_PHYSICAL_PX_SETTLED;

    const typographicFloor =
      targetPhysicalPixels / KNEX_PDF_ASSUMED_SMALL_TEXT_CSS_PX;

    return clamp(
      typographicFloor,
      MIN_OUTPUT_SCALE,
      KNEX_PDF_PDFJS_MAX_OUTPUT_SCALE,
    );
  }

  if (input.backend === "pdfium") {
    const targetPhysicalPixels =
      input.renderPhase === "settled-final"
        ? KNEX_PDF_PDFIUM_TARGET_TEXT_PHYSICAL_PX_SETTLED
        : KNEX_PDF_PDFIUM_TARGET_TEXT_PHYSICAL_PX_PREVIEW;

    const typographicFloor =
      targetPhysicalPixels / KNEX_PDF_ASSUMED_SMALL_TEXT_CSS_PX;

    return clamp(
      typographicFloor,
      MIN_OUTPUT_SCALE,
      KNEX_PDF_PDFIUM_MAX_OUTPUT_SCALE,
    );
  }

  const targetPhysicalPixels =
    input.renderPhase === "settled-final"
      ? KNEX_PDF_GENERIC_TARGET_TEXT_PHYSICAL_PX_SETTLED
      : KNEX_PDF_GENERIC_TARGET_TEXT_PHYSICAL_PX_PREVIEW;

  const typographicFloor =
    targetPhysicalPixels / KNEX_PDF_ASSUMED_SMALL_TEXT_CSS_PX;

  return clamp(
    typographicFloor,
    MIN_OUTPUT_SCALE,
    KNEX_PDF_GENERIC_MAX_OUTPUT_SCALE,
  );
}

function resolveDefaultMaxBitmapPixels(input: {
  backend?: KnexPdfRenderBackendKind;
  renderPhase?: KnexPdfRenderPhase;
}): number {
  if (input.backend === "pdfjs") {
    if (input.renderPhase === "interactive-preview") {
      return KNEX_PDF_PDFJS_INTERACTIVE_MAX_BITMAP_PIXELS;
    }

    if (input.renderPhase === "warmup-preview") {
      return KNEX_PDF_PDFJS_WARMUP_MAX_BITMAP_PIXELS;
    }

    return KNEX_PDF_PDFJS_SETTLED_FINAL_MAX_BITMAP_PIXELS;
  }

  if (input.backend === "pdfium") {
    return input.renderPhase === "settled-final"
      ? KNEX_PDF_PDFIUM_SETTLED_FINAL_MAX_BITMAP_PIXELS
      : KNEX_PDF_PDFIUM_INTERACTIVE_MAX_BITMAP_PIXELS;
  }

  return input.renderPhase === "settled-final"
    ? KNEX_PDF_GENERIC_SETTLED_FINAL_MAX_BITMAP_PIXELS
    : KNEX_PDF_GENERIC_INTERACTIVE_MAX_BITMAP_PIXELS;
}

function resolveDefaultMaxOutputScale(input: {
  backend?: KnexPdfRenderBackendKind;
}): number {
  if (input.backend === "pdfjs") {
    return KNEX_PDF_PDFJS_MAX_OUTPUT_SCALE;
  }

  if (input.backend === "pdfium") {
    return KNEX_PDF_PDFIUM_MAX_OUTPUT_SCALE;
  }

  return KNEX_PDF_GENERIC_MAX_OUTPUT_SCALE;
}

export function normalizeKnexPdfPageRotation(
  rotation?: number,
): KnexPdfPageRotation {
  const roundedToRightAngle = Math.round(safeNumber(rotation, 0) / 90) * 90;
  const normalized = (((roundedToRightAngle % 360) + 360) %
    360) as KnexPdfPageRotation;

  return normalized === 0 ||
    normalized === 90 ||
    normalized === 180 ||
    normalized === 270
    ? normalized
    : 0;
}

function computeOutputScaleLimit(input: {
  cssWidth: number;
  cssHeight: number;
  maxBitmapPixels?: number;
  maxBitmapSide?: number;
  maxOutputScale?: number;
  qualityMaxOutputScale: number;
}): number {
  const cssWidth = Math.max(MIN_PAGE_SIDE, input.cssWidth);
  const cssHeight = Math.max(MIN_PAGE_SIDE, input.cssHeight);
  const cssPixels = Math.max(MIN_PAGE_SIDE, cssWidth * cssHeight);

  const maxBitmapPixels = Math.max(
    MIN_PAGE_SIDE,
    safeNumber(input.maxBitmapPixels, Number.POSITIVE_INFINITY),
  );
  const maxBitmapSide = Math.max(
    MIN_PAGE_SIDE,
    safeNumber(input.maxBitmapSide, KNEX_PDF_MAX_CANVAS_SIDE),
  );

  const maxScaleByPixels = Number.isFinite(maxBitmapPixels)
    ? Math.sqrt(maxBitmapPixels / cssPixels)
    : Number.POSITIVE_INFINITY;
  const maxScaleBySide = Math.min(
    maxBitmapSide / cssWidth,
    maxBitmapSide / cssHeight,
  );

  return Math.max(
    MIN_OUTPUT_SCALE,
    Math.min(
      KNEX_PDF_MAX_OUTPUT_SCALE,
      safeNumber(input.maxOutputScale, KNEX_PDF_MAX_OUTPUT_SCALE),
      safeNumber(input.qualityMaxOutputScale, KNEX_PDF_MAX_OUTPUT_SCALE),
      maxScaleByPixels,
      maxScaleBySide,
    ),
  );
}

export function buildKnexPdfPageGeometry(
  input: BuildKnexPdfPageGeometryInput,
): KnexPdfPageGeometry {
  const rotation = normalizeKnexPdfPageRotation(input.rotation);
  const rawBaseWidth = Math.max(
    MIN_PAGE_SIDE,
    safeNumber(input.baseWidth, MIN_PAGE_SIDE),
  );
  const rawBaseHeight = Math.max(
    MIN_PAGE_SIDE,
    safeNumber(input.baseHeight, MIN_PAGE_SIDE),
  );
  const baseWidth =
    rotation === 90 || rotation === 270 ? rawBaseHeight : rawBaseWidth;
  const baseHeight =
    rotation === 90 || rotation === 270 ? rawBaseWidth : rawBaseHeight;
  const zoom = Math.max(MIN_ZOOM, safeNumber(input.zoom, 1));

  const cssWidth = Math.max(MIN_PAGE_SIDE, Math.ceil(baseWidth * zoom));
  const cssHeight = Math.max(MIN_PAGE_SIDE, Math.ceil(baseHeight * zoom));

  const explanation = explainKnexPdfOutputScale({
    cssWidth,
    cssHeight,
    quality: input.quality,
    capabilities: input.capabilities,
  });

  const requestedOutputScale = Math.max(
    MIN_OUTPUT_SCALE,
    safeNumber(
      computeKnexPdfOutputScale({
        cssWidth,
        cssHeight,
        quality: input.quality,
        capabilities: input.capabilities,
      }),
      MIN_OUTPUT_SCALE,
    ),
  );

  const typographicMinimumOutputScale = resolveTypographicOutputScaleFloor({
    backend: input.backend,
    renderPhase: input.renderPhase,
  });

  const requestedMinimumOutputScale = Math.max(
    MIN_OUTPUT_SCALE,
    safeNumber(input.minimumOutputScale, explanation.minimumOutputScale),
    typographicMinimumOutputScale,
  );

  const targetOutputScale = Math.max(
    requestedOutputScale,
    requestedMinimumOutputScale,
  );
  const phaseClampedOutputScale =
    input.backend && input.renderPhase
      ? clampKnexPdfOutputScaleForRenderPhase({
          backend: input.backend,
          phase: input.renderPhase,
          outputScale: targetOutputScale,
        })
      : targetOutputScale;

  const maxAllowedOutputScale = computeOutputScaleLimit({
    cssWidth,
    cssHeight,
    maxBitmapPixels:
      input.maxBitmapPixels ??
      resolveDefaultMaxBitmapPixels({
        backend: input.backend,
        renderPhase: input.renderPhase,
      }),
    maxBitmapSide: input.maxBitmapSide,
    maxOutputScale:
      input.maxOutputScale ??
      resolveDefaultMaxOutputScale({
        backend: input.backend,
      }),
    qualityMaxOutputScale: Math.max(
      safeNumber(explanation.maxAllowedScale, KNEX_PDF_MAX_OUTPUT_SCALE),
      typographicMinimumOutputScale,
    ),
  });

  const outputScale = clamp(
    phaseClampedOutputScale,
    MIN_OUTPUT_SCALE,
    maxAllowedOutputScale,
  );
  const bitmapWidth = Math.max(MIN_PAGE_SIDE, Math.ceil(cssWidth * outputScale));
  const bitmapHeight = Math.max(
    MIN_PAGE_SIDE,
    Math.ceil(cssHeight * outputScale),
  );
  const outputScaleX = bitmapWidth / cssWidth;
  const outputScaleY = bitmapHeight / cssHeight;
  const effectiveOutputScale = Math.min(outputScaleX, outputScaleY);

  return {
    pageNumber: input.pageNumber,
    baseWidth,
    baseHeight,
    cssWidth,
    cssHeight,
    bitmapWidth,
    bitmapHeight,
    zoom,
    devicePixelRatio: Math.max(
      MIN_OUTPUT_SCALE,
      safeNumber(explanation.devicePixelRatio, 1),
    ),
    qualityScale: Math.max(
      MIN_OUTPUT_SCALE,
      safeNumber(explanation.qualityMultiplier, 1),
    ),
    outputScale: effectiveOutputScale,
    outputScaleX,
    outputScaleY,
    rotation,
    requestedOutputScale,
    requestedMinimumOutputScale,
    targetOutputScale,
    phaseClampedOutputScale,
    maxAllowedOutputScale,
    bitmapPixels: bitmapWidth * bitmapHeight,
    wasOutputScaleClamped:
      effectiveOutputScale + 0.0001 < phaseClampedOutputScale,
    wasOutputScaleFloorApplied:
      requestedMinimumOutputScale > requestedOutputScale + 0.0001 &&
      effectiveOutputScale > requestedOutputScale + 0.0001,
  };
}
