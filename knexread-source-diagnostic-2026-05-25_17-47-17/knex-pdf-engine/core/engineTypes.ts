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

export type KnexPdfRenderMode =
  | "bitmap-only"
  | "hybrid-semantic"
  | "hybrid-visual"
  | "scanned-document";

export type KnexPdfTextLayerRenderMode =
  | "disabled"
  | "semantic"
  | "visual"
  | "hybrid";

/**
 * Alias mantido por compatibilidade com arquivos existentes,
 * como SemanticTextLayer.ts.
 *
 * A partir de agora, preferir KnexPdfTextLayerRenderMode.
 */
export type KnexPdfVisualTextLayerMode = KnexPdfTextLayerRenderMode;

export type KnexPdfBitmapDescriptor = {
  width: number;
  height: number;
  cssWidth: number;
  cssHeight: number;
  outputScale: number;
  devicePixelRatio?: number;
  zoom?: number;
  zoomBucket?: number;
  rotation?: number;
};

export type KnexPdfPageViewport = {
  /**
   * Largura lógica do viewport da página na escala solicitada.
   * Normalmente corresponde ao tamanho CSS pretendido da página.
   */
  width: number;

  /**
   * Altura lógica do viewport da página na escala solicitada.
   * Normalmente corresponde ao tamanho CSS pretendido da página.
   */
  height: number;

  /**
   * Escala lógica de renderização.
   *
   * 1.0 = 100%
   * 1.5 = 150%
   * 4.0 = 400%
   *
   * Esta escala NÃO é o devicePixelRatio e NÃO é o outputScale.
   */
  scale: number;

  /**
   * Matriz de transformação do viewport, quando fornecida pelo backend.
   */
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
   * Escala lógica do documento.
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

  /**
   * Diagnóstico de zoom e dispositivo.
   */
  zoom?: number;
  zoomBucket?: number;
  devicePixelRatio?: number;
  rotation?: number;

  /**
   * Modo de renderização utilizado.
   */
  renderMode?: KnexPdfRenderMode;

  /**
   * Modo de camada textual associado ao render.
   */
  textLayerMode?: KnexPdfTextLayerRenderMode;

  /**
   * Descritor opcional do bitmap.
   * Deve ser usado apenas para diagnóstico ou compatibilidade.
   * Os componentes devem priorizar os campos diretos:
   * width, height, cssWidth, cssHeight e outputScale.
   */
  bitmap?: KnexPdfBitmapDescriptor;
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

export type KnexPdfTextVisualRole =
  | "body"
  | "title"
  | "subtitle"
  | "header"
  | "footer"
  | "caption"
  | "page-number"
  | "table"
  | "unknown";

export type KnexPdfSemanticTextBlock = {
  id: string;

  pageNumber: number;

  text: string;

  /**
   * Coordenadas em CSS pixels.
   */
  x: number;
  y: number;

  /**
   * Dimensões em CSS pixels.
   */
  width: number;
  height: number;

  /**
   * Fonte detectada ou inferida.
   *
   * Mantida como obrigatória para compatibilidade com os componentes atuais.
   * Quando o backend não souber a fonte real, deve preencher com fallback seguro,
   * por exemplo: "Arial", "Times New Roman" ou "sans-serif".
   */
  fontFamily: string;

  /**
   * Nome bruto extraído do backend PDF.
   * Ex:
   *  - TimesNewRomanPSMT
   *  - Arial-BoldMT
   *  - CIDFont+F1
   */
  fontName?: string;

  /**
   * Tamanho visual da fonte em CSS pixels.
   *
   * Mantido como obrigatório para não quebrar PdfReaderShell.tsx
   * e componentes que calculam estilo diretamente.
   */
  fontSize: number;

  /**
   * Peso CSS.
   * Ex:
   *  - "400"
   *  - "700"
   *  - "bold"
   */
  fontWeight: string;

  /**
   * Estilo CSS.
   */
  fontStyle: "normal" | "italic";

  /**
   * Cor CSS.
   */
  color: string;

  /**
   * Alinhamento lógico.
   */
  align: "left" | "center" | "right";

  /**
   * Espaçamentos.
   *
   * lineHeight foi mantido como obrigatório para não quebrar
   * PdfReaderShell.tsx e outras camadas que dependem desse cálculo.
   */
  lineHeight: number;
  letterSpacing: number;

  /**
   * Ordem semântica.
   */
  readingOrder: number;
  lineIndex: number;
  paragraphIndex: number;

  /**
   * Backend de origem.
   */
  sourceBackend?: KnexPdfBackendId;

  /**
   * Natureza visual ou semântica do bloco.
   */
  visualRole?: KnexPdfTextVisualRole;

  /**
   * Como o texto deve ser tratado.
   *
   * semantic:
   *  - invisível
   *  - usado apenas para seleção, busca e indexação
   *
   * visual:
   *  - texto visual real em HTML/CSS
   *  - usado quando houver metadados confiáveis
   *
   * hybrid:
   *  - canvas continua como fundo
   *  - texto HTML/CSS melhora a nitidez
   */
  textRenderMode?: "semantic" | "visual" | "hybrid";

  /**
   * Opacidade visual original inferida.
   */
  opacity?: number;

  /**
   * Rotação do texto.
   */
  rotation?: number;

  /**
   * Escala horizontal detectada.
   */
  scaleX?: number;

  /**
   * Escala vertical detectada.
   */
  scaleY?: number;

  /**
   * Matriz de transformação original ou inferida do texto no PDF.
   * Útil para posicionamento visual mais fiel.
   */
  transform?: [number, number, number, number, number, number];

  /**
   * Informação de confiança.
   * 0 -> ruim
   * 1 -> perfeita
   */
  confidence?: number;

  /**
   * Texto é decorativo?
   */
  decorative?: boolean;

  /**
   * Texto provavelmente rasterizado?
   */
  rasterized?: boolean;
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
 *   escala lógica do documento.
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

  /**
   * Tamanho base da página em pontos PDF.
   */
  pageWidthPt: number;
  pageHeightPt: number;

  /**
   * Escala lógica do documento.
   */
  renderScale: number;

  /**
   * Escala HiDPI do bitmap.
   */
  outputScale: number;

  /**
   * Cor de fundo usada pela página.
   */
  backgroundColor: string;

  /**
   * Diagnóstico de zoom e dispositivo.
   */
  zoom?: number;
  zoomBucket?: number;
  devicePixelRatio?: number;
  rotation?: number;

  /**
   * Modo de renderização da página.
   */
  renderMode?: KnexPdfRenderMode;

  /**
   * Página possui camada textual disponível?
   */
  hasTextLayer?: boolean;

  /**
   * Quantidade de blocos semânticos.
   */
  textBlockCount?: number;

  /**
   * Backend textual.
   */
  textBackend?: KnexPdfBackendId;

  /**
   * Modo textual ativo.
   */
  textLayerMode?: KnexPdfTextLayerRenderMode;

  /**
   * Render usa estratégia híbrida com texto.
   */
  hybridTextEnabled?: boolean;

  /**
   * Canvas está atuando apenas como fundo visual.
   */
  canvasActsAsBackground?: boolean;

  /**
   * Diagnóstico de renderização.
   */
  renderPixelRatio?: number;
  bitmapPixels?: number;
  wasOutputScaleClamped?: boolean;

  /**
   * Descritor opcional do bitmap.
   * Deve ser usado apenas para diagnóstico ou compatibilidade.
   * Os componentes devem priorizar os campos diretos:
   * width, height, cssWidth, cssHeight e outputScale.
   */
  bitmap?: KnexPdfBitmapDescriptor;

  /**
   * Blocos de texto extraídos para seleção, busca ou camada visual.
   */
  textBlocks?: KnexPdfSemanticTextBlock[];
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