/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 07-knowledge-retrieval-and-research-layer
 * Module: operators/evidence-ranker
 * Responsibility: Rank retrieved sources locally for downstream grounding.
 * Primary Inputs: ProcessingState and layer mode.
 * Primary Outputs: Ranked RetrievedSource array.
 * Upstream Dependencies: bridges/contracts/processing-state, bridges/contracts/layer-mode
 * Downstream Dependencies: knowledge-layer, epistemic-integration
 * Invariants: Ranking is local and stable.
 * Failure Modes: Empty sources return empty output.
 * Audit Events: evidence_ranked
 * Notes: Freshness is used as a lightweight proxy until a richer provenance model is wired.
 */
import type { LayerMode } from "../../bridges/contracts/layer-mode";
import type { ProcessingState, RetrievedSource } from "../../bridges/contracts/processing-state";

export function evidenceRanker(state: ProcessingState, mode: LayerMode): RetrievedSource[] {
  const bonus = mode === "retrieval-heavy" ? 0.12 : 0;
  return [...state.retrievedSources].sort(
    (left, right) => (right.freshnessScore + bonus) - (left.freshnessScore + bonus),
  );
}
