import type {
  KnexPdfBackendId,
  KnexPdfCanvasRenderResult,
  KnexPdfPageGeometry,
  KnexPdfRenderQualityInput,
  KnexPdfSemanticTextBlock,
} from "../core/engineTypes";
import type { KnexPdfRenderPhase } from "../rendering/RenderQualityController";
import type { KnexPdfPageTile } from "../rendering/TileGridCalculator";

/**
 * Origem comum para abertura de documento em qualquer backend.
 *
 * PDF.js pode usar `pdf` já carregado ou `data`.
 * PDFium/MuPDF devem usar preferencialmente `data`.
 */
export type PdfBackendDocumentSource = {
  id: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;

  /**
   * Bytes do PDF.
   * Use Uint8Array porque PDFium/MuPDF/WASM normalmente trabalham melhor assim.
   */
  data?: Uint8Array;

  /**
   * Documento já aberto por um runtime específico.
   * Útil para manter compatibilidade com o fluxo atual do PDF.js.
   */
  pdf?: unknown;

  /**
   * Metadados livres do chamador.
   */
  metadata?: Record<string, unknown>;
};

export type PdfBackendCapabilities = {
  /**
   * Indica se o backend está realmente disponível no runtime atual.
   * Exemplo: PDFium WASM carregado, MuPDF instalado, PDF.js importado etc.
   */
  available: boolean;

  /**
   * Renderização visual de página em canvas/bitmap.
   */
  renderPage: boolean;

  /**
   * Extração semântica de texto.
   */
  extractText: boolean;

  /**
   * Extração de links/anotações.
   */
  extractAnnotations: boolean;

  /**
   * Suporte a cancelamento de render em andamento.
   */
  cancellation: boolean;

  /**
   * Suporte a HiDPI/outputScale.
   */
  hiDpi: boolean;

  /**
   * Suporte a renderizar recortes/tile da pagina.
   *
   * Quando false, o viewer deve continuar usando render de pagina inteira e
   * tratar tiles apenas como planejamento/debug.
   */
  tileRendering?: boolean;

  /**
   * Suporte a worker ou WASM fora da thread principal.
   */
  worker: boolean;

  /**
   * Indica se o backend sabe renderizar a página sem texto rasterizado.
   *
   * Este recurso é necessário para o modo profissional real:
   *
   * canvas sem texto
   * +
   * PdfVisualTextLayer visível
   *
   * Se false/undefined, o frontend NÃO deve ativar texto visual sobre o canvas,
   * para evitar duplicação.
   */
  renderWithoutText?: boolean;

  /**
   * Observação curta para debug.
   */
  reason?: string;
};

export type PdfBackendDocumentHandle = {
  id: string;
  backendId: KnexPdfBackendId | string;
  pageCount: number;

  /**
   * Objeto nativo do backend:
   * - PDF.js document;
   * - PDFium document;
   * - MuPDF document;
   * - outro handle futuro.
   */
  backendDocument?: unknown;

  /**
   * Metadados livres do backend.
   */
  metadata?: Record<string, unknown>;
};

export type PdfBackendPageHandle = {
  pageNumber: number;
  backendId?: KnexPdfBackendId | string;

  /**
   * Objeto nativo da página no backend.
   */
  backendPage: unknown;

  /**
   * Referência opcional ao documento de origem.
   */
  document?: PdfBackendDocumentHandle;
};

export type PdfBackendAnnotation = {
  id: string;
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
  url?: string;
  dest?: unknown;
};

export type PdfBackendCanvasTextMode =
  | "normal"
  | "without-text"
  | "unknown";

