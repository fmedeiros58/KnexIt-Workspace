/**
 * KnexPdfTypes.ts
 * 
 * Tipos fundamentais do sistema KnexRead 2.0.
 * Definem os contratos básicos para:
 * - Geometria de páginas
 * - Renderização
 * - Extração de conteúdo
 * - Interação do usuário
 * 
 * Esses tipos são agnósticos em relação ao backend (PDFium, PDF.js, etc.)
 */

/**
 * Dimensões e escala de uma página PDF
 */
export interface KnexPdfPageGeometry {
  /** Largura da página em pontos PDF (PT = 1/72 inch) */
  widthPt: number;
  
  /** Altura da página em pontos PDF */
  heightPt: number;
  
  /** Ângulo de rotação em graus (0, 90, 180, 270) */
  rotationDegrees: 0 | 90 | 180 | 270;
  
  /** Caixa de corte (crop box) ou null se usar MediaBox */
  cropBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  
  /** Proporção de aspecto (width/height) */
  aspectRatio: number;
}

/**
 * Escala de renderização e coordenadas CSS
 */
export interface KnexPdfRenderScale {
  /** Fator de zoom (1.0 = 100%) */
  zoom: number;
  
  /** Device pixel ratio do dispositivo */
  devicePixelRatio: number;
  
  /** Escala de saída/renderização (para HiDPI) */
  outputScale: number;
  
  /** Escala total aplicada = zoom * devicePixelRatio * outputScale */
  totalScale: number;
  
  /** Largura CSS da página em pixels */
  cssWidth: number;
  
  /** Altura CSS da página em pixels */
  cssHeight: number;
  
  /** Largura do bitmap em pixels */
  bitmapWidth: number;
  
  /** Altura do bitmap em pixels */
  bitmapHeight: number;
}

/**
 * Viewport (área visível do documento)
 */
export interface KnexPdfViewport {
  /** Largura da viewport em pixels */
  width: number;
  
  /** Altura da viewport em pixels */
  height: number;
  
  /** Posição de scroll horizontal em pixels */
  scrollX: number;
  
  /** Posição de scroll vertical em pixels */
  scrollY: number;
  
  /** Zoom atual (0.1 = 10%, 1.0 = 100%, etc.) */
  zoom: number;
  
  /** Modo de zoom (page-width, page-height, page-fit, etc.) */
  zoomMode: "fixed" | "page-width" | "page-height" | "page-fit" | "auto";
}

/**
 * Metadados de uma página PDF
 */
export interface KnexPdfPageMetadata {
  /** Número da página (0-indexado) */
  pageIndex: number;
  
  /** Geometria da página */
  geometry: KnexPdfPageGeometry;
  
  /** Se a página contém conteúdo textual extraível */
  hasNativeText: boolean;
  
  /** Se a página contém apenas imagens (scannerizado) */
  isScanned: boolean;
  
  /** Nível de confiança de que a página é scaneada (0-1) */
  scanConfidence: number;
  
  /** Número de blocos de texto encontrados */
  textBlockCount: number;
  
  /** Número de anotações na página */
  annotationCount: number;
  
  /** Renderização recomendada */
  suggestedRenderMode: "canvas" | "canvas+html" | "image" | "interactive";
}

/**
 * Modos de renderização suportados
 */
export type KnexPdfRenderMode = 
  | "canvas-only"           // Apenas canvas (rápido, menos acessível)
  | "canvas+invisible-text" // Canvas + camada textual invisível (seleção/cópia/busca)
  | "canvas+visual-text"    // Canvas + HTML visual (melhor tipografia)
  | "visual-only"           // Apenas HTML (experimental)
  | "image"                 // Renderizar como imagem
  | "server-tiles";         // Tiles do servidor (deprecated)

/**
 * Configuração de qualidade de renderização
 */
export type KnexPdfRenderQuality = 
  | "low"           // ~72 DPI
  | "medium"        // ~150 DPI
  | "high"          // ~200 DPI
  | "extreme";      // >= 300 DPI

/**
 * Estado de uma página renderizada
 */
export interface KnexPdfRenderedPage {
  /** Página renderizada ou null se ainda não renderizada */
  canvas: HTMLCanvasElement | null;
  
  /** Estado da renderização */
  state: "idle" | "rendering" | "ready" | "error";
  
  /** Erro de renderização (se houver) */
  error?: Error;
  
  /** Escala utilizada para renderizar */
  scale: KnexPdfRenderScale;
  
  /** Timestamp da última renderização */
  renderedAt: number;
  
  /** Versão da renderização (para cache invalidation) */
  renderVersion: number;
}

/**
 * Metadados de uma seleção textual
 */
export interface KnexPdfTextSelection {
  /** Texto selecionado */
  text: string;
  
  /** Índice do caractere inicial */
  startOffset: number;
  
  /** Índice do caractere final */
  endOffset: number;
  
