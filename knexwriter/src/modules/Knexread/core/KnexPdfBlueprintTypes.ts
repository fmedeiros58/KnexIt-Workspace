/**
 * KnexPdfBlueprintTypes.ts
 *
 * Tipos para Blueprint-Based Page Reconstruction
 *
 * O Blueprint é uma representação estruturada de uma página PDF que permite
 * reconstruir a página em uma superfície/palco do Knexread usando composição DOM.
 *
 * Ao invés de renderizar PDF como bitmap (canvas rasterizado) + HTML sobreposto,
 * o blueprint extrai estrutura completa (texto, imagens, formas, campos) e
 * reconstrói a página como composição de elementos DOM.
 *
 * Arquitetura:
 *   PDF Original
 *     ↓
 *   Extração Estrutural (Blueprint Builder)
 *     ├─ Texto → KnexPdfTextRun[]
 *     ├─ Imagens → KnexPdfImageElement[]
 *     ├─ Formas → KnexPdfShapeElement[]
 *     ├─ Campos → KnexPdfFormField[]
 *     └─ Anotações → KnexPdfAnnotation[]
 *     ↓
 *   KnexPdfPageBlueprint (Representação Reconstruível)
 *     ↓
 *   Renderização em DOM (Blueprint Renderer)
 *     ├─ Texto: HTML <span> com CSS positioning
 *     ├─ Imagens: <img> ou <canvas> nativo para otimização
 *     ├─ Formas: SVG inline ou <canvas> para complexidade
 *     ├─ Campos: <input>, <select>, <textarea>, etc.
 *     └─ Resultado: Página reconstruída (não bitmap)
 */

import type { PdfVisualTextRun } from "../rendering/text/PdfVisualTextModelBuilder";
import type { KnexPdfAnnotation } from "./KnexPdfTypes";

/**
 * Elemento de imagem no blueprint
 *
 * Representa uma imagem extraída do PDF que será renderizada como <img> ou canvas
 */
export interface KnexPdfImageElement {
  /** Tipo de elemento (para discriminar union types) */
  type: "image";

  /** ID único do elemento */
  id: string;

  /** Posição X em coordenadas CSS (pixels) */
  x: number;

  /** Posição Y em coordenadas CSS (pixels) */
  y: number;

  /** Largura em coordenadas CSS (pixels) */
  width: number;

  /** Altura em coordenadas CSS (pixels) */
  height: number;

  /** Dados da imagem (data URL ou blob URL) */
  src: string;

  /** MIME type da imagem */
  mimeType: "image/png" | "image/jpeg" | "image/webp" | "image/tiff";

  /** Opacidade (0-1) */
  opacity: number;

  /** Transform CSS (rotate, scale, skew) */
  transform?: string;

  /** Ângulo de rotação em graus (0, 90, 180, 270) */
  rotation?: number;

  /** Metadados da imagem */
  metadata?: {
    naturalWidth?: number;
    naturalHeight?: number;
    colorSpace?: string;
    bitsPerComponent?: number;
    interpolationHint?: "none" | "high" | "medium" | "low";
  };
}

/**
 * Elemento de forma/vetor no blueprint
 *
 * Representa formas geométricas e caminhos vetoriais extraídos do PDF
 * que serão renderizados como SVG inline ou <canvas> nativo
 */
export interface KnexPdfShapeElement {
  /** Tipo de elemento (para discriminar union types) */
  type: "shape";

  /** ID único do elemento */
  id: string;

  /** Tipo de forma */
  shapeType:
    | "rect"
    | "circle"
    | "ellipse"
    | "path"
    | "line"
    | "polygon"
    | "polyline";

  /** Posição X em coordenadas CSS (pixels) */
  x: number;

  /** Posição Y em coordenadas CSS (pixels) */
  y: number;

  /** Largura em coordenadas CSS (pixels) */
  width: number;

  /** Altura em coordenadas CSS (pixels) */
  height: number;

  /** Preenchimento (fill) */
  fill?: {
    color: string; // hex, rgb, rgba, etc.
    opacity: number; // 0-1
  };

