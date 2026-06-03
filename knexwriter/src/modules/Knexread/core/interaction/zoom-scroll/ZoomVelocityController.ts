import type { ZoomDirection, ZoomVelocityInput, ZoomVelocityResult } from "./ZoomScrollTypes";
import {
  ZOOM_SCROLL_EPSILON,
  ZOOM_SCROLL_HIGH_ZOOM_OUT_RETURN_BOOST,
  ZOOM_SCROLL_MAX_ZOOM_IN_FACTOR_PER_INPUT,
  ZOOM_SCROLL_MAX_ZOOM_PERCENT,
  ZOOM_SCROLL_MIN_ZOOM_OUT_FACTOR_PER_INPUT,
  ZOOM_SCROLL_MIN_ZOOM_PERCENT,
  ZOOM_SCROLL_NEAR_MAX_ZOOM_BRAKE,
  ZOOM_SCROLL_WHEEL_NOTCH_PIXELS,
  ZOOM_SCROLL_WHEEL_ZOOM_SPEED_MULTIPLIER,
} from "./ZoomScrollConstants";

/**
 * ZoomVelocityController.ts
 * -----------------------------------------------------------------------------
 * Este é o módulo proprietário da velocidade do zoom.
 *
 * A velocidade de zoom-in e zoom-out deve ser alterada aqui.
 * Não no Shell.
 * Não no PdfZoomFramePolicy.
 * Não no PdfWheelInteractionPolicy.
 * Não no ZoomCenterAnchorController.
 *
 * Modelo adotado:
 * - entrada: deltaY normalizado em pixels;
 * - saída: próximo zoom percentual;
 * - visualZoom deve aplicar a saída imediatamente;
 * - renderZoom só confirma depois no RenderZoomCommitController.
 *
 * Sensação desejada:
 * - zoom-in veloz;
 * - zoom-out com retorno em mola;
 * - sem curva lenta de reentrada;
 * - sem múltiplos módulos competindo.
 */

function safeNumber(value: number | null | undefined, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, safeNumber(value, min)));
}

