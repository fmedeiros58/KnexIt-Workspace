import type { PdfRect } from "../types";

export function toNormalizedRect(input: {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
}): PdfRect {
  const safeWidth = Math.max(1, input.pageWidth);
  const safeHeight = Math.max(1, input.pageHeight);
  return {
    pageNumber: input.pageNumber,
    x: clamp01(input.x / safeWidth),
    y: clamp01(input.y / safeHeight),
    width: clamp01(input.width / safeWidth),
    height: clamp01(input.height / safeHeight),
    coordinateSystem: "pdf-page-normalized",
  };
}

export function fromNormalizedRect(input: {
  rect: PdfRect;
  pageWidth: number;
  pageHeight: number;
}) {
  const safeWidth = Math.max(1, input.pageWidth);
  const safeHeight = Math.max(1, input.pageHeight);
  return {
    x: input.rect.x * safeWidth,
    y: input.rect.y * safeHeight,
    width: input.rect.width * safeWidth,
    height: input.rect.height * safeHeight,
  };
}

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

