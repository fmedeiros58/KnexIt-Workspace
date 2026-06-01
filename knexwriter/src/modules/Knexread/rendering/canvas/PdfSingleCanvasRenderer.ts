/**
 * rendering/canvas/PdfSingleCanvasRenderer.ts
 * 
 * Renderizador de página em canvas único (não tiles).
 * Renderiza cada página como uma unidade visual integrada.
 * 
 * Responsabilidades:
 * - Renderizar página inteira em um canvas
 * - Gerenciar qualidade e escala
 * - Cancelar renderização quando necessário
 * - Integrar com backend de renderização
 */

import type {
  KnexPdfRenderScale,
  KnexPdfPageGeometry,
  KnexPdfRenderQuality,
} from '../../core/KnexPdfTypes';
import type { IKnexPdfBackend } from '../../core/KnexPdfRenderContracts';
import { BlankCanvasBuilder } from './BlankCanvasBuilder';

/**
 * Token para rastrear renderização
 */
export interface CanvasRenderToken {
  /** ID único da renderização */
  id: string;
  
  /** Página sendo renderizada */
  pageIndex: number;
  
  /** Timestamp de início */
  startedAt: number;
  
  /** Se foi cancelada */
  cancelled: boolean;
}

/**
 * Configuração de renderização
 */
export interface CanvasRenderConfig {
  /** Qualidade de renderização */
  quality: KnexPdfRenderQuality;
  
  /** Se incluir texto no canvas */
  includeText: boolean;
  
  /** Se incluir anotações no canvas */
  includeAnnotations: boolean;
  
  /** Se usar cache */
  useCache: boolean;
  
  /** Cor de fundo */
  backgroundColor: string;
}

/**
 * Resultado de renderização
 */
export interface CanvasRenderResult {
  /** Canvas renderizado */
  canvas: HTMLCanvasElement;
  
  /** Escala utilizada */
  scale: KnexPdfRenderScale;
  
  /** Tempo total de renderização em ms */
  duration: number;
  
  /** Se foi do cache */
  fromCache: boolean;
  
  /** Token da renderização */
  token: CanvasRenderToken;
}

/**
 * Observer de eventos de renderização
 */
export interface ICanvasRenderObserver {
  onRenderStart(token: CanvasRenderToken): void;
  onRenderProgress(token: CanvasRenderToken, progress: number): void;
  onRenderComplete(token: CanvasRenderToken, result: CanvasRenderResult): void;
  onRenderError(token: CanvasRenderToken, error: Error): void;
}

/**
 * Renderizador de canvas único
 */
export class PdfSingleCanvasRenderer {
  private backend: IKnexPdfBackend;
  private pageGeometries: Map<number, KnexPdfPageGeometry> = new Map();
  private renderTokens: Map<string, CanvasRenderToken> = new Map();
  private observers: Set<ICanvasRenderObserver> = new Set();
  private currentCanvas: HTMLCanvasElement | null = null;
  private disposed: boolean = false;

  constructor(backend: IKnexPdfBackend) {
    this.backend = backend;
  }

  /**
   * Registra geometria de página
   */
  registerPageGeometry(pageIndex: number, geometry: KnexPdfPageGeometry): void {
    if (this.disposed) {
      throw new Error('Renderer disposed');
    }
    this.pageGeometries.set(pageIndex, geometry);
  }

  /**
   * Renderiza uma página
   */
  async renderPage(input: {
    pageIndex: number;
    scale: KnexPdfRenderScale;
    config: CanvasRenderConfig;
  }): Promise<CanvasRenderResult> {
    if (this.disposed) {
      throw new Error('Renderer disposed');
    }

    const token: CanvasRenderToken = {
      id: `render-${Date.now()}-${Math.random()}`,
      pageIndex: input.pageIndex,
      startedAt: Date.now(),
      cancelled: false,
    };

    this.renderTokens.set(token.id, token);

    try {
      // Notificar início
      this.notifyRenderStart(token);

      // Criar canvas em branco
      const geometry = this.pageGeometries.get(input.pageIndex);
      if (!geometry) {
        throw new Error(`No geometry for page ${input.pageIndex}`);
      }

      const blankResult = BlankCanvasBuilder.create({
        widthPt: geometry.widthPt,
        heightPt: geometry.heightPt,
        zoom: input.scale.zoom,
        devicePixelRatio: input.scale.devicePixelRatio,
        outputScale: input.scale.outputScale,
        backgroundColor: input.config.backgroundColor,
      });

      // Checar cancelamento
      if (token.cancelled) {
        BlankCanvasBuilder.dispose(blankResult.canvas);
        throw new Error('Render cancelled');
      }

      // Renderizar página no canvas
      await this.backend.renderPage({
        pageIndex: input.pageIndex,
        canvas: blankResult.canvas,
        scale: input.scale,
      });

      // Checar cancelamento novamente
      if (token.cancelled) {
        BlankCanvasBuilder.dispose(blankResult.canvas);
        throw new Error('Render cancelled');
      }

      // Limpar canvas anterior
      if (this.currentCanvas) {
        BlankCanvasBuilder.dispose(this.currentCanvas);
      }

      this.currentCanvas = blankResult.canvas;

      const result: CanvasRenderResult = {
        canvas: blankResult.canvas,
        scale: blankResult.scale,
        duration: Date.now() - token.startedAt,
        fromCache: false,
        token,
      };

      // Notificar sucesso
      this.notifyRenderComplete(token, result);

      return result;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.notifyRenderError(token, err);
      throw err;
    } finally {
      this.renderTokens.delete(token.id);
    }
  }