  /** Traço (stroke/border) */
  stroke?: {
    color: string;
    width: number;
    opacity: number;
    dashArray?: string; // "5,5" para line dashes
    lineCap?: "butt" | "round" | "square";
    lineJoin?: "miter" | "round" | "bevel";
  };

  /** SVG path data (para tipo "path") */
  pathData?: string;

  /** Pontos da forma (para "polygon", "polyline") */
  points?: Array<[number, number]>;

  /** Raio do círculo (para "circle", "ellipse") */
  radius?: {
    rx?: number;
    ry?: number;
  };

  /** Transform CSS (rotate, scale, skew) */
  transform?: string;

  /** Z-index relativo (para ordem de renderização) */
  zIndex?: number;

  /** Composição de blending */
  blendMode?: "normal" | "multiply" | "screen" | "overlay" | "darken" | "lighten";
}

/**
 * Campo de formulário no blueprint
 *
 * Representa campos de formulário interativos extraídos do PDF que serão
 * renderizados como <input>, <select>, <textarea>, etc.
 */
export interface KnexPdfFormField {
  /** Tipo de elemento (para discriminar union types) */
  type: "form-field";

  /** ID único do campo */
  id: string;

  /** Tipo de campo de formulário */
  fieldType:
    | "text"
    | "password"
    | "checkbox"
    | "radio"
    | "select"
    | "textarea"
    | "button"
    | "signature"
    | "date"
    | "number";

  /** Posição X em coordenadas CSS (pixels) */
  x: number;

  /** Posição Y em coordenadas CSS (pixels) */
  y: number;

  /** Largura em coordenadas CSS (pixels) */
  width: number;

  /** Altura em coordenadas CSS (pixels) */
  height: number;

  /** Nome do campo (para envio) */
  name: string;

  /** Valor padrão do campo */
  defaultValue?: string;

  /** Placeholder/dica para o usuário */
  placeholder?: string;

  /** Opções disponíveis (para select, radio, checkbox) */
  options?: Array<{
    value: string;
    label: string;
    selected?: boolean;
  }>;

  /** Se o campo é obrigatório */
  required: boolean;

  /** Se o campo é somente leitura */
  readOnly: boolean;

  /** Validação regex */
  pattern?: string;

  /** Número máximo de caracteres (text, password, textarea) */
  maxLength?: number;

  /** Tamanho da fonte do campo */
  fontSize?: number;

  /** Cor da fonte */
  fontColor?: string;

  /** Cor de fundo */
  backgroundColor?: string;

  /** Borda do campo */
  border?: {
    color?: string;
    width?: number;
    style?: "solid" | "dashed" | "dotted";
  };
}

/**
 * Elemento de blueprint (union type)
 *
 * Qualquer elemento que pode ser renderizado no blueprint
 */
export type KnexPdfBlueprintElement =
  | PdfVisualTextRun // Texto extraído (já definido em PdfVisualTextModelBuilder.ts)
  | KnexPdfImageElement
  | KnexPdfShapeElement
  | KnexPdfFormField;

/**
 * Page Blueprint - Representação completa e reconstruível de uma página PDF
 *
 * O Blueprint contém toda a informação estrutural necessária para reconstruir
 * uma página em uma superfície/palco DOM sem depender de rasterização bitmap.
 *
 * Uso:
 *   1. Extrator (PdfPageBlueprintBuilder) cria blueprint a partir de PDF
 *   2. Renderizador (PdfBlueprintRenderer) renderiza blueprint em DOM
 *   3. Composição DOM resultante é usada como superfície principal
 */
export interface KnexPdfPageBlueprint {
  // ==================== Identificação ====================

  /** Número da página (0-indexado) */
  pageIndex: number;

  /** ID único do blueprint (para cache) */
  blueprintId: string;

  // ==================== Dimensões ====================

  /** Largura CSS em pixels (dimensão de renderização) */
  cssWidth: number;

  /** Altura CSS em pixels (dimensão de renderização) */
  cssHeight: number;

  /** Largura original em PDF points (72dpi) */
  pageWidthPt: number;

  /** Altura original em PDF points (72dpi) */
  pageHeightPt: number;

  /** Proporção de aspecto (width/height) */
  aspectRatio: number;

  // ==================== Propriedades da Página ====================

