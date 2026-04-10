/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: orchestrator-audit-recorder
 * Responsibility: Append typed orchestrator audit records to ProcessingState.
 * Primary Inputs: ProcessingState and OrchestratorAuditRecord.
 * Primary Outputs: Mutated ProcessingState with appended orchestrator audit trail.
 * Upstream Dependencies: bridges/contracts/processing-state, bridges/contracts/orchestrator-audit-record
 * Downstream Dependencies: orchestration-layer, observability, architectural-audit collectors
 * Invariants: Audit records are append-only and do not alter routing decisions after the fact.
 * Failure Modes: None
 * Audit Events: orchestrator_audit_recorded
 * Notes: This recorder is intentionally lightweight and state-native.
 */
import type { OrchestratorAuditRecord } from "../bridges/contracts/orchestrator-audit-record";
import type { ProcessingState } from "../bridges/contracts/processing-state";

export function recordOrchestratorAudit(
  state: ProcessingState,
  record: OrchestratorAuditRecord,
): void {
  state.orchestratorAuditTrail = [...state.orchestratorAuditTrail, record].slice(-24);
}
