import { PdfJsBackend } from "./backends/pdfjs/PdfJsBackend";
import {
  BackendSelector,
  type BackendSelectionResult,
} from "./backends/BackendSelector";
import {
  BackendRegistry,
  createDefaultBackendRegistry,
} from "./backends/BackendRegistry";
import type { PdfRenderBackend } from "./backends/PdfRenderBackend";
import {
  createInitialKnexPdfEngineState,
  updateKnexPdfBackendState,
  type KnexPdfEngineState,
  type KnexPdfBackendSelectionMode,
} from "./core/engineState";
import type {
  KnexPdfEngineEvent,
  KnexPdfEngineEventListener,
} from "./core/engineEvents";
import type { KnexPdfEngineLogger } from "./core/engineLogger";
import { silentKnexPdfLogger } from "./core/engineLogger";
import type {
  KnexPdfBackendId,
  KnexPdfRenderQualityInput,
} from "./core/engineTypes";
import { detectKnexPdfDeviceCapabilities } from "./platform/DeviceCapabilities";
import { normalizeKnexPdfRenderQuality } from "./rendering/RenderQualityController";
import {
  clampKnexPdfZoom,
  computeActualSizeZoom,
  computeFitPageZoom,
  computeFitWidthZoom,
  computeWheelZoom,
  computeZoomIn,
  computeZoomOut,
  createZoomChange,
  parseZoomPercentInput,
  type ComputeFitZoomInput,
  type ComputeWheelZoomInput,
  type KnexPdfZoomChange,
  type KnexPdfZoomReason,
} from "./viewport/ZoomController";

export type SetKnexPdfZoomOptions = {
  /**
   * Motivo do zoom. Ajuda o viewer a decidir a política de scroll.
   *
   * Exemplo:
   * - wheel-zoom: ScrollCoordinator deve preservar âncora e HorizontalOverflowController
   *   não deve sobrescrever scrollLeft.
   * - fit-width: pode recentralizar.
   */
  reason?: KnexPdfZoomReason;

  /**
   * Quando true, força incremento de layout/render mesmo se o zoom numérico
   * não mudou. Use apenas em casos de reconstrução explícita de layout.
   */
  force?: boolean;
};

export type KnexPdfEngineSnapshot = {
  state: KnexPdfEngineState;
  zoom: number;
  layoutVersion: number;
  renderVersion: number;
  pageCount: number;
};

function normalizePageCount(pageCount: number): number {
  return Math.max(0, Math.floor(Number.isFinite(pageCount) ? pageCount : 0));
}

