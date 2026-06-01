import type {
  KnexPdfBackendId,
  KnexPdfDeviceCapabilities,
  KnexPdfRenderQuality,
  KnexPdfViewMode,
} from "./engineTypes";

/**
 * Modo de seleção de backend.
 *
 * - "pdfjs": força PDF.js.
 * - "pdfium": força PDFium, quando disponível.
 * - "auto": deixa o engine escolher o melhor backend disponível.
 */
export type KnexPdfBackendSelectionMode = KnexPdfBackendId | "auto";

export type KnexPdfBackendRuntimeState = {
  /**
   * Backend solicitado pelo usuário/configuração.
   */
  preferredBackend: KnexPdfBackendSelectionMode;

  /**
   * Backend efetivamente em uso.
   *
   * No modo auto, pode ser "pdfium" quando disponível ou "pdfjs" como fallback.
   */
  activeBackend: KnexPdfBackendId;

  /**
   * Campo antigo mantido por compatibilidade.
   *
   * Deve sempre refletir o mesmo valor de activeBackend.
   * Remover apenas depois que todo o código tiver migrado para activeBackend.
   */
  backend: KnexPdfBackendId;

  /**
   * Contador para invalidar renders/cache quando o backend muda.
   */
  backendVersion: number;

  /**
   * Último backend que falhou, útil para diagnóstico.
   */
  failedBackend?: KnexPdfBackendId | string;

  /**
   * Motivo do último fallback.
   */
  backendFallbackReason?: string;
};

export type KnexPdfEngineState = KnexPdfBackendRuntimeState & {
  viewMode: KnexPdfViewMode;
  zoom: number;
  renderQuality: KnexPdfRenderQuality;
  deviceCapabilities: KnexPdfDeviceCapabilities;
  activePageNumber: number;
  pageCount: number;
  layoutVersion: number;
  renderVersion: number;
};

export function createInitialKnexPdfEngineState(
  deviceCapabilities: KnexPdfDeviceCapabilities,
): KnexPdfEngineState {
  return {
    /**
     * Por enquanto, começamos em PDF.js para não quebrar o leitor atual.
     * Quando PDFium estiver implementado, o valor poderá ser "auto".
     */
    preferredBackend: "pdfjs",

    /**
     * Backend realmente ativo no boot.
     */
    activeBackend: "pdfjs",

    /**
     * Compatibilidade com código antigo.
     */
    backend: "pdfjs",

    backendVersion: 0,

    viewMode: "continuous",
    zoom: 1.3,
    renderQuality: "extreme",
    deviceCapabilities,
    activePageNumber: 1,
    pageCount: 0,
    layoutVersion: 0,
    renderVersion: 0,
  };
}

export function updateKnexPdfBackendState(
  state: KnexPdfEngineState,
  input: {
    preferredBackend?: KnexPdfBackendSelectionMode;
    activeBackend?: KnexPdfBackendId;
    failedBackend?: KnexPdfBackendId | string;
    backendFallbackReason?: string;
  },
): KnexPdfEngineState {
  const preferredBackend = input.preferredBackend ?? state.preferredBackend;
  const activeBackend = input.activeBackend ?? state.activeBackend;

  const changed =
    preferredBackend !== state.preferredBackend ||
    activeBackend !== state.activeBackend ||
    input.failedBackend !== state.failedBackend ||
    input.backendFallbackReason !== state.backendFallbackReason;

  if (!changed) {
    return state;
  }

  return {
    ...state,
    preferredBackend,
    activeBackend,

    /**
     * Campo antigo acompanha o activeBackend.
     */
    backend: activeBackend,

    failedBackend: input.failedBackend,
    backendFallbackReason: input.backendFallbackReason,

    /**
     * Troca de backend exige nova renderização, mas não necessariamente altera
     * geometria da página. Ainda assim, incrementamos layoutVersion para garantir
     * que caches e métricas dependentes de backend não reaproveitem estado antigo.
     */
    backendVersion: state.backendVersion + 1,
    layoutVersion: state.layoutVersion + 1,
    renderVersion: state.renderVersion + 1,
  };
}