  /** Rotação aplicada (0, 90, 180, 270 graus) */
  rotation: 0 | 90 | 180 | 270;

  /** Crop box da página (se houver) */
  cropBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };

  // ==================== Elementos ====================

  /** Todos os elementos da página (texto, imagens, formas, campos) */
  elements: KnexPdfBlueprintElement[];

  /** Anotações adicionais (highlights, comments, etc.) */
  annotations?: KnexPdfAnnotation[];

  // ==================== Metadados de Extração ====================

  /** Modo de extração utilizado */
  extractionMode: "digital" | "ocr" | "hybrid" | "mixed";

  /** Confiança geral da extração (0-100) */
  confidence: number;

  /** Backend que foi utilizado para extração */
  sourceBackend?: "pdfium" | "pdfjs" | "ocr" | "hybrid";

  /** Timestamp de quando o blueprint foi criado */
  extractedAt: number;

  /** Versão do blueprint (para migrations futuras) */
  blueprintVersion: "1.0";

  // ==================== Controle de Renderização ====================

  /** Modo de renderização recomendado */
  suggestedRenderMode?: "canvas+html" | "blueprint" | "image";

  /** Se a página contém apenas imagem scaneada */
  isScannedOnly: boolean;

  /** Se a página contém campos de formulário interativos */
  hasFormFields: boolean;

  /** Se a página contém anotações */
  hasAnnotations: boolean;

  // ==================== Bandeiras de Otimização ====================

  /** Se a página pode ser renderizada apenas em canvas (para speed) */
  canRenderAsCanvas: boolean;

  /** Se a página requer composição DOM (para interatividade) */
  requiresDomComposition: boolean;

  /** Se a página requer layers separadas para performance */
  suggestLayeredRendering: boolean;

  // ==================== Debug ====================

  /** Dados de debug para diagnóstico */
  debug?: {
    extractionTimeMs?: number;
    textBlockCount?: number;
    imageCount?: number;
    shapeCount?: number;
    formFieldCount?: number;
    errorLog?: string[];
  };
}

/**
 * Builder configuration para criar blueprints
 *
 * Controla comportamento da extração
 */
export interface KnexPdfBlueprintBuilderConfig {
  /** Extrair texto nativo */
  extractNativeText: boolean;

  /** Usar OCR para páginas scaneadas */
  useOcr: boolean;

  /** Extrair imagens */
  extractImages: boolean;

  /** Formato de imagem (qualidade vs tamanho) */
  imageFormat: "png" | "jpeg" | "webp";

  /** Qualidade JPEG (1-100) */
  jpegQuality: number;

  /** Extrair shapes e vetores */
  extractShapes: boolean;

  /** Extrair campos de formulário */
  extractFormFields: boolean;

  /** Extrair anotações */
  extractAnnotations: boolean;

  /** Cache de blueprint */
  cacheBlueprint: boolean;

  /** Timeout em ms para extração */
  extractionTimeout: number;

  /** Log verboso */
  verbose: boolean;
}

/**
 * Resultado de construção de blueprint
 */
export interface KnexPdfBlueprintBuildResult {
  /** Blueprint construído com sucesso */
  blueprint: KnexPdfPageBlueprint;

  /** Warnings durante construção */
  warnings: string[];

  /** Erros durante construção */
  errors: string[];

  /** Tempo total de construção em ms */
  buildTimeMs: number;

  /** Status final */
  success: boolean;
}

/**
 * Opções de renderização de blueprint
 */
export interface KnexPdfBlueprintRenderOptions {
  /** Se renderizar em canvas ou DOM */
  mode: "canvas" | "dom" | "auto";

  /** Zoom level (1.0 = 100%) */
  zoom: number;

  /** Device pixel ratio */
  devicePixelRatio: number;

  /** Escala de saída */
  outputScale: number;

  /** Se renderizar com sombras/efeitos */
  withEffects: boolean;

  /** Se renderizar campos de formulário como interativos */
  interactiveFormFields: boolean;

  /** Callback de progresso */
  onProgress?: (progress: number) => void;

  /** AbortSignal para cancelar renderização */
  signal?: AbortSignal;
}
