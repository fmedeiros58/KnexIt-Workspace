export type PdfWheelDeltaMode = 0 | 1 | 2 | number;

export type PdfWheelLikeEvent = {
  deltaY: number;
  deltaMode?: PdfWheelDeltaMode;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
};

export type PdfWheelZoomModifierMode = "ctrl" | "ctrl-or-meta" | "meta" | "always";

export type PdfWheelInteractionPolicyInput = {
  /**
   * Multiplicador da rolagem comum da bolinha.
   *
   * Padrão: 3x.
   */
  wheelScrollMultiplier?: number;

  /**
   * Multiplicador do zoom via Ctrl/Meta + bolinha.
   *
   * Padrão: 3x.
   *
   * Observação:
   * este multiplicador não pode ser confundido com ausência de limite. O delta
   * acelerado ainda passa por travas antes de chegar ao ZoomController.
   */
  wheelZoomMultiplier?: number;

  /**
   * Limite máximo de deslocamento por evento wheel.
   * Evita salto exagerado em mouse/touchpad de alta resolução.
   */
  maxWheelScrollStepPx?: number;

  /**
   * Limite máximo de variação percentual de zoom por evento quando o próprio
   * policy calcula o alvo diretamente.
   */
  maxWheelZoomStepPercent?: number;

  /**
   * Limite físico do delta entregue ao ZoomController.
   *
   * O ZoomController já possui curva exponencial, clamp global e perfil
   * adaptativo por faixa de zoom. Por isso, o wheel policy deve entregar um
   * delta acelerado, mas não gigantesco.
   */
  maxWheelZoomControllerDeltaPx?: number;

  /**
   * Passo base de zoom, em pontos percentuais, antes do multiplicador.
   */
  baseWheelZoomStepPercent?: number;

  /**
   * Conversão para eventos cujo deltaMode é "linha".
   */
  wheelLineHeightPx?: number;

  /**
   * Conversão para eventos cujo deltaMode é "página".
   */
  wheelPageHeightPx?: number;

  /**
   * Define qual modificador ativa zoom por wheel.
   *
   * Padrão: ctrl-or-meta.
   */
  zoomModifierMode?: PdfWheelZoomModifierMode;

  /**
   * Limites percentuais do leitor.
   *
   * Devem acompanhar o ZoomController.
   * Padrão: 10% a 2000%.
   */
  minZoomPercent?: number;
  maxZoomPercent?: number;
};

export type PdfWheelInteractionPolicy = {
  wheelScrollMultiplier: number;
  wheelZoomMultiplier: number;
  maxWheelScrollStepPx: number;
  maxWheelZoomStepPercent: number;
  maxWheelZoomControllerDeltaPx: number;
  baseWheelZoomStepPercent: number;
  wheelLineHeightPx: number;
  wheelPageHeightPx: number;
  zoomModifierMode: PdfWheelZoomModifierMode;
  minZoomPercent: number;
  maxZoomPercent: number;
};

export type PdfAcceleratedWheelScrollInput = {
  deltaY: number;
  deltaMode?: PdfWheelDeltaMode;

  /**
   * Zoom atual em percentual.
   *
   * Em zoom alto, a página fica fisicamente muito maior. Se a rolagem continuar
   * limitada ao mesmo delta de 100%/200%, a sensação é de travamento.
   */
  currentZoomPercent?: number;

  policy?: Partial<PdfWheelInteractionPolicy>;
};

export type PdfAcceleratedWheelZoomInput = {
  deltaY: number;
  deltaMode?: PdfWheelDeltaMode;

  /**
   * Zoom atual em percentual.
   *
   * Opcional para manter compatibilidade com chamadas antigas.
   * Quando informado, permite reduzir agressividade perto do teto de zoom.
   */
  currentZoomPercent?: number;

  policy?: Partial<PdfWheelInteractionPolicy>;
};

export type PdfWheelZoomTargetInput = {
  currentZoomPercent: number;
  deltaY: number;
  deltaMode?: PdfWheelDeltaMode;
  minZoomPercent?: number;
  maxZoomPercent?: number;
  policy?: Partial<PdfWheelInteractionPolicy>;
};

const DEFAULT_WHEEL_SCROLL_MULTIPLIER = 4;
const DEFAULT_WHEEL_ZOOM_MULTIPLIER = 4;

const DEFAULT_MAX_WHEEL_SCROLL_STEP_PX = 240;

