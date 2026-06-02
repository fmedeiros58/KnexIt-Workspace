/**
 * KnexPdfRenderContracts.ts
 * 
 * Contratos (interfaces) para o sistema de renderização.
 * Define como diferentes componentes se comunicam.
 */

import type {
  KnexPdfPageGeometry,
  KnexPdfRenderScale,
  KnexPdfRenderedPage,
  KnexPdfTextBlock,
  KnexPdfAnnotation,
  KnexPdfRenderMode,
  KnexPdfRenderQuality,
  KnexPdfBackendCapabilities,
} from './KnexPdfTypes';

/**
 * Contrato para renderizador de página
 */
export interface IKnexPdfPageRenderer {
  /**
   * Renderiza uma página no canvas fornecido
   */
  renderPage(input: {
    pageIndex: number;
    canvas: HTMLCanvasElement;
    scale: KnexPdfRenderScale;
    includeText: boolean;
    includeAnnotations: boolean;
    quality: KnexPdfRenderQuality;
  }): Promise<void>;
  
  /**
   * Cancela renderização em andamento
   */
  cancelRender(): void;
  
  /**
   * Libera recursos
   */
  dispose(): void;
}

/**
 * Contrato para extrator de geometria de texto
 */
export interface IKnexPdfTextGeometryExtractor {
  /**
   * Extrai blocos de texto de uma página
   */
  extractTextBlocks(input: {
    pageIndex: number;
    scale?: KnexPdfRenderScale;
  }): Promise<KnexPdfTextBlock[]>;
  
  /**
   * Extrai apenas as coordenadas de texto
   */
  extractTextCoordinates(input: {
    pageIndex: number;
  }): Promise<Array<{
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
  }>>;
}

/**
 * Contrato para cache de renderização
 */
export interface IKnexPdfRenderCache {
  /**
   * Tenta recuperar canvas em cache
   */
  get(key: string): HTMLCanvasElement | null;
  
  /**
   * Armazena canvas em cache
   */
  set(key: string, canvas: HTMLCanvasElement, ttl?: number): void;
  
  /**
   * Remove item do cache
   */
  invalidate(key: string): void;
  
  /**
   * Limpa todo cache
   */
  clear(): void;
  
  /**
   * Retorna quantidade de itens em cache
   */
  size(): number;
}

/**
 * Contrato para renderização de camadas
 */
export interface IKnexPdfLayerRenderer {
  /**
   * Renderiza uma camada
   */
  render(): void;
  
  /**
   * Atualiza configuração da camada
   */
  updateConfig(config: Record<string, unknown>): void;
  
  /**
   * Retorna elemento DOM da camada
   */
  getElement(): HTMLElement | null;
  
  /**
   * Mostra/esconde a camada
   */
  setVisible(visible: boolean): void;
}

/**
 * Contrato para gestor de viewport
 */
export interface IKnexPdfViewportManager {
  /**
   * Retorna geometria da página
   */
  getPageGeometry(pageIndex: number): KnexPdfPageGeometry | null;
  
  /**
   * Retorna escala de renderização
   */
  getRenderScale(zoom: number): KnexPdfRenderScale;
  
  /**
   * Calcula dimensões CSS baseado em zoom
   */
  calculateCssDimensions(
    geometry: KnexPdfPageGeometry,
    zoom: number,
  ): { width: number; height: number };
  
  /**
   * Converte coordenadas PDF para CSS
   */
  convertPdfToCss(
    pdfX: number,
    pdfY: number,
    zoom: number,
  ): { x: number; y: number };
  
  /**
   * Converte coordenadas CSS para PDF
   */
  convertCssToPdf(
    cssX: number,
    cssY: number,
    zoom: number,
  ): { x: number; y: number };
}

/**
 * Contrato para backend PDF
 */
export interface IKnexPdfBackend {
  /**
   * Retorna capacidades do backend
   */
  getCapabilities(): KnexPdfBackendCapabilities;
  
  /**
   * Carrega um documento
   */
  loadDocument(source: ArrayBuffer | Uint8Array | string): Promise<void>;
  
  /**
   * Retorna número de páginas
   */
  getPageCount(): number;
  
  /**
   * Retorna geometria de uma página
   */
  getPageGeometry(pageIndex: number): KnexPdfPageGeometry | null;
  
  /**
   * Renderiza uma página
   */
  renderPage(input: {
    pageIndex: number;
    canvas: HTMLCanvasElement;
    scale: KnexPdfRenderScale;
  }): Promise<void>;
  
  /**
   * Extrai texto de uma página
   */
  extractText(pageIndex: number): Promise<KnexPdfTextBlock[]>;
  
  /**
   * Limpa recursos
   */
  dispose(): void;
}

/**
 * Contrato para serviço de seleção de texto
 */
export interface IKnexPdfTextSelectionService {
  /**
   * Inicia seleção
   */
  startSelection(x: number, y: number): void;
  
  /**
   * Move seleção
   */
  updateSelection(x: number, y: number): void;
  
  /**
   * Finaliza seleção
   */
  endSelection(): string | null;
  
  /**
   * Limpa seleção
   */
  clearSelection(): void;
  
  /**
   * Retorna seleção atual
   */
  getSelection(): string | null;
}

/**
 * Contrato para renderização de anotações
 */
export interface IKnexPdfAnnotationRenderer {
  /**
   * Renderiza anotações em uma página
   */
  renderAnnotations(input: {
    pageIndex: number;
    annotations: KnexPdfAnnotation[];
    container: HTMLElement;
  }): void;
  
  /**
   * Atualiza renderização
   */
  updateAnnotations(annotations: KnexPdfAnnotation[]): void;
  
  /**
   * Remove todas as anotações
   */
  clear(): void;
}

/**
 * Contrato para composição de camadas
 */
export interface IKnexPdfLayerComposition {
  /**
   * Adiciona camada
   */
  addLayer(id: string, layer: HTMLElement, zIndex: number): void;
  
  /**
   * Remove camada
   */
  removeLayer(id: string): void;
  
  /**
   * Altera ordem z-index
   */
  setZIndex(id: string, zIndex: number): void;
  
  /**
   * Mostra/esconde camada
   */
  setLayerVisible(id: string, visible: boolean): void;
  
  /**
   * Renderiza todas as camadas
   */
  render(): void;
}

/**
 * Evento de renderização
 */
export interface KnexPdfRenderEvent {
  type:
    | 'render-start'
    | 'render-progress'
    | 'render-complete'
    | 'render-error'
    | 'cache-hit'
    | 'cache-miss'
    | 'text-extraction-complete'
    | 'annotation-updated';
  
  pageIndex?: number;
  
  progress?: number;
  
  error?: Error;
  
  details?: Record<string, unknown>;
}

/**
 * Contrato para observador de eventos de renderização
 */
export interface IKnexPdfRenderEventObserver {
  onRenderEvent(event: KnexPdfRenderEvent): void;
}

/**
 * Contrato para gerenciador de renderização
 */
export interface IKnexPdfRenderManager {
  /**
   * Registra observador
   */
  subscribe(observer: IKnexPdfRenderEventObserver): void;
  
  /**
   * Remove observador
   */
  unsubscribe(observer: IKnexPdfRenderEventObserver): void;
  
  /**
   * Inicia renderização de uma página
   */
  requestRender(pageIndex: number, priority: number): Promise<void>;
  
  /**
   * Cancela renderização
   */
  cancelRender(pageIndex: number): void;
  
  /**
   * Invalida cache
   */
  invalidateCache(pageIndex: number): void;
}
