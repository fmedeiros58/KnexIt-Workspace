/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: llm-routing/motor-routing-fallback
 * Responsibility: Produce heuristic fallback routing analysis when the short motor call fails or returns invalid data.
 * Primary Inputs: HeuristicRoutingSnapshot and failure metadata.
 * Primary Outputs: MotorRoutingAnalysis fallback objects.
 * Upstream Dependencies: bridges/contracts/motor-routing-analysis, routing-analysis-types
 * Downstream Dependencies: motor-routing-client, fusion
 * Invariants: Fallback remains deterministic and never blocks the pipeline.
 * Failure Modes: Unknown intent/domain values degrade to conservative defaults.
 * Audit Events: motor_routing_fallback_generated
 * Notes: The fallback preserves the hybrid model by keeping the heuristics authoritative when the motor is unavailable.
 */
import type { MotorComplexityBand, MotorRoutingAnalysis } from "../../bridges/contracts/motor-routing-analysis";
import type { HeuristicRoutingSnapshot } from "./routing-analysis-types";

function toComplexityBand(score: number): MotorComplexityBand {
  if (score >= 0.88) return "very-high";
  if (score >= 0.68) return "high";
  if (score >= 0.42) return "medium";
  if (score >= 0.18) return "low";
  return "very-low";
}

export interface MotorRoutingFallbackInput {
  snapshot: HeuristicRoutingSnapshot;
  reason: string;
  timeoutMs: number;
}

export function createMotorRoutingFallback(input: MotorRoutingFallbackInput): MotorRoutingAnalysis {
  const { snapshot, reason, timeoutMs } = input;

  return {
    source: "heuristic-fallback",
    primaryIntent: snapshot.primaryIntent || "chat",
    secondaryIntents: snapshot.secondaryIntents,
    complexityBand: toComplexityBand(snapshot.complexityScore),
    complexityConfidence: 0.48,
    ambiguityScore: snapshot.ambiguityScore,
    taskType: snapshot.primaryIntent || "general_request",
    domainProfile: {
      primary: snapshot.domain || "general",
      secondary: [...snapshot.semanticModes],
    },
    topicShift: snapshot.topicShift,
    memoryNeed: snapshot.needsMemoryReinforcement ? "heavy" : "light",
    retrievalNeed: snapshot.needsRetrieval ? (snapshot.needsWebSearch ? "heavy" : "standard") : "light",
    validationNeed: snapshot.validationNeed,
    reflectionNeed: snapshot.reflectionNeed,
    responseStyle: snapshot.responseStyle,
    expectedOutputShape: snapshot.expectedOutputShape,
    recommendedProfiles: [],
    profileWeights: {},
    riskLevel: snapshot.riskLevel,
    needsClarification: snapshot.needsClarification,
    proactivityTolerance: snapshot.proactivityTolerance,
    estimatedBudgetClass: snapshot.estimatedBudgetClass,
    schemaValid: false,
    normalized: false,
    fallbackUsed: true,
    cacheHit: false,
    timeoutMs,
    errors: [reason],
  };
}
