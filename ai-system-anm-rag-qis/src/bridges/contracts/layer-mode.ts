/**
 * ANM ARCHITECTURAL SPEC
 * Layer: bridges/contracts
 * Module: layer-mode
 * Responsibility: Define canonical layer execution modes used by the adaptive orchestrator.
 * Primary Inputs: Profile composition decisions and adaptive activation rules.
 * Primary Outputs: Stable LayerMode values and resolution helpers.
 * Upstream Dependencies: shared/enums/pipeline-enums
 * Downstream Dependencies: activation-policy, orchestration-layer, operators
 * Invariants: Modes are declarative; modes never bypass the descending pipeline by jump routing.
 * Failure Modes: Unknown modes must fall back to "medium".
 * Audit Events: layer_mode_resolved, layer_mode_fallback
 * Notes: The mode controls intensity or no-op behavior inside the descending tree, not route jumping.
 */
export const LAYER_MODES = [
  "required",
  "light",
  "medium",
  "heavy",
  "noop-intelligent",
  "structural-only",
  "epistemic-heavy",
  "memory-heavy",
  "retrieval-heavy",
  "delivery-light",
  "delivery-rich",
] as const;

export type LayerMode = typeof LAYER_MODES[number];

export const LAYER_MODE_PRIORITY: Record<LayerMode, number> = {
  "noop-intelligent": 0,
  "light": 1,
  "structural-only": 2,
  "medium": 3,
  "delivery-light": 4,
  "required": 5,
  "heavy": 6,
  "memory-heavy": 7,
  "retrieval-heavy": 8,
  "epistemic-heavy": 9,
  "delivery-rich": 10,
};

export function isLayerMode(value: string): value is LayerMode {
  return (LAYER_MODES as readonly string[]).includes(value);
}

export function normalizeLayerMode(value: string | null | undefined): LayerMode {
  if (value && isLayerMode(value)) return value;
  return "medium";
}

export function pickDominantLayerMode(current: LayerMode, candidate: LayerMode): LayerMode {
  return LAYER_MODE_PRIORITY[candidate] > LAYER_MODE_PRIORITY[current] ? candidate : current;
}

export function isIntelligentNoopMode(mode: LayerMode): boolean {
  return mode === "noop-intelligent";
}
