/**
 * rendering/canvas/BlankCanvasBuilder.ts
 * 
 * Construtor de canvas em branco.
 * Cria a superfície visual base para uma página.
 * 
 * Responsabilidades:
 * - Criar elemento canvas com dimensões corretas
 * - Configurar device pixel ratio corretamente
 * - Preencher com cor branca
 * - Garantir qualidade HiDPI
 */

import type { KnexPdfRenderScale } from '../../core/KnexPdfTypes';

/**
 * Configuração para construção de canvas
 */
export interface BlankCanvasConfig {
  /** CSS width da página em pixels */
  cssWidth: number;
  
  /** CSS height da página em pixels */
  cssHeight: number;
  
  /** Device pixel ratio */
  devicePixelRatio?: number;
  
  /** Output scale para HiDPI */
  outputScale?: number;
  
  /** Cor de fundo (padrão: branco) */
  backgroundColor?: string;
  
  /** ID do elemento (para debugging) */
  elementId?: string;
  
  /** CSS classes */
  cssClasses?: string[];
}

/**
 * Resultado da construção
 */
export interface BlankCanvasResult {
  /** Canvas criado */
  canvas: HTMLCanvasElement;
  
  /** Contexto 2D */
  context: CanvasRenderingContext2D;
  
  /** Escala real de renderização */
  scale: KnexPdfRenderScale;
  
  /** Largura real do bitmap */
  bitmapWidth: number;
  
  /** Altura real do bitmap */
  bitmapHeight: number;
}

/**
 * Construtor de canvas em branco
 */
export class BlankCanvasBuilder {
  /**
   * Cria novo canvas em branco
   */
  static create(input: {
    widthPt: number;
    heightPt: number;
    zoom: number;
    devicePixelRatio?: number;
    outputScale?: number;
    backgroundColor?: string;
  }): BlankCanvasResult {
    const dpr = input.devicePixelRatio ?? this.getDevicePixelRatio();
    const outputScale = input.outputScale ?? 1;

    // Calcular dimensões CSS
    const cssWidth = input.widthPt * input.zoom;
    const cssHeight = input.heightPt * input.zoom;

    // Calcular dimensões do bitmap
    const bitmapWidth = Math.round(cssWidth * dpr * outputScale);
    const bitmapHeight = Math.round(cssHeight * dpr * outputScale);

    // Criar canvas
    const canvas = document.createElement('canvas');
    canvas.className = 'knex-pdf-canvas';
    canvas.width = bitmapWidth;
    canvas.height = bitmapHeight;

    // Aplicar estilo CSS
    canvas.style.width = `${cssWidth}px`;
    canvas.style.height = `${cssHeight}px`;
    canvas.style.display = 'block';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';

    // Obter contexto
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2D context from canvas');
    }

    // Aplicar escala ao contexto
    context.scale(dpr * outputScale, dpr * outputScale);

