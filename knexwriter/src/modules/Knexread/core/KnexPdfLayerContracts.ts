/**
 * KnexPdfLayerContracts.ts
 * 
 * Contratos (interfaces) para o sistema de camadas (layers).
 * Define a estrutura de composição visual do PDF.
 */

import type { KnexPdfTextBlock, KnexPdfAnnotation } from './KnexPdfTypes';

/**
 * Configuração de camada base
 */
export interface KnexPdfLayerConfig {
  /** ID única da camada */
  id: string;
  
  /** Tipo de camada */
  type: string;
  
  /** Se camada está visível */
  visible: boolean;
  
  /** Z-index da camada */
  zIndex: number;
  
  /** Opacidade (0-1) */
  opacity: number;
  
  /** Modo de blending */
  blendMode: 'normal' | 'multiply' | 'screen' | 'overlay' | 'color-dodge' | 'color-burn' | 'lighten' | 'darken' | 'difference' | 'exclusion' | 'hue' | 'saturation' | 'color' | 'luminosity';
}

/**
 * Contrato base para uma camada
 */
export interface IKnexPdfLayer {
  /**
   * ID da camada
   */
  getId(): string;
  
  /**
   * Tipo de camada
   */
  getType(): string;
  
  /**
   * Inicializa a camada
   */
  initialize(container: HTMLElement): Promise<void>;
  
  /**
   * Atualiza camada (dados alterados)
   */
  update(data: unknown): Promise<void>;
  
  /**
   * Renderiza a camada
   */
  render(): Promise<void>;
  
  /**
   * Altera visibilidade
   */
  setVisible(visible: boolean): void;
  
  /**
   * Altera z-index
   */
  setZIndex(zIndex: number): void;
  
  /**
   * Altera opacidade
   */
  setOpacity(opacity: number): void;
  
  /**
   * Retorna elemento DOM da camada
   */
  getElement(): HTMLElement | null;
  
  /**
   * Limpa recursos
   */
  dispose(): void;
}

/**
 * Contrato para camada de canvas
 */
export interface IKnexPdfCanvasLayer extends IKnexPdfLayer {
  /**
   * Retorna o canvas principal
   */
  getCanvas(): HTMLCanvasElement | null;
  
  /**
   * Atualiza canvas com novo tamanho
   */
  resizeCanvas(width: number, height: number): void;
  
  /**
   * Renderiza página no canvas
   */
  renderPage(pageIndex: number, scale: number): Promise<void>;
}

/**
 * Contrato para camada textual
 */
export interface IKnexPdfTextLayer extends IKnexPdfLayer {
  /**
   * Atualiza blocos de texto
   */
  updateTextBlocks(blocks: KnexPdfTextBlock[]): void;
  
  /**
   * Retorna seleção de texto atual
   */
  getSelection(): string | null;
  
  /**
   * Limpa seleção
   */
  clearSelection(): void;
  
  /**
   * Destaca texto especificado
   */
  highlightText(text: string): void;
  
  /**
   * Remove destaque
   */
  clearHighlight(): void;
}

/**
 * Contrato para camada de anotações
 */
export interface IKnexPdfAnnotationLayer extends IKnexPdfLayer {
  /**
   * Atualiza anotações
   */
  updateAnnotations(annotations: KnexPdfAnnotation[]): void;
  
  /**
   * Seleciona uma anotação
   */
  selectAnnotation(annotationId: string): void;
  
  /**
   * Remove seleção de anotações
   */
  clearSelection(): void;
  
  /**
   * Retorna anotação sob cursor
   */
  getAnnotationAtPoint(x: number, y: number): KnexPdfAnnotation | null;
}

/**
 * Contrato para camada de busca
 */
export interface IKnexPdfSearchLayer extends IKnexPdfLayer {
  /**
   * Realiza busca no texto
   */
  search(query: string): Promise<Array<{
    pageIndex: number;
    text: string;
    rects: Array<{ x: number; y: number; width: number; height: number }>;
  }>>;
  
  /**
   * Destaca resultados de busca
   */
  highlightSearchResults(results: Array<{
    pageIndex: number;
    rects: Array<{ x: number; y: number; width: number; height: number }>;
  }>): void;
  
  /**
   * Remove destaque
   */
  clearSearchHighlight(): void;
}

/**
 * Eventos de interação com camadas
 */
