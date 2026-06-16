import { KNEX_PDF_MAX_ZOOM, KNEX_PDF_MIN_ZOOM } from "../core/engineConfig";

export type KnexPdfZoomReason =
  | "zoom-in"
  | "zoom-out"
  | "wheel-zoom"
  | "pinch-zoom"
  | "manual-percent"
  | "manual-scale"
  | "preset"
  | "fit-width"
  | "fit-page"
  | "actual-size"
  | "restore";

export type KnexPdfZoomMode =
  | "custom"
  | "fitWidth"
  | "fitPage"
  | "actualSize";

export type KnexPdfZoomDirection = "in" | "out";

export type KnexPdfZoomState = {
  /**
   * Escala real.
   * 1.0 = 100%
   * 4.0 = 400%
   * 20.0 = 2000%
   *
   * O viewer comum deve permanecer limitado a 2000%.
   */
  zoom: number;

  /**
   * Percentual inteiro exibido na UI.
   *
   * O layout deve usar `zoom`, pois ele preserva microvariações necessárias
   * para fluidez.
   */
  zoomPercent: number;

  mode: KnexPdfZoomMode;
  reason: KnexPdfZoomReason;
};

export type KnexPdfZoomChange = {
  previousZoom: number;
  nextZoom: number;
  previousZoomPercent: number;
  nextZoomPercent: number;
  direction: KnexPdfZoomDirection | "none";
  reason: KnexPdfZoomReason;
  changed: boolean;
};

export type ComputeWheelZoomInput = {
  currentZoom: number;

  /**
   * WheelEvent.deltaY.
   * deltaY < 0 normalmente significa zoom in.
   * deltaY > 0 normalmente significa zoom out.
   */
  deltaY: number;

  /**
   * WheelEvent.deltaMode.
   * 0 = pixels
   * 1 = linhas
   * 2 = páginas
   */
  deltaMode?: number;

  /**
   * Quando true, inverte o sentido do zoom.
   */
  invertDirection?: boolean;

  /**
   * Sensibilidade base do wheel zoom.
   */
  sensitivity?: number;

  /**
   * Se true, usa curva exponencial suave.
   */
  smooth?: boolean;

  /**
   * Limite opcional de delta por evento.
   */
  maxDeltaPixelsPerEvent?: number;

  /**
   * Fator máximo de zoom por evento.
   */
  maxZoomFactorPerEvent?: number;

  /**
   * Fator mínimo de zoom por evento.
   */
  minZoomFactorPerEvent?: number;
};

export type ComputeStepZoomInput = {
  currentZoom: number;
  direction: KnexPdfZoomDirection;
  usePresets?: boolean;
};

export type ComputeFitZoomInput = {
  viewportWidth: number;
  viewportHeight: number;
  pageWidth: number;
  pageHeight: number;
  paddingX?: number;
  paddingY?: number;
};

export type ParseZoomPercentInput = {
  value: string | number | null | undefined;
  fallbackZoom?: number;
};

type WheelZoomFluidityProfile = {
  sensitivity: number;
  maxDeltaPixelsPerEvent: number;
  minZoomFactorPerEvent: number;
  maxZoomFactorPerEvent: number;
};

const DEFAULT_WHEEL_ZOOM_SENSITIVITY = 0.00235;
const LINE_DELTA_PIXEL_FACTOR = 16;
const PAGE_DELTA_PIXEL_FACTOR = 800;
const ZOOM_CHANGE_EPSILON = 0.000001;

const KNEX_PDF_SAFE_MIN_ZOOM = 0.1;
const KNEX_PDF_SAFE_MAX_ZOOM = 20;

const EFFECTIVE_MIN_ZOOM = Math.max(KNEX_PDF_MIN_ZOOM, KNEX_PDF_SAFE_MIN_ZOOM);
const EFFECTIVE_MAX_ZOOM = Math.min(KNEX_PDF_MAX_ZOOM, KNEX_PDF_SAFE_MAX_ZOOM);

