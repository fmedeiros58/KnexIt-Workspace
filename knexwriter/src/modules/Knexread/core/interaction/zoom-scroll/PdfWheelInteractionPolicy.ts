import {
  ZOOM_SCROLL_LINE_DELTA_PX,
  ZOOM_SCROLL_MAX_ZOOM_PERCENT,
  ZOOM_SCROLL_MIN_ZOOM_PERCENT,
  ZOOM_SCROLL_PAGE_DELTA_PX,
} from "./ZoomScrollConstants";
import { computeWheelZoomVelocity } from "./ZoomVelocityController";

export type PdfWheelDeltaMode = 0 | 1 | 2 | number;

export type PdfWheelLikeEvent = {
  deltaY: number;
  deltaMode?: PdfWheelDeltaMode;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
};

export type PdfWheelZoomModifierMode =
  | "ctrl"
  | "ctrl-or-meta"
  | "meta"
  | "always";

export type PdfWheelInteractionPolicyInput = {
  /**
   * Multiplicador da rolagem comum da bolinha.
   *
   * Este campo continua ativo, porque este arquivo ainda é responsável pelo
   * scroll comum enquanto a migração para ScrollMotionController não estiver
   * completa em todos os pontos.
   */
  wheelScrollMultiplier?: number;

  /**
   * Campo legado.
   *
   * ATENÇÃO:
   * este valor não controla mais a velocidade final do zoom por wheel.
   * A velocidade real agora pertence ao ZoomVelocityController.
   *
   * O campo permanece no contrato para não quebrar chamadas antigas.
   */
  wheelZoomMultiplier?: number;

  /**
   * Limite máximo de deslocamento por evento wheel para scroll comum.
   */
  maxWheelScrollStepPx?: number;

  /**
   * Campo legado.
   *
   * Mantido para compatibilidade, mas neutralizado na política resolvida.
   */
  maxWheelZoomStepPercent?: number;

  /**
   * Campo legado.
   *
   * Mantido para compatibilidade, mas neutralizado na política resolvida.
   */
  maxWheelZoomControllerDeltaPx?: number;

  /**
   * Campo legado.
   *
   * Mantido para compatibilidade, mas neutralizado na política resolvida.
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
   * Devem acompanhar ZoomScrollConstants/ZoomVelocityController.
   */
  minZoomPercent?: number;
  maxZoomPercent?: number;
};

