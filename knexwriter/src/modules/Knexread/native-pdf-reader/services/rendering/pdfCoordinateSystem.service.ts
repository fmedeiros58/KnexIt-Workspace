export type PdfViewportAnchor = {
  x: number;
  y: number;
};

export type PdfNormalizedRect = {
  xNorm: number;
  yNorm: number;
  wNorm: number;
  hNorm: number;
};

export type PdfAbsoluteRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function clampUnit(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

export function toNormalizedPageRect(input: {
  x: number;
  y: number;
  width: number;
  height: number;
  pageWidth: number;
  pageHeight: number;
}): PdfNormalizedRect {
  const safeWidth = Math.max(1, input.pageWidth);
  const safeHeight = Math.max(1, input.pageHeight);
  return {
    xNorm: clampUnit(input.x / safeWidth),
    yNorm: clampUnit(input.y / safeHeight),
    wNorm: clampUnit(input.width / safeWidth),
    hNorm: clampUnit(input.height / safeHeight),
  };
}

export function fromNormalizedPageRect(input: {
  rect: PdfNormalizedRect;
  pageWidth: number;
  pageHeight: number;
}): PdfAbsoluteRect {
  const safeWidth = Math.max(1, input.pageWidth);
  const safeHeight = Math.max(1, input.pageHeight);
  return {
    x: input.rect.xNorm * safeWidth,
    y: input.rect.yNorm * safeHeight,
    width: input.rect.wNorm * safeWidth,
    height: input.rect.hNorm * safeHeight,
  };
}

export function captureViewportAnchor(input: {
  scrollLeft: number;
  scrollTop: number;
  clientWidth: number;
  clientHeight: number;
  oldScale: number;
}): PdfViewportAnchor {
  const centerX = input.scrollLeft + input.clientWidth / 2;
  const centerY = input.scrollTop + input.clientHeight / 2;
  const safeScale = Math.max(0.001, input.oldScale);
  return {
    x: centerX / safeScale,
    y: centerY / safeScale,
  };
}

export function restoreViewportFromAnchor(input: {
  anchor: PdfViewportAnchor;
  newScale: number;
  clientWidth: number;
  clientHeight: number;
}) {
  return {
    scrollLeft: Math.max(0, input.anchor.x * input.newScale - input.clientWidth / 2),
    scrollTop: Math.max(0, input.anchor.y * input.newScale - input.clientHeight / 2),
  };
}