/**
 * Multiplicador global da velocidade do wheel.
 *
 * Este é o ponto solicitado:
 * uma volta pequena do wheel deve gerar muito mais deslocamento de zoom,
 * tanto no zoom-in quanto no zoom-out.
 *
 * Importante:
 * esse multiplicador atua antes do cálculo exponencial e antes da compressão
 * de delta. Por isso, os limites de delta e fator por evento também foram
 * ampliados para o x4 realmente aparecer na interface.
 */
const WHEEL_ZOOM_SPEED_MULTIPLIER = 6;

/**
 * Limites base para wheel.
 *
 * Como o delta agora entra multiplicado por 6, esses tetos precisam ser mais
 * abertos. Caso contrário, o multiplicador seria neutralizado pelo clamp.
 */
const DEFAULT_MAX_WHEEL_DELTA_PIXELS_PER_EVENT = 1440;
const DEFAULT_MAX_ZOOM_FACTOR_PER_EVENT = 1.58;
const DEFAULT_MIN_ZOOM_FACTOR_PER_EVENT = 0.42;

const MAX_EXTERNAL_SENSITIVITY_MULTIPLIER = 1.12;
const MAX_EXTERNAL_DELTA_MULTIPLIER = 1.1;
const MIN_TRACKPAD_IMPULSE_PIXELS = 8;
const TRACKPAD_IMPULSE_LIMIT_PIXELS = 36;

/**
 * Integração com PdfWheelInteractionPolicy:
 *
 * Este arquivo agora assume a aceleração principal do wheel com x6.
 * Portanto, o PdfWheelInteractionPolicy NÃO deve aplicar outro multiplicador
 * agressivo por cima. Ele deve ficar responsável por:
 * - normalizar tipo de entrada;
 * - comprimir picos absurdos;
 * - preservar direção;
 * - entregar delta estável ao ZoomController.
 *
 * Se o Policy também multiplicar por 4, 6 ou mais, os dois módulos passam a
 * competir e o zoom fica instável: ora lento por dupla compressão, ora brusco
 * por dupla aceleração.
 */

export const KNEX_PDF_ZOOM_PERCENT_PRESETS = [
  10,
  25,
  50,
  75,
  100,
  125,
  150,
  175,
  200,
  250,
  300,
  350,
  400,
  500,
  600,
  800,
  1000,
  1200,
  1600,
  2000,
] as const;

export function safeNumber(
  value: number | null | undefined,
  fallback = 0,
): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

export function clampValue(value: number, min: number, max: number): number {
  const safeMin = safeNumber(min, 0);
  const safeMax = Math.max(safeMin, safeNumber(max, safeMin));
  const safeValue = safeNumber(value, safeMin);

  return Math.max(safeMin, Math.min(safeMax, safeValue));
}

export function roundZoom(zoom: number): number {
  return Math.round(zoom * 1000000) / 1000000;
}

export function getEffectiveZoomLimits(): {
  minZoom: number;
  maxZoom: number;
  minZoomPercent: number;
  maxZoomPercent: number;
} {
  return {
    minZoom: EFFECTIVE_MIN_ZOOM,
    maxZoom: EFFECTIVE_MAX_ZOOM,
    minZoomPercent: Math.round(EFFECTIVE_MIN_ZOOM * 100),
    maxZoomPercent: Math.round(EFFECTIVE_MAX_ZOOM * 100),
  };
}

export function zoomToPercent(zoom: number): number {
  return Math.round(clampKnexPdfZoom(zoom) * 100);
}

export function percentToZoom(percent: number): number {
  return clampKnexPdfZoom(safeNumber(percent, 100) / 100);
}

export function clampKnexPdfZoom(
  zoom: number | null | undefined,
): number {
  return roundZoom(
    clampValue(
      safeNumber(zoom, 1),
      EFFECTIVE_MIN_ZOOM,
      EFFECTIVE_MAX_ZOOM,
    ),
  );
}

export function clampKnexPdfZoomPercent(
  zoomPercent: number | null | undefined,
): number {
  return zoomToPercent(percentToZoom(safeNumber(zoomPercent, 100)));
}

export function createZoomState(input: {
  zoom: number;
  mode?: KnexPdfZoomMode;
  reason?: KnexPdfZoomReason;
}): KnexPdfZoomState {
  const zoom = clampKnexPdfZoom(input.zoom);

  return {
    zoom,
    zoomPercent: zoomToPercent(zoom),
    mode: input.mode ?? "custom",
    reason: input.reason ?? "manual-scale",
  };
}

export function createZoomChange(input: {
  previousZoom: number;
  nextZoom: number;
  reason: KnexPdfZoomReason;
}): KnexPdfZoomChange {
  const previousZoom = clampKnexPdfZoom(input.previousZoom);
  const nextZoom = clampKnexPdfZoom(input.nextZoom);
  const diff = nextZoom - previousZoom;

  return {
    previousZoom,
    nextZoom,
    previousZoomPercent: zoomToPercent(previousZoom),
    nextZoomPercent: zoomToPercent(nextZoom),
    direction:
      Math.abs(diff) <= ZOOM_CHANGE_EPSILON
        ? "none"
        : diff > 0
          ? "in"
          : "out",
    reason: input.reason,
    changed: Math.abs(diff) > ZOOM_CHANGE_EPSILON,
  };
}

export function normalizeWheelDeltaToPixels(input: {
  deltaY: number;
  deltaMode?: number;
}): number {
  const deltaY = safeNumber(input.deltaY, 0);

  switch (input.deltaMode ?? 0) {
    case 1:
      return deltaY * LINE_DELTA_PIXEL_FACTOR;
    case 2:
      return deltaY * PAGE_DELTA_PIXEL_FACTOR;
    case 0:
    default:
      return deltaY;
  }
}

function applySmallDeltaImpulse(deltaPixels: number): number {
  const safeDelta = safeNumber(deltaPixels, 0);

  if (Math.abs(safeDelta) <= ZOOM_CHANGE_EPSILON) {
    return 0;
  }

  const sign = Math.sign(safeDelta);
  const magnitude = Math.abs(safeDelta);

  if (magnitude >= TRACKPAD_IMPULSE_LIMIT_PIXELS) {
    return safeDelta;
  }

  const progressiveBoost =
    MIN_TRACKPAD_IMPULSE_PIXELS +
    magnitude * 0.86 +
    Math.sqrt(magnitude) * 1.12;

  return sign * Math.max(magnitude, progressiveBoost);
}

function getImmediateZoomOutDeltaMultiplier(currentZoom: number): number {
  const zoom = clampKnexPdfZoom(currentZoom);

  if (zoom >= 16) return 2.4;
  if (zoom >= 12) return 2.2;
  if (zoom >= 8) return 2;
  if (zoom >= 4) return 1.75;
  if (zoom >= 2) return 1.45;

  return 1.15;
}

export function limitWheelDeltaForContinuousZoom(input: {
  deltaPixels: number;
  maxDeltaPixelsPerEvent?: number;
}): number {
  const maxDelta = Math.max(
    1,
    safeNumber(
      input.maxDeltaPixelsPerEvent,
      DEFAULT_MAX_WHEEL_DELTA_PIXELS_PER_EVENT,
    ),
  );

  const delta = safeNumber(input.deltaPixels, 0);

  if (Math.abs(delta) <= ZOOM_CHANGE_EPSILON) {
    return 0;
  }

  const sign = Math.sign(delta);
  const magnitude = Math.abs(delta);

  /**
   * Compressão suave.
   *
   * Como o objetivo agora é wheel x6, a compressão usa maxDelta bem maior.
   * Assim, uma volta pequena já altera muito o zoom, mas eventos absurdamente
   * grandes continuam saturados de forma segura.
   */
  const compressedMagnitude =
    maxDelta * Math.tanh(magnitude / Math.max(1, maxDelta));

  return sign * compressedMagnitude;
}

