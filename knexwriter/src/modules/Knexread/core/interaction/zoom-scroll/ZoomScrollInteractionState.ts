import type {
  ZoomScrollInteractionPhase,
  ZoomScrollInteractionSnapshot,
} from "./ZoomScrollTypes";
import { ZOOM_SCROLL_INTERACTION_SETTLE_MS } from "./ZoomScrollConstants";

/**
 * ZoomScrollInteractionState.ts
 * -----------------------------------------------------------------------------
 * Responsabilidade única:
 * controlar estado leve da interação.
 *
 * Este módulo ajuda PageView/Tiles/Observers a saberem:
 * - o usuário está rolando?
 * - o usuário está zoomando?
 * - ainda estamos em settle?
 *
 * Importante:
 * este arquivo não deve disparar render pesado por conta própria.
 */

function getNowMs(input?: number): number {
  if (typeof input === "number" && Number.isFinite(input)) return input;

  return typeof performance !== "undefined" &&
    typeof performance.now === "function"
    ? performance.now()
    : Date.now();
}

export function createIdleZoomScrollInteractionState(): ZoomScrollInteractionSnapshot {
  return {
    phase: "idle",
    isWheelActive: false,
    isZooming: false,
    isScrolling: false,
    lastWheelAtMs: 0,
    lastZoomAtMs: 0,
    lastScrollAtMs: 0,
    settleDeadlineMs: 0,
  };
}

export function markZoomScrollInteraction(input: {
  state: ZoomScrollInteractionSnapshot;
  phase: Extract<ZoomScrollInteractionPhase, "zooming" | "scrolling">;
  nowMs?: number;
  settleMs?: number;
}): ZoomScrollInteractionSnapshot {
  const now = getNowMs(input.nowMs);
  const settleMs = Math.max(
    0,
    input.settleMs ?? ZOOM_SCROLL_INTERACTION_SETTLE_MS,
  );

  return {
    phase: input.phase,
    isWheelActive: true,
    isZooming: input.phase === "zooming",
    isScrolling: input.phase === "scrolling",
    lastWheelAtMs: now,
    lastZoomAtMs:
      input.phase === "zooming" ? now : input.state.lastZoomAtMs,
    lastScrollAtMs:
      input.phase === "scrolling" ? now : input.state.lastScrollAtMs,
    settleDeadlineMs: now + settleMs,
  };
}

export function resolveZoomScrollInteractionState(input: {
  state: ZoomScrollInteractionSnapshot;
  nowMs?: number;
}): ZoomScrollInteractionSnapshot {
  const now = getNowMs(input.nowMs);

  if (input.state.phase === "idle") {
    return input.state;
  }

  if (now <= input.state.settleDeadlineMs) {
    return input.state;
  }

  return {
    ...input.state,
    phase: "idle",
    isWheelActive: false,
    isZooming: false,
    isScrolling: false,
  };
}
