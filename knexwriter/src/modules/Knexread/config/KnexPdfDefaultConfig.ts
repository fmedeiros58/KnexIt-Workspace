/**
 * config/KnexPdfDefaultConfig.ts
 * 
 * Configuração padrão do sistema KnexRead.
 * Centraliza todos os valores padrão para fácil ajuste.
 */

import type {
  KnexPdfRenderMode,
  KnexPdfRenderQuality,
  KnexPdfRenderConfig,
} from '../core/KnexPdfTypes';

/**
 * Configuração padrão de renderização
 */
export const KNEX_PDF_DEFAULT_RENDER_CONFIG: KnexPdfRenderConfig = {
  renderMode: 'canvas+invisible-text',
  quality: 'extreme',
  showTextLayer: true,
  useCache: true,
  cacheLevel: 'memory+indexeddb',
  maxCachedPages: 50,
  prefetchAdjacentPages: true,
  useWarmupRender: true,
};

/**
 * Valores padrão para geometria
 */
export const KNEX_PDF_DEFAULT_GEOMETRY = {
  // Tamanho A4 em pontos PDF (1 pt = 1/72 inch)
  // A4: 210mm x 297mm = 595pt x 842pt
  A4_WIDTH_PT: 595.275,
  A4_HEIGHT_PT: 841.890,
  
  // Letter size
  LETTER_WIDTH_PT: 612,
  LETTER_HEIGHT_PT: 792,
  
  // Default fallback
  DEFAULT_WIDTH_PT: 612,
  DEFAULT_HEIGHT_PT: 792,
};

/**
 * Valores padrão para rendering
 */
export const KNEX_PDF_DEFAULT_RENDER_VALUES = {
  // Zoom
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 8.0,
  DEFAULT_ZOOM: 1.0,
  ZOOM_STEP: 0.1,
  
  // Canvas
  MIN_CANVAS_DIMENSION: 1,
  MAX_CANVAS_DIMENSION: 10000,
  MAX_CANVAS_AREA: 16777216, // ~4096x4096
  
  // Performance
  TEXT_EXTRACTION_DELAY_MS: 0,
  LINK_EXTRACTION_DELAY_MS: 180,
  RENDER_DEBOUNCE_MS: 100,
  
  // Cache
  DEFAULT_CACHE_TTL_MS: 1000 * 60 * 5, // 5 minutos
  MEMORY_CACHE_MAX_SIZE: 100 * 1024 * 1024, // 100MB
  
  // Text layer
  TEXT_LAYER_BASE_SCALE: 1.0,
  TEXT_SELECTION_TIMEOUT_MS: 2000,
};

/**
 * Valores padrão para qualidade
 */
export const KNEX_PDF_QUALITY_LEVELS = {
  low: {
    dpi: 72,
    outputScale: 0.5,
    maxSize: 2000,
  },
  medium: {
    dpi: 150,
    outputScale: 0.75,
    maxSize: 3000,
  },
  high: {
    dpi: 200,
    outputScale: 1,
    maxSize: 4000,
  },
  extreme: {
    dpi: 300,
    outputScale: 1.5,
    maxSize: 5000,
  },
};

/**
 * Feature flags
 */
export const KNEX_PDF_FEATURE_FLAGS = {
  // Canvas
  ENABLE_SINGLE_CANVAS_RENDERER: true,
  ENABLE_MODULAR_PAGE_PIPELINE: false,
  DISABLE_TILES_MANDATORY: false, // Tiles ainda opcionais, não obrigatórios
  
  // Text
  ENABLE_HTML_TEXT_LAYER: false, // Experimental
  FORCE_VISUAL_TEXT_LAYER: false, // Override global
  HIDE_CANVAS_TEXT_WHEN_VISUAL: false,
  
  // Selection
  ENABLE_TEXT_SELECTION: true,
  ENABLE_SELECTION_TOOLBAR: true,
  
  // Annotations
  ENABLE_ANNOTATIONS: false, // Estrutura criada, não ativado
  ENABLE_ANNOTATION_PERSISTENCE: false,
  ENABLE_ANNOTATION_COMMENTS: false,
  
  // OCR
  ENABLE_OCR_PIPELINE: false, // Estrutura criada, não ativado
  AUTO_DETECT_SCANNED_PAGES: false,
  
  // Performance
  ENABLE_PREFETCH: true,
  ENABLE_WARMUP_RENDER: true,
  ENABLE_VIRTUALIZATION: true,
  
  // Debugging
  ENABLE_DEBUG_OVERLAY: false,
  ENABLE_GEOMETRY_DEBUG: false,
  ENABLE_PERFORMANCE_MONITORING: false,
};

/**
 * Configuração de plataforma
 */
