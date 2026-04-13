/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 07-knowledge-retrieval-and-research-layer
 * Module: operators/contradiction-detector
 * Responsibility: Detect lightweight contradiction signals across retrieved evidence.
 * Primary Inputs: ProcessingState and layer mode.
 * Primary Outputs: Contradiction flags.
 * Upstream Dependencies: bridges/contracts/processing-state, bridges/contracts/layer-mode
 * Downstream Dependencies: knowledge-layer, validation, epistemic-integration
 * Invariants: Detection is heuristic and local.
 * Failure Modes: Sparse evidence degrades to no contradiction.
 * Audit Events: contradiction_signal_detected
 * Notes: This is a local pre-filter, not the final epistemic verdict.
 */
import type { LayerMode } from "../../bridges/contracts/layer-mode";
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function contradictionDetector(state: ProcessingState, mode: LayerMode) {
  const evidence = state.retrievedEvidence.slice(0, mode === "heavy" ? 12 : 6).map((item) => item.toLowerCase());
  const contradictionDetected = evidence.some((item) => /\b(no entanto|however|contradiz|conflict|inconsisten)\b/.test(item));
  return {
    contradictionDetected,
    signals: contradictionDetected ? ["lexical_contradiction_signal"] : [],
  };
}
