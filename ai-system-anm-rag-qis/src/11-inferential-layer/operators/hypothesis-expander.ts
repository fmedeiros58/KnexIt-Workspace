/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 11-inferential-layer
 * Module: operators/hypothesis-expander
 * Responsibility: Expand local hypotheses into inference candidates.
 * Primary Inputs: ProcessingState and layer mode.
 * Primary Outputs: Expanded hypothesis strings.
 * Upstream Dependencies: bridges/contracts/processing-state, bridges/contracts/layer-mode
 * Downstream Dependencies: inferential-layer
 * Invariants: Expansion remains local and derived from existing hypotheses.
 * Failure Modes: Sparse hypothesis sets degrade to collapsed truth summary.
 * Audit Events: hypotheses_expanded
 * Notes: Avoids centralizing inferential expansion in orchestration.
 */
import type { LayerMode } from "../../bridges/contracts/layer-mode";
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function hypothesisExpander(state: ProcessingState, mode: LayerMode): string[] {
  const hypotheses = state.hypothesisSet.length
    ? state.hypothesisSet.map((item) => item.claim)
    : state.collapsedTruth.summary
      ? [state.collapsedTruth.summary]
      : [];
  return hypotheses.slice(0, mode === "heavy" ? 6 : 3);
}