  /**
   * Renderiza página com fallback automático de qualidade
   */
  async renderPageWithFallback(input: {
    pageIndex: number;
    geometry: KnexPdfPageGeometry;
    zoom: number;
    preferredQuality: KnexPdfRenderQuality;
  }): Promise<CanvasRenderResult> {
    const scale = this.calculateScale(input.geometry, input.zoom);

    // Tentar com qualidade preferida
    try {
      return await this.renderPage({
        pageIndex: input.pageIndex,
        scale,
        config: {
          quality: input.preferredQuality,
          includeText: true,
          includeAnnotations: false,
          useCache: true,
          backgroundColor: '#ffffff',
        },
      });
    } catch (error) {
      // Fallback para qualidade menor
      const fallbackQualities: KnexPdfRenderQuality[] = ['high', 'medium', 'low'];

      for (const quality of fallbackQualities) {
        if (quality === input.preferredQuality) {
          continue; // Skip já tentada
        }

        try {
          return await this.renderPage({
            pageIndex: input.pageIndex,
            scale,
            config: {
              quality,
              includeText: true,
              includeAnnotations: false,
              useCache: true,
              backgroundColor: '#ffffff',
            },
          });
        } catch {
          // Continuar tentando
        }
      }

      throw error;
    }
  }

  /**
   * Cancelar renderização
   */
  cancelRender(tokenId: string): void {
    const token = this.renderTokens.get(tokenId);
    if (token) {
      token.cancelled = true;
    }
  }

  /**
   * Retorna canvas atual
   */
  getCurrentCanvas(): HTMLCanvasElement | null {
    return this.currentCanvas;
  }

  /**
   * Registra observer
   */
  subscribe(observer: ICanvasRenderObserver): void {
    this.observers.add(observer);
  }

  /**
   * Remove observer
   */
  unsubscribe(observer: ICanvasRenderObserver): void {
    this.observers.delete(observer);
  }

  /**
   * Limpa recursos
   */
  dispose(): void {
    if (this.disposed) {
      return;
    }

    // Cancelar renderizações ativas
    for (const token of this.renderTokens.values()) {
      token.cancelled = true;
    }

    // Limpar canvas
    if (this.currentCanvas) {
      BlankCanvasBuilder.dispose(this.currentCanvas);
      this.currentCanvas = null;
    }

    this.renderTokens.clear();
    this.observers.clear();
    this.pageGeometries.clear();
    this.disposed = true;
  }

  /**
   * Métodos auxiliares privados
   */

  private calculateScale(
    geometry: KnexPdfPageGeometry,
    zoom: number,
  ): KnexPdfRenderScale {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;

    return {
      zoom,
      devicePixelRatio: dpr,
      outputScale: 1,
      totalScale: zoom * dpr,
      cssWidth: geometry.widthPt * zoom,
      cssHeight: geometry.heightPt * zoom,
      bitmapWidth: Math.round(geometry.widthPt * zoom * dpr),
      bitmapHeight: Math.round(geometry.heightPt * zoom * dpr),
    };
  }

  private notifyRenderStart(token: CanvasRenderToken): void {
    for (const observer of this.observers) {
      observer.onRenderStart(token);
    }
  }

  private notifyRenderProgress(token: CanvasRenderToken, progress: number): void {
    for (const observer of this.observers) {
      observer.onRenderProgress(token, progress);
    }
  }

  private notifyRenderComplete(token: CanvasRenderToken, result: CanvasRenderResult): void {
    for (const observer of this.observers) {
      observer.onRenderComplete(token, result);
    }
  }

  private notifyRenderError(token: CanvasRenderToken, error: Error): void {
    for (const observer of this.observers) {
      observer.onRenderError(token, error);
    }
  }
}
