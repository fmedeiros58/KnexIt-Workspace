import type { KnexPdfRenderQuality } from "./engineTypes";

export const KNEX_PDF_ENGINE_NAME = "KnexPDF Engine";

export const KNEX_PDF_MIN_ZOOM = 0.1;
export const KNEX_PDF_MAX_ZOOM = 80;

export const KNEX_PDF_ZOOM_PRESETS = [
  10,
  25,
  50,
  75,
  100,
  125,
  150,
  175,
  200,
  250,
  300,
  400,
  500,
  600,
  800,
  1000,
  1600,
  2400,
  3200,
  4000,
  6400,
  8000,
] as const;

export const KNEX_PDF_QUALITY_MULTIPLIER: Record<KnexPdfRenderQuality, number> = {
  draft: 1,
  standard: 1.5,
  high: 2.5,
  ultra: 4,
  extreme: 6,
};

export const KNEX_PDF_MAX_CANVAS_PIXELS: Record<KnexPdfRenderQuality, number> = {
  draft: 24_000_000,
  standard: 40_000_000,
  high: 64_000_000,
  ultra: 120_000_000,
  extreme: 144_000_000,
};

export const KNEX_PDF_MAX_OUTPUT_SCALE = 12;
export const KNEX_PDF_MAX_CANVAS_SIDE = 32767;
export const KNEX_PDF_DEFAULT_PAGE_GAP = 24;
