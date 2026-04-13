/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 10-reflective-layer
 * Module: operators/first-pass-critique
 * Responsibility: Produce a lightweight first-pass critique from local reflective signals.
 * Primary Inputs: ProcessingState and layer mode.
 * Primary Outputs: Critique notes.
 * Upstream Dependencies: bridges/contracts/processing-state, bridges/contracts/layer-mode
 * Downstream Dependencies: reflective-layer
 * Invariants: Critique is local and non-destructive.
 * Failure Modes: Sparse inputs degrade to a generic caution note.
 * Audit Events: first_pass_critique_generated
 * Notes: Useful as a low-cost critique seed before heavier reflection.
 */
import type { LayerMode } from "../../bridges/contracts/layer-mode";
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function firstPassCritique(state: ProcessingState, mode: LayerMode): string[] {
  const notes = [...state.criticalCaveats];
  if (!notes.length && (mode === "heavy" || state.deliberativeTaskState.isActive)) {
    notes.push("check hidden assumptions and unsupported transitions");
  }
  return notes.slice(0, mode === "heavy" ? 6 : 3);
}
