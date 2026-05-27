"use client";

export type PdfInteractionKind = "scroll" | "zoom";
export type PdfInteractionState = "idle" | "scrolling" | "zooming";

export type PdfInteractionSnapshot = {
  state: PdfInteractionState;
  scrolling: boolean;
  zooming: boolean;
  active: boolean;
  idleGeneration: number;
  activeGeneration: number;
  lastKind: PdfInteractionKind | null;
  lastStartedAt: number;
  lastEventAt: number;
  lastIdleAt: number;
};

export type PdfInteractionIdleListener = (
  snapshot: PdfInteractionSnapshot,
) => void;

export type PdfInteractionIdleSubscribeOptions = {
  /**
   * Quando true, chama o listener também se a interação já estiver idle.
   * Use com cuidado no PdfPageCanvas para evitar loop de render.
   */
  notifyIfAlreadyIdle?: boolean;

  /**
   * Quando true, remove o listener após a primeira notificação.
   */
  once?: boolean;
};

type PdfInteractionTimer = ReturnType<typeof globalThis.setTimeout>;

const MIN_SETTLE_MS = 80;
const MAX_SETTLE_MS = 1500;

const state = {
  scrolling: false,
  zooming: false,
};

const timers: Record<PdfInteractionKind, PdfInteractionTimer | null> = {
  scroll: null,
  zoom: null,
};

const idleListeners = new Map<
  PdfInteractionIdleListener,
  PdfInteractionIdleSubscribeOptions
>();

let idleNotificationScheduled = false;
let idleGeneration = 0;
let activeGeneration = 0;
let lastKind: PdfInteractionKind | null = null;
let lastStartedAt = 0;
let lastEventAt = 0;
let lastIdleAt = 0;

function nowMs(): number {
  return typeof globalThis.performance !== "undefined" &&
    typeof globalThis.performance.now === "function"
    ? globalThis.performance.now()
    : Date.now();
}

function normalizeSettleMs(settleMs: number): number {
  if (!Number.isFinite(settleMs)) return 280;

  return Math.max(MIN_SETTLE_MS, Math.min(MAX_SETTLE_MS, Math.round(settleMs)));
}

function requestNextFrame(callback: () => void) {
  if (
    typeof globalThis.requestAnimationFrame === "function"
  ) {
    globalThis.requestAnimationFrame(callback);
    return;
  }

  globalThis.setTimeout(callback, 0);
}

function createSnapshot(): PdfInteractionSnapshot {
  const active = isKnexPdfRenderInteractionActive();

  return {
    state: getKnexPdfRenderInteractionState(),
    scrolling: state.scrolling,
    zooming: state.zooming,
    active,
    idleGeneration,
    activeGeneration,
    lastKind,
    lastStartedAt,
    lastEventAt,
    lastIdleAt,
  };
}

function emitIdleToListener(
  listener: PdfInteractionIdleListener,
  snapshot: PdfInteractionSnapshot,
) {
  const options = idleListeners.get(listener);

  if (options?.once) {
    idleListeners.delete(listener);
  }

  try {
    listener(snapshot);
  } catch (error) {
    /**
     * Não deixar um listener quebrar os demais.
     */
    if (
      typeof process !== "undefined" &&
      process.env.NODE_ENV !== "production"
    ) {
      // eslint-disable-next-line no-console
      console.error("[KnexPDF] idle listener failed", error);
    }
  }
}

function scheduleIdleNotification() {
  if (isKnexPdfRenderInteractionActive()) return;
  if (idleNotificationScheduled) return;

  idleNotificationScheduled = true;

  requestNextFrame(() => {
    idleNotificationScheduled = false;

    if (isKnexPdfRenderInteractionActive()) return;

    idleGeneration += 1;
    lastIdleAt = nowMs();

    const snapshot = createSnapshot();
    const listeners = [...idleListeners.keys()];

    for (const listener of listeners) {
      if (!idleListeners.has(listener)) continue;
      emitIdleToListener(listener, snapshot);
    }
  });
}

function clearTimer(kind: PdfInteractionKind) {
  const existingTimer = timers[kind];

  if (existingTimer !== null) {
    globalThis.clearTimeout(existingTimer);
    timers[kind] = null;
  }
}

export function beginKnexPdfRenderInteraction(
  kind: PdfInteractionKind,
  settleMs: number,
) {
  const wasIdle = !isKnexPdfRenderInteractionActive();
  const normalizedSettleMs = normalizeSettleMs(settleMs);
  const now = nowMs();

  if (wasIdle) {
    activeGeneration += 1;
    lastStartedAt = now;
  }

  lastKind = kind;
  lastEventAt = now;

  if (kind === "scroll") {
    state.scrolling = true;
  } else {
    state.zooming = true;
  }

  clearTimer(kind);

  timers[kind] = globalThis.setTimeout(() => {
    timers[kind] = null;

    if (kind === "scroll") {
      state.scrolling = false;
    } else {
      state.zooming = false;
    }

    scheduleIdleNotification();
  }, normalizedSettleMs);
}

export function clearKnexPdfRenderInteraction(kind?: PdfInteractionKind) {
  const kinds: PdfInteractionKind[] = kind ? [kind] : ["scroll", "zoom"];

  for (const item of kinds) {
    clearTimer(item);

    if (item === "scroll") {
      state.scrolling = false;
    } else {
      state.zooming = false;
    }
  }

  scheduleIdleNotification();
}

export function isKnexPdfRenderInteractionActive(): boolean {
  return state.scrolling || state.zooming;
}

export function getKnexPdfRenderInteractionState(): PdfInteractionState {
  if (state.zooming) return "zooming";
  if (state.scrolling) return "scrolling";
  return "idle";
}

export function getKnexPdfRenderInteractionSnapshot(): PdfInteractionSnapshot {
  return createSnapshot();
}

export function getKnexPdfRenderInteractionIdleGeneration(): number {
  return idleGeneration;
}

export function getKnexPdfRenderInteractionActiveGeneration(): number {
  return activeGeneration;
}

export function subscribeKnexPdfRenderInteractionIdle(
  listener: PdfInteractionIdleListener,
  options: PdfInteractionIdleSubscribeOptions = {},
) {
  idleListeners.set(listener, options);

  if (options.notifyIfAlreadyIdle && !isKnexPdfRenderInteractionActive()) {
    requestNextFrame(() => {
      if (!idleListeners.has(listener)) return;
      if (isKnexPdfRenderInteractionActive()) return;

      emitIdleToListener(listener, createSnapshot());
    });
  }

  return () => {
    idleListeners.delete(listener);
  };
}

/**
 * Força uma notificação de idle caso o estado atual já esteja idle.
 * Útil quando o Shell muda renderPhase para settled-final e precisa destravar
 * renders que ficaram aguardando estabilização.
 */
export function flushKnexPdfRenderInteractionIdle() {
  scheduleIdleNotification();
}