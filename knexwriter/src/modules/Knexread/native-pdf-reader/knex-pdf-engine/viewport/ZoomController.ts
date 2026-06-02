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
   * 80.0 = 8000% apenas em configuração extrema/debug
   */
  zoom: number;

  /**
   * Percentual inteiro exibido na UI.
   *
   * Importante:
   * a UI pode exibir inteiro, mas o layout deve usar `zoom`,
   * pois ele preserva microvariações necessárias para fluidez.
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
   *
   * Valores muito altos geram salto.
   * Valores muito baixos dão sensação de zoom agarrado.
   */
  sensitivity?: number;

  /**
   * Se true, usa curva exponencial suave.
   */
  smooth?: boolean;

  /**
   * Limite opcional de delta por evento.
   *
   * Serve para evitar que eventos acumulados pelo navegador sejam aplicados
   * de uma vez só, gerando o efeito elástico.
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

  /**
   * Quando true, usa presets em vez de multiplicador fixo.
   */
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

const DEFAULT_WHEEL_ZOOM_SENSITIVITY = 0.00225;
const LINE_DELTA_PIXEL_FACTOR = 16;
const PAGE_DELTA_PIXEL_FACTOR = 800;
const ZOOM_CHANGE_EPSILON = 0.000001;

/**
 * Limite seguro do leitor.
 *
 * O engineConfig pode permitir valores muito altos para testes, mas o viewer
 * interativo não deve deixar o zoom crescer indefinidamente. O teto seguro
 * abaixo fica em 2000%, bem menor que 8000%, mas suficiente para leitura
 * ampliada sem abrir completamente a porta para renderizações extremas.
 *
 * Se no futuro houver um modo técnico/debug para zoom extremo, ele deve ser
 * isolado do fluxo comum de leitura.
 */
const KNEX_PDF_SAFE_MIN_ZOOM = 0.1;
const KNEX_PDF_SAFE_MAX_ZOOM = 20;

/**
 * Limites efetivos.
 *
 * Respeitam engineConfig quando ele for mais restritivo, mas impedem que um
 * KNEX_PDF_MAX_ZOOM muito alto, como 80.0, vaze para o leitor comum.
 */
const EFFECTIVE_MIN_ZOOM = Math.max(KNEX_PDF_MIN_ZOOM, KNEX_PDF_SAFE_MIN_ZOOM);
const EFFECTIVE_MAX_ZOOM = Math.min(KNEX_PDF_MAX_ZOOM, KNEX_PDF_SAFE_MAX_ZOOM);

/**
 * Limites base para wheel.
 *
 * Mantêm fluidez sem permitir saltos grandes demais. O multiplicador externo
 * do Shell pode acelerar o delta, então este controlador precisa continuar
 * sendo a trava final antes da renderização.
 */
const DEFAULT_MAX_WHEEL_DELTA_PIXELS_PER_EVENT = 320;
const DEFAULT_MAX_ZOOM_FACTOR_PER_EVENT = 1.16;
const DEFAULT_MIN_ZOOM_FACTOR_PER_EVENT =
  1 / DEFAULT_MAX_ZOOM_FACTOR_PER_EVENT;

/**
 * Presets em percentual para o leitor comum.
 *
 * Teto em 2000%. Esse valor ainda exige cuidado no renderizador por tiles,
 * mas é muito mais seguro que 8000% e atende ao uso de ampliação forte.
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
  /**
   * Não arredondar para percentual aqui.
   * O zoom real precisa manter microvariações para não parecer saltado.
   */
  return Math.round(zoom * 1000000) / 1000000;
}

export function zoomToPercent(zoom: number): number {
  return Math.round(clampKnexPdfZoom(zoom) * 100);
}

export function percentToZoom(percent: number): number {
  return clampKnexPdfZoom(safeNumber(percent, 100) / 100);
}

