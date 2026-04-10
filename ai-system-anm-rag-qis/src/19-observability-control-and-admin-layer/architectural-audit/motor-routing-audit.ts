/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 19-observability-control-and-admin-layer
 * Module: architectural-audit/motor-routing-audit
 * Responsibility: Summarize the initial motor routing stage for observability.
 * Primary Inputs: ProcessingState
 * Primary Outputs: Serializable motor routing summary
 * Upstream Dependencies: bridges/contracts/processing-state
 * Downstream Dependencies: observability-layer
 * Invariants: Read-only summary over structured motor analysis.
 * Failure Modes: Missing analysis returns null.
 * Audit Events: motor_routing_stage_audited
 * Notes: Makes the initial short motor call visible without mixing it with final generation runtime.
 */
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function buildMotorRoutingStageAudit(state: ProcessingState) {
  if (!state.motorRoutingAnalysis) return null;
  return {
    source: state.motorRoutingAnalysis.source,
    primaryIntent: state.motorRoutingAnalysis.primaryIntent,
    complexityBand: state.motorRoutingAnalysis.complexityBand,
    fallbackUsed: state.motorRoutingAnalysis.fallbackUsed,
    cacheHit: state.motorRoutingAnalysis.cacheHit,
    errors: state.motorRoutingAnalysis.errors,
  };
}