function normalizeErrorReason(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

const BACKEND_RECOVERY_BASE_DELAY_MS = 10_000;
const BACKEND_RECOVERY_MAX_DELAY_MS = 120_000;

function shouldRecoverBackend(
  preferredBackend: KnexPdfBackendSelectionMode,
): boolean {
  return preferredBackend !== "pdfjs";
}

/**
 * KnexPdfEngine
 * ------------------------------------------------------------
 * Motor central do leitor PDF.
 *
 * Responsabilidade deste arquivo:
 * - manter estado global do engine;
 * - controlar zoom de forma clampada, versionada e previsível;
 * - emitir eventos de mudança;
 * - impedir incrementos desnecessários de layoutVersion/renderVersion;
 * - servir como núcleo para web, PWA, desktop e mobile.
 *
 * Responsabilidade que este arquivo NÃO deve assumir:
 * - escrever diretamente viewport.scrollLeft;
 * - manipular DOM;
 * - sincronizar régua diretamente;
 * - renderizar canvas diretamente;
 * - decidir sozinho a âncora visual do zoom.
 *
 * Fluxo correto de zoom no viewer:
 * 1. componente captura snapshot/anchor com ScrollCoordinator;
 * 2. engine calcula e confirma o novo zoom;
 * 3. layout recalcula páginas;
 * 4. ScrollCoordinator restaura scroll;
 * 5. HorizontalOverflowController atualiza overflow sem sobrescrever wheel-zoom;
 * 6. RulerScrollSyncController sincroniza a régua.
 */
export class KnexPdfEngine {
  private state: KnexPdfEngineState;
  private readonly listeners = new Set<KnexPdfEngineEventListener>();
  private activeRenderBackend: PdfRenderBackend;
  private backendRecoveryTimer: ReturnType<typeof setTimeout> | null = null;
  private backendRecoveryAttempt = 0;

  readonly pdfJsBackend = new PdfJsBackend();
  readonly backendRegistry: BackendRegistry;
  readonly backendSelector: BackendSelector;

  constructor(
    private readonly logger: KnexPdfEngineLogger = silentKnexPdfLogger,
  ) {
    this.backendRegistry = createDefaultBackendRegistry({
      pdfJsBackend: this.pdfJsBackend,
    });
    this.backendSelector = new BackendSelector(this.backendRegistry);
    this.activeRenderBackend = this.pdfJsBackend;
    this.state = createInitialKnexPdfEngineState(
      detectKnexPdfDeviceCapabilities(),
    );
  }

  getState(): KnexPdfEngineState {
    return this.state;
  }

  getSnapshot(): KnexPdfEngineSnapshot {
    return {
      state: this.state,
      zoom: this.state.zoom,
      layoutVersion: this.state.layoutVersion,
      renderVersion: this.state.renderVersion,
      pageCount: this.state.pageCount,
    };
  }

  getZoom(): number {
    return this.state.zoom;
  }

  getLayoutVersion(): number {
    return this.state.layoutVersion;
  }

  getRenderVersion(): number {
    return this.state.renderVersion;
  }

  getPageCount(): number {
    return this.state.pageCount;
  }

  getPreferredBackend(): KnexPdfBackendSelectionMode {
    return this.state.preferredBackend;
  }

  getActiveBackend(): KnexPdfBackendId {
    return this.state.activeBackend;
  }

  getBackend(): PdfRenderBackend {
    return (
      this.activeRenderBackend ??
      this.backendRegistry.get(this.state.activeBackend) ??
      this.pdfJsBackend
    );
  }

  async setBackend(
    preferredBackend: KnexPdfBackendSelectionMode,
  ): Promise<KnexPdfEngineState> {
    await this.resolveActiveBackend(preferredBackend);
    return this.state;
  }

  async resolveActiveBackend(
    preferredBackend: KnexPdfBackendSelectionMode = this.state.preferredBackend,
  ): Promise<BackendSelectionResult> {
    try {
      const selection = await this.backendSelector.select(preferredBackend);
      this.commitBackendSelection(selection);
      return selection;
    } catch (error) {
      this.reportBackendError({
        backend: preferredBackend,
        reason: normalizeErrorReason(
          error,
          "Failed to resolve KnexPDF backend.",
        ),
        error,
      });
      throw error;
    }
  }

  reportBackendFallback(input: {
    requestedBackend?: KnexPdfBackendSelectionMode;
    failedBackend: KnexPdfBackendId | string;
    reason: string;
    recover?: boolean;
  }): KnexPdfEngineState {
    const requestedBackend =
      input.requestedBackend ?? this.state.preferredBackend;
    const previousState = this.state;
    const previousBackend = previousState.activeBackend;
    const fallbackBackend =
      this.backendRegistry.get("pdfjs") ?? this.pdfJsBackend;

    this.activeRenderBackend = fallbackBackend;
    this.state = updateKnexPdfBackendState(this.state, {
      preferredBackend: requestedBackend,
      activeBackend: "pdfjs",
      failedBackend: input.failedBackend,
      backendFallbackReason: input.reason,
    });

    this.logger.log("warn", "KnexPDF backend fallback", {
      requestedBackend,
      failedBackend: input.failedBackend,
      fallbackBackend: "pdfjs",
      reason: input.reason,
      renderVersion: this.state.renderVersion,
    });

    if (this.state !== previousState) {
      this.emit({
        type: "backend-changed",
        preferredBackend: this.state.preferredBackend,
        activeBackend: this.state.activeBackend,
        previousBackend,
        renderVersion: this.state.renderVersion,
      });
    }

    this.emit({
      type: "backend-fallback",
      requestedBackend,
      failedBackend: input.failedBackend,
      fallbackBackend: "pdfjs",
      reason: input.reason,
      renderVersion: this.state.renderVersion,
    });

    if (input.recover !== false) {
      this.scheduleBackendRecovery(requestedBackend, input.reason);
    } else {
      this.clearBackendRecovery();
    }

    return this.state;
  }

  reportBackendError(input: {
    backend: KnexPdfBackendId | KnexPdfBackendSelectionMode | string;
    reason: string;
    error?: unknown;
  }): void {
    this.logger.log("error", "KnexPDF backend error", {
      backend: input.backend,
      reason: input.reason,
      error: input.error,
      renderVersion: this.state.renderVersion,
    });

    this.emit({
      type: "backend-error",
      backend: input.backend,
      reason: input.reason,
      error: input.error,
      renderVersion: this.state.renderVersion,
    });
  }

  /**
   * Altera qualidade de renderização.
   *
   * Importante:
   * - muda renderVersion;
   * - não muda layoutVersion, porque qualidade não altera geometria da página;
   * - não deve mexer em scroll.
   */
  setRenderQuality(quality: KnexPdfRenderQualityInput): KnexPdfEngineState {
    const normalizedQuality = normalizeKnexPdfRenderQuality(quality);

    if (this.state.renderQuality === normalizedQuality) {
      this.logger.log(
        "debug",
        "KnexPDF render quality unchanged",
        normalizedQuality,
      );
      return this.state;
    }

    this.state = {
      ...this.state,
      renderQuality: normalizedQuality,
      renderVersion: this.state.renderVersion + 1,
    };

    this.logger.log(
      "debug",
      "KnexPDF render quality changed",
      this.state.renderQuality,
    );

    return this.state;
  }

  /**
   * Método central de commit de zoom.
   *
   * Ele só altera o estado do engine. A preservação visual do viewport deve ser
   * feita fora daqui, pelo ScrollCoordinator, após o layout recalcular.
   */
  private commitZoom(
    requestedZoom: number,
    options: SetKnexPdfZoomOptions = {},
  ): KnexPdfZoomChange {
    const reason = options.reason ?? "manual-scale";
    const nextZoom = clampKnexPdfZoom(requestedZoom);

    const change = createZoomChange({
      previousZoom: this.state.zoom,
      nextZoom,
      reason,
    });

    if (!change.changed && !options.force) {
      this.logger.log("debug", "KnexPDF zoom unchanged", {
        zoom: this.state.zoom,
        reason,
      });
      return change;
    }

    this.state = {
      ...this.state,
      zoom: change.nextZoom,
      layoutVersion: this.state.layoutVersion + 1,
      renderVersion: this.state.renderVersion + 1,
    };

    this.logger.log("debug", "KnexPDF zoom changed", {
      previousZoom: change.previousZoom,
      nextZoom: change.nextZoom,
      reason,
      layoutVersion: this.state.layoutVersion,
      renderVersion: this.state.renderVersion,
    });

    /**
     * Manter o formato antigo do evento para não quebrar engineEvents existente.
     * Se engineEvents for expandido depois, pode incluir reason/renderVersion.
     */
    this.emit({
      type: "zoom-changed",
      zoom: change.nextZoom,
      layoutVersion: this.state.layoutVersion,
    });

    return change;
  }

  /**
   * Compatível com a API antiga.
   */
  setZoom(
    zoom: number,
    options: SetKnexPdfZoomOptions = {},
  ): KnexPdfZoomChange {
    return this.commitZoom(zoom, {
      reason: options.reason ?? "manual-scale",
      force: options.force,
    });
  }

  setZoomPercent(
    zoomPercent: string | number,
    options: SetKnexPdfZoomOptions = {},
  ): KnexPdfZoomChange {
    const nextZoom = parseZoomPercentInput({
      value: zoomPercent,
      fallbackZoom: this.state.zoom,
    });

    return this.commitZoom(nextZoom, {
      reason: options.reason ?? "manual-percent",
      force: options.force,
    });
  }

  zoomIn(): KnexPdfZoomChange {
    return this.commitZoom(computeZoomIn(this.state.zoom), {
      reason: "zoom-in",
    });
  }

  zoomOut(): KnexPdfZoomChange {
    return this.commitZoom(computeZoomOut(this.state.zoom), {
      reason: "zoom-out",
    });
  }

  /**
   * Calcula zoom por Ctrl + wheel.
   *
   * Atenção:
   * Este método NÃO preserva scroll sozinho.
   * O componente deve capturar anchor antes, chamar wheelZoom, aguardar layout
   * e restaurar scroll com ScrollCoordinator.
   */
  wheelZoom(
    input: Omit<ComputeWheelZoomInput, "currentZoom">,
  ): KnexPdfZoomChange {
    const nextZoom = computeWheelZoom({
      ...input,
      currentZoom: this.state.zoom,
    });

    return this.commitZoom(nextZoom, {
      reason: "wheel-zoom",
    });
  }

  actualSize(): KnexPdfZoomChange {
    return this.commitZoom(computeActualSizeZoom(), {
      reason: "actual-size",
    });
  }

  fitWidth(input: ComputeFitZoomInput): KnexPdfZoomChange {
    return this.commitZoom(computeFitWidthZoom(input), {
      reason: "fit-width",
    });
  }

  fitPage(input: ComputeFitZoomInput): KnexPdfZoomChange {
    return this.commitZoom(computeFitPageZoom(input), {
      reason: "fit-page",
    });
  }

  /**
   * Atualiza contagem de páginas.
   * Não deve mexer em zoom ou scroll.
   */
  setPageCount(pageCount: number): KnexPdfEngineState {
    const normalizedPageCount = normalizePageCount(pageCount);

    if (this.state.pageCount === normalizedPageCount) {
      return this.state;
    }

    this.state = {
      ...this.state,
      pageCount: normalizedPageCount,
    };

    this.emit({
      type: "document-loaded",
      pageCount: normalizedPageCount,
    });

    return this.state;
  }

  subscribe(listener: KnexPdfEngineEventListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  private emit(event: KnexPdfEngineEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        this.logger.log("error", "KnexPDF event listener failed", error);
      }
    });
  }

  private clearBackendRecovery(): void {
    if (this.backendRecoveryTimer) {
      clearTimeout(this.backendRecoveryTimer);
      this.backendRecoveryTimer = null;
    }

    this.backendRecoveryAttempt = 0;
  }

  private scheduleBackendRecovery(
    preferredBackend: KnexPdfBackendSelectionMode,
    reason: string,
  ): void {
    if (!shouldRecoverBackend(preferredBackend)) return;
    if (this.backendRecoveryTimer) return;

    const delay = Math.min(
      BACKEND_RECOVERY_MAX_DELAY_MS,
      BACKEND_RECOVERY_BASE_DELAY_MS *
        Math.max(1, 2 ** this.backendRecoveryAttempt),
    );

    this.backendRecoveryAttempt += 1;

    this.logger.log("warn", "KnexPDF backend recovery scheduled", {
      preferredBackend,
      activeBackend: this.state.activeBackend,
      delay,
      reason,
      attempt: this.backendRecoveryAttempt,
    });

    this.backendRecoveryTimer = setTimeout(() => {
      this.backendRecoveryTimer = null;

      void this.resolveActiveBackend(preferredBackend)
        .then((selection) => {
          if (
            selection.activeBackend === "pdfjs" &&
            shouldRecoverBackend(selection.requestedBackend)
          ) {
            this.scheduleBackendRecovery(
              selection.requestedBackend,
              selection.reason ?? reason,
            );
          }
        })
        .catch((error) => {
          const recoveryReason = normalizeErrorReason(
            error,
            "Backend recovery failed.",
          );

          this.reportBackendError({
            backend: preferredBackend,
            reason: recoveryReason,
            error,
          });
          this.scheduleBackendRecovery(preferredBackend, recoveryReason);
        });
    }, delay);
  }

  private commitBackendSelection(selection: BackendSelectionResult): void {
    const previousState = this.state;
    const previousBackend = previousState.activeBackend;

    if (selection.activeBackend !== "pdfjs" && !selection.fallbackUsed) {
      this.clearBackendRecovery();
    }

    this.activeRenderBackend = selection.backend;
    this.state = updateKnexPdfBackendState(this.state, {
      preferredBackend: selection.requestedBackend,
      activeBackend: selection.activeBackend,
      failedBackend: selection.failedBackend,
      backendFallbackReason: selection.fallbackUsed ? selection.reason : undefined,
    });

    this.logger.log("debug", "KnexPDF backend selected", {
      requestedBackend: selection.requestedBackend,
      activeBackend: selection.activeBackend,
      fallbackUsed: selection.fallbackUsed,
      failedBackend: selection.failedBackend,
      reason: selection.reason,
      backendVersion: this.state.backendVersion,
      renderVersion: this.state.renderVersion,
    });

    if (this.state !== previousState) {
      this.emit({
        type: "backend-changed",
        preferredBackend: this.state.preferredBackend,
        activeBackend: this.state.activeBackend,
        previousBackend,
        renderVersion: this.state.renderVersion,
      });
    }

    if (selection.fallbackUsed && selection.failedBackend && selection.reason) {
      this.emit({
        type: "backend-fallback",
        requestedBackend: selection.requestedBackend,
        failedBackend: selection.failedBackend,
        fallbackBackend: selection.activeBackend,
        reason: selection.reason,
        renderVersion: this.state.renderVersion,
      });

      this.scheduleBackendRecovery(selection.requestedBackend, selection.reason);
    }
  }
}

