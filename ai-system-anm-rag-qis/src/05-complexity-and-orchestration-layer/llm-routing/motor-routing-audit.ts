/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: llm-routing/motor-routing-audit
 * Responsibility: Convert motor routing analysis into compact, typed audit records.
 * Primary Inputs: MotorRoutingAnalysis
 * Primary Outputs: Serializable audit details and summaries.
 * Upstream Dependencies: bridges/contracts/motor-routing-analysis, bridges/contracts/orchestrator-audit-record
 * Downstream Dependencies: orchestrator-audit-recorder, observability
 * Invariants: Audit output is structured and compact.
 * Failure Modes: Missing details degrade to conservative summaries.
 * Audit Events: motor_routing_audited
 * Notes: This module intentionally avoids log strings as the primary output.
 */
import type { MotorRoutingAnalysis } from "../../bridges/contracts/motor-routing-analysis";
import type { OrchestratorAuditRecord } from "../../bridges/contracts/orchestrator-audit-record";

export function summarizeMotorRoutingAnalysis(analysis: MotorRoutingAnalysis): string {
  return [
    `source=${analysis.source}`,
    `intent=${analysis.primaryIntent}`,
    `complexity=${analysis.complexityBand}`,
    `ambiguity=${analysis.ambiguityScore.toFixed(2)}`,
    `profiles=${analysis.recommendedProfiles.join("|") || "none"}`,
    `fallback=${analysis.fallbackUsed ? "true" : "false"}`,
  ].join("; ");
}

export function buildMotorRoutingAuditRecord(analysis: MotorRoutingAnalysis): OrchestratorAuditRecord {
  return {
    stage: "motor-routing",
    at: new Date().toISOString(),
    summary: summarizeMotorRoutingAnalysis(analysis),
    usedMotor: analysis.source !== "heuristic-fallback",
    fallbackUsed: analysis.fallbackUsed,
    cacheHit: analysis.cacheHit,
    details: {
      primaryIntent: analysis.primaryIntent,
      secondaryIntents: analysis.secondaryIntents,
      complexityBand: analysis.complexityBand,
      complexityConfidence: analysis.complexityConfidence,
      ambiguityScore: analysis.ambiguityScore,
      taskType: analysis.taskType,
      domainProfile: analysis.domainProfile,
      retrievalNeed: analysis.retrievalNeed,
      reflectionNeed: analysis.reflectionNeed,
      validationNeed: analysis.validationNeed,
      recommendedProfiles: analysis.recommendedProfiles,
      profileWeights: analysis.profileWeights,
      riskLevel: analysis.riskLevel,
      needsClarification: analysis.needsClarification,
      errors: analysis.errors,
    },
  };
}