/**
 * Limita o zoom real do leitor.
 *
 * Este é o ponto principal de proteção contra tela preta e sobrecarga de
 * memória. Mesmo que o engineConfig esteja aberto para testes extremos, o
 * viewer comum fica limitado ao intervalo efetivo definido acima.
 */
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

function getWheelZoomFluidityProfile(input: {
  currentZoom: number;
  signedDelta: number;
  sensitivity?: number;
  maxDeltaPixelsPerEvent?: number;
  minZoomFactorPerEvent?: number;
  maxZoomFactorPerEvent?: number;
}): WheelZoomFluidityProfile {
  const currentZoom = clampKnexPdfZoom(input.currentZoom);

  /**
   * signedDelta > 0 = zoom in.
   * signedDelta < 0 = zoom out.
   */
  const isZoomingOut = input.signedDelta < 0;

  let sensitivity = DEFAULT_WHEEL_ZOOM_SENSITIVITY;
  let maxDeltaPixelsPerEvent = DEFAULT_MAX_WHEEL_DELTA_PIXELS_PER_EVENT;
  let maxZoomFactorPerEvent = DEFAULT_MAX_ZOOM_FACTOR_PER_EVENT;
  let minZoomFactorPerEvent = DEFAULT_MIN_ZOOM_FACTOR_PER_EVENT;

  /**
   * Em zoom alto, o usuário sente mais o travamento na volta.
   * Por isso, a saída do zoom alto precisa ser mais responsiva do que a entrada.
   *
   * A ideia é:
   * - zoom in em escala alta fica controlado para não explodir o layout;
   * - zoom out em escala alta fica mais rápido para não parecer preso.
   */
  if (currentZoom >= 16) {
    if (isZoomingOut) {
      /*
       * Em 1600%+, a saída precisa continuar responsiva para o usuário não
       * ficar "preso" no zoom alto.
       */
      sensitivity = 0.00275;
      maxDeltaPixelsPerEvent = 520;
      maxZoomFactorPerEvent = 1.08;
      minZoomFactorPerEvent = 0.78;
    } else {
      /*
       * Entrada perto do teto de 2000% deve ser bem controlada para evitar
       * renderizações sucessivas tentando ultrapassar o limite.
       */
      sensitivity = 0.00125;
      maxDeltaPixelsPerEvent = 180;
      maxZoomFactorPerEvent = 1.035;
      minZoomFactorPerEvent = 1 / 1.035;
    }
  } else if (currentZoom >= 8) {
    if (isZoomingOut) {
      sensitivity = 0.00265;
      maxDeltaPixelsPerEvent = 500;
      maxZoomFactorPerEvent = 1.1;
      minZoomFactorPerEvent = 0.8;
    } else {
      sensitivity = 0.00145;
      maxDeltaPixelsPerEvent = 220;
      maxZoomFactorPerEvent = 1.045;
      minZoomFactorPerEvent = 1 / 1.045;
    }
  } else if (currentZoom >= 4) {
    if (isZoomingOut) {
      sensitivity = 0.00255;
      maxDeltaPixelsPerEvent = 480;
      maxZoomFactorPerEvent = 1.12;
      minZoomFactorPerEvent = 0.82;
    } else {
      sensitivity = 0.00165;
      maxDeltaPixelsPerEvent = 260;
      maxZoomFactorPerEvent = 1.06;
      minZoomFactorPerEvent = 1 / 1.06;
    }
  } else if (currentZoom >= 2) {
    if (isZoomingOut) {
      sensitivity = 0.00245;
      maxDeltaPixelsPerEvent = 500;
      maxZoomFactorPerEvent = 1.16;
      minZoomFactorPerEvent = 0.84;
    } else {
      sensitivity = 0.00205;
      maxDeltaPixelsPerEvent = 360;
      maxZoomFactorPerEvent = 1.12;
      minZoomFactorPerEvent = 1 / 1.12;
    }
  }

  /**
   * Overrides externos continuam respeitados.
   * Útil caso o Shell tenha preferência própria.
   */
  sensitivity = Math.max(
    0.0001,
    safeNumber(input.sensitivity, sensitivity),
  );

  maxDeltaPixelsPerEvent = Math.max(
    1,
    safeNumber(input.maxDeltaPixelsPerEvent, maxDeltaPixelsPerEvent),
  );

  maxZoomFactorPerEvent = Math.max(
    1.001,
    safeNumber(input.maxZoomFactorPerEvent, maxZoomFactorPerEvent),
  );

  minZoomFactorPerEvent = clampValue(
    safeNumber(input.minZoomFactorPerEvent, minZoomFactorPerEvent),
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

  return clampValue(input.deltaPixels, -maxDelta, maxDelta);
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

/**
 * Calcula zoom por Ctrl + wheel ou gesto equivalente.
 *
 * Correção principal:
 * - em zoom alto, a volta fica mais responsiva;
 * - ainda há limite de delta para evitar salto elástico;
 * - o zoom real mantém microvariações;
 * - a entrada em zoom muito alto fica controlada para não travar o layout.
 */
export function computeWheelZoom(input: ComputeWheelZoomInput): number {
  const currentZoom = clampKnexPdfZoom(input.currentZoom);

  const normalizedDelta = normalizeWheelDeltaToPixels({
    deltaY: input.deltaY,
    deltaMode: input.deltaMode,
  });

  const directionMultiplier = input.invertDirection ? 1 : -1;
  const preliminarySignedDelta = normalizedDelta * directionMultiplier;

  const profile = getWheelZoomFluidityProfile({
    currentZoom,
    signedDelta: preliminarySignedDelta,
    sensitivity: input.sensitivity,
    maxDeltaPixelsPerEvent: input.maxDeltaPixelsPerEvent,
    minZoomFactorPerEvent: input.minZoomFactorPerEvent,
    maxZoomFactorPerEvent: input.maxZoomFactorPerEvent,
  });

  const limitedDelta = limitWheelDeltaForContinuousZoom({
    deltaPixels: normalizedDelta,
    maxDeltaPixelsPerEvent: profile.maxDeltaPixelsPerEvent,
  });

  const signedDelta = limitedDelta * directionMultiplier;

  /*
   * Trava curta para evitar trabalho inútil no limite.
   *
   * signedDelta > 0 = zoom-in.
   * signedDelta < 0 = zoom-out.
   */
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
  const minPercent = zoomToPercent(KNEX_PDF_MIN_ZOOM);
  const maxPercent = zoomToPercent(KNEX_PDF_MAX_ZOOM);

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
  return clampKnexPdfZoom(zoom) <= KNEX_PDF_MIN_ZOOM + ZOOM_CHANGE_EPSILON;
}

export function isZoomAtMaximum(zoom: number): boolean {
  return clampKnexPdfZoom(zoom) >= KNEX_PDF_MAX_ZOOM - ZOOM_CHANGE_EPSILON;
}

function modeFromReason(reason: KnexPdfZoomReason): KnexPdfZoomMode {
  if (reason === "fit-width") return "fitWidth";
  if (reason === "fit-page") return "fitPage";
  if (reason === "actual-size") return "actualSize";
  return "custom";
}

/**
 * Classe opcional para organizar o uso no viewer.
 *
 * Mantém compatibilidade com o uso antigo:
 * - wheelZoom continua atualizando o estado imediatamente;
 * - setZoom continua confirmando o zoom;
 * - não exige que o Shell já tenha implementado previewZoom/committedZoom.
 */
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
 * 1. O componente captura o anchor ANTES do zoom.
 * 2. O ZoomController calcula o novo zoom real com microvariação preservada.
 * 3. O layout aplica change.nextZoom imediatamente.
 * 4. O ScrollCoordinator restaura a âncora.
 * 5. O render pesado só deve estabilizar depois do gesto.
 */