function roundZoomPercent(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Pequena função de transição usada apenas para freio perto do teto.
 * Ela não cria animação. É só cálculo instantâneo.
 */
function smoothStep(edge0: number, edge1: number, value: number): number {
  if (edge0 === edge1) return value >= edge1 ? 1 : 0;

  const t = clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function getDirectionFromDelta(input: {
  deltaY: number;
  invertDirection?: boolean;
}): ZoomDirection {
  const signed = input.invertDirection ? -input.deltaY : input.deltaY;

  if (Math.abs(signed) <= ZOOM_SCROLL_EPSILON) return "none";

  /*
   * Navegador:
   * - deltaY < 0 aproxima;
   * - deltaY > 0 afasta.
   */
  return signed < 0 ? "in" : "out";
}

function getHighZoomReturnBoost(currentZoomPercent: number): number {
  if (currentZoomPercent >= 1800) return ZOOM_SCROLL_HIGH_ZOOM_OUT_RETURN_BOOST;
  if (currentZoomPercent >= 1400) return 1.34;
  if (currentZoomPercent >= 1000) return 1.24;
  if (currentZoomPercent >= 700) return 1.16;
  if (currentZoomPercent >= 400) return 1.08;

  return 1;
}

function getNearLimitBrake(input: {
  currentZoomPercent: number;
  maxZoomPercent: number;
}): number {
  const pressure =
    input.currentZoomPercent / Math.max(1, input.maxZoomPercent);

  /*
   * Quanto mais perto de 2000%, menor a força do zoom-in.
   * Isso evita tremulação no teto, mas não afeta zoom-out.
   */
  return 1 - ZOOM_SCROLL_NEAR_MAX_ZOOM_BRAKE * smoothStep(0.72, 1, pressure);
}

export function clampZoomPercent(input: {
  value: number;
  minZoomPercent?: number;
  maxZoomPercent?: number;
}): number {
  const minZoomPercent = Math.max(
    1,
    safeNumber(input.minZoomPercent, ZOOM_SCROLL_MIN_ZOOM_PERCENT),
  );
  const maxZoomPercent = Math.max(
    minZoomPercent,
    safeNumber(input.maxZoomPercent, ZOOM_SCROLL_MAX_ZOOM_PERCENT),
  );

  return roundZoomPercent(clamp(input.value, minZoomPercent, maxZoomPercent));
}

export function computeWheelZoomVelocity(
  input: ZoomVelocityInput,
): ZoomVelocityResult {
  const minZoomPercent = Math.max(
    1,
    safeNumber(input.minZoomPercent, ZOOM_SCROLL_MIN_ZOOM_PERCENT),
  );
  const maxZoomPercent = Math.max(
    minZoomPercent,
    safeNumber(input.maxZoomPercent, ZOOM_SCROLL_MAX_ZOOM_PERCENT),
  );
  const speedMultiplier = Math.max(
    0.1,
    safeNumber(input.speedMultiplier, ZOOM_SCROLL_WHEEL_ZOOM_SPEED_MULTIPLIER),
  );

  const previousZoomPercent = clampZoomPercent({
    value: input.currentZoomPercent,
    minZoomPercent,
    maxZoomPercent,
  });

  const direction = getDirectionFromDelta({
    deltaY: input.deltaY,
    invertDirection: input.invertDirection,
  });

  if (direction === "none") {
    return {
      previousZoomPercent,
      nextZoomPercent: previousZoomPercent,
      deltaZoomPercent: 0,
      direction,
      clamped: false,
      appliedFactor: 1,
      audit: {
        source: "ZoomVelocityController",
        effectiveDeltaY: 0,
        effectiveNotches: 0,
        speedMultiplier,
        highZoomReturnBoost: 1,
        nearLimitBrake: 1,
      },
    };
  }

  /*
   * effectiveDeltaY é a única entrada de velocidade.
   * Para aumentar/diminuir a sensação geral, altere speedMultiplier.
   */
  const effectiveDeltaY = input.deltaY * speedMultiplier;
  const effectiveNotches = Math.min(
    3.5,
    Math.max(
      0.12,
      Math.abs(effectiveDeltaY) / ZOOM_SCROLL_WHEEL_NOTCH_PIXELS,
    ),
  );

  let appliedFactor = 1;
  let highZoomReturnBoost = 1;
  let nearLimitBrake = 1;

  if (direction === "in") {
    nearLimitBrake = getNearLimitBrake({
      currentZoomPercent: previousZoomPercent,
      maxZoomPercent,
    });

    /*
     * Crescimento direto.
     * Não usamos animação nem easing temporal. O resultado sai pronto para
     * aplicação imediata em visualZoom.
     */
    const growth = effectiveNotches * 0.18 * nearLimitBrake;
    appliedFactor = clamp(
      1 + growth,
      1.015,
      ZOOM_SCROLL_MAX_ZOOM_IN_FACTOR_PER_INPUT,
    );
  }

  if (direction === "out") {
    highZoomReturnBoost = getHighZoomReturnBoost(previousZoomPercent);

    /*
     * Retorno em mola:
     * quanto maior o zoom atual, maior a força de saída.
     *
     * Usamos divisão por (1 + força), pois ela reduz muito em zoom alto sem
     * passar do limite mínimo.
     */
    const returnForce = effectiveNotches * 0.28 * highZoomReturnBoost;
    appliedFactor = clamp(
      1 / (1 + returnForce),
      ZOOM_SCROLL_MIN_ZOOM_OUT_FACTOR_PER_INPUT,
      0.985,
    );
  }

  const rawNextZoomPercent = previousZoomPercent * appliedFactor;

  const nextZoomPercent = clampZoomPercent({
    value: rawNextZoomPercent,
    minZoomPercent,
    maxZoomPercent,
  });

  return {
    previousZoomPercent,
    nextZoomPercent,
    deltaZoomPercent: nextZoomPercent - previousZoomPercent,
    direction,
    clamped:
      nextZoomPercent === minZoomPercent ||
      nextZoomPercent === maxZoomPercent,
    appliedFactor,
    audit: {
      source: "ZoomVelocityController",
      effectiveDeltaY,
      effectiveNotches,
      speedMultiplier,
      highZoomReturnBoost,
      nearLimitBrake,
    },
  };
}