/**
 * Como o ZoomController agora permite 2000%, o wheel precisa ser rápido, mas
 * progressivo. Passos percentuais diretos acima disso ficam bruscos demais.
 */
const DEFAULT_MAX_WHEEL_ZOOM_STEP_PERCENT = 18;
const DEFAULT_MAX_WHEEL_ZOOM_CONTROLLER_DELTA_PX = 150;
const DEFAULT_BASE_WHEEL_ZOOM_STEP_PERCENT = 4;

const DEFAULT_WHEEL_LINE_HEIGHT_PX = 16;
const DEFAULT_WHEEL_PAGE_HEIGHT_PX = 800;
const DEFAULT_ZOOM_MODIFIER_MODE: PdfWheelZoomModifierMode = "ctrl-or-meta";

const MIN_WHEEL_MULTIPLIER = 0.25;
const MAX_WHEEL_MULTIPLIER = 4;

const DEFAULT_MIN_ZOOM_PERCENT = 10;
const DEFAULT_MAX_ZOOM_PERCENT = 2000;

function safeNumber(
  value: number | null | undefined,
  fallback = 0,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function clamp(value: number, min: number, max: number): number {
  const safeMin = safeNumber(min, 0);
  const safeMax = Math.max(safeMin, safeNumber(max, safeMin));
  const safeValue = safeNumber(value, safeMin);

  return Math.max(safeMin, Math.min(safeMax, safeValue));
}

function clampAbs(value: number, maxAbs: number): number {
  const safeMaxAbs = Math.max(0, safeNumber(maxAbs, 0));

  if (safeMaxAbs <= 0) return 0;

  return clamp(value, -safeMaxAbs, safeMaxAbs);
}

function resolvePositiveNumber(
  value: number | null | undefined,
  fallback: number,
  min = 1,
): number {
  return Math.max(min, safeNumber(value, fallback));
}

function resolveWheelMultiplier(
  value: number | null | undefined,
  fallback: number,
): number {
  return clamp(
    safeNumber(value, fallback),
    MIN_WHEEL_MULTIPLIER,
    MAX_WHEEL_MULTIPLIER,
  );
}

function resolveZoomPercentLimits(input: {
  minZoomPercent?: number | null;
  maxZoomPercent?: number | null;
}): { minZoomPercent: number; maxZoomPercent: number } {
  const minZoomPercent = resolvePositiveNumber(
    input.minZoomPercent,
    DEFAULT_MIN_ZOOM_PERCENT,
  );
  const maxZoomPercent = Math.max(
    minZoomPercent,
    resolvePositiveNumber(input.maxZoomPercent, DEFAULT_MAX_ZOOM_PERCENT),
  );

  return { minZoomPercent, maxZoomPercent };
}

function getZoomInPressure(input: {
  currentZoomPercent: number;
  maxZoomPercent: number;
}): number {
  const currentZoomPercent = Math.max(1, safeNumber(input.currentZoomPercent, 100));
  const maxZoomPercent = Math.max(currentZoomPercent, safeNumber(input.maxZoomPercent, DEFAULT_MAX_ZOOM_PERCENT));

  return clamp(currentZoomPercent / Math.max(1, maxZoomPercent), 0, 1);
}

function resolveZoomAwareScrollFactor(input: {
  currentZoomPercent?: number;
}): number {
  const currentZoomPercent = safeNumber(input.currentZoomPercent, 100);

  /*
   * A rolagem precisa crescer com o zoom visual.
   *
   * Em 1200%/2000%, o documento ocupa muitas vezes mais altura/largura. Um
   * limite fixo de 240px faz a roda parecer lenta. Usamos degraus controlados,
   * não uma multiplicação linear, para manter fluidez sem saltos absurdos.
   */
  if (currentZoomPercent >= 1800) return 6.5;
  if (currentZoomPercent >= 1600) return 6;
  if (currentZoomPercent >= 1200) return 5.25;
  if (currentZoomPercent >= 800) return 4.25;
  if (currentZoomPercent >= 400) return 3;
  if (currentZoomPercent >= 200) return 1.75;

  return 1;
}

function resolveZoomAwareScrollStepLimit(input: {
  currentZoomPercent?: number;
  policy: PdfWheelInteractionPolicy;
}): number {
  const currentZoomPercent = safeNumber(input.currentZoomPercent, 100);
  const baseLimit = Math.max(1, input.policy.maxWheelScrollStepPx);

  if (currentZoomPercent >= 1800) return Math.max(baseLimit, 3_000);
  if (currentZoomPercent >= 1600) return Math.max(baseLimit, 2_700);
  if (currentZoomPercent >= 1200) return Math.max(baseLimit, 2_300);
  if (currentZoomPercent >= 800) return Math.max(baseLimit, 1_700);
  if (currentZoomPercent >= 400) return Math.max(baseLimit, 1_100);
  if (currentZoomPercent >= 200) return Math.max(baseLimit, 620);

  return baseLimit;
}

/**
 * Reduz a agressividade do wheel quando o zoom-in já está perto do teto.
 *
 * Isso evita que o usuário continue gerando vários deltas grandes tentando
 * ultrapassar 2000%, o que pode disparar renderizações pesadas e tela preta.
 */
function resolveZoomControllerDeltaLimit(input: {
  normalizedDelta: number;
  currentZoomPercent?: number;
  policy: PdfWheelInteractionPolicy;
}): number {
  const baseLimit = Math.max(1, input.policy.maxWheelZoomControllerDeltaPx);
  const currentZoomPercent = safeNumber(input.currentZoomPercent, 100);
  const isZoomingIn = input.normalizedDelta < 0;

  if (!isZoomingIn) {
    /*
     * Zoom-out em escala alta precisa ser mais forte.
     * Caso contrário, o usuário fica "preso" em 1200%/2000% e a redução parece
     * pesada. Aqui ampliamos apenas a trava física do delta; o ZoomController
     * ainda faz a curva e o clamp final.
     */
    if (currentZoomPercent >= 1600) return Math.max(320, baseLimit * 2.8);
    if (currentZoomPercent >= 1200) return Math.max(290, baseLimit * 2.45);
    if (currentZoomPercent >= 800) return Math.max(250, baseLimit * 2.15);
    if (currentZoomPercent >= 400) return Math.max(220, baseLimit * 1.75);

    return Math.max(baseLimit, baseLimit * 1.35);
  }

  const pressure = getZoomInPressure({
    currentZoomPercent,
    maxZoomPercent: input.policy.maxZoomPercent,
  });

  /*
   * Antes o zoom-in ficava muito contido perto do teto, causando sensação de
   * letargia. Mantemos proteção contra estouro, mas sem reduzir o delta a ponto
   * de o gesto parecer travado.
   */
  if (pressure >= 0.96) return Math.max(76, baseLimit * 0.55);
  if (pressure >= 0.9) return Math.max(90, baseLimit * 0.65);
  if (pressure >= 0.8) return Math.max(105, baseLimit * 0.75);
  if (pressure >= 0.6) return Math.max(120, baseLimit * 0.9);

  return baseLimit;
}

export function resolvePdfWheelInteractionPolicy(
  input: PdfWheelInteractionPolicyInput = {},
): PdfWheelInteractionPolicy {
  const { minZoomPercent, maxZoomPercent } = resolveZoomPercentLimits({
    minZoomPercent: input.minZoomPercent,
    maxZoomPercent: input.maxZoomPercent,
  });

  return {
    wheelScrollMultiplier: resolveWheelMultiplier(
      input.wheelScrollMultiplier,
      DEFAULT_WHEEL_SCROLL_MULTIPLIER,
    ),
    wheelZoomMultiplier: resolveWheelMultiplier(
      input.wheelZoomMultiplier,
      DEFAULT_WHEEL_ZOOM_MULTIPLIER,
    ),
    maxWheelScrollStepPx: resolvePositiveNumber(
      input.maxWheelScrollStepPx,
      DEFAULT_MAX_WHEEL_SCROLL_STEP_PX,
    ),
    maxWheelZoomStepPercent: resolvePositiveNumber(
      input.maxWheelZoomStepPercent,
      DEFAULT_MAX_WHEEL_ZOOM_STEP_PERCENT,
    ),
    maxWheelZoomControllerDeltaPx: resolvePositiveNumber(
      input.maxWheelZoomControllerDeltaPx,
      DEFAULT_MAX_WHEEL_ZOOM_CONTROLLER_DELTA_PX,
    ),
    baseWheelZoomStepPercent: resolvePositiveNumber(
      input.baseWheelZoomStepPercent,
      DEFAULT_BASE_WHEEL_ZOOM_STEP_PERCENT,
    ),
    wheelLineHeightPx: resolvePositiveNumber(
      input.wheelLineHeightPx,
      DEFAULT_WHEEL_LINE_HEIGHT_PX,
    ),
    wheelPageHeightPx: resolvePositiveNumber(
      input.wheelPageHeightPx,
      DEFAULT_WHEEL_PAGE_HEIGHT_PX,
    ),
    zoomModifierMode: input.zoomModifierMode ?? DEFAULT_ZOOM_MODIFIER_MODE,
    minZoomPercent,
    maxZoomPercent,
  };
}

export const DEFAULT_PDF_WHEEL_INTERACTION_POLICY =
  resolvePdfWheelInteractionPolicy();

/**
 * Normaliza deltaY da roda do mouse para pixels.
 *
 * deltaMode:
 * - 0: pixels
 * - 1: linhas
 * - 2: páginas
 */
export function normalizePdfWheelDeltaToPixels(input: {
  deltaY: number;
  deltaMode?: PdfWheelDeltaMode;
  lineHeightPx?: number;
  pageHeightPx?: number;
}): number {
  const deltaY = safeNumber(input.deltaY, 0);
  const deltaMode = safeNumber(input.deltaMode, 0);
  const lineHeightPx = resolvePositiveNumber(
    input.lineHeightPx,
    DEFAULT_WHEEL_LINE_HEIGHT_PX,
  );
  const pageHeightPx = resolvePositiveNumber(
    input.pageHeightPx,
    DEFAULT_WHEEL_PAGE_HEIGHT_PX,
  );

  if (deltaMode === 1) {
    return deltaY * lineHeightPx;
  }

  if (deltaMode === 2) {
    return deltaY * pageHeightPx;
  }

  return deltaY;
}

export function shouldHandlePdfWheelZoom(
  event: PdfWheelLikeEvent,
  policy: Partial<PdfWheelInteractionPolicy> = {},
): boolean {
  const resolvedPolicy = {
    ...DEFAULT_PDF_WHEEL_INTERACTION_POLICY,
    ...policy,
  };

  if (resolvedPolicy.zoomModifierMode === "always") {
    return true;
  }

  if (resolvedPolicy.zoomModifierMode === "ctrl") {
    return event.ctrlKey === true;
  }

  if (resolvedPolicy.zoomModifierMode === "meta") {
    return event.metaKey === true;
  }

  return event.ctrlKey === true || event.metaKey === true;
}

/**
 * Retorna o delta de rolagem acelerado em pixels.
 *
 * O sinal é preservado:
 * - delta positivo rola para baixo;
 * - delta negativo rola para cima.
 */
export function getAcceleratedPdfWheelScrollDelta(
  input: PdfAcceleratedWheelScrollInput,
): number {
  const policy = {
    ...DEFAULT_PDF_WHEEL_INTERACTION_POLICY,
    ...input.policy,
  };

  const normalizedDelta = normalizePdfWheelDeltaToPixels({
    deltaY: input.deltaY,
    deltaMode: input.deltaMode,
    lineHeightPx: policy.wheelLineHeightPx,
    pageHeightPx: policy.wheelPageHeightPx,
  });

  const zoomScrollFactor = resolveZoomAwareScrollFactor({
    currentZoomPercent: input.currentZoomPercent,
  });
  const maxScrollStep = resolveZoomAwareScrollStepLimit({
    currentZoomPercent: input.currentZoomPercent,
    policy,
  });

  const acceleratedDelta =
    normalizedDelta * policy.wheelScrollMultiplier * zoomScrollFactor;

  return clampAbs(acceleratedDelta, maxScrollStep);
}

/**
 * Retorna o passo de zoom em pontos percentuais.
 *
 * O sinal é invertido em relação ao deltaY:
 * - wheel para cima aproxima;
 * - wheel para baixo afasta.
 */
export function getAcceleratedPdfWheelZoomStep(
  input: PdfAcceleratedWheelZoomInput,
): number {
  const policy = {
    ...DEFAULT_PDF_WHEEL_INTERACTION_POLICY,
    ...input.policy,
  };

  const normalizedDelta = normalizePdfWheelDeltaToPixels({
    deltaY: input.deltaY,
    deltaMode: input.deltaMode,
    lineHeightPx: policy.wheelLineHeightPx,
    pageHeightPx: policy.wheelPageHeightPx,
  });

  if (normalizedDelta === 0) return 0;

  const direction = normalizedDelta > 0 ? -1 : 1;
  const currentZoomPercent = safeNumber(input.currentZoomPercent, 100);

  if (
    direction > 0 &&
    currentZoomPercent >= policy.maxZoomPercent
  ) {
    return 0;
  }

  if (
    direction < 0 &&
    currentZoomPercent <= policy.minZoomPercent
  ) {
    return 0;
  }

  /*
   * A intensidade aumenta levemente em eventos maiores, mas é limitada.
   * Isso preserva velocidade sem deixar o zoom saltar de modo brusco.
   */
  const intensity = clamp(Math.abs(normalizedDelta) / 100, 1, 2.35);

  let maxStep = policy.maxWheelZoomStepPercent;

  if (direction > 0) {
    const pressure = getZoomInPressure({
      currentZoomPercent,
      maxZoomPercent: policy.maxZoomPercent,
    });

    if (pressure >= 0.96) maxStep = Math.min(maxStep, 8);
    else if (pressure >= 0.9) maxStep = Math.min(maxStep, 10);
    else if (pressure >= 0.8) maxStep = Math.min(maxStep, 12);
    else if (pressure >= 0.6) maxStep = Math.min(maxStep, 15);
  }

  const rawStep =
    direction *
    policy.baseWheelZoomStepPercent *
    policy.wheelZoomMultiplier *
    intensity;

  return clampAbs(rawStep, maxStep);
}

/**
 * Calcula diretamente o novo zoom percentual.
 *
 * Útil quando o handler não quiser chamar o ZoomController.
 * Se o PdfReaderShell já usa computeWheelZoom, prefira passar o delta acelerado
 * para o controlador por getAcceleratedPdfWheelDeltaForController.
 */
export function getPdfWheelZoomTarget(
  input: PdfWheelZoomTargetInput,
): number {
  const policy = {
    ...DEFAULT_PDF_WHEEL_INTERACTION_POLICY,
    ...input.policy,
  };

  const minZoomPercent = resolvePositiveNumber(
    input.minZoomPercent ?? policy.minZoomPercent,
    DEFAULT_MIN_ZOOM_PERCENT,
  );
  const maxZoomPercent = Math.max(
    minZoomPercent,
    resolvePositiveNumber(
      input.maxZoomPercent ?? policy.maxZoomPercent,
      DEFAULT_MAX_ZOOM_PERCENT,
    ),
  );

  const currentZoomPercent = clamp(
    safeNumber(input.currentZoomPercent, 100),
    minZoomPercent,
    maxZoomPercent,
  );

  const zoomStep = getAcceleratedPdfWheelZoomStep({
    deltaY: input.deltaY,
    deltaMode: input.deltaMode,
    currentZoomPercent,
    policy: {
      ...policy,
      minZoomPercent,
      maxZoomPercent,
    },
  });

  return clamp(
    currentZoomPercent + zoomStep,
    minZoomPercent,
    maxZoomPercent,
  );
}

/**
 * Retorna um deltaY já acelerado para ser consumido por controladores legados.
 *
 * Mantém o sinal original do wheel. Esse helper é útil para integrar com
 * funções já existentes, como computeWheelZoom, sem refatorar tudo de uma vez.
 *
 * Importante:
 * o ZoomController já calcula curva exponencial e clamp final. Aqui apenas
 * entregamos um delta acelerado, mas com limite físico compatível com o teto
 * de 2000%.
 */
export function getAcceleratedPdfWheelDeltaForController(
  input: PdfAcceleratedWheelZoomInput,
): number {
  const policy = {
    ...DEFAULT_PDF_WHEEL_INTERACTION_POLICY,
    ...input.policy,
  };

  const normalizedDelta = normalizePdfWheelDeltaToPixels({
    deltaY: input.deltaY,
    deltaMode: input.deltaMode,
    lineHeightPx: policy.wheelLineHeightPx,
    pageHeightPx: policy.wheelPageHeightPx,
  });

  if (normalizedDelta === 0) return 0;

  const currentZoomPercent = safeNumber(input.currentZoomPercent, 100);

  /*
   * deltaY < 0 = zoom-in.
   * deltaY > 0 = zoom-out.
   */
  if (normalizedDelta < 0 && currentZoomPercent >= policy.maxZoomPercent) {
    return 0;
  }

  if (normalizedDelta > 0 && currentZoomPercent <= policy.minZoomPercent) {
    return 0;
  }

  const acceleratedDelta = normalizedDelta * policy.wheelZoomMultiplier;
  const maxControllerDelta = resolveZoomControllerDeltaLimit({
    normalizedDelta,
    currentZoomPercent,
    policy,
  });

  return clampAbs(acceleratedDelta, maxControllerDelta);
}