export function limitZoomFactorForContinuousZoom(input: {
  zoomFactor: number;
  minZoomFactorPerEvent?: number;
  maxZoomFactorPerEvent?: number;
}): number {
  const maxFactor = Math.max(
    1.001,
    safeNumber(
      input.maxZoomFactorPerEvent,
      DEFAULT_MAX_ZOOM_FACTOR_PER_EVENT,
    ),
  );

  const minFactor = clampValue(
    safeNumber(
      input.minZoomFactorPerEvent,
      DEFAULT_MIN_ZOOM_FACTOR_PER_EVENT,
    ),
    0.001,
    maxFactor,
  );

  return clampValue(
    safeNumber(input.zoomFactor, 1),
    minFactor,
    maxFactor,
  );
}

function getWheelZoomFluidityProfile(input: {
  currentZoom: number;
  signedDelta: number;
  sensitivity?: number;
  maxDeltaPixelsPerEvent?: number;
  minZoomFactorPerEvent?: number;
  maxZoomFactorPerEvent?: number;
}): WheelZoomFluidityProfile {
  const currentZoom = clampKnexPdfZoom(input.currentZoom);
  const isZoomingOut = input.signedDelta < 0;

  let sensitivity = DEFAULT_WHEEL_ZOOM_SENSITIVITY;
  let maxDeltaPixelsPerEvent = DEFAULT_MAX_WHEEL_DELTA_PIXELS_PER_EVENT;
  let maxZoomFactorPerEvent = DEFAULT_MAX_ZOOM_FACTOR_PER_EVENT;
  let minZoomFactorPerEvent = DEFAULT_MIN_ZOOM_FACTOR_PER_EVENT;

  /**
   * Perfil revisado para wheel x6:
   *
   * - zoom-in fica realmente veloz em escala baixa/média;
   * - zoom-in em escala alta ainda freia perto do teto de 2000%;
   * - zoom-out permanece imediato, com retorno agressivo em zoom alto.
   */
  if (currentZoom >= 16) {
    if (isZoomingOut) {
      sensitivity = 0.0084;
      maxDeltaPixelsPerEvent = 2380;
      maxZoomFactorPerEvent = 1.1;
      minZoomFactorPerEvent = 0.26;
    } else {
      sensitivity = 0.00215;
      maxDeltaPixelsPerEvent = 940;
      maxZoomFactorPerEvent = 1.2;
      minZoomFactorPerEvent = 1 / 1.2;
    }
  } else if (currentZoom >= 12) {
    if (isZoomingOut) {
      sensitivity = 0.0078;
      maxDeltaPixelsPerEvent = 2200;
      maxZoomFactorPerEvent = 1.2;
      minZoomFactorPerEvent = 0.3;
    } else {
      sensitivity = 0.00238;
      maxDeltaPixelsPerEvent = 840;
      maxZoomFactorPerEvent = 1.2;
      minZoomFactorPerEvent = 1 / 1.2;
    }
  } else if (currentZoom >= 8) {
    if (isZoomingOut) {
      sensitivity = 0.007;
      maxDeltaPixelsPerEvent = 1980;
      maxZoomFactorPerEvent = 1.14;
      minZoomFactorPerEvent = 0.34;
    } else {
      sensitivity = 0.0027;
      maxDeltaPixelsPerEvent = 940;
      maxZoomFactorPerEvent = 1.36;
      minZoomFactorPerEvent = 1 / 1.36;
    }
  } else if (currentZoom >= 4) {
    if (isZoomingOut) {
      sensitivity = 0.006;
      maxDeltaPixelsPerEvent = 1760;
      maxZoomFactorPerEvent = 1.18;
      minZoomFactorPerEvent = 0.4;
    } else {
      sensitivity = 0.00355;
      maxDeltaPixelsPerEvent = 1120;
      maxZoomFactorPerEvent = 1.36;
      minZoomFactorPerEvent = 1 / 1.36;
    }
  } else if (currentZoom >= 2) {
    if (isZoomingOut) {
      sensitivity = 0.0049;
      maxDeltaPixelsPerEvent = 1480;
      maxZoomFactorPerEvent = 1.36;
      minZoomFactorPerEvent = 0.5;
    } else {
      sensitivity = 0.00355;
      maxDeltaPixelsPerEvent = 1320;
      maxZoomFactorPerEvent = 1.46;
      minZoomFactorPerEvent = 1 / 1.46;
    }
  } else if (isZoomingOut) {
    sensitivity = 0.0036;
    maxDeltaPixelsPerEvent = 1120;
    maxZoomFactorPerEvent = 1.36;
    minZoomFactorPerEvent = 0.58;
  } else {
    sensitivity = 0.004;
    maxDeltaPixelsPerEvent = 1440;
    maxZoomFactorPerEvent = 1.58;
    minZoomFactorPerEvent = 1 / 1.58;
  }

  /**
   * Overrides externos com proteção:
   *
   * - em zoom-out, override conservador não pode prender o retorno;
   * - em zoom-in, override externo não pode abrir salto acima do perfil seguro;
   * - o x4 global já foi aplicado antes do perfil, então não aceitamos
   *   multiplicações externas descontroladas.
   */
  const requestedSensitivity = input.sensitivity;
  if (typeof requestedSensitivity === "number" && Number.isFinite(requestedSensitivity)) {
    if (isZoomingOut) {
      sensitivity = clampValue(
        Math.max(requestedSensitivity, sensitivity),
        sensitivity,
        sensitivity * MAX_EXTERNAL_SENSITIVITY_MULTIPLIER,
      );
    } else {
      sensitivity = clampValue(
        requestedSensitivity,
        0.0001,
        sensitivity * MAX_EXTERNAL_SENSITIVITY_MULTIPLIER,
      );
    }
  }

  const requestedMaxDelta = input.maxDeltaPixelsPerEvent;
  if (typeof requestedMaxDelta === "number" && Number.isFinite(requestedMaxDelta)) {
    if (isZoomingOut) {
      maxDeltaPixelsPerEvent = clampValue(
        Math.max(requestedMaxDelta, maxDeltaPixelsPerEvent),
        maxDeltaPixelsPerEvent,
        maxDeltaPixelsPerEvent * MAX_EXTERNAL_DELTA_MULTIPLIER,
      );
    } else {
      maxDeltaPixelsPerEvent = clampValue(
        requestedMaxDelta,
        1,
        maxDeltaPixelsPerEvent,
      );
    }
  }

  const requestedMaxFactor = input.maxZoomFactorPerEvent;
  if (typeof requestedMaxFactor === "number" && Number.isFinite(requestedMaxFactor)) {
    if (isZoomingOut) {
      maxZoomFactorPerEvent = clampValue(
        Math.max(requestedMaxFactor, maxZoomFactorPerEvent),
        1.001,
        maxZoomFactorPerEvent * MAX_EXTERNAL_DELTA_MULTIPLIER,
      );
    } else {
      maxZoomFactorPerEvent = clampValue(
        requestedMaxFactor,
        1.001,
        maxZoomFactorPerEvent,
      );
    }
  }

  const requestedMinFactor = input.minZoomFactorPerEvent;
  if (typeof requestedMinFactor === "number" && Number.isFinite(requestedMinFactor)) {
    if (isZoomingOut) {
      minZoomFactorPerEvent = clampValue(
        Math.min(requestedMinFactor, minZoomFactorPerEvent),
        0.25,
        minZoomFactorPerEvent,
      );
    } else {
      minZoomFactorPerEvent = clampValue(
        requestedMinFactor,
        minZoomFactorPerEvent,
        maxZoomFactorPerEvent,
      );
    }
  }

  minZoomFactorPerEvent = clampValue(
    minZoomFactorPerEvent,
    0.001,
    maxZoomFactorPerEvent,
  );

  return {
    sensitivity,
    maxDeltaPixelsPerEvent,
    minZoomFactorPerEvent,
    maxZoomFactorPerEvent,
  };
}

