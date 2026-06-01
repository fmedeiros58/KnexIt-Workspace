/**
 * KnexPdfGeometry.ts
 * 
 * Utilitários para cálculos de geometria, escala e conversão de coordenadas.
 * Centraliza toda a lógica de dimensionamento para evitar inconsistências.
 */

import type {
  KnexPdfPageGeometry,
  KnexPdfRenderScale,
  KnexPdfViewport,
} from './KnexPdfTypes';

/**
 * Construtor de escala de renderização
 */
export class KnexPdfRenderScaleBuilder {
  /**
   * Calcula escala de renderização completa
   */
  static build(input: {
    widthPt: number;
    heightPt: number;
    zoom: number;
    devicePixelRatio: number;
    outputScale?: number;
  }): KnexPdfRenderScale {
    const zoom = Math.max(0.01, input.zoom || 1);
    const devicePixelRatio = Math.max(1, input.devicePixelRatio || 1);
    const outputScale = Math.max(0.5, input.outputScale || 1);

    // Escala total = zoom * DPR * output scale
    const totalScale = zoom * devicePixelRatio * outputScale;

    // Dimensões CSS baseadas em zoom (em pixels)
    const cssWidth = input.widthPt * zoom;
    const cssHeight = input.heightPt * zoom;

    // Dimensões do bitmap = CSS * DPR * output scale
    const bitmapWidth = Math.round(cssWidth * devicePixelRatio * outputScale);
    const bitmapHeight = Math.round(cssHeight * devicePixelRatio * outputScale);

    return {
      zoom,
      devicePixelRatio,
      outputScale,
      totalScale,
      cssWidth,
      cssHeight,
      bitmapWidth,
      bitmapHeight,
    };
  }

  /**
   * Calcula escala ideal para HiDPI
   */
  static calculateOutputScale(
    canvas: HTMLCanvasElement,
  ): { scale: number; canUseNativeScale: boolean } {
    const ctx = canvas.getContext('2d');
    if (!ctx) return { scale: 1, canUseNativeScale: false };

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
    const backingStore =
      (ctx as any).backingStorePixelRatio ||
      (ctx as any).webkitBackingStorePixelRatio ||
      (ctx as any).mozBackingStorePixelRatio ||
      (ctx as any).msBackingStorePixelRatio ||
      (ctx as any).oBackingStorePixelRatio ||
      1;

    const ratio = dpr / backingStore;
    return {
      scale: ratio > 1 ? ratio : 1,
      canUseNativeScale: ratio >= 1,
    };
  }
}

/**
 * Conversor de coordenadas PDF <-> CSS
 */
export class KnexPdfCoordinateConverter {
  /**
   * Converte coordenadas PDF para CSS
   *
   * Coordenadas PDF têm origem no canto inferior-esquerdo.
   * Coordenadas CSS têm origem no canto superior-esquerdo.
   */
  static pdfToCss(
    pdfX: number,
    pdfY: number,
    pageSizePt: { width: number; height: number },
    zoom: number,
    rotation: 0 | 90 | 180 | 270 = 0,
  ): { x: number; y: number } {
    let cssX = pdfX * zoom;
    let cssY = (pageSizePt.height - pdfY) * zoom; // Inverte Y

    // Aplica rotação
    if (rotation === 90) {
      const temp = cssX;
      cssX = cssY;
      cssY = pageSizePt.width * zoom - temp;
    } else if (rotation === 180) {
      cssX = pageSizePt.width * zoom - cssX;
      cssY = pageSizePt.height * zoom - cssY;
    } else if (rotation === 270) {
      const temp = cssX;
      cssX = pageSizePt.height * zoom - cssY;
      cssY = temp;
    }

    return { x: cssX, y: cssY };
  }