/**
 * Fluxo recomendado para Ctrl + wheel no componente:
 *
 * function onWheel(event: WheelEvent) {
 *   if (!event.ctrlKey) return;
 *   event.preventDefault();
 *
 *   const before = scrollCoordinator.createSnapshot({
 *     contentWidth: currentContentWidth,
 *     contentHeight: currentContentHeight,
 *     layoutVersion: engine.getLayoutVersion(),
 *   });
 *
 *   const anchor = scrollCoordinator.captureWheelAnchor(event, before);
 *
 *   const change = engine.wheelZoom({
 *     deltaY: event.deltaY,
 *     deltaMode: event.deltaMode,
 *   });
 *
 *   if (!change.changed) return;
 *
 *   requestAnimationFrame(() => {
 *     const after = scrollCoordinator.createSnapshot({
 *       contentWidth: nextContentWidth,
 *       contentHeight: nextContentHeight,
 *       layoutVersion: engine.getLayoutVersion(),
 *     });
 *
 *     scrollCoordinator.preserveAfterZoom({
 *       anchor,
 *       nextSnapshot: after,
 *       currentLayoutVersion: engine.getLayoutVersion(),
 *       reason: "wheel-zoom",
 *     });
 *
 *     horizontalOverflowController.updateFromContentElement({
 *       contentEl: pageFlowEl,
 *       activeContentCenterX: zoomCenterAnchor.contentCenterX,
 *       reason: "wheel-zoom",
 *       scrollWritePolicy: "none",
 *       resetScrollWhenNoOverflow: false,
 *       layoutVersion: engine.getLayoutVersion(),
 *       currentLayoutVersion: engine.getLayoutVersion(),
 *     });
 *   });
 * }
 */