export type PdfWheelInteractionPolicy = {
  wheelScrollMultiplier: number;

  /**
   * Campo legado preservado no tipo.
   *
   * No fluxo novo, deve permanecer neutro em 1.
   */
  wheelZoomMultiplier: number;

  maxWheelScrollStepPx: number;

  /**
   * Campos legados preservados no tipo.
   *
   * No fluxo novo, ficam neutros e não devem ser usados para calibrar a
   * velocidade do zoom.
   */
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
   * Em zoom alto, a página fica fisicamente maior. O scroll comum pode usar
   * esse valor para não parecer travado.
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

/**
 * PdfWheelInteractionPolicy.ts
 * -----------------------------------------------------------------------------
 * Papel deste arquivo na arquitetura modular:
 *
 * ESTE ARQUIVO NÃO É MAIS O DONO DA VELOCIDADE FINAL DO ZOOM.
 *
 * Responsabilidades preservadas:
 * - normalizar deltaMode para pixels;
 * - detectar Ctrl/Meta + wheel em fluxos legados;
 * - acelerar scroll comum;
 * - manter compatibilidade com imports antigos.
 *
 * Responsabilidades retiradas:
 * - curva própria de zoom-in;
 * - curva própria de zoom-out;
 * - multiplicador agressivo de zoom;
 * - compressão própria de delta para ZoomController.
 *
 * A velocidade auditável do zoom agora deve ser ajustada em:
 * - ZoomScrollConstants.ts;
 * - ZoomVelocityController.ts.
 */
const DEFAULT_WHEEL_SCROLL_MULTIPLIER = 4;

/**
 * Neutro por design.
 *
 * Mesmo que algum ponto antigo passe wheelZoomMultiplier: 4.15, a política
 * resolvida força o valor para 1. Isso impede competição com
 * ZoomVelocityController.
 */
const DEFAULT_WHEEL_ZOOM_MULTIPLIER = 1;

const DEFAULT_MAX_WHEEL_SCROLL_STEP_PX = 720;

/**
 * Campos legados neutralizados.
 */
const DEFAULT_MAX_WHEEL_ZOOM_STEP_PERCENT = 9999;
const DEFAULT_MAX_WHEEL_ZOOM_CONTROLLER_DELTA_PX = 9999;
const DEFAULT_BASE_WHEEL_ZOOM_STEP_PERCENT = 1;

const DEFAULT_WHEEL_LINE_HEIGHT_PX = ZOOM_SCROLL_LINE_DELTA_PX;
const DEFAULT_WHEEL_PAGE_HEIGHT_PX = ZOOM_SCROLL_PAGE_DELTA_PX;
const DEFAULT_ZOOM_MODIFIER_MODE: PdfWheelZoomModifierMode = "ctrl-or-meta";

const MIN_WHEEL_SCROLL_MULTIPLIER = 0.25;
const MAX_WHEEL_SCROLL_MULTIPLIER = 8;

const DEFAULT_MIN_ZOOM_PERCENT = ZOOM_SCROLL_MIN_ZOOM_PERCENT;
const DEFAULT_MAX_ZOOM_PERCENT = ZOOM_SCROLL_MAX_ZOOM_PERCENT;

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

function resolvePositiveNumber(
  value: number | null | undefined,
  fallback: number,
  min = 1,
): number {
  return Math.max(min, safeNumber(value, fallback));
}

function resolveWheelScrollMultiplier(
  value: number | null | undefined,
  fallback: number,
): number {
  return clamp(
    safeNumber(value, fallback),
    MIN_WHEEL_SCROLL_MULTIPLIER,
    MAX_WHEEL_SCROLL_MULTIPLIER,
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

function resolveZoomAwareScrollFactor(input: {
  currentZoomPercent?: number;
}): number {
  const currentZoomPercent = clamp(
    safeNumber(input.currentZoomPercent, 100),
    DEFAULT_MIN_ZOOM_PERCENT,
    DEFAULT_MAX_ZOOM_PERCENT,
  );

  if (currentZoomPercent <= 100) return 1;

  const minZoom = 100;
  const maxZoom = DEFAULT_MAX_ZOOM_PERCENT;

  const normalized =
    (Math.sqrt(currentZoomPercent / minZoom) - 1) /
    Math.max(0.000001, Math.sqrt(maxZoom / minZoom) - 1);

  const t = clamp(normalized, 0, 1);

  /*
   * Curva contínua de scroll comum:
   *
   * 100%  -> 1.00
   * 200%  -> ~1.62
   * 400%  -> ~2.50
   * 800%  -> ~3.74
   * 1200% -> ~4.68
   * 1600% -> ~5.48
   * 2000% -> ~6.20
   */
  return 1 + 5.2 * t;
}

function resolveZoomAwareScrollStepLimit(input: {
  currentZoomPercent?: number;
  policy: PdfWheelInteractionPolicy;
}): number {
  const baseLimit = Math.max(1, input.policy.maxWheelScrollStepPx);
  const scrollFactor = resolveZoomAwareScrollFactor({
    currentZoomPercent: input.currentZoomPercent,
  });

  /*
   * Piso operacional:
   * evita que configurações antigas, como maxWheelScrollStepPx = 300, cortem
   * o delta comum da roda e gerem sensação de scroll pesado.
   */
  const operationalBaseLimit = Math.max(baseLimit, 560);

  return operationalBaseLimit * (0.9 + scrollFactor * 0.85);
}

function limitScrollDeltaForProgressiveScroll(input: {
  deltaPixels: number;
  maxDeltaPixels: number;
}): number {
  const maxDelta = Math.max(1, safeNumber(input.maxDeltaPixels, 1));
  const delta = safeNumber(input.deltaPixels, 0);

  if (delta === 0) return 0;

  const sign = delta < 0 ? -1 : 1;
  const magnitude = Math.abs(delta);

  /*
   * Deltas normais passam intactos.
   * Deltas acima do orçamento são comprimidos de forma macia.
   */
  if (magnitude <= maxDelta) {
    return delta;
  }

  const overflow = magnitude - maxDelta;
  const softExtra = maxDelta * 0.16 * (1 - Math.exp(-overflow / maxDelta));

  return sign * (maxDelta + softExtra);
}

export function resolvePdfWheelInteractionPolicy(
  input: PdfWheelInteractionPolicyInput = {},
): PdfWheelInteractionPolicy {
  const { minZoomPercent, maxZoomPercent } = resolveZoomPercentLimits({
    minZoomPercent: input.minZoomPercent,
    maxZoomPercent: input.maxZoomPercent,
  });

  return {
    wheelScrollMultiplier: resolveWheelScrollMultiplier(
      input.wheelScrollMultiplier,
      DEFAULT_WHEEL_SCROLL_MULTIPLIER,
    ),

    /*
     * Neutralização intencional:
     * não aceitar multiplicador de zoom legado vindo de fora.
     */
    wheelZoomMultiplier: DEFAULT_WHEEL_ZOOM_MULTIPLIER,

    maxWheelScrollStepPx: resolvePositiveNumber(
      input.maxWheelScrollStepPx,
      DEFAULT_MAX_WHEEL_SCROLL_STEP_PX,
    ),

    /*
     * Campos legados ficam neutros.
     */
    maxWheelZoomStepPercent: DEFAULT_MAX_WHEEL_ZOOM_STEP_PERCENT,
    maxWheelZoomControllerDeltaPx: DEFAULT_MAX_WHEEL_ZOOM_CONTROLLER_DELTA_PX,
    baseWheelZoomStepPercent: DEFAULT_BASE_WHEEL_ZOOM_STEP_PERCENT,

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
 * - 0: pixels;
 * - 1: linhas;
 * - 2: páginas.
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
 * Retorna o delta de rolagem comum acelerado em pixels.
 *
 * Este continua sendo o papel ativo deste arquivo.
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

  return limitScrollDeltaForProgressiveScroll({
    deltaPixels: acceleratedDelta,
    maxDeltaPixels: maxScrollStep,
  });
}

/**
 * Retorna o passo de zoom em pontos percentuais.
 *
 * Compatibilidade legada:
 * esta função não calcula mais curva própria. Ela delega para
 * ZoomVelocityController e retorna apenas a diferença percentual.
 */
export function getAcceleratedPdfWheelZoomStep(
  input: PdfAcceleratedWheelZoomInput,
): number {
  const policy = {
    ...DEFAULT_PDF_WHEEL_INTERACTION_POLICY,
    ...input.policy,
  };

  const currentZoomPercent = safeNumber(input.currentZoomPercent, 100);

  const deltaY = normalizePdfWheelDeltaToPixels({
    deltaY: input.deltaY,
    deltaMode: input.deltaMode,
    lineHeightPx: policy.wheelLineHeightPx,
    pageHeightPx: policy.wheelPageHeightPx,
  });

  const result = computeWheelZoomVelocity({
    currentZoomPercent,
    deltaY,
    minZoomPercent: policy.minZoomPercent,
    maxZoomPercent: policy.maxZoomPercent,
  });

  return result.deltaZoomPercent;
}

/**
 * Calcula diretamente o novo zoom percentual.
 *
 * Compatibilidade legada:
 * o cálculo é delegado indiretamente para ZoomVelocityController.
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
 * Retorna um deltaY normalizado para controladores legados.
 *
 * Compatibilidade legada, sem aceleração própria:
 * - não usa wheelZoomMultiplier;
 * - não usa curva zoom-in/out;
 * - não usa compressão própria;
 * - apenas respeita limites globais e devolve o delta normalizado.
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

  return normalizedDelta;
}
