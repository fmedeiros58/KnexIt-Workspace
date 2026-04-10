/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 13-epistemic-integration-layer
 * Module: operators/conflict-consolidator
 * Responsibility: Consolidate conflict signals from epistemic and reflective state.
 * Primary Inputs: ProcessingState and layer mode.
 * Primary Outputs: Unique conflict strings.
 * Upstream Dependencies: bridges/contracts/processing-state, bridges/contracts/layer-mode
 * Downstream Dependencies: epistemic-integration-layer
 * Invariants: Consolidation is local and idempotent.
 * Failure Modes: Empty conflict lists degrade to an empty array.
 * Audit Events: conflicts_consolidated
 * Notes: This keeps conflict shaping within layer 13.
 */
import type { LayerMode } from "../../bridges/contracts/layer-mode";
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function conflictConsolidator(state: ProcessingState, mode: LayerMode): string[] {
  const conflicts = [
    ...state.epistemicIntegrationState.conflicts,
    ...state.reflectiveNotes.tensions,
    ...state.validationReport.factual.issues,
  ];
  return [...new Set(conflicts)].slice(0, mode === "heavy" ? 10 : 5);
}