/**
 * Calcula zoom por Ctrl + wheel ou gesto equivalente.
 *
 * Versão x6:
 * - multiplica a velocidade real do wheel por 6 em zoom-in e zoom-out;
 * - abre os limites internos para o x4 não ser neutralizado;
 * - preserva freio em zoom-in perto de 2000%;
 * - mantém retorno imediato em zoom-out.
 */
export function computeWheelZoom(input: ComputeWheelZoomInput): number {
  const currentZoom = clampKnexPdfZoom(input.currentZoom);

  const normalizedDelta =
    normalizeWheelDeltaToPixels({
      deltaY: input.deltaY,
      deltaMode: input.deltaMode,
    }) * WHEEL_ZOOM_SPEED_MULTIPLIER;

  if (Math.abs(normalizedDelta) <= ZOOM_CHANGE_EPSILON) {
    return currentZoom;
  }

  const directionMultiplier = input.invertDirection ? 1 : -1;
  const rawSignedDelta = normalizedDelta * directionMultiplier;
  const isZoomingOut = rawSignedDelta < 0;

  const directionalSignedDelta = isZoomingOut
    ? rawSignedDelta * getImmediateZoomOutDeltaMultiplier(currentZoom)
    : rawSignedDelta;

  const profile = getWheelZoomFluidityProfile({
    currentZoom,
    signedDelta: directionalSignedDelta,
    sensitivity: input.sensitivity,
    maxDeltaPixelsPerEvent: input.maxDeltaPixelsPerEvent,
    minZoomFactorPerEvent: input.minZoomFactorPerEvent,
    maxZoomFactorPerEvent: input.maxZoomFactorPerEvent,
  });

  const impulsedSignedDelta = applySmallDeltaImpulse(directionalSignedDelta);

  const signedDelta = limitWheelDeltaForContinuousZoom({
    deltaPixels: impulsedSignedDelta,
    maxDeltaPixelsPerEvent: profile.maxDeltaPixelsPerEvent,
  });

  if (signedDelta > 0 && currentZoom >= EFFECTIVE_MAX_ZOOM - ZOOM_CHANGE_EPSILON) {
    return EFFECTIVE_MAX_ZOOM;
  }

  if (signedDelta < 0 && currentZoom <= EFFECTIVE_MIN_ZOOM + ZOOM_CHANGE_EPSILON) {
    return EFFECTIVE_MIN_ZOOM;
  }

  if (input.smooth ?? true) {
    const rawZoomFactor = Math.exp(signedDelta * profile.sensitivity);

    const zoomFactor = limitZoomFactorForContinuousZoom({
      zoomFactor: rawZoomFactor,
      minZoomFactorPerEvent: profile.minZoomFactorPerEvent,
      maxZoomFactorPerEvent: profile.maxZoomFactorPerEvent,
    });

    return clampKnexPdfZoom(currentZoom * zoomFactor);
  }

  const linearDelta = signedDelta * profile.sensitivity;
  const rawNextZoom = currentZoom + currentZoom * linearDelta;
  const rawZoomFactor = rawNextZoom / Math.max(0.000001, currentZoom);

  const zoomFactor = limitZoomFactorForContinuousZoom({
    zoomFactor: rawZoomFactor,
    minZoomFactorPerEvent: profile.minZoomFactorPerEvent,
    maxZoomFactorPerEvent: profile.maxZoomFactorPerEvent,
  });

  return clampKnexPdfZoom(currentZoom * zoomFactor);
}