  /**
   * Converte coordenadas CSS para PDF
   */
  static cssToPdf(
    cssX: number,
    cssY: number,
    pageSizePt: { width: number; height: number },
    zoom: number,
    rotation: 0 | 90 | 180 | 270 = 0,
  ): { x: number; y: number } {
    let pdfX = cssX / zoom;
    let pdfY = (pageSizePt.height * zoom - cssY) / zoom;

    // Inverte rotação
    if (rotation === 90) {
      const temp = pdfX;
      pdfX = pageSizePt.height - pdfY;
      pdfY = temp;
    } else if (rotation === 180) {
      pdfX = pageSizePt.width - pdfX;
      pdfY = pageSizePt.height - pdfY;
    } else if (rotation === 270) {
      const temp = pdfX;
      pdfX = pdfY;
      pdfY = pageSizePt.width - temp;
    }

    return { x: pdfX, y: pdfY };
  }

  /**
   * Converte rect PDF para CSS
   */
  static pdfRectToCss(
    pdfRect: { x: number; y: number; width: number; height: number },
    pageSizePt: { width: number; height: number },
    zoom: number,
    rotation: 0 | 90 | 180 | 270 = 0,
  ): { x: number; y: number; width: number; height: number } {
    const topLeft = this.pdfToCss(
      pdfRect.x,
      pdfRect.y + pdfRect.height,
      pageSizePt,
      zoom,
      rotation,
    );
    const bottomRight = this.pdfToCss(
      pdfRect.x + pdfRect.width,
      pdfRect.y,
      pageSizePt,
      zoom,
      rotation,
    );

    return {
      x: Math.min(topLeft.x, bottomRight.x),
      y: Math.min(topLeft.y, bottomRight.y),
      width: Math.abs(bottomRight.x - topLeft.x),
      height: Math.abs(bottomRight.y - topLeft.y),
    };
  }

  /**
   * Converte rect CSS para PDF
   */
  static cssRectToPdf(
    cssRect: { x: number; y: number; width: number; height: number },
    pageSizePt: { width: number; height: number },
    zoom: number,
    rotation: 0 | 90 | 180 | 270 = 0,
  ): { x: number; y: number; width: number; height: number } {
    const topLeft = this.cssToPdf(
      cssRect.x,
      cssRect.y,
      pageSizePt,
      zoom,
      rotation,
    );
    const bottomRight = this.cssToPdf(
      cssRect.x + cssRect.width,
      cssRect.y + cssRect.height,
      pageSizePt,
      zoom,
      rotation,
    );

    return {
      x: Math.min(topLeft.x, bottomRight.x),
      y: Math.min(topLeft.y, bottomRight.y),
      width: Math.abs(bottomRight.x - topLeft.x),
      height: Math.abs(bottomRight.y - topLeft.y),
    };
  }
}

/**
 * Calculador de geometria de página
 */
export class KnexPdfPageGeometryCalculator {
  /**
   * Calcula dimensões CSS da página
   */
  static calculateCssDimensions(
    geometry: KnexPdfPageGeometry,
    zoom: number,
  ): { width: number; height: number } {
    let width = geometry.widthPt * zoom;
    let height = geometry.heightPt * zoom;

    // Rotação troca dimensões (90 e 270 graus)
    if (geometry.rotationDegrees === 90 || geometry.rotationDegrees === 270) {
      [width, height] = [height, width];
    }

    return { width, height };
  }

  /**
   * Calcula dimensões do bitmap para canvas
   */
  static calculateBitmapDimensions(
    geometry: KnexPdfPageGeometry,
    zoom: number,
    devicePixelRatio: number,
    outputScale: number = 1,
  ): { width: number; height: number } {
    const css = this.calculateCssDimensions(geometry, zoom);
    return {
      width: Math.round(css.width * devicePixelRatio * outputScale),
      height: Math.round(css.height * devicePixelRatio * outputScale),
    };
  }

  /**
   * Valida dimensões (evita canvas extremamente grande)
   */
  static validateDimensions(
    width: number,
    height: number,
    options: { maxDimension?: number; minDimension?: number } = {},
  ): boolean {
    const maxDimension = options.maxDimension ?? 10000;
    const minDimension = options.minDimension ?? 1;

    return (
      width >= minDimension &&
      width <= maxDimension &&
      height >= minDimension &&
      height <= maxDimension &&
      width * height <= maxDimension * maxDimension
    );
  }