export type PdfBackendRenderPageInput = {
  page: PdfBackendPageHandle;
  canvas: HTMLCanvasElement;

  /**
   * Escala lógica/CSS da página.
   *
   * Não confundir com outputScale.
   * Exemplo:
   * scale 1.0 = zoom 100%
   * scale 2.0 = zoom 200%
   */
  scale: number;

  /**
   * Qualidade desejada.
   * O backend deve converter isso para outputScale/HiDPI internamente.
   */
  quality?: KnexPdfRenderQualityInput;

  /**
   * Controle visual do texto dentro do bitmap/canvas.
   *
   * true:
   *   renderiza a página normalmente, incluindo texto rasterizado no canvas.
   *
   * false:
   *   solicita que o backend renderize a página sem texto rasterizado.
   *   Esse modo é necessário para o hybrid-visual profissional:
   *
   *   canvas sem texto
   *   +
   *   PdfVisualTextLayer visível
   *
   * Importante:
   * Nem todo backend consegue cumprir isso.
   * Quando não conseguir, o backend deve renderizar normalmente e sinalizar
   * nos metadados/datasets que a supressão não foi aplicada.
   */
  renderText?: boolean;

  /**
   * Modo textual esperado pelo chamador.
   *
   * normal:
   *   canvas deve conter texto.
   *
   * without-text:
   *   canvas deve tentar remover/suprimir operações de texto.
   *
   * unknown:
   *   compatibilidade com chamadas antigas.
   */
  canvasTextMode?: PdfBackendCanvasTextMode;

  /**
   * Cancelamento de render antigo.
   */
  signal?: AbortSignal;

  /**
   * Versão de renderização.
   * Útil para logs/cache/fila.
   */
  renderVersion?: number;
  renderPhase?: KnexPdfRenderPhase;
};

export type PdfBackendRenderTileInput = {
  page: PdfBackendPageHandle;
  canvas: HTMLCanvasElement;

  /**
   * Geometria global da pagina inteira. O tile sempre e interpretado dentro
   * deste espaco, nao como uma pagina independente.
   */
  geometry: KnexPdfPageGeometry;

  /**
   * Recorte em coordenadas CSS/bitmap normalizadas pelo TileGridCalculator.
   */
  tile: KnexPdfPageTile;

  /**
   * Escala logica da pagina inteira.
   */
  scale: number;

  quality?: KnexPdfRenderQualityInput;
  renderText?: boolean;
  canvasTextMode?: PdfBackendCanvasTextMode;
  signal?: AbortSignal;
  renderVersion?: number;
  renderPhase?: KnexPdfRenderPhase;
};

export type PdfBackendExtractTextInput = {
  page: PdfBackendPageHandle;
  scale: number;
  signal?: AbortSignal;
};

export type PdfBackendExtractAnnotationsInput = {
  page: PdfBackendPageHandle;
  scale: number;
  signal?: AbortSignal;
};

export interface PdfRenderBackend {
  readonly id: KnexPdfBackendId | string;

  /**
   * Nome humano para debug/UI.
   * Exemplo: "PDF.js", "PDFium WASM", "MuPDF WASM".
   */
  readonly label?: string;

  /**
   * Prioridade usada pelo BackendSelector em modo auto.
   * Quanto maior, mais preferido.
   *
   * Sugestão:
   * pdfium: 90
   * mupdf: 80
   * pdfjs: 10
   */
  readonly priority?: number;

  /**
   * Verifica disponibilidade e recursos do backend.
   * Deve ser leve e não abrir documento pesado.
   */
  getCapabilities?(): Promise<PdfBackendCapabilities> | PdfBackendCapabilities;

  /**
   * Abre/cria o handle de documento para o backend.
   *
   * Para PDF.js atual:
   * - pode receber `pdf` já aberto;
   * - ou futuramente abrir por `data`.
   *
   * Para PDFium/MuPDF:
   * - deve receber `data`.
   */
  createDocumentHandle?(
    source: PdfBackendDocumentSource,
  ): Promise<PdfBackendDocumentHandle> | PdfBackendDocumentHandle;

  getPage(
    document: PdfBackendDocumentHandle,
    pageNumber: number,
  ): Promise<PdfBackendPageHandle>;

