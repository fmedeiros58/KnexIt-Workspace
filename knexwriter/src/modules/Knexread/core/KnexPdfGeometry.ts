/**
 * KnexPdfGeometry.ts
 *
 * Núcleo canônico de geometria do Knexread.
 *
 * Este arquivo centraliza:
 * - normalização de zoom;
 * - cálculo de escala CSS/bitmap;
 * - conversão PDF ↔ CSS;
 * - cálculo de dimensões de página;
 * - cálculo de viewport/visibilidade.
 *
 * Regra estrutural:
 * - Coordenadas de blueprint/HTML devem sempre estar em CSS pixels finais.
 * - outputScale e devicePixelRatio pertencem ao canvas/bitmap, não ao DOM.
 */

import type {
  KnexPdfPageGeometry,
  KnexPdfRenderScale,
  KnexPdfViewport,
} from './KnexPdfTypes';

export type KnexPdfRotation = 0 | 90 | 180 | 270;

export type KnexPdfPoint = {
  x: number;
  y: number;
};

export type KnexPdfRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type KnexPdfPageSizePt = {
  width: number;
  height: number;
};

export type KnexPdfCssPageSize = {
  width: number;
  height: number;
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function safeNumber(value: unknown, fallback: number): number {
  return isFiniteNumber(value) ? value : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function getWindowDevicePixelRatio(): number {
  if (typeof window === 'undefined') return 1;

  return Math.max(1, window.devicePixelRatio || 1);
}

function normalizeRotation(value: unknown): KnexPdfRotation {
  return value === 90 || value === 180 || value === 270 ? value : 0;
}

function normalizePageSizePt(pageSizePt: KnexPdfPageSizePt): KnexPdfPageSizePt {
  return {
    width: Math.max(1, safeNumber(pageSizePt.width, 1)),
    height: Math.max(1, safeNumber(pageSizePt.height, 1)),
  };
}

function getRectCorners(rect: KnexPdfRect): KnexPdfPoint[] {
  return [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x, y: rect.y + rect.height },
    { x: rect.x + rect.width, y: rect.y + rect.height },
  ];
}

function boundsFromPoints(points: KnexPdfPoint[]): KnexPdfRect {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = Math.min(...xs);
  const top = Math.min(...ys);
  const right = Math.max(...xs);
  const bottom = Math.max(...ys);

  return {
    x: left,
    y: top,
    width: Math.max(0, right - left),
    height: Math.max(0, bottom - top),
  };
}

/**
 * Utilitários numéricos compartilhados.
 */
export class KnexPdfGeometryMath {
  /**
   * Normaliza zoom para fator decimal.
   *
   * Aceita tanto:
   * - 1, 1.25, 0.8
   * - 100, 125, 80
   *
   * Qualquer valor acima de 10 é tratado como porcentagem, pois no reader o
   * zoom de UI costuma circular como 100, 125, 150 etc.
   */
  static normalizeZoom(zoom: number | null | undefined, fallback = 1): number {
    const value = safeNumber(zoom, fallback);

    if (value <= 0) return Math.max(0.01, fallback);
    if (value > 10) return Math.max(0.01, value / 100);

    return Math.max(0.01, value);
  }

  static normalizeDevicePixelRatio(
    devicePixelRatio: number | null | undefined,
  ): number {
    return Math.max(1, safeNumber(devicePixelRatio, 1));
  }

  static normalizeOutputScale(
    outputScale: number | null | undefined,
    fallback = 1,
  ): number {
    return Math.max(0.5, safeNumber(outputScale, fallback));
  }

  static roundCss(value: number): number {
    return Math.round(value * 1000) / 1000;
  }

  static roundBitmap(value: number): number {
    return Math.max(1, Math.round(value));
  }

  static clamp = clamp;
}

/**
 * Construtor de escala de renderização.
 */
export class KnexPdfRenderScaleBuilder {
  /**
   * Calcula escala de renderização completa.
   *
   * Entrada:
   * - widthPt/heightPt: dimensão da página em pontos PDF.
   * - zoom: fator decimal ou porcentagem.
   * - devicePixelRatio/outputScale: somente bitmap/canvas.
   */
  static build(input: {
    widthPt: number;
    heightPt: number;
    zoom: number;
    devicePixelRatio: number;
    outputScale?: number;
  }): KnexPdfRenderScale {
    const zoom = KnexPdfGeometryMath.normalizeZoom(input.zoom);
    const devicePixelRatio =
      KnexPdfGeometryMath.normalizeDevicePixelRatio(input.devicePixelRatio);
    const outputScale = KnexPdfGeometryMath.normalizeOutputScale(
      input.outputScale,
    );

    const cssWidth = Math.max(
      1,
      KnexPdfGeometryMath.roundCss(safeNumber(input.widthPt, 1) * zoom),
    );
    const cssHeight = Math.max(
      1,
      KnexPdfGeometryMath.roundCss(safeNumber(input.heightPt, 1) * zoom),
    );

    const bitmapWidth = KnexPdfGeometryMath.roundBitmap(
      cssWidth * devicePixelRatio * outputScale,
    );
    const bitmapHeight = KnexPdfGeometryMath.roundBitmap(
      cssHeight * devicePixelRatio * outputScale,
    );

    return {
      zoom,
      devicePixelRatio,
      outputScale,
      totalScale: zoom * devicePixelRatio * outputScale,
      cssWidth,
      cssHeight,
      bitmapWidth,
      bitmapHeight,
    };
  }

  /**
   * Calcula escala ideal para HiDPI.
   */
  static calculateOutputScale(
    canvas: HTMLCanvasElement,
  ): { scale: number; canUseNativeScale: boolean } {
    const ctx = canvas.getContext('2d');
    if (!ctx) return { scale: 1, canUseNativeScale: false };

    const dpr = getWindowDevicePixelRatio();
    const backingStore =
      (ctx as unknown as { backingStorePixelRatio?: number }).backingStorePixelRatio ||
      (ctx as unknown as { webkitBackingStorePixelRatio?: number })
        .webkitBackingStorePixelRatio ||
      (ctx as unknown as { mozBackingStorePixelRatio?: number })
        .mozBackingStorePixelRatio ||
      (ctx as unknown as { msBackingStorePixelRatio?: number })
        .msBackingStorePixelRatio ||
      (ctx as unknown as { oBackingStorePixelRatio?: number })
        .oBackingStorePixelRatio ||
      1;

    const ratio = dpr / Math.max(1, backingStore);

    return {
      scale: ratio > 1 ? ratio : 1,
      canUseNativeScale: ratio >= 1,
    };
  }
}

/**
 * Conversor de coordenadas PDF <-> CSS.
 *
 * Convenção:
 * - PDF: origem no canto inferior esquerdo.
 * - CSS: origem no canto superior esquerdo.
 * - Zoom sempre normalizado para fator decimal.
 */
export class KnexPdfCoordinateConverter {
  static normalizeZoom(zoom: number): number {
    return KnexPdfGeometryMath.normalizeZoom(zoom);
  }

  static getCssPageSize(input: {
    pageSizePt: KnexPdfPageSizePt;
    zoom: number;
    rotation?: KnexPdfRotation;
  }): KnexPdfCssPageSize {
    const pageSize = normalizePageSizePt(input.pageSizePt);
    const zoom = KnexPdfGeometryMath.normalizeZoom(input.zoom);
    const rotation = normalizeRotation(input.rotation);

    const width = pageSize.width * zoom;
    const height = pageSize.height * zoom;

    if (rotation === 90 || rotation === 270) {
      return {
        width: KnexPdfGeometryMath.roundCss(height),
        height: KnexPdfGeometryMath.roundCss(width),
      };
    }

    return {
      width: KnexPdfGeometryMath.roundCss(width),
      height: KnexPdfGeometryMath.roundCss(height),
    };
  }

  /**
   * Converte ponto PDF para ponto CSS.
   */
  static pdfToCss(
    pdfX: number,
    pdfY: number,
    pageSizePt: KnexPdfPageSizePt,
    zoom: number,
    rotation: KnexPdfRotation = 0,
  ): KnexPdfPoint {
    const pageSize = normalizePageSizePt(pageSizePt);
    const z = KnexPdfGeometryMath.normalizeZoom(zoom);
    const x = safeNumber(pdfX, 0);
    const y = safeNumber(pdfY, 0);

    switch (normalizeRotation(rotation)) {
      case 90:
        return {
          x: KnexPdfGeometryMath.roundCss((pageSize.height - y) * z),
          y: KnexPdfGeometryMath.roundCss((pageSize.width - x) * z),
        };
      case 180:
        return {
          x: KnexPdfGeometryMath.roundCss((pageSize.width - x) * z),
          y: KnexPdfGeometryMath.roundCss(y * z),
        };
      case 270:
        return {
          x: KnexPdfGeometryMath.roundCss(y * z),
          y: KnexPdfGeometryMath.roundCss(x * z),
        };
      case 0:
      default:
        return {
          x: KnexPdfGeometryMath.roundCss(x * z),
          y: KnexPdfGeometryMath.roundCss((pageSize.height - y) * z),
        };
    }
  }

  /**
   * Converte ponto CSS para ponto PDF.
   */
  static cssToPdf(
    cssX: number,
    cssY: number,
    pageSizePt: KnexPdfPageSizePt,
    zoom: number,
    rotation: KnexPdfRotation = 0,
  ): KnexPdfPoint {
    const pageSize = normalizePageSizePt(pageSizePt);
    const z = KnexPdfGeometryMath.normalizeZoom(zoom);
    const x = safeNumber(cssX, 0);
    const y = safeNumber(cssY, 0);

    switch (normalizeRotation(rotation)) {
      case 90:
        return {
          x: KnexPdfGeometryMath.roundCss(pageSize.width - y / z),
          y: KnexPdfGeometryMath.roundCss(pageSize.height - x / z),
        };
      case 180:
        return {
          x: KnexPdfGeometryMath.roundCss(pageSize.width - x / z),
          y: KnexPdfGeometryMath.roundCss(y / z),
        };
      case 270:
        return {
          x: KnexPdfGeometryMath.roundCss(y / z),
          y: KnexPdfGeometryMath.roundCss(x / z),
        };
      case 0:
      default:
        return {
          x: KnexPdfGeometryMath.roundCss(x / z),
          y: KnexPdfGeometryMath.roundCss(pageSize.height - y / z),
        };
    }
  }

  /**
   * Converte retângulo PDF para retângulo CSS.
   */
  static pdfRectToCss(
    pdfRect: KnexPdfRect,
    pageSizePt: KnexPdfPageSizePt,
    zoom: number,
    rotation: KnexPdfRotation = 0,
  ): KnexPdfRect {
    const normalizedRect = {
      x: safeNumber(pdfRect.x, 0),
      y: safeNumber(pdfRect.y, 0),
      width: Math.max(0, safeNumber(pdfRect.width, 0)),
      height: Math.max(0, safeNumber(pdfRect.height, 0)),
    };

    const corners = getRectCorners(normalizedRect).map((corner) =>
      this.pdfToCss(corner.x, corner.y, pageSizePt, zoom, rotation),
    );

    return boundsFromPoints(corners);
  }

  /**
   * Converte retângulo CSS para retângulo PDF.
   */
  static cssRectToPdf(
    cssRect: KnexPdfRect,
    pageSizePt: KnexPdfPageSizePt,
    zoom: number,
    rotation: KnexPdfRotation = 0,
  ): KnexPdfRect {
    const normalizedRect = {
      x: safeNumber(cssRect.x, 0),
      y: safeNumber(cssRect.y, 0),
      width: Math.max(0, safeNumber(cssRect.width, 0)),
      height: Math.max(0, safeNumber(cssRect.height, 0)),
    };

    const corners = getRectCorners(normalizedRect).map((corner) =>
      this.cssToPdf(corner.x, corner.y, pageSizePt, zoom, rotation),
    );

    return boundsFromPoints(corners);
  }

  /**
   * Converte array de retângulo PDF [x1, y1, x2, y2] para CSS.
   * Útil para annotations/widgets do PDF.js.
   */
  static pdfRectArrayToCss(input: {
    rect: number[];
    pageSizePt: KnexPdfPageSizePt;
    zoom: number;
    rotation?: KnexPdfRotation;
  }): KnexPdfRect | null {
    if (!Array.isArray(input.rect) || input.rect.length < 4) return null;

    const x1 = safeNumber(input.rect[0], 0);
    const y1 = safeNumber(input.rect[1], 0);
    const x2 = safeNumber(input.rect[2], 0);
    const y2 = safeNumber(input.rect[3], 0);

    return this.pdfRectToCss(
      {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
      },
      input.pageSizePt,
      input.zoom,
      input.rotation ?? 0,
    );
  }
}

/**
 * Calculador de geometria de página.
 */
export class KnexPdfPageGeometryCalculator {
  /**
   * Calcula dimensões CSS da página.
   */
  static calculateCssDimensions(
    geometry: KnexPdfPageGeometry,
    zoom: number,
  ): { width: number; height: number } {
    return KnexPdfCoordinateConverter.getCssPageSize({
      pageSizePt: {
        width: geometry.widthPt,
        height: geometry.heightPt,
      },
      zoom,
      rotation: normalizeRotation(geometry.rotationDegrees),
    });
  }

  /**
   * Calcula dimensões do bitmap para canvas.
   */
  static calculateBitmapDimensions(
    geometry: KnexPdfPageGeometry,
    zoom: number,
    devicePixelRatio: number,
    outputScale = 1,
  ): { width: number; height: number } {
    const css = this.calculateCssDimensions(geometry, zoom);
    const dpr = KnexPdfGeometryMath.normalizeDevicePixelRatio(devicePixelRatio);
    const os = KnexPdfGeometryMath.normalizeOutputScale(outputScale);

    return {
      width: KnexPdfGeometryMath.roundBitmap(css.width * dpr * os),
      height: KnexPdfGeometryMath.roundBitmap(css.height * dpr * os),
    };
  }

  static buildRenderScale(
    geometry: KnexPdfPageGeometry,
    zoom: number,
    options: {
      devicePixelRatio?: number;
      outputScale?: number;
    } = {},
  ): KnexPdfRenderScale {
    const dimensions = this.calculateCssDimensions(geometry, zoom);
    const dpr = KnexPdfGeometryMath.normalizeDevicePixelRatio(
      options.devicePixelRatio ?? getWindowDevicePixelRatio(),
    );
    const outputScale = KnexPdfGeometryMath.normalizeOutputScale(
      options.outputScale,
    );

    const bitmapWidth = KnexPdfGeometryMath.roundBitmap(
      dimensions.width * dpr * outputScale,
    );
    const bitmapHeight = KnexPdfGeometryMath.roundBitmap(
      dimensions.height * dpr * outputScale,
    );
    const normalizedZoom = KnexPdfGeometryMath.normalizeZoom(zoom);

    return {
      zoom: normalizedZoom,
      devicePixelRatio: dpr,
      outputScale,
      totalScale: normalizedZoom * dpr * outputScale,
      cssWidth: dimensions.width,
      cssHeight: dimensions.height,
      bitmapWidth,
      bitmapHeight,
    };
  }

  /**
   * Valida dimensões para evitar canvas extremamente grande.
   */
  static validateDimensions(
    width: number,
    height: number,
    options: { maxDimension?: number; minDimension?: number } = {},
  ): boolean {
    const maxDimension = Math.max(1, options.maxDimension ?? 10000);
    const minDimension = Math.max(1, options.minDimension ?? 1);

    return (
      Number.isFinite(width) &&
      Number.isFinite(height) &&
      width >= minDimension &&
      width <= maxDimension &&
      height >= minDimension &&
      height <= maxDimension &&
      width * height <= maxDimension * maxDimension
    );
  }

  /**
   * Calcula zoom necessário para caber página em viewport.
   */
  static calculateFitZoom(
    geometry: KnexPdfPageGeometry,
    viewportWidth: number,
    viewportHeight: number,
    mode: 'page-fit' | 'page-width' | 'page-height',
  ): number {
    const pageDimensions = this.calculateCssDimensions(geometry, 1);
    const safeViewportWidth = Math.max(1, safeNumber(viewportWidth, 1));
    const safeViewportHeight = Math.max(1, safeNumber(viewportHeight, 1));

    if (mode === 'page-width') {
      return safeViewportWidth / Math.max(1, pageDimensions.width);
    }

    if (mode === 'page-height') {
      return safeViewportHeight / Math.max(1, pageDimensions.height);
    }

    return Math.min(
      safeViewportWidth / Math.max(1, pageDimensions.width),
      safeViewportHeight / Math.max(1, pageDimensions.height),
    );
  }
}

/**
 * Gestor de viewport.
 */
export class KnexPdfViewportManager {
  private viewport: KnexPdfViewport;
  private pageGeometries: Map<number, KnexPdfPageGeometry> = new Map();

  constructor(initialViewport: KnexPdfViewport) {
    this.viewport = initialViewport;
  }

  registerPageGeometry(pageIndex: number, geometry: KnexPdfPageGeometry): void {
    this.pageGeometries.set(pageIndex, geometry);
  }

  getPageGeometry(pageIndex: number): KnexPdfPageGeometry | null {
    return this.pageGeometries.get(pageIndex) ?? null;
  }

  updateViewport(viewport: Partial<KnexPdfViewport>): void {
    this.viewport = { ...this.viewport, ...viewport };
  }

  getViewport(): KnexPdfViewport {
    return { ...this.viewport };
  }

  getRenderScale(zoom?: number, pageIndex = 0): KnexPdfRenderScale {
    const z = zoom ?? this.viewport.zoom;
    const geometry = this.pageGeometries.get(pageIndex) ?? this.pageGeometries.get(0);

    if (!geometry) {
      return KnexPdfRenderScaleBuilder.build({
        widthPt: 612,
        heightPt: 792,
        zoom: z,
        devicePixelRatio: getWindowDevicePixelRatio(),
      });
    }

    return KnexPdfPageGeometryCalculator.buildRenderScale(geometry, z, {
      devicePixelRatio: getWindowDevicePixelRatio(),
    });
  }

  private getPageGap(): number {
    return Math.max(
      0,
      safeNumber((this.viewport as unknown as { pageGap?: number }).pageGap, 16),
    );
  }

  private getPageHeightForOffset(pageIndex: number, fallbackHeight: number): number {
    const geometry = this.pageGeometries.get(pageIndex);

    if (!geometry) return Math.max(1, fallbackHeight);

    return KnexPdfPageGeometryCalculator.calculateCssDimensions(
      geometry,
      this.viewport.zoom,
    ).height;
  }

  calculatePageOffset(
    pageIndex: number,
    pageHeight: number,
  ): { top: number; visible: boolean } {
    const safePageIndex = Math.max(0, Math.floor(pageIndex));
    const pageGap = this.getPageGap();
    let top = 0;

    for (let index = 0; index < safePageIndex; index += 1) {
      top += this.getPageHeightForOffset(index, pageHeight) + pageGap;
    }

    return {
      top,
      visible: this.isPageVisible(safePageIndex, top, pageHeight),
    };
  }

  isPageVisible(
    pageIndex: number,
    pageTop: number,
    pageHeight: number,
  ): boolean {
    void pageIndex;

    const scrollY = Math.max(0, safeNumber(this.viewport.scrollY, 0));
    const viewportHeight = Math.max(1, safeNumber(this.viewport.height, 1));
    const pageBottom = pageTop + Math.max(1, safeNumber(pageHeight, 1));
    const viewportBottom = scrollY + viewportHeight;

    return pageTop < viewportBottom && pageBottom > scrollY;
  }

  getVisiblePageRange(
    pageTops: number[],
    pageHeights: number[],
  ): { startPage: number; endPage: number } {
    let startPage = -1;
    let endPage = -1;

    for (let index = 0; index < pageTops.length; index += 1) {
      const pageTop = safeNumber(pageTops[index], 0);
      const pageHeight = Math.max(1, safeNumber(pageHeights[index], 1));

      if (!this.isPageVisible(index, pageTop, pageHeight)) {
        continue;
      }

      if (startPage === -1) startPage = index;
      endPage = index;
    }

    return { startPage, endPage };
  }
}
