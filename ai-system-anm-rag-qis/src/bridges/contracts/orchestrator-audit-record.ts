/**
 * ANM ARCHITECTURAL SPEC
 * Layer: bridges/contracts
 * Module: orchestrator-audit-record
 * Responsibility: Define structured audit records produced by the adaptive orchestrator.
 * Primary Inputs: Heuristic scores, motor routing analysis, profile selection, layer activation.
 * Primary Outputs: OrchestratorAuditRecord.
 * Upstream Dependencies: none
 * Downstream Dependencies: orchestration-layer, observability, architectural-audit
 * Invariants: Records are typed, serializable and append-only.
 * Failure Modes: Missing details must degrade to compact summaries instead of breaking execution.
 * Audit Events: heuristic_scan, motor_routing, fusion_completed, profiles_selected, contract_built
 * Notes: This is not verbose logging; it is typed evidence of orchestration decisions.
 */
export type OrchestratorAuditStage =
  | "heuristic-scan"
  | "task-nature"
  | "motor-routing"
  | "fusion"
  | "profile-selection"
  | "layer-activation"
  | "adaptive-contract";

export interface OrchestratorAuditRecord {
  stage: OrchestratorAuditStage;
  at: string;
  summary: string;
  usedMotor: boolean;
  fallbackUsed: boolean;
  cacheHit: boolean;
  details: Record<string, unknown>;
}