export function getAvailableZoomPercentPresets(): number[] {
  const minPercent = Math.round(EFFECTIVE_MIN_ZOOM * 100);
  const maxPercent = Math.round(EFFECTIVE_MAX_ZOOM * 100);

  return KNEX_PDF_ZOOM_PERCENT_PRESETS.filter(
    (percent) => percent >= minPercent && percent <= maxPercent,
  );
}

export function findNearestZoomPresetPercent(zoom: number): number {
  const currentPercent = zoomToPercent(zoom);
  const presets = getAvailableZoomPercentPresets();

  if (presets.length === 0) {
    return currentPercent;
  }

  return presets.reduce((nearest, preset) => {
    const currentDistance = Math.abs(currentPercent - nearest);
    const nextDistance = Math.abs(currentPercent - preset);

    return nextDistance < currentDistance ? preset : nearest;
  }, presets[0]);
}

export function getNextZoomPresetPercent(input: {
  currentZoom: number;
  direction: KnexPdfZoomDirection;
}): number {
  const currentPercent = zoomToPercent(input.currentZoom);
  const presets = getAvailableZoomPercentPresets();

  if (presets.length === 0) {
    return currentPercent;
  }

  if (input.direction === "in") {
    return (
      presets.find((preset) => preset > currentPercent) ??
      presets[presets.length - 1]
    );
  }

  const reversed = [...presets].reverse();

  return reversed.find((preset) => preset < currentPercent) ?? presets[0];
}

