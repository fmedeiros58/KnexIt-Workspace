import type { KnexPdfHorizontalOverflowState } from "../core/engineTypes";

export type HorizontalOverflowReason =
  | "initial-layout"
  | "zoom"
  | "wheel-zoom"
  | "pinch-zoom"
  | "fit-width"
  | "fit-page"
  | "actual-size"
  | "resize"
  | "view-mode-change"
  | "side-by-side"
  | "manual"
  | "content-change"
  | "restore";

export type HorizontalOverflowMode = "hidden" | "auto";

/**
 * Política de escrita de scrollLeft.
 *
 * center:
 *   centraliza pelo activeContentCenterX.
 *
 * preserve:
 *   preserva o scrollLeft atual se estiver dentro dos limites.
 *
 * none:
 *   não escreve scrollLeft. Apenas atualiza overflowX e chama hooks.
 *   Esta é a política mais segura durante wheel-zoom quando o ScrollCoordinator
 *   já restaurou a âncora visual.
 *
 * reset:
 *   força scrollLeft = 0. Deve ser usado com cuidado.
 *
 * auto:
 *   escolhe a política com base no reason.
 */
export type HorizontalScrollWritePolicy =
  | "auto"
  | "center"
  | "preserve"
  | "none"
  | "reset";

export type HorizontalOverflowMetrics = {
  viewportWidth: number;
  realContentWidth: number;
  activeContentCenterX: number;
  maxScrollLeft: number;
  currentScrollLeft: number;
  tolerance: number;
};

export type HorizontalOverflowDecision = {
  hasOverflow: boolean;
  mode: HorizontalOverflowMode;
  desiredScrollLeft: number;
  viewportWidth: number;
  realContentWidth: number;
  activeContentCenterX: number;
  maxScrollLeft: number;
  tolerance: number;
  reason: HorizontalOverflowReason;
};

export type HorizontalOverflowApplyResult = {
  state: KnexPdfHorizontalOverflowState;
  decision: HorizontalOverflowDecision;
  appliedScrollLeft: number;
  appliedOverflowX: HorizontalOverflowMode;
  didWriteScrollLeft: boolean;
  didChangeOverflowMode: boolean;
  scrollWritePolicy: HorizontalScrollWritePolicy;
  discarded: boolean;
};

export type HorizontalOverflowHooks = {
  /**
   * Deve chamar rulerScrollSyncController.sync() imediatamente após alteração
   * de scrollLeft ou overflow-x.
   */
  onAfterScroll?: () => void;

  /**
   * Útil apenas para modo desenvolvimento.
   */
  onDebug?: (eventName: string, payload: Record<string, unknown>) => void;
};

export type ComputeHorizontalOverflowInput = {
  viewportWidth: number;
  realContentWidth: number;
  activeContentCenterX: number;

  /**
   * Valor máximo possível do scrollLeft.
   * Se não for informado, será calculado como:
   * realContentWidth - viewportWidth.
   */
  maxScrollLeft?: number;

  /**
   * Scroll atual. Usado apenas em funções detalhadas.
   */
  currentScrollLeft?: number;

  /**
   * Tolerância para evitar barra horizontal por erro subpixel de 1 ou 2 px.
   */
  tolerance?: number;

  reason?: HorizontalOverflowReason;
};

export type ApplyHorizontalOverflowInput = ComputeHorizontalOverflowInput & {
  viewportEl: HTMLElement;
  hooks?: HorizontalOverflowHooks;

  /**
   * Política explícita de escrita horizontal.
   *
   * Use "none" durante wheel-zoom quando o ScrollCoordinator já restaurou
   * o scrollLeft pela âncora visual.
   */
  scrollWritePolicy?: HorizontalScrollWritePolicy;

  /**
   * Compatibilidade com a versão anterior.
   * Se true e scrollWritePolicy não for informado, equivale a "preserve".
   */
  preserveCurrentScrollWhenPossible?: boolean;

  /**
   * Quando false, evita forçar scrollLeft = 0 quando não há overflow.
   * Útil em ciclos intermediários de zoom para evitar salto por medição transitória.
   * O padrão é true.
   */
  resetScrollWhenNoOverflow?: boolean;

  /**
   * Controle opcional de versão de layout.
   * Se informado, impede aplicação de overflow/scroll com layout antigo.
   */
  layoutVersion?: number;
  currentLayoutVersion?: number;
};

const DEFAULT_PIXEL_TOLERANCE = 2;
const SUBPIXEL_ROUNDING_FACTOR = 1000;

