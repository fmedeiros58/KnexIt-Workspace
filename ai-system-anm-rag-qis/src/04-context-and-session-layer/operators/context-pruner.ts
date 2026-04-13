/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 04-context-and-session-layer
 * Module: operators/context-pruner
 * Responsibility: Prune active context according to layer mode.
 * Primary Inputs: ProcessingState and layer mode.
 * Primary Outputs: Pruned context array.
 * Upstream Dependencies: bridges/contracts/processing-state, bridges/contracts/layer-mode
 * Downstream Dependencies: context-layer
 * Invariants: Pruning is local and preserves ordering.
 * Failure Modes: Empty context degrades to empty output.
 * Audit Events: context_pruned
 * Notes: Used to prevent context bloat in lighter operating modes.
 */
import type { LayerMode } from "../../bridges/contracts/layer-mode";
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function contextPruner(state: ProcessingState, mode: LayerMode): string[] {
  const limit = mode === "memory-heavy" || mode === "heavy" ? 24 : mode === "light" ? 8 : 14;
  return state.activeContext.slice(-limit);
}
