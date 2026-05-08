export function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function computePageFillRatio(contentHeightPx: number, usableHeightPx: number) {
  if (usableHeightPx <= 0) return 0;
  return clampNumber(contentHeightPx / usableHeightPx, 0, 1);
}

export function computeActivePage(scrollTopPx: number, pageStridePx: number, pageCount: number) {
  if (pageCount <= 1 || pageStridePx <= 0) return 1;
  return clampNumber(Math.floor(scrollTopPx / pageStridePx) + 1, 1, pageCount);
}

