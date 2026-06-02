/**
 * backends/pdfium/PdfiumBackend.ts
 * 
 * Adapter para o backend PDFium (nativo).
 * Implementa a interface IKnexPdfBackend, abstraindo a complexidade
 * do KnexPdfEngine existente.
 * 
 * Este arquivo NOT BREAKING CHANGES:
 * - Usa KnexPdfEngine existente por baixo
 * - Não altera comportamento atual
 * - Mantém compatibilidade com código existente
 */

import type {
  KnexPdfPageGeometry,
  KnexPdfRenderScale,
  KnexPdfBackendCapabilities,
  KnexPdfTextBlock,
} from '../../core/KnexPdfTypes';
import type { IKnexPdfBackend } from '../../core/KnexPdfRenderContracts';
import {
  KnexPdfCapabilityDetector,
  KnexPdfCapabilityChecker,
} from '../../core/KnexPdfCapabilities';

/**
 * Implementação do backend PDFium
 */
export class PdfiumBackend implements IKnexPdfBackend {
  private capabilities: KnexPdfBackendCapabilities;
  private capabilityChecker: KnexPdfCapabilityChecker;
  private pageGeometries: Map<number, KnexPdfPageGeometry> = new Map();
  private pageCount: number = 0;
  private isDisposed: boolean = false;

  // Referência ao engine existente (será injetada ou recuperada)
  private knexPdfEngine: any = null;

  constructor() {
    // Detecta capacidades do PDFium
    const detection = KnexPdfCapabilityDetector.detectPdfiumCapabilities();
    this.capabilities = detection.capabilities;
    this.capabilityChecker = new KnexPdfCapabilityChecker(this.capabilities);

    if (detection.warnings.length > 0) {
      console.warn('[PdfiumBackend] Warnings:', detection.warnings);
    }

    if (detection.errors.length > 0) {
      console.error('[PdfiumBackend] Errors:', detection.errors);
    }
  }

  /**
   * Injetar engine existente (KnexPdfEngine)
   */
  injectKnexPdfEngine(engine: any): void {
    this.knexPdfEngine = engine;
  }

  /**
   * Implementação de IKnexPdfBackend
   */

  getCapabilities(): KnexPdfBackendCapabilities {
    if (this.isDisposed) {
      throw new Error('Backend disposed');
    }
    return this.capabilities;
  }

  async loadDocument(source: ArrayBuffer | Uint8Array | string): Promise<void> {
    if (this.isDisposed) {
      throw new Error('Backend disposed');
    }

    try {
      // TODO: Implementar carregamento via KnexPdfEngine existente
      // Por enquanto, apenas marca como preparado
      this.pageCount = 0;
      this.pageGeometries.clear();
    } catch (error) {
      throw new Error(
        `Failed to load PDF document: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  getPageCount(): number {
    if (this.isDisposed) {
      throw new Error('Backend disposed');
    }
    return this.pageCount;
  }

  getPageGeometry(pageIndex: number): KnexPdfPageGeometry | null {
    if (this.isDisposed) {
      throw new Error('Backend disposed');
    }

    const cached = this.pageGeometries.get(pageIndex);
    if (cached) {
      return cached;
    }

    // TODO: Recuperar geometria do KnexPdfEngine
    // Por enquanto retorna null
    return null;
  }

  async renderPage(input: {
    pageIndex: number;
    canvas: HTMLCanvasElement;
    scale: KnexPdfRenderScale;
  }): Promise<void> {
    if (this.isDisposed) {
      throw new Error('Backend disposed');
    }

    if (input.pageIndex < 0 || input.pageIndex >= this.pageCount) {
      throw new Error(
        `Invalid page index: ${input.pageIndex}`,
      );
    }

    // Validar dimensões do canvas
    if (
      input.canvas.width !== input.scale.bitmapWidth ||
      input.canvas.height !== input.scale.bitmapHeight
    ) {
      input.canvas.width = input.scale.bitmapWidth;
      input.canvas.height = input.scale.bitmapHeight;
    }

    try {
      // TODO: Implementar renderização via KnexPdfEngine
      // Por enquanto, apenas preenche com branco
      const ctx = input.canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, input.canvas.width, input.canvas.height);
      }
    } catch (error) {
      throw new Error(
        `Failed to render page: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  async extractText(pageIndex: number): Promise<KnexPdfTextBlock[]> {
    if (this.isDisposed) {
      throw new Error('Backend disposed');
    }

    if (pageIndex < 0 || pageIndex >= this.pageCount) {
      throw new Error(
        `Invalid page index: ${pageIndex}`,
      );
    }

    try {
      // TODO: Implementar extração de texto via KnexPdfEngine
      // Por enquanto retorna array vazio
      return [];
    } catch (error) {
      throw new Error(
        `Failed to extract text: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  dispose(): void {
    if (this.isDisposed) {
      return;
    }

    this.pageGeometries.clear();
    this.knexPdfEngine = null;
    this.isDisposed = true;
  }

  /**
   * Métodos auxiliares específicos do PDFium
   */

  /**
   * Retorna verificador de capacidades
   */
  getCapabilityChecker(): KnexPdfCapabilityChecker {
    return this.capabilityChecker;
  }

  /**
   * Registra geometria de página (cache)
   */
  cachePageGeometry(pageIndex: number, geometry: KnexPdfPageGeometry): void {
    if (this.isDisposed) {
      throw new Error('Backend disposed');
    }
    this.pageGeometries.set(pageIndex, geometry);
  }

  /**
   * Define número de páginas (usado após carregar documento)
   */
  setPageCount(count: number): void {
    if (this.isDisposed) {
      throw new Error('Backend disposed');
    }
    this.pageCount = count;
  }
}

/**
 * Factory para criar instância do PDFium backend
 */
export class PdfiumBackendFactory {
  /**
   * Cria nova instância do backend
   */
  static create(): PdfiumBackend {
    return new PdfiumBackend();
  }

  /**
   * Cria backend com engine injetada
   */
  static createWithEngine(engine: any): PdfiumBackend {
    const backend = new PdfiumBackend();
    backend.injectKnexPdfEngine(engine);
    return backend;
  }
}
