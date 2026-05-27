export type KnexPdfRenderQuality =
  | "draft"
  | "standard"
  | "high"
  | "ultra"
  | "extreme";

export type KnexPdfRenderQualityInput =
  | KnexPdfRenderQuality
  | "auto"
  | "economy"
  | "very-high";

export type KnexPdfBackendId = "pdfjs" | "mupdf" | "pdfium";

export type KnexPdfRuntimePlatform = "web" | "pwa" | "desktop" | "mobile";

export type KnexPdfViewMode = "single" | "continuous" | "sideBySide";

export type KnexPdfPageRenderNature =
  | "vector-text"
  | "raster-scan"
  | "hybrid"
  | "unknown";

export type KnexPdfPageViewport = {
  /**
   * Largura lógica do viewport do PDF.js na escala solicitada.
   * Normalmente corresponde ao tamanho CSS pretendido da página.
   */
  width: number;

  /**
   * Altura lógica do viewport do PDF.js na escala solicitada.
   * Normalmente corresponde ao tamanho CSS pretendido da página.
   */
  height: number;

  /**
   * Escala lógica do PDF.js.
   *
   * 1.0 = 100%
   * 1.5 = 150%
   * 4.0 = 400%
   *
   * Esta escala NÃO é o devicePixelRatio e NÃO é o outputScale.
   */
  scale: number;

  transform?: number[];
};

/**
 * Resultado bruto de renderização do canvas.
 *
 * Regra central:
 *
 * width/height:
 *   dimensão real do bitmap HiDPI do canvas.
 *   Deve bater com canvas.width/canvas.height.
 *
 * cssWidth/cssHeight:
 *   dimensão visual CSS da página.
 *   Deve bater com canvas.style.width/canvas.style.height.
 *
 * outputScale:
 *   fator entre bitmap e CSS.
 *
 * Exemplo:
 *   cssWidth = 1000
 *   cssHeight = 1400
 *   outputScale = 3
 *   width = 3000
 *   height = 4200
 */
export type KnexPdfCanvasRenderResult = {
  pageNumber: number;

  /**
   * Largura real do bitmap renderizado.
   * Deve ser igual ou equivalente a canvas.width.
   */
  width: number;

  /**
   * Altura real do bitmap renderizado.
   * Deve ser igual ou equivalente a canvas.height.
   */
  height: number;

  /**
   * Largura visual CSS da página.
   */
  cssWidth: number;

  /**
   * Altura visual CSS da página.
   */
  cssHeight: number;

  /**
   * Largura original da página em pontos PDF, normalmente em 72 dpi.
   */
  pageWidthPt: number;

  /**
   * Altura original da página em pontos PDF, normalmente em 72 dpi.
   */
  pageHeightPt: number;

  /**
   * Escala lógica do PDF.js.
   * Exemplo: zoom 150% => renderScale 1.5.
   */
  renderScale: number;

  /**
   * Escala HiDPI aplicada sobre o bitmap.
   * Exemplo: outputScale 3 gera bitmap 3x maior que a caixa CSS.
   */
  outputScale: number;

  /**
   * Informação opcional para diagnóstico.
   * Pode indicar se o render foi limitado por max pixels, max side etc.
   */
  renderPixelRatio?: number;
  bitmapPixels?: number;
  wasOutputScaleClamped?: boolean;
};

export type KnexPdfDeviceCapabilities = {
  platform: KnexPdfRuntimePlatform;
  devicePixelRatio: number;
  approximateMemoryGb?: number;
  supportsOffscreenCanvas: boolean;
  supportsWorker: boolean;
  supportsWasm: boolean;
  isTouch: boolean;
  screenWidth: number;
  screenHeight: number;
  performanceClass: "low" | "medium" | "high";
};

export type KnexPdfZoomCenterAnchor = {
  viewportCenterX: number;
  viewportCenterY: number;
  contentCenterX: number;
  contentCenterY: number;
  activePageNumber: number;
  mode: "single" | "sideBySide";
  sourcePageCenterX: number;
  pagePairCenterX?: number;
};

export type KnexPdfHorizontalOverflowState = {
  hasOverflow: boolean;
  viewportWidth: number;
  realContentWidth: number;
  desiredScrollLeft: number;
};

export type KnexPdfRulerState = {
  rulerZeroX: number;
  scrollLeft: number;
  rulerTrackX: number;
  layoutVersion: number;
};

export type KnexPdfSemanticTextBlock = {
  id: string;
  pageNumber: number;
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontFamily: string;
  fontSize: number;
  fontWeight: string;
  fontStyle: "normal" | "italic";
  color: string;
  align: "left" | "center" | "right";
  lineHeight: number;
  letterSpacing: number;
  readingOrder: number;
  lineIndex: number;
  paragraphIndex: number;
};

export type KnexPdfTextBlock = KnexPdfSemanticTextBlock;

/**
 * Página renderizada exposta para os componentes React.
 *
 * Regra central:
 *
 * width/height:
 *   dimensão real do bitmap HiDPI renderizado.
 *
 * cssWidth/cssHeight:
 *   dimensão visual CSS da página.
 *
 * pageWidthPt/pageHeightPt:
 *   tamanho base da página em pontos PDF.
 *
 * renderScale:
 *   escala lógica do PDF.js.
 *
 * outputScale:
 *   escala HiDPI do bitmap.
 */
export type KnexPdfRenderedPage = {
  pageNumber: number;

  /**
   * Largura real do bitmap renderizado.
   */
  width: number;

  /**
   * Altura real do bitmap renderizado.
   */
  height: number;

  /**
   * Largura visual CSS da página.
   */
  cssWidth: number;

  /**
   * Altura visual CSS da página.
   */
  cssHeight: number;

  pageWidthPt: number;
  pageHeightPt: number;
  renderScale: number;
  outputScale: number;
  backgroundColor: string;

  /**
   * Campos opcionais de diagnóstico.
   */
  renderPixelRatio?: number;
  bitmapPixels?: number;
  wasOutputScaleClamped?: boolean;
};

export type KnexPdfPageLinkAnnotation = {
  id: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  url?: string;
  dest?: unknown;
};

export type KnexPdfSelectionRectangle = {
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
};