export interface KnexPdfLayerInteractionEvent {
  type:
    | 'text-selected'
    | 'text-deselected'
    | 'annotation-clicked'
    | 'annotation-created'
    | 'annotation-deleted'
    | 'annotation-edited'
    | 'search-result-clicked'
    | 'layer-updated';
  
  layerId: string;
  
  pageIndex?: number;
  
  data?: unknown;
}

/**
 * Contrato para observador de camadas
 */
export interface IKnexPdfLayerObserver {
  onLayerEvent(event: KnexPdfLayerInteractionEvent): void;
}

/**
 * Contrato para composição de camadas
 */
export interface IKnexPdfLayerStack {
  /**
   * Adiciona camada ao stack
   */
  addLayer(layer: IKnexPdfLayer, config: KnexPdfLayerConfig): void;
  
  /**
   * Remove camada do stack
   */
  removeLayer(layerId: string): void;
  
  /**
   * Retorna camada por ID
   */
  getLayer(layerId: string): IKnexPdfLayer | null;
  
  /**
   * Retorna todas as camadas em ordem de z-index
   */
  getLayers(): IKnexPdfLayer[];
  
  /**
   * Altera z-index de uma camada
   */
  setZIndex(layerId: string, zIndex: number): void;
  
  /**
   * Move camada para frente
   */
  moveToFront(layerId: string): void;
  
  /**
   * Move camada para trás
   */
  moveToBack(layerId: string): void;
  
  /**
   * Mostra/esconde camada
   */
  setLayerVisible(layerId: string, visible: boolean): void;
  
  /**
   * Registra observador
   */
  subscribe(observer: IKnexPdfLayerObserver): void;
  
  /**
   * Remove observador
   */
  unsubscribe(observer: IKnexPdfLayerObserver): void;
  
  /**
   * Renderiza todas as camadas
   */
  render(): Promise<void>;
  
  /**
   * Limpa recursos
   */
  dispose(): void;
}

/**
 * Configuração de composição de página
 */
export interface KnexPdfPageCompositionConfig {
  /** Se mostrar camada de canvas */
  showCanvas: boolean;
  
  /** Se mostrar camada textual */
  showTextLayer: boolean;
  
  /** Se mostrar anotações */
  showAnnotations: boolean;
  
  /** Se mostrar búsca */
  showSearch: boolean;
  
  /** Ordem de renderização de camadas */
  layerOrder: Array<'canvas' | 'annotations-behind' | 'text' | 'annotations-above' | 'search' | 'selection'>;
  
  /** Se permitir seleção de texto */
  enableTextSelection: boolean;
  
  /** Se permitir anotação */
  enableAnnotation: boolean;
  
  /** Se permitir zoom/scroll */
  enableInteraction: boolean;
}

/**
 * Contrato para composição de página PDF
 */
export interface IKnexPdfPageComposition {
  /**
   * Inicializa composição
   */
  initialize(container: HTMLElement): Promise<void>;
  
  /**
   * Atualiza configuração
   */
  updateConfig(config: Partial<KnexPdfPageCompositionConfig>): void;
  
  /**
   * Atualiza dados da página
   */
  updatePageData(input: {
    pageIndex: number;
    canvas?: HTMLCanvasElement;
    textBlocks?: KnexPdfTextBlock[];
    annotations?: KnexPdfAnnotation[];
  }): Promise<void>;
  
  /**
   * Retorna layer stack
   */
  getLayerStack(): IKnexPdfLayerStack;
  
  /**
   * Renderiza página
   */
  render(): Promise<void>;
  
  /**
   * Limpa recursos
   */
  dispose(): void;
}

/**
 * Placementment de anotações (em relação ao texto)
 */
export type KnexPdfAnnotationPlacement = 
  | 'behind-text'    // Anotações aparecem atrás do texto (ex: highlights)
  | 'above-text'     // Anotações aparecem acima do texto (ex: notas, pinos);
  | 'floating';      // Anotações flutuam sobre tudo

/**
 * Contrato para renderização com placement de anotações
 */
export interface IKnexPdfAnnotationPlacementRenderer {
  /**
   * Renderiza anotações no placement especificado
   */
  renderAnnotationsAt(
    placement: KnexPdfAnnotationPlacement,
    annotations: KnexPdfAnnotation[],
  ): HTMLElement;
  
  /**
   * Atualiza renderização
   */
  updateAnnotations(annotations: KnexPdfAnnotation[]): void;
  
  /**
   * Remove element
   */
  clear(): void;
}