export function safeNumber(
  value: number | null | undefined,
  fallback = 0,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

export function roundToSubpixel(value: number): number {
  return Math.round(value * SUBPIXEL_ROUNDING_FACTOR) / SUBPIXEL_ROUNDING_FACTOR;
}

export function clamp(value: number, min: number, max: number): number {
  const safeMin = safeNumber(min, 0);
  const safeMax = Math.max(safeMin, safeNumber(max, safeMin));
  const safeValue = safeNumber(value, safeMin);

  return roundToSubpixel(Math.max(safeMin, Math.min(safeMax, safeValue)));
}

export function computeMaxScrollLeft(input: {
  viewportWidth: number;
  realContentWidth: number;
}): number {
  return Math.max(
    0,
    safeNumber(input.realContentWidth, 0) - safeNumber(input.viewportWidth, 0),
  );
}

export function computeMaxScrollLeftFromViewport(viewportEl: HTMLElement): number {
  return Math.max(0, viewportEl.scrollWidth - viewportEl.clientWidth);
}

export function shouldHaveHorizontalOverflow(input: {
  viewportWidth: number;
  realContentWidth: number;
  tolerance?: number;
}): boolean {
  const viewportWidth = Math.max(0, safeNumber(input.viewportWidth, 0));
  const realContentWidth = Math.max(0, safeNumber(input.realContentWidth, 0));
  const tolerance = Math.max(
    0,
    safeNumber(input.tolerance, DEFAULT_PIXEL_TOLERANCE),
  );

  return realContentWidth > viewportWidth + tolerance;
}

/**
 * Centraliza o viewport no centro lógico do conteúdo ativo.
 *
 * Importante:
 * - Não usa o 0 da régua.
 * - Não usa origem métrica da régua.
 * - Usa activeContentCenterX, que deve vir do ZoomCenterAnchorController
 *   ou do PageLayoutEngine.
 */
export function computeCenteredScrollLeft(input: {
  activeContentCenterX: number;
  viewportWidth: number;
  maxScrollLeft: number;
}): number {
  const viewportCenterX = Math.max(1, safeNumber(input.viewportWidth, 1)) / 2;

  const desiredScrollLeft =
    safeNumber(input.activeContentCenterX, viewportCenterX) - viewportCenterX;

  return clamp(desiredScrollLeft, 0, input.maxScrollLeft);
}

export function normalizeHorizontalOverflowMetrics(
  input: ComputeHorizontalOverflowInput,
): HorizontalOverflowMetrics {
  const viewportWidth = Math.max(1, safeNumber(input.viewportWidth, 1));
  const realContentWidth = Math.max(0, safeNumber(input.realContentWidth, 0));
  const activeContentCenterX = Math.max(
    0,
    safeNumber(input.activeContentCenterX, viewportWidth / 2),
  );
  const tolerance = Math.max(
    0,
    safeNumber(input.tolerance, DEFAULT_PIXEL_TOLERANCE),
  );

  const maxScrollLeft =
    typeof input.maxScrollLeft === "number"
      ? Math.max(0, safeNumber(input.maxScrollLeft, 0))
      : computeMaxScrollLeft({
          viewportWidth,
          realContentWidth,
        });

  const currentScrollLeft = clamp(
    safeNumber(input.currentScrollLeft, 0),
    0,
    maxScrollLeft,
  );

  return {
    viewportWidth,
    realContentWidth,
    activeContentCenterX,
    maxScrollLeft,
    currentScrollLeft,
    tolerance,
  };
}

/**
 * Versão detalhada para uso interno/debug.
 */
export function computeHorizontalOverflowDecision(
  input: ComputeHorizontalOverflowInput,
): HorizontalOverflowDecision {
  const metrics = normalizeHorizontalOverflowMetrics(input);

  const hasOverflow = shouldHaveHorizontalOverflow({
    viewportWidth: metrics.viewportWidth,
    realContentWidth: metrics.realContentWidth,
    tolerance: metrics.tolerance,
  });

  const desiredScrollLeft = hasOverflow
    ? computeCenteredScrollLeft({
        activeContentCenterX: metrics.activeContentCenterX,
        viewportWidth: metrics.viewportWidth,
        maxScrollLeft: metrics.maxScrollLeft,
      })
    : 0;

  return {
    hasOverflow,
    mode: hasOverflow ? "auto" : "hidden",
    desiredScrollLeft,
    viewportWidth: metrics.viewportWidth,
    realContentWidth: metrics.realContentWidth,
    activeContentCenterX: metrics.activeContentCenterX,
    maxScrollLeft: metrics.maxScrollLeft,
    tolerance: metrics.tolerance,
    reason: input.reason ?? "manual",
  };
}

/**
 * Mantém a assinatura original, mas torna o cálculo mais seguro e consistente.
 *
 * Retorna apenas os campos esperados por KnexPdfHorizontalOverflowState
 * para evitar conflito com engineTypes existentes.
 */
export function computeHorizontalOverflow(input: {
  viewportWidth: number;
  realContentWidth: number;
  activeContentCenterX: number;
  tolerance?: number;
}): KnexPdfHorizontalOverflowState {
  const decision = computeHorizontalOverflowDecision({
    viewportWidth: input.viewportWidth,
    realContentWidth: input.realContentWidth,
    activeContentCenterX: input.activeContentCenterX,
    tolerance: input.tolerance,
    reason: "manual",
  });

  return {
    hasOverflow: decision.hasOverflow,
    viewportWidth: decision.viewportWidth,
    realContentWidth: decision.realContentWidth,
    desiredScrollLeft: decision.desiredScrollLeft,
  };
}

export function shouldPreserveScrollForReason(
  reason: HorizontalOverflowReason | undefined,
): boolean {
  return (
    reason === "zoom" ||
    reason === "wheel-zoom" ||
    reason === "pinch-zoom"
  );
}

export function shouldCenterScrollForReason(
  reason: HorizontalOverflowReason | undefined,
): boolean {
  return (
    reason === "initial-layout" ||
    reason === "fit-width" ||
    reason === "fit-page" ||
    reason === "actual-size" ||
    reason === "view-mode-change" ||
    reason === "side-by-side" ||
    reason === "resize"
  );
}

export function resolveScrollWritePolicy(input: {
  reason?: HorizontalOverflowReason;
  requestedPolicy?: HorizontalScrollWritePolicy;
  preserveCurrentScrollWhenPossible?: boolean;
}): HorizontalScrollWritePolicy {
  if (input.requestedPolicy && input.requestedPolicy !== "auto") {
    return input.requestedPolicy;
  }

  if (input.preserveCurrentScrollWhenPossible) {
    return "preserve";
  }

  /**
   * Durante zoom, especialmente wheel-zoom, o ScrollCoordinator deve ser
   * o único responsável por restaurar o scrollLeft.
   *
   * O HorizontalOverflowController não deve recentralizar depois dele,
   * pois isso causa salto lateral.
   */
  if (shouldPreserveScrollForReason(input.reason)) {
    return "none";
  }

  if (shouldCenterScrollForReason(input.reason)) {
    return "center";
  }

  return "center";
}

/**
 * Decide se é possível preservar o scrollLeft atual.
 *
 * Útil quando o usuário já está navegando horizontalmente em zoom alto.
 * Em mudanças estruturais fortes, como sideBySide ou fit, prefira centralizar.
 */
export function canPreserveCurrentScrollLeft(input: {
  currentScrollLeft: number;
  maxScrollLeft: number;
}): boolean {
  const currentScrollLeft = safeNumber(input.currentScrollLeft, 0);
  const maxScrollLeft = Math.max(0, safeNumber(input.maxScrollLeft, 0));

  return currentScrollLeft >= 0 && currentScrollLeft <= maxScrollLeft;
}

export function shouldDiscardByLayoutVersion(input: {
  layoutVersion?: number;
  currentLayoutVersion?: number;
}): boolean {
  if (
    typeof input.layoutVersion !== "number" ||
    typeof input.currentLayoutVersion !== "number"
  ) {
    return false;
  }

  return input.layoutVersion !== input.currentLayoutVersion;
}

export function createHorizontalOverflowState(
  decision: HorizontalOverflowDecision,
): KnexPdfHorizontalOverflowState {
  return {
    hasOverflow: decision.hasOverflow,
    viewportWidth: decision.viewportWidth,
    realContentWidth: decision.realContentWidth,
    desiredScrollLeft: decision.desiredScrollLeft,
  };
}

export function applyHorizontalOverflowToViewport(
  input: ApplyHorizontalOverflowInput,
): HorizontalOverflowApplyResult {
  const decision = computeHorizontalOverflowDecision({
    viewportWidth: input.viewportWidth,
    realContentWidth: input.realContentWidth,
    activeContentCenterX: input.activeContentCenterX,
    maxScrollLeft: input.maxScrollLeft,
    currentScrollLeft: input.currentScrollLeft ?? input.viewportEl.scrollLeft,
    tolerance: input.tolerance,
    reason: input.reason,
  });

  const state = createHorizontalOverflowState(decision);

  const scrollWritePolicy = resolveScrollWritePolicy({
    reason: input.reason,
    requestedPolicy: input.scrollWritePolicy,
    preserveCurrentScrollWhenPossible: input.preserveCurrentScrollWhenPossible,
  });

  if (
    shouldDiscardByLayoutVersion({
      layoutVersion: input.layoutVersion,
      currentLayoutVersion: input.currentLayoutVersion,
    })
  ) {
    input.hooks?.onDebug?.("horizontalOverflow.discardedByLayoutVersion", {
      state,
      decision,
      scrollWritePolicy,
      layoutVersion: input.layoutVersion,
      currentLayoutVersion: input.currentLayoutVersion,
    });

    return {
      state,
      decision,
      appliedScrollLeft: input.viewportEl.scrollLeft,
      appliedOverflowX:
        input.viewportEl.style.overflowX === "auto" ? "auto" : "hidden",
      didWriteScrollLeft: false,
      didChangeOverflowMode: false,
      scrollWritePolicy,
      discarded: true,
    };
  }

  const previousOverflowX =
    input.viewportEl.style.overflowX === "auto" ? "auto" : "hidden";

  if (previousOverflowX !== decision.mode) {
    input.viewportEl.style.overflowX = decision.mode;
  }

  let didWriteScrollLeft = false;

  if (!decision.hasOverflow) {
    /**
     * Durante zoom interativo, NÃO zerar scrollLeft por padrão.
     *
     * A medição de overflow pode oscilar por um frame enquanto o layout muda.
     * Se este controlador zerar scrollLeft nesse intervalo, ele desfaz a
     * âncora do ScrollCoordinator e cria sensação de salto/lentidão.
     */
    const shouldResetWhenNoOverflow =
      input.resetScrollWhenNoOverflow ??
      !shouldPreserveScrollForReason(input.reason);

    if (shouldResetWhenNoOverflow && input.viewportEl.scrollLeft !== 0) {
      input.viewportEl.scrollLeft = 0;
      didWriteScrollLeft = true;
    }
  } else if (scrollWritePolicy === "none") {
    /**
     * Política fundamental para wheel-zoom:
     * Não escrever scrollLeft. O ScrollCoordinator já restaurou a âncora.
     */
  } else {
    let nextScrollLeft = decision.desiredScrollLeft;

    if (scrollWritePolicy === "reset") {
      nextScrollLeft = 0;
    }

    if (scrollWritePolicy === "preserve") {
      const currentScrollLeft = clamp(
        input.viewportEl.scrollLeft,
        0,
        decision.maxScrollLeft,
      );

      nextScrollLeft = canPreserveCurrentScrollLeft({
        currentScrollLeft,
        maxScrollLeft: decision.maxScrollLeft,
      })
        ? currentScrollLeft
        : decision.desiredScrollLeft;
    }

    if (scrollWritePolicy === "center") {
      nextScrollLeft = decision.desiredScrollLeft;
    }

    const clampedNextScrollLeft = clamp(
      nextScrollLeft,
      0,
      decision.maxScrollLeft,
    );

    if (input.viewportEl.scrollLeft !== clampedNextScrollLeft) {
      input.viewportEl.scrollLeft = clampedNextScrollLeft;
      didWriteScrollLeft = true;
    }
  }

  const didChangeOverflowMode = previousOverflowX !== decision.mode;

  /**
   * Sincronizar a régua apenas quando algo mudou.
   *
   * Antes o hook rodava mesmo quando scrollWritePolicy = "none" e nenhum
   * scroll/overflow mudava. Durante wheel-zoom isso pode virar trabalho extra
   * por microevento, reduzindo a sensação de resposta imediata.
   */
  if (didWriteScrollLeft || didChangeOverflowMode) {
    input.hooks?.onAfterScroll?.();
  }

  input.hooks?.onDebug?.("horizontalOverflow.applied", {
    state,
    decision,
    appliedScrollLeft: input.viewportEl.scrollLeft,
    appliedOverflowX: decision.mode,
    didWriteScrollLeft,
    didChangeOverflowMode,
    scrollWritePolicy,
    discarded: false,
  });

  return {
    state,
    decision,
    appliedScrollLeft: input.viewportEl.scrollLeft,
    appliedOverflowX: decision.mode,
    didWriteScrollLeft,
    didChangeOverflowMode,
    scrollWritePolicy,
    discarded: false,
  };
}

/**
 * Mede a largura real do conteúdo usando getBoundingClientRect.
 *
 * Use com cuidado:
 * - O elemento recebido deve ser o conteúdo útil de páginas.
 * - Não passe toolbar, ribbon, régua, labels, overlays ou sidebar.
 */
export function measureRealContentWidth(contentEl: HTMLElement): number {
  const rect = contentEl.getBoundingClientRect();
  return Math.max(0, safeNumber(rect.width, 0));
}

/**
 * Mede viewport e conteúdo real e aplica overflow.
 *
 * Essa função é útil quando o PageLayoutEngine já criou um contentEl limpo,
 * sem régua, sem sombra externa e sem overlays.
 */
export function updateHorizontalOverflowFromElements(input: {
  viewportEl: HTMLElement;
  contentEl: HTMLElement;
  activeContentCenterX: number;
  tolerance?: number;
  reason?: HorizontalOverflowReason;
  hooks?: HorizontalOverflowHooks;
  preserveCurrentScrollWhenPossible?: boolean;
  scrollWritePolicy?: HorizontalScrollWritePolicy;
  resetScrollWhenNoOverflow?: boolean;
  layoutVersion?: number;
  currentLayoutVersion?: number;
}): HorizontalOverflowApplyResult {
  const viewportWidth = Math.max(1, input.viewportEl.clientWidth);
  const realContentWidth = measureRealContentWidth(input.contentEl);
  const maxScrollLeft = computeMaxScrollLeftFromViewport(input.viewportEl);

  return applyHorizontalOverflowToViewport({
    viewportEl: input.viewportEl,
    viewportWidth,
    realContentWidth,
    activeContentCenterX: input.activeContentCenterX,
    maxScrollLeft,
    currentScrollLeft: input.viewportEl.scrollLeft,
    tolerance: input.tolerance,
    reason: input.reason,
    hooks: input.hooks,
    preserveCurrentScrollWhenPossible: input.preserveCurrentScrollWhenPossible,
    scrollWritePolicy: input.scrollWritePolicy,
    resetScrollWhenNoOverflow: input.resetScrollWhenNoOverflow,
    layoutVersion: input.layoutVersion,
    currentLayoutVersion: input.currentLayoutVersion,
  });
}

export class HorizontalOverflowController {
  private viewportEl: HTMLElement;
  private hooks: HorizontalOverflowHooks;

  constructor(input: {
    viewportEl: HTMLElement;
    hooks?: HorizontalOverflowHooks;
  }) {
    this.viewportEl = input.viewportEl;
    this.hooks = input.hooks ?? {};
  }

  compute(input: ComputeHorizontalOverflowInput): HorizontalOverflowDecision {
    return computeHorizontalOverflowDecision(input);
  }

  apply(
    input: Omit<ApplyHorizontalOverflowInput, "viewportEl" | "hooks">,
  ): HorizontalOverflowApplyResult {
    return applyHorizontalOverflowToViewport({
      ...input,
      viewportEl: this.viewportEl,
      hooks: this.hooks,
    });
  }

  updateFromContentElement(input: {
    contentEl: HTMLElement;
    activeContentCenterX: number;
    tolerance?: number;
    reason?: HorizontalOverflowReason;
    preserveCurrentScrollWhenPossible?: boolean;
    scrollWritePolicy?: HorizontalScrollWritePolicy;
    resetScrollWhenNoOverflow?: boolean;
    layoutVersion?: number;
    currentLayoutVersion?: number;
  }): HorizontalOverflowApplyResult {
    return updateHorizontalOverflowFromElements({
      viewportEl: this.viewportEl,
      contentEl: input.contentEl,
      activeContentCenterX: input.activeContentCenterX,
      tolerance: input.tolerance,
      reason: input.reason,
      hooks: this.hooks,
      preserveCurrentScrollWhenPossible: input.preserveCurrentScrollWhenPossible,
      scrollWritePolicy: input.scrollWritePolicy,
      resetScrollWhenNoOverflow: input.resetScrollWhenNoOverflow,
      layoutVersion: input.layoutVersion,
      currentLayoutVersion: input.currentLayoutVersion,
    });
  }
}

/**
 * Fluxo ideal durante wheel-zoom:
 *
 * 1. ScrollCoordinator captura âncora antes do zoom.
 * 2. ZoomController calcula nextZoom.
 * 3. Layout recalcula páginas.
 * 4. ScrollCoordinator restaura scrollLeft/scrollTop.
 * 5. HorizontalOverflowController roda com:
 *
 * horizontalOverflowController.updateFromContentElement({
 *   contentEl: pageFlowEl,
 *   activeContentCenterX: anchor.contentCenterX,
 *   reason: "wheel-zoom",
 *   scrollWritePolicy: "none",
 *   resetScrollWhenNoOverflow: false,
 * });
 *
 * 6. RulerScrollSyncController sincroniza a régua no onAfterScroll.
 *
 * Isso impede o HorizontalOverflowController de sobrescrever o scrollLeft
 * restaurado pelo ScrollCoordinator e elimina salto lateral.
 */