    // Preencher com branco
    const backgroundColor = input.backgroundColor ?? '#ffffff';
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, cssWidth, cssHeight);

    // Construir objeto de escala
    const scale: KnexPdfRenderScale = {
      zoom: input.zoom,
      devicePixelRatio: dpr,
      outputScale,
      totalScale: input.zoom * dpr * outputScale,
      cssWidth,
      cssHeight,
      bitmapWidth,
      bitmapHeight,
    };

    return {
      canvas,
      context,
      scale,
      bitmapWidth,
      bitmapHeight,
    };
  }

  /**
   * Cria canvas com dimensões específicas (bitmap)
   */
  static createWithBitmapDimensions(input: {
    bitmapWidth: number;
    bitmapHeight: number;
    cssWidth: number;
    cssHeight: number;
    backgroundColor?: string;
  }): BlankCanvasResult {
    const canvas = document.createElement('canvas');
    canvas.className = 'knex-pdf-canvas';
    canvas.width = input.bitmapWidth;
    canvas.height = input.bitmapHeight;

    // Aplicar estilo CSS
    canvas.style.width = `${input.cssWidth}px`;
    canvas.style.height = `${input.cssHeight}px`;
    canvas.style.display = 'block';
    canvas.style.position = 'absolute';
    canvas.style.top = '0';
    canvas.style.left = '0';

    // Obter contexto
    const context = canvas.getContext('2d');
    if (!context) {
      throw new Error('Failed to get 2D context from canvas');
    }

    // Calcular escala necessária
    const scaleX = input.bitmapWidth / input.cssWidth;
    const scaleY = input.bitmapHeight / input.cssHeight;
    context.scale(scaleX, scaleY);

    // Preencher com branco
    const backgroundColor = input.backgroundColor ?? '#ffffff';
    context.fillStyle = backgroundColor;
    context.fillRect(0, 0, input.cssWidth, input.cssHeight);

    // Construir objeto de escala
    const scale: KnexPdfRenderScale = {
      zoom: input.cssWidth / (input.cssWidth / (input.bitmapWidth / input.cssWidth)),
      devicePixelRatio: scaleX,
      outputScale: 1,
      totalScale: scaleX,
      cssWidth: input.cssWidth,
      cssHeight: input.cssHeight,
      bitmapWidth: input.bitmapWidth,
      bitmapHeight: input.bitmapHeight,
    };

    return {
      canvas,
      context,
      scale,
      bitmapWidth: input.bitmapWidth,
      bitmapHeight: input.bitmapHeight,
    };
  }

  /**
   * Recria canvas com novas dimensões
   */
  static resize(
    canvas: HTMLCanvasElement,
    newCssWidth: number,
    newCssHeight: number,
    dpr: number = this.getDevicePixelRatio(),
  ): KnexPdfRenderScale {
    const newBitmapWidth = Math.round(newCssWidth * dpr);
    const newBitmapHeight = Math.round(newCssHeight * dpr);

    canvas.width = newBitmapWidth;
    canvas.height = newBitmapHeight;

    canvas.style.width = `${newCssWidth}px`;
    canvas.style.height = `${newCssHeight}px`;

    const context = canvas.getContext('2d');
    if (context) {
      context.scale(dpr, dpr);
      context.fillStyle = '#ffffff';
      context.fillRect(0, 0, newCssWidth, newCssHeight);
    }

    return {
      zoom: 1, // Será calculado corretamente pelo caller
      devicePixelRatio: dpr,
      outputScale: 1,
      totalScale: dpr,
      cssWidth: newCssWidth,
      cssHeight: newCssHeight,
      bitmapWidth: newBitmapWidth,
      bitmapHeight: newBitmapHeight,
    };
  }

  /**
   * Valida se canvas tem dimensões corretas
   */
  static validateDimensions(
    canvas: HTMLCanvasElement,
    expectedCssWidth: number,
    expectedCssHeight: number,
  ): boolean {
    const tolerance = 1; // 1 pixel

    const actualCssWidth = Math.abs(
      canvas.offsetWidth || parseInt(canvas.style.width, 10),
    );
    const actualCssHeight = Math.abs(
      canvas.offsetHeight || parseInt(canvas.style.height, 10),
    );

    return (
      Math.abs(actualCssWidth - expectedCssWidth) <= tolerance &&
      Math.abs(actualCssHeight - expectedCssHeight) <= tolerance
    );
  }

  /**
   * Detecta device pixel ratio
   */
  private static getDevicePixelRatio(): number {
    if (typeof window === 'undefined') {
      return 1;
    }
    return window.devicePixelRatio || 1;
  }

  /**
   * Limpa canvas
   */
  static clear(canvas: HTMLCanvasElement, backgroundColor: string = '#ffffff'): void {
    const context = canvas.getContext('2d');
    if (context) {
      context.fillStyle = backgroundColor;
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  /**
   * Remove canvas do DOM e libera recursos
   */
  static dispose(canvas: HTMLCanvasElement): void {
    if (canvas.parentElement) {
      canvas.parentElement.removeChild(canvas);
    }

    // Limpar contexto
    const context = canvas.getContext('2d');
    if (context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }

    // Resetar atributos
    canvas.width = 0;
    canvas.height = 0;
  }
}

/**
 * Calculador de escala para canvas em branco
 */
export class BlankCanvasScaleCalculator {
  /**
   * Calcula dimensões ótimas para HiDPI
   */
  static calculateOptimalScale(input: {
    pageSizePoints: { width: number; height: number };
    zoom: number;
    maxPixelDimension?: number;
  }): { cssWidth: number; cssHeight: number; dpr: number } {
    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1;
    const maxPixels = input.maxPixelDimension ?? 4000;

    const cssWidth = input.pageSizePoints.width * input.zoom;
    const cssHeight = input.pageSizePoints.height * input.zoom;

    // Se dimensões são muito grandes, reduzir DPR efetivo
    let effectiveDpr = dpr;
    if (cssWidth * dpr > maxPixels || cssHeight * dpr > maxPixels) {
      effectiveDpr = Math.max(1, maxPixels / Math.max(cssWidth, cssHeight));
    }

    return {
      cssWidth,
      cssHeight,
      dpr: effectiveDpr,
    };
  }

  /**
   * Valida se escala é viável
   */
  static isViableScale(scale: { cssWidth: number; cssHeight: number; dpr: number }): boolean {
    const maxPixels = 16777216; // ~4096x4096

    return (
      scale.cssWidth * scale.dpr <= Math.sqrt(maxPixels) &&
      scale.cssHeight * scale.dpr <= Math.sqrt(maxPixels) &&
      scale.cssWidth * scale.cssHeight * scale.dpr * scale.dpr <= maxPixels
    );
  }
}