export function computeStepZoom(input: ComputeStepZoomInput): number {
  const currentZoom = clampKnexPdfZoom(input.currentZoom);

  if (input.usePresets ?? true) {
    return percentToZoom(
      getNextZoomPresetPercent({
        currentZoom,
        direction: input.direction,
      }),
    );
  }

  const factor = input.direction === "in" ? 1.25 : 0.8;
  return clampKnexPdfZoom(currentZoom * factor);
}

export function computeZoomIn(currentZoom: number): number {
  return computeStepZoom({
    currentZoom,
    direction: "in",
    usePresets: true,
  });
}

export function computeZoomOut(currentZoom: number): number {
  return computeStepZoom({
    currentZoom,
    direction: "out",
    usePresets: true,
  });
}

export function computeActualSizeZoom(): number {
  return clampKnexPdfZoom(1);
}

export function computeFitWidthZoom(input: ComputeFitZoomInput): number {
  const viewportWidth = Math.max(1, safeNumber(input.viewportWidth, 1));
  const pageWidth = Math.max(1, safeNumber(input.pageWidth, 1));
  const paddingX = Math.max(0, safeNumber(input.paddingX, 0));
  const availableWidth = Math.max(1, viewportWidth - paddingX * 2);

  return clampKnexPdfZoom(availableWidth / pageWidth);
}

export function computeFitPageZoom(input: ComputeFitZoomInput): number {
  const viewportWidth = Math.max(1, safeNumber(input.viewportWidth, 1));
  const viewportHeight = Math.max(1, safeNumber(input.viewportHeight, 1));
  const pageWidth = Math.max(1, safeNumber(input.pageWidth, 1));
  const pageHeight = Math.max(1, safeNumber(input.pageHeight, 1));
  const paddingX = Math.max(0, safeNumber(input.paddingX, 0));
  const paddingY = Math.max(0, safeNumber(input.paddingY, 0));
  const availableWidth = Math.max(1, viewportWidth - paddingX * 2);
  const availableHeight = Math.max(1, viewportHeight - paddingY * 2);

  return clampKnexPdfZoom(
    Math.min(availableWidth / pageWidth, availableHeight / pageHeight),
  );
}

export function parseZoomPercentInput(input: ParseZoomPercentInput): number {
  const fallbackZoom = clampKnexPdfZoom(input.fallbackZoom ?? 1);

  if (typeof input.value === "number") {
    return percentToZoom(input.value);
  }

  if (typeof input.value !== "string") {
    return fallbackZoom;
  }

  const normalized = input.value
    .trim()
    .replace("%", "")
    .replace(",", ".");

  const parsed = Number.parseFloat(normalized);

  if (!Number.isFinite(parsed)) {
    return fallbackZoom;
  }

  return percentToZoom(parsed);
}

export function formatZoomPercent(zoom: number): string {
  return `${zoomToPercent(zoom)}%`;
}

