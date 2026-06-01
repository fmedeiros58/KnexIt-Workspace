/**
 * KnexPdfCapabilities.ts
 * 
 * Definição e detecção de capacidades do sistema KnexRead.
 * Permite que diferentes partes do código adaptem comportamento
 * conforme o backend e plataforma disponíveis.
 */

import type {
  KnexPdfBackendCapabilities,
  KnexPdfRenderMode,
  KnexPdfRenderQuality,
} from './KnexPdfTypes';

/**
 * Resultado da detecção de capacidades
 */
export interface KnexPdfCapabilityDetectionResult {
  /** Capacidades detectadas */
  capabilities: KnexPdfBackendCapabilities;
  
  /** Avisos de capacidades limitadas */
  warnings: string[];
  
  /** Erros detectados */
  errors: string[];
}

/**
 * Detector de capacidades do PDF backend
 */
export class KnexPdfCapabilityDetector {
  /**
   * Detecta capacidades do PDFium
   */
  static detectPdfiumCapabilities(): KnexPdfCapabilityDetectionResult {
    const warnings: string[] = [];
    const errors: string[] = [];

    const capabilities: KnexPdfBackendCapabilities = {
      name: 'PDFium',
      version: '1.0.0', // Versão será atualizada conforme integração
      canRender: true,
      canExtractNativeText: true,
      canRenderWithoutText: true, // PDFium pode renderizar apenas gráficos
      canHandleAnnotations: true,
      canVerifySignatures: false,
      supportedRenderModes: [
        'canvas-only',
        'canvas+invisible-text',
        'canvas+visual-text',
      ],
      supportedQualities: ['low', 'medium', 'high', 'extreme'],
      supportsWorkers: true,
      maxConcurrentPages: 4,
    };

    return { capabilities, warnings, errors };
  }

  /**
   * Detecta capacidades do PDF.js
   */
  static detectPdfJsCapabilities(): KnexPdfCapabilityDetectionResult {
    const warnings: string[] = [
      'PDF.js has limited support for advanced annotations',
      'Signature verification not supported',
    ];
    const errors: string[] = [];

    const capabilities: KnexPdfBackendCapabilities = {
      name: 'PDF.js',
      version: '3.0.0',
      canRender: true,
      canExtractNativeText: true,
      canRenderWithoutText: false,
      canHandleAnnotations: false,
      canVerifySignatures: false,
      supportedRenderModes: ['canvas-only', 'canvas+invisible-text'],
      supportedQualities: ['low', 'medium', 'high'],
      supportsWorkers: true,
      maxConcurrentPages: 2,
    };

    return { capabilities, warnings, errors };
  }

  /**
   * Detecta capacidades de plataforma
   */
  static detectPlatformCapabilities(): {
    supportsOffscreenCanvas: boolean;
    supportsWorkers: boolean;
    supportsIndexedDb: boolean;
    supportsWebGL: boolean;
    maxMemory: number;
    devicePixelRatio: number;
  } {
    if (typeof window === 'undefined') {
      return {
        supportsOffscreenCanvas: false,
        supportsWorkers: false,
        supportsIndexedDb: false,
        supportsWebGL: false,
        maxMemory: 0,
        devicePixelRatio: 1,
      };
    }

    return {
      supportsOffscreenCanvas: typeof OffscreenCanvas !== 'undefined',
      supportsWorkers: typeof Worker !== 'undefined',
      supportsIndexedDb: typeof indexedDB !== 'undefined',
      supportsWebGL:
        !!document.createElement('canvas').getContext('webgl') ||
        !!document.createElement('canvas').getContext('webgl2'),
      maxMemory: (navigator as any).deviceMemory * 1024 * 1024 * 1024 || 0,
      devicePixelRatio: window.devicePixelRatio || 1,
    };
  }

  /**
   * Sugere modo de renderização ótimo baseado em capacidades
   */
  static suggestOptimalRenderMode(
    capabilities: KnexPdfBackendCapabilities,
  ): KnexPdfRenderMode {
    // Preferência: HTML visual para melhor tipografia
    if (capabilities.supportedRenderModes.includes('canvas+visual-text')) {
      return 'canvas+visual-text';
    }

    // Fallback: canvas + texto invisível
    if (capabilities.supportedRenderModes.includes('canvas+invisible-text')) {
      return 'canvas+invisible-text';
    }

    // Último recurso: apenas canvas
    if (capabilities.supportedRenderModes.includes('canvas-only')) {
      return 'canvas-only';
    }

    // Não deveria chegar aqui
    return 'canvas-only';
  }

  /**
   * Sugere qualidade ótima baseado em capacidades
   */
  static suggestOptimalQuality(
    capabilities: KnexPdfBackendCapabilities,
  ): KnexPdfRenderQuality {
    if (capabilities.supportedQualities.includes('extreme')) {
      return 'extreme';
    }
    if (capabilities.supportedQualities.includes('high')) {
      return 'high';
    }
    if (capabilities.supportedQualities.includes('medium')) {
      return 'medium';
    }
    return 'low';
  }
}

/**
 * Verificador de capacidade
 */
export class KnexPdfCapabilityChecker {
  private capabilities: KnexPdfBackendCapabilities;

  constructor(capabilities: KnexPdfBackendCapabilities) {
    this.capabilities = capabilities;
  }

  /**
   * Verifica se renderização é suportada
   */
  canRender(): boolean {
    return this.capabilities.canRender;
  }

  /**
   * Verifica se extração de texto é suportada
   */
  canExtractText(): boolean {
    return this.capabilities.canExtractNativeText;
  }

  /**
   * Verifica se modo de renderização é suportado
   */
  supportsRenderMode(mode: KnexPdfRenderMode): boolean {
    return this.capabilities.supportedRenderModes.includes(mode);
  }

  /**
   * Verifica se qualidade é suportada
   */
  supportsQuality(quality: KnexPdfRenderQuality): boolean {
    return this.capabilities.supportedQualities.includes(quality);
  }

  /**
   * Retorna modo de renderização compatível
   */
  getCompatibleRenderMode(requested: KnexPdfRenderMode): KnexPdfRenderMode | null {
    if (this.supportsRenderMode(requested)) {
      return requested;
    }

    // Tenta sugerir fallback
    return KnexPdfCapabilityDetector.suggestOptimalRenderMode(
      this.capabilities,
    );
  }

  /**
   * Retorna qualidade compatível
   */
  getCompatibleQuality(requested: KnexPdfRenderQuality): KnexPdfRenderQuality | null {
    if (this.supportsQuality(requested)) {
      return requested;
    }

    // Tenta sugerir fallback
    return KnexPdfCapabilityDetector.suggestOptimalQuality(
      this.capabilities,
    );
  }

  /**
   * Retorna máximo de páginas simultâneas
   */
  getMaxConcurrentPages(): number {
    return this.capabilities.maxConcurrentPages;
  }

  /**
   * Verifica se suporta workers
   */
  supportsWorkers(): boolean {
    return this.capabilities.supportsWorkers;
  }
}
