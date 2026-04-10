/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 10-reflective-layer
 * Module: operators/alternative-interpretation-builder
 * Responsibility: Generate local alternative interpretations from existing state.
 * Primary Inputs: ProcessingState and layer mode.
 * Primary Outputs: Alternative interpretation strings.
 * Upstream Dependencies: bridges/contracts/processing-state, bridges/contracts/layer-mode
 * Downstream Dependencies: reflective-layer
 * Invariants: Alternatives are suggestion-only and stay within local reflective scope.
 * Failure Modes: Sparse state degrades to empty alternatives.
 * Audit Events: alternative_interpretations_built
 * Notes: This avoids pushing comparison logic back into orchestration.
 */
import type { LayerMode } from "../../bridges/contracts/layer-mode";
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function alternativeInterpretationBuilder(state: ProcessingState, mode: LayerMode): string[] {
  const alternatives: string[] = [];
  if (state.deliberativeTaskState.solutionModels.length > 1) {
    alternatives.push(...state.deliberativeTaskState.solutionModels.map((model) => model.title));
  }
  if (mode === "heavy" && state.reflectiveNotes.tensions.length) {
    alternatives.push(...state.reflectiveNotes.tensions.slice(0, 2));
  }
  return [...new Set(alternatives)].slice(0, 4);
}