  /**
   * Renderiza a página no canvas.
   *
   * Para o modo profissional real, o backend deve observar:
   *
   * input.renderText === false
   *
   * Se conseguir, deve renderizar a página sem texto rasterizado.
   * Se não conseguir, deve manter renderização normal e deixar claro
   * por diagnóstico/dataset que a supressão não foi aplicada.
   */
  renderPage(input: PdfBackendRenderPageInput): Promise<KnexPdfCanvasRenderResult>;

  /**
   * Renderiza um recorte da pagina em um canvas do tamanho do tile.
   *
   * Implementacao opcional: backends que nao suportam clipping nativo devem
   * omitir este metodo para impedir fallback acidental para bitmap borrado.
   */
  renderTile?(
    input: PdfBackendRenderTileInput,
  ): Promise<KnexPdfCanvasRenderResult>;

  /**
   * Forma nova, mais extensível.
   * Backends novos podem implementar esta.
   */
  extractTextFromPage?(
    input: PdfBackendExtractTextInput,
  ): Promise<KnexPdfSemanticTextBlock[]>;

  /**
   * Forma antiga, mantida para compatibilidade.
   */
  extractText(
    page: PdfBackendPageHandle,
    scale: number,
  ): Promise<KnexPdfSemanticTextBlock[]>;

  /**
   * Forma nova, mais extensível.
   * Backends novos podem implementar esta.
   */
  extractAnnotationsFromPage?(
    input: PdfBackendExtractAnnotationsInput,
  ): Promise<PdfBackendAnnotation[]>;

  /**
   * Forma antiga, mantida para compatibilidade.
   */
  extractAnnotations(
    page: PdfBackendPageHandle,
    scale: number,
  ): Promise<PdfBackendAnnotation[]>;

  /**
   * Fecha/libera documento do backend.
   * Importante para PDFium/MuPDF/WASM.
   */
  destroyDocument?(document: PdfBackendDocumentHandle): Promise<void> | void;

  /**
   * Destrói o backend inteiro.
   * Útil para desligar runtime WASM, workers etc.
   */
  destroy?(): Promise<void> | void;
}

/**
 * Helpers de compatibilidade para permitir que o restante do engine use a API
 * nova sem quebrar backends antigos.
 */
export async function extractTextWithBackend(input: {
  backend: PdfRenderBackend;
  page: PdfBackendPageHandle;
  scale: number;
  signal?: AbortSignal;
}) {
  if (input.backend.extractTextFromPage) {
    return input.backend.extractTextFromPage({
      page: input.page,
      scale: input.scale,
      signal: input.signal,
    });
  }

  return input.backend.extractText(input.page, input.scale);
}

export async function extractAnnotationsWithBackend(input: {
  backend: PdfRenderBackend;
  page: PdfBackendPageHandle;
  scale: number;
  signal?: AbortSignal;
}) {
  if (input.backend.extractAnnotationsFromPage) {
    return input.backend.extractAnnotationsFromPage({
      page: input.page,
      scale: input.scale,
      signal: input.signal,
    });
  }

  return input.backend.extractAnnotations(input.page, input.scale);
}

export async function renderTileWithBackend(input: {
  backend: PdfRenderBackend;
  page: PdfBackendPageHandle;
  canvas: HTMLCanvasElement;
  geometry: KnexPdfPageGeometry;
  tile: KnexPdfPageTile;
  scale: number;
  quality?: KnexPdfRenderQualityInput;
  renderText?: boolean;
  canvasTextMode?: PdfBackendCanvasTextMode;
  signal?: AbortSignal;
  renderVersion?: number;
  renderPhase?: KnexPdfRenderPhase;
}) {
  if (!input.backend.renderTile) {
    throw new Error(
      `Backend ${input.backend.id} does not support PDF tile rendering.`,
    );
  }

  return input.backend.renderTile({
    page: input.page,
    canvas: input.canvas,
    geometry: input.geometry,
    tile: input.tile,
    scale: input.scale,
    quality: input.quality,
    renderText: input.renderText,
    canvasTextMode: input.canvasTextMode,
    signal: input.signal,
    renderVersion: input.renderVersion,
    renderPhase: input.renderPhase,
  });
}