  /**
   * Calcula zoom necessário para caber página em viewport
   */
  static calculateFitZoom(
    geometry: KnexPdfPageGeometry,
    viewportWidth: number,
    viewportHeight: number,
    mode: 'page-fit' | 'page-width' | 'page-height',
  ): number {
    const pageDimensions = this.calculateCssDimensions(geometry, 1); // Zoom 1.0

    if (mode === 'page-width') {
      return viewportWidth / pageDimensions.width;
    }

    if (mode === 'page-height') {
      return viewportHeight / pageDimensions.height;
    }

    // 'page-fit'
    const fitWidth = viewportWidth / pageDimensions.width;
    const fitHeight = viewportHeight / pageDimensions.height;
    return Math.min(fitWidth, fitHeight);
  }
}

/**
 * Gestor de viewport
 */
export class KnexPdfViewportManager {
  private viewport: KnexPdfViewport;
  private pageGeometries: Map<number, KnexPdfPageGeometry> = new Map();

  constructor(initialViewport: KnexPdfViewport) {
    this.viewport = initialViewport;
  }

  /**
   * Registra geometria de página
   */
  registerPageGeometry(pageIndex: number, geometry: KnexPdfPageGeometry): void {
    this.pageGeometries.set(pageIndex, geometry);
  }

  /**
   * Recupera geometria de página
   */
  getPageGeometry(pageIndex: number): KnexPdfPageGeometry | null {
    return this.pageGeometries.get(pageIndex) ?? null;
  }

  /**
   * Atualiza viewport
   */
  updateViewport(viewport: Partial<KnexPdfViewport>): void {
    this.viewport = { ...this.viewport, ...viewport };
  }

  /**
   * Retorna viewport atual
   */
  getViewport(): KnexPdfViewport {
    return { ...this.viewport };
  }

  /**
   * Calcula escala de renderização
   */
  getRenderScale(zoom?: number): KnexPdfRenderScale {
    const z = zoom ?? this.viewport.zoom;
    // Obter página atual ou primeira página disponível
    const geometry = this.pageGeometries.get(0);

    if (!geometry) {
      // Fallback: tamanho A4 padrão
      return KnexPdfRenderScaleBuilder.build({
        widthPt: 612,
        heightPt: 792,
        zoom: z,
        devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
      });
    }

    return KnexPdfRenderScaleBuilder.build({
      widthPt: geometry.widthPt,
      heightPt: geometry.heightPt,
      zoom: z,
      devicePixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1,
    });
  }

  /**
   * Calcula offset de página em relação ao viewport
   */
  calculatePageOffset(
    pageIndex: number,
    pageHeight: number,
  ): { top: number; visible: boolean } {
    // Implementação simplificada
    // Em produção, isso consideraria posições acumuladas de todas as páginas

    return {
      top: 0,
      visible: true,
    };
  }

  /**
   * Verifica se página é visível no viewport
   */
  isPageVisible(
    pageIndex: number,
    pageTop: number,
    pageHeight: number,
  ): boolean {
    const pageBottom = pageTop + pageHeight;
    const viewportBottom = this.viewport.scrollY + this.viewport.height;

    return pageTop < viewportBottom && pageBottom > this.viewport.scrollY;
  }

  /**
   * Calcula páginas visíveis
   */
  getVisiblePageRange(
    pageTops: number[],
    pageHeights: number[],
  ): { startPage: number; endPage: number } {
    let startPage = 0;
    let endPage = Math.max(0, pageTops.length - 1);

    for (let i = 0; i < pageTops.length; i++) {
      if (this.isPageVisible(i, pageTops[i], pageHeights[i])) {
        startPage = Math.min(startPage, i);
        endPage = Math.max(endPage, i);
      }
    }

    return { startPage, endPage };
  }
}