export const KNEX_PDF_PLATFORM_CONFIG = {
  // Web Desktop
  web: {
    maxConcurrentRenders: 4,
    renderDebounceMs: 100,
    prefetchPages: true,
    useWorkers: true,
  },
  
  // Mobile
  mobile: {
    maxConcurrentRenders: 2,
    renderDebounceMs: 200,
    prefetchPages: false,
    useWorkers: false,
    maxCachedPages: 10,
  },
  
  // Tablet
  tablet: {
    maxConcurrentRenders: 3,
    renderDebounceMs: 150,
    prefetchPages: true,
    useWorkers: true,
    maxCachedPages: 30,
  },
};

/**
 * Configuração por tipo de documento
 */
export const KNEX_PDF_DOCUMENT_CONFIG = {
  // Documento pequeno (<10 páginas)
  small: {
    renderMode: 'canvas+visual-text' as KnexPdfRenderMode,
    quality: 'extreme' as KnexPdfRenderQuality,
    prefetchAdjacentPages: true,
    cacheLevel: 'memory' as const,
  },
  
  // Documento médio (10-100 páginas)
  medium: {
    renderMode: 'canvas+invisible-text' as KnexPdfRenderMode,
    quality: 'high' as KnexPdfRenderQuality,
    prefetchAdjacentPages: true,
    cacheLevel: 'memory+indexeddb' as const,
  },
  
  // Documento grande (>100 páginas)
  large: {
    renderMode: 'canvas-only' as KnexPdfRenderMode,
    quality: 'medium' as KnexPdfRenderQuality,
    prefetchAdjacentPages: false,
    cacheLevel: 'indexeddb' as const,
  },
};

/**
 * Gestor de configuração
 */
export class KnexPdfConfigManager {
  private static instance: KnexPdfConfigManager;
  private config: KnexPdfRenderConfig;
  private featureFlags: Record<string, boolean>;

  private constructor() {
    this.config = { ...KNEX_PDF_DEFAULT_RENDER_CONFIG };
    this.featureFlags = { ...KNEX_PDF_FEATURE_FLAGS };
    this.loadFromGlobals();
  }

  /**
   * Retorna instância singleton
   */
  static getInstance(): KnexPdfConfigManager {
    if (!KnexPdfConfigManager.instance) {
      KnexPdfConfigManager.instance = new KnexPdfConfigManager();
    }
    return KnexPdfConfigManager.instance;
  }

  /**
   * Retorna configuração atual
   */
  getConfig(): KnexPdfRenderConfig {
    return { ...this.config };
  }

  /**
   * Atualiza configuração
   */
  updateConfig(partial: Partial<KnexPdfRenderConfig>): void {
    this.config = { ...this.config, ...partial };
  }

  /**
   * Retorna valor de feature flag
   */
  getFeatureFlag(name: string): boolean {
    return this.featureFlags[name] ?? false;
  }

  /**
   * Altera feature flag
   */
  setFeatureFlag(name: string, value: boolean): void {
    this.featureFlags[name] = value;
  }

  /**
   * Carrega configurações de variáveis globais
   */
  private loadFromGlobals(): void {
    if (typeof globalThis === 'undefined') {
      return;
    }

    const globals = globalThis as Record<string, unknown>;

    // Carregar flags de debug
    if (globals['KNEX_PDF_DEBUG_RENDER'] === true) {
      this.setFeatureFlag('ENABLE_DEBUG_OVERLAY', true);
    }

    if (globals['KNEX_PDF_FORCE_VISUAL_TEXT_LAYER'] === true) {
      this.setFeatureFlag('FORCE_VISUAL_TEXT_LAYER', true);
    }

    if (globals['KNEX_PDF_USE_MODULAR_PAGE_PIPELINE'] === true) {
      this.setFeatureFlag('ENABLE_MODULAR_PAGE_PIPELINE', true);
      this.setFeatureFlag('ENABLE_HTML_TEXT_LAYER', true);
    }

    if (globals['KNEX_PDF_DEBUG_PERFORMANCE'] === true) {
      this.setFeatureFlag('ENABLE_PERFORMANCE_MONITORING', true);
    }
  }

  /**
   * Retorna configuração recomendada para tipo de documento
   */
  getConfigForDocumentSize(pageCount: number): KnexPdfRenderConfig {
    let config: Partial<KnexPdfRenderConfig>;

    if (pageCount <= 10) {
      config = KNEX_PDF_DOCUMENT_CONFIG.small;
    } else if (pageCount <= 100) {
      config = KNEX_PDF_DOCUMENT_CONFIG.medium;
    } else {
      config = KNEX_PDF_DOCUMENT_CONFIG.large;
    }

    return { ...this.config, ...config };
  }
}

/**
 * Configuração de log
 */
export const KNEX_PDF_LOG_CONFIG = {
  levels: {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
  },
  
  modules: {
    backend: 'info',
    render: 'info',
    text: 'info',
    annotation: 'info',
    ocr: 'debug',
    cache: 'debug',
  },
};
