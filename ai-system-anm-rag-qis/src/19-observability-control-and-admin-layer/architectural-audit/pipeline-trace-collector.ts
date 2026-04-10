/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 19-observability-control-and-admin-layer
 * Module: architectural-audit/pipeline-trace-collector
 * Responsibility: Collect compact orchestrator and pipeline trace snapshots for observability.
 * Primary Inputs: ProcessingState
 * Primary Outputs: Serializable trace summary
 * Upstream Dependencies: bridges/contracts/processing-state
 * Downstream Dependencies: observability-layer
 * Invariants: Collection is read-only.
 * Failure Modes: Missing traces produce empty arrays.
 * Audit Events: pipeline_trace_collected
 * Notes: This is a structural collector, not a verbose logger.
 */
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export function collectPipelineTraceSnapshot(state: ProcessingState) {
  return {
    traceTail: state.trace.slice(-12),
    orchestratorAuditTail: state.orchestratorAuditTrail.slice(-8),
  };
}