  /** Rects de seleção em coordenadas PDF */
  pdfRects: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  
  /** Timestamp da seleção */
  selectedAt: number;
  
  /** Página onde foi selecionado */
  pageIndex: number;
}

/**
 * Modelo de um bloco de texto
 */
export interface KnexPdfTextBlock {
  /** ID único do bloco */
  id: string;
  
  /** Texto do bloco */
  text: string;
  
  /** Posição X em coordenadas PDF */
  x: number;
  
  /** Posição Y em coordenadas PDF */
  y: number;
  
  /** Largura em coordenadas PDF */
  width: number;
  
  /** Altura em coordenadas PDF */
  height: number;
  
  /** Tamanho da fonte */
  fontSize: number;
  
  /** Altura da linha */
  lineHeight: number;
  
  /** Espaçamento entre letras */
  letterSpacing: number;
  
  /** Nome da fonte */
  fontName?: string;
  
  /** Se é bold */
  bold?: boolean;
  
  /** Se é itálico */
  italic?: boolean;
  
  /** Cor do texto em hex */
  color?: string;
  
  /** Ângulo de rotação em graus */
  rotation?: number;
  
  /** Confiança da extração (0-1) */
  confidence?: number;
  
  /** Origem do texto: 'native' ou 'ocr' */
  source: "native" | "ocr" | "hybrid";
}

/**
 * Modelo de um fragmento de anotação
 */
export type KnexPdfAnnotationType = 
  | "highlight"
  | "comment"
  | "note"
  | "bookmark"
  | "underline"
  | "strikethrough"
  | "squiggle"
  | "drawing";

export interface KnexPdfAnnotation {
  /** ID único da anotação */
  id: string;
  
  /** Tipo de anotação */
  type: KnexPdfAnnotationType;
  
  /** Página onde a anotação está */
  pageIndex: number;
  
  /** Rects em coordenadas PDF */
  rects: Array<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>;
  
  /** Texto do comentário/nota */
  content?: string;
  
  /** Cor da anotação em hex */
  color?: string;
  
  /** Autor da anotação */
  author?: string;
  
  /** Data de criação */
  createdAt: number;
  
  /** Data de última modificação */
  updatedAt: number;
  
  /** Se está selecionada/ativa */
  isSelected?: boolean;
}

/**
 * Capacidades do backend de renderização
 */
export interface KnexPdfBackendCapabilities {
  /** Nome e versão do backend */
  name: string;
  version: string;
  
  /** Se suporta renderização de páginas */
  canRender: boolean;
  
  /** Se suporta extração de texto nativo */
  canExtractNativeText: boolean;
  
  /** Se suporta renderização sem texto */
  canRenderWithoutText: boolean;
  
  /** Se suporta anotações */
  canHandleAnnotations: boolean;
  
  /** Se suporta assinatura digital */
  canVerifySignatures: boolean;
  
  /** Modos de renderização suportados */
  supportedRenderModes: KnexPdfRenderMode[];
  
  /** Qualidades de renderização suportadas */
  supportedQualities: KnexPdfRenderQuality[];
  
  /** Se suporta worker threads */
  supportsWorkers: boolean;
  
  /** Limite de páginas simultâneas em renderização */
  maxConcurrentPages: number;
}

/**
 * Configuração de renderização
 */
export interface KnexPdfRenderConfig {
  /** Modo de renderização */
  renderMode: KnexPdfRenderMode;
  
  /** Qualidade de renderização */
  quality: KnexPdfRenderQuality;
  
  /** Se renderizar a camada textual */
  showTextLayer: boolean;
  
  /** Se usar cáche */
  useCache: boolean;
  
  /** Nível de cache (none, memory, indexeddb, etc.) */
  cacheLevel: "none" | "memory" | "indexeddb" | "memory+indexeddb";
  
  /** Máximo de páginas em memória */
  maxCachedPages: number;
  
  /** Se pré-renderizar páginas adjacentes */
  prefetchAdjacentPages: boolean;
  
  /** Se renderizar de forma antecipada (warmup) */
  useWarmupRender: boolean;
}

/**
 * Estado geral do documento PDF
 */
export interface KnexPdfDocumentState {
  /** ID único do documento */
  documentId: string;
  
  /** Número de páginas */
  pageCount: number;
  
  /** Página atual (0-indexado) */
  currentPageIndex: number;
  
  /** Metadados gerais */
  metadata?: {
    title?: string;
    author?: string;
    subject?: string;
    creationDate?: number;
    modificationDate?: number;
  };
  
  /** Estado do carregamento */
  loadingState: "idle" | "loading" | "ready" | "error";
  
  /** Erro de carregamento */
  loadError?: Error;
  
  /** Capacidades do backend */
  backendCapabilities: KnexPdfBackendCapabilities;
  
  /** Configuração ativa */
  config: KnexPdfRenderConfig;
}
