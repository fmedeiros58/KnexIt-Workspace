import type {
  WheelInputClassification,
  ZoomDirection,
  ZoomScrollDeltaMode,
  ZoomScrollWheelLikeEvent,
} from "./ZoomScrollTypes";
import {
  ZOOM_SCROLL_LINE_DELTA_PX,
  ZOOM_SCROLL_PAGE_DELTA_PX,
} from "./ZoomScrollConstants";

/**
 * WheelInputController.ts
 * -----------------------------------------------------------------------------
 * Responsabilidade única:
 * transformar um WheelEvent bruto em intenção de interação.
 *
 * Este arquivo NÃO decide velocidade de zoom.
 * Este arquivo NÃO aplica visualZoom.
 * Este arquivo NÃO mexe em scrollTop/scrollLeft.
 *
 * Ele apenas responde:
 * - isto é zoom?
 * - isto é scroll vertical?
 * - isto é scroll horizontal?
 * - qual delta normalizado em pixels?
 */

export type WheelInputControllerOptions = {
  /**
   * "ctrl-or-meta" é o comportamento recomendado para web:
   * - Windows/Linux: Ctrl + wheel;
   * - macOS: Meta/Cmd ou Ctrl, dependendo do dispositivo.
   */
  zoomModifierMode?: "ctrl" | "meta" | "ctrl-or-meta" | "always";

  /**
   * Se true, Shift + wheel vira scroll horizontal.
   */
  shiftWheelMeansHorizontalScroll?: boolean;
};

const DEFAULT_OPTIONS: Required<WheelInputControllerOptions> = {
  zoomModifierMode: "ctrl-or-meta",
  shiftWheelMeansHorizontalScroll: true,
};

function safeNumber(value: number | null | undefined, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value)
    ? value
    : fallback;
}

export function normalizeWheelDeltaToPixels(input: {
  delta: number;
  deltaMode?: ZoomScrollDeltaMode;
}): number {
  const delta = safeNumber(input.delta, 0);

  switch (input.deltaMode ?? 0) {
    case 1:
      return delta * ZOOM_SCROLL_LINE_DELTA_PX;
    case 2:
      return delta * ZOOM_SCROLL_PAGE_DELTA_PX;
    case 0:
    default:
      return delta;
  }
}

function getZoomModifier(input: {
  event: ZoomScrollWheelLikeEvent;
  mode: Required<WheelInputControllerOptions>["zoomModifierMode"];
}): "ctrl" | "meta" | "none" {
  if (input.mode === "always") {
    return "none";
  }

  if (input.mode === "ctrl") {
    return input.event.ctrlKey ? "ctrl" : "none";
  }

  if (input.mode === "meta") {
    return input.event.metaKey ? "meta" : "none";
  }

  if (input.event.ctrlKey) return "ctrl";
  if (input.event.metaKey) return "meta";

  return "none";
}

function getZoomDirection(deltaY: number): ZoomDirection {
  if (deltaY < 0) return "in";
  if (deltaY > 0) return "out";
  return "none";
}

export function classifyWheelInput(
  event: ZoomScrollWheelLikeEvent,
  options: WheelInputControllerOptions = {},
): WheelInputClassification {
  const resolved = {
    ...DEFAULT_OPTIONS,
    ...options,
  };

  const rawDeltaX = safeNumber(event.deltaX, 0);
  const rawDeltaY = safeNumber(event.deltaY, 0);
  const deltaMode = event.deltaMode ?? 0;

  const deltaX = normalizeWheelDeltaToPixels({
    delta: rawDeltaX,
    deltaMode,
  });
  const deltaY = normalizeWheelDeltaToPixels({
    delta: rawDeltaY,
    deltaMode,
  });

  const usedModifier = getZoomModifier({
    event,
    mode: resolved.zoomModifierMode,
  });

  const isZoom =
    resolved.zoomModifierMode === "always" || usedModifier !== "none";

  if (isZoom) {
    return {
      kind: "wheel-zoom",
      deltaX,
      deltaY,
      zoomDirection: getZoomDirection(deltaY),
      pointerClientX: event.clientX,
      pointerClientY: event.clientY,
      usedModifier,
      shouldPreventDefault: true,
      audit: {
        source: "WheelInputController",
        reason: "modifier-wheel-zoom",
        rawDeltaX,
        rawDeltaY,
        deltaMode,
      },
    };
  }

  if (resolved.shiftWheelMeansHorizontalScroll && event.shiftKey) {
    return {
      kind: "horizontal-scroll",
      deltaX: deltaX !== 0 ? deltaX : deltaY,
      deltaY: 0,
      zoomDirection: "none",
      pointerClientX: event.clientX,
      pointerClientY: event.clientY,
      usedModifier: "none",
      shouldPreventDefault: true,
      audit: {
        source: "WheelInputController",
        reason: "shift-wheel-horizontal-scroll",
        rawDeltaX,
        rawDeltaY,
        deltaMode,
      },
    };
  }

  return {
    kind: "vertical-scroll",
    deltaX,
    deltaY,
    zoomDirection: "none",
    pointerClientX: event.clientX,
    pointerClientY: event.clientY,
    usedModifier: "none",
    shouldPreventDefault: false,
    audit: {
      source: "WheelInputController",
      reason: "plain-wheel-scroll",
      rawDeltaX,
      rawDeltaY,
      deltaMode,
    },
  };
}