export function isZoomAtMinimum(zoom: number): boolean {
  return clampKnexPdfZoom(zoom) <= EFFECTIVE_MIN_ZOOM + ZOOM_CHANGE_EPSILON;
}

export function isZoomAtMaximum(zoom: number): boolean {
  return clampKnexPdfZoom(zoom) >= EFFECTIVE_MAX_ZOOM - ZOOM_CHANGE_EPSILON;
}

function modeFromReason(reason: KnexPdfZoomReason): KnexPdfZoomMode {
  if (reason === "fit-width") return "fitWidth";
  if (reason === "fit-page") return "fitPage";
  if (reason === "actual-size") return "actualSize";
  return "custom";
}

export class ZoomController {
  private state: KnexPdfZoomState;

  constructor(initialZoom = 1) {
    this.state = createZoomState({
      zoom: initialZoom,
      mode: "custom",
      reason: "restore",
    });
  }

  getState(): KnexPdfZoomState {
    return { ...this.state };
  }

  setZoom(
    nextZoom: number,
    reason: KnexPdfZoomReason = "manual-scale",
  ): KnexPdfZoomChange {
    const change = createZoomChange({
      previousZoom: this.state.zoom,
      nextZoom,
      reason,
    });

    this.state = createZoomState({
      zoom: change.nextZoom,
      mode: modeFromReason(reason),
      reason,
    });

    return change;
  }

  commitZoom(
    nextZoom: number,
    reason: KnexPdfZoomReason = "manual-scale",
  ): KnexPdfZoomChange {
    return this.setZoom(nextZoom, reason);
  }

  previewWheelZoom(
    input: Omit<ComputeWheelZoomInput, "currentZoom"> & {
      currentZoom?: number;
    },
  ): KnexPdfZoomChange {
    const previousZoom = clampKnexPdfZoom(input.currentZoom ?? this.state.zoom);
    const nextZoom = computeWheelZoom({
      ...input,
      currentZoom: previousZoom,
    });

    return createZoomChange({
      previousZoom,
      nextZoom,
      reason: "wheel-zoom",
    });
  }

  zoomIn(): KnexPdfZoomChange {
    return this.setZoom(computeZoomIn(this.state.zoom), "zoom-in");
  }

  zoomOut(): KnexPdfZoomChange {
    return this.setZoom(computeZoomOut(this.state.zoom), "zoom-out");
  }

  wheelZoom(
    input: Omit<ComputeWheelZoomInput, "currentZoom">,
  ): KnexPdfZoomChange {
    return this.setZoom(
      computeWheelZoom({
        ...input,
        currentZoom: this.state.zoom,
      }),
      "wheel-zoom",
    );
  }

  pinchZoom(nextZoom: number): KnexPdfZoomChange {
    return this.setZoom(nextZoom, "pinch-zoom");
  }

  setPercent(value: string | number): KnexPdfZoomChange {
    return this.setZoom(
      parseZoomPercentInput({
        value,
        fallbackZoom: this.state.zoom,
      }),
      "manual-percent",
    );
  }

  actualSize(): KnexPdfZoomChange {
    return this.setZoom(computeActualSizeZoom(), "actual-size");
  }

  fitWidth(input: ComputeFitZoomInput): KnexPdfZoomChange {
    return this.setZoom(computeFitWidthZoom(input), "fit-width");
  }

  fitPage(input: ComputeFitZoomInput): KnexPdfZoomChange {
    return this.setZoom(computeFitPageZoom(input), "fit-page");
  }
}

/**
 * Fluxo correto para Ctrl + wheel:
 *
 * 1. Capturar anchor antes do zoom.
 * 2. Aplicar visualZoom imediatamente.
 * 3. Restaurar a âncora no espaço visual.
 * 4. Manter render pesado congelado durante o gesto.
 * 5. Confirmar renderZoom/committedRenderZoom apenas após settle.
 *
 * Se esta versão calcular rápido, mas a tela ainda demorar, o gargalo estará
 * no Shell: RAF, flushWheel, debounce/settle, setVisualZoom ou restauração de
 * âncora.
 */
