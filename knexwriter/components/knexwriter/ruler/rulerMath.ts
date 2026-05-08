import type { PageOrientation, PageSize } from "./rulerTypes";

export const PX_PER_INCH = 96;
export const CM_PER_INCH = 2.54;
export const PX_PER_CM = PX_PER_INCH / CM_PER_INCH;
export const PX_PER_MM = PX_PER_CM / 10;

export function cmToPx(cm: number): number {
  return cm * PX_PER_CM;
}

export function pxToCm(px: number): number {
  return px / PX_PER_CM;
}

export function mmToPx(mm: number): number {
  return mm * PX_PER_MM;
}

export function pxToMm(px: number): number {
  return px / PX_PER_MM;
}

export function inchToPx(inch: number): number {
  return inch * PX_PER_INCH;
}

export function pxToInch(px: number): number {
  return px / PX_PER_INCH;
}

export function applyZoom(valuePx: number, zoom: number): number {
  return valuePx * zoom;
}

export function removeZoom(valuePx: number, zoom: number): number {
  if (zoom <= 0) return valuePx;
  return valuePx / zoom;
}

export function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function getA4PageSize(orientation: PageOrientation = "portrait"): PageSize {
  const selected =
    orientation === "landscape"
      ? {
          widthCm: 29.7,
          heightCm: 21,
        }
      : {
          widthCm: 21,
          heightCm: 29.7,
        };

  return {
    format: "a4",
    orientation,
    widthCm: selected.widthCm,
    heightCm: selected.heightCm,
    widthPx: cmToPx(selected.widthCm),
    heightPx: cmToPx(selected.heightCm),
  };
}

export function createRulerId(prefix: string): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

