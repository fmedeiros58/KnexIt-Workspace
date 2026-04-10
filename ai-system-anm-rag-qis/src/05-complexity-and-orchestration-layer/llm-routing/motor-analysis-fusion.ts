/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: llm-routing/motor-analysis-fusion
 * Responsibility: Build the final fused routing decision from heuristic signals and the short motor analysis.
 * Primary Inputs: HeuristicRoutingSnapshot and MotorRoutingAnalysis.
 * Primary Outputs: FusedRoutingDecision.
 * Upstream Dependencies: adaptive-intent-fusion, complexity-fusion-engine
 * Downstream Dependencies: profile-selector, activation-policy, adaptive contract builder, orchestration-layer
 * Invariants: The fused decision remains an orchestration artifact, not a final answer.
 * Failure Modes: Invalid motor analysis degrades to heuristic-fallback analysis.
 * Audit Events: motor_analysis_fused
 * Notes: This is the hybrid decision point that balances heuristics with the short motor read.
 */
import { adaptiveIntentFusion } from "../adaptive-intent-fusion";
import { complexityFusionEngine } from "../complexity-fusion-engine";
import type { MotorNeedLevel, MotorRoutingAnalysis } from "../../bridges/contracts/motor-routing-analysis";
import type { FusedRoutingDecision, HeuristicRoutingSnapshot } from "./routing-analysis-types";

function maxNeed(left: MotorNeedLevel, right: MotorNeedLevel): MotorNeedLevel {
  const rank: Record<MotorNeedLevel, number> = {
    none: 0,
    light: 1,
    standard: 2,
    heavy: 3,
  };
  return rank[right] > rank[left] ? right : left;
}

export function fuseMotorAnalysis(
  heuristic: HeuristicRoutingSnapshot,
  motor: MotorRoutingAnalysis,
): FusedRoutingDecision {
  const intentFusion = adaptiveIntentFusion(heuristic, motor);
  const complexityFusion = complexityFusionEngine(heuristic, motor);

  const recommendedProfiles = [
    ...new Set([
      ...motor.recommendedProfiles,
      ...(heuristic.hasGreetingSignal ? ["greeting-profile"] : []),
      ...(heuristic.needsRetrieval ? ["retrieval-augmented-profile"] : []),
      ...(heuristic.validationNeed === "heavy" ? ["high-caution-validation-profile"] : []),
    ]),
  ];

  const profileWeights = Object.keys(motor.profileWeights).length
    ? motor.profileWeights
    : Object.fromEntries(recommendedProfiles.map((profileId, index) => [profileId, Number((1 / (index + 1)).toFixed(4))]));

  return {
    primaryIntent: intentFusion.primaryIntent,
    secondaryIntents: intentFusion.secondaryIntents,
    finalComplexityScore: complexityFusion.score,
    finalComplexityBand: complexityFusion.band,
    complexityConfidence: complexityFusion.confidence,
    ambiguityScore: Number(Math.max(heuristic.ambiguityScore, motor.ambiguityScore).toFixed(4)),
    taskType: motor.taskType || heuristic.primaryIntent,
    domainProfile: motor.domainProfile,
    topicShift: heuristic.topicShift || motor.topicShift,
    memoryNeed: maxNeed(heuristic.needsMemoryReinforcement ? "standard" : "light", motor.memoryNeed),
    retrievalNeed: maxNeed(heuristic.needsRetrieval ? (heuristic.needsWebSearch ? "heavy" : "standard") : "light", motor.retrievalNeed),
    validationNeed: maxNeed(heuristic.validationNeed, motor.validationNeed),
    reflectionNeed: maxNeed(heuristic.reflectionNeed, motor.reflectionNeed),
    responseStyle: motor.responseStyle || heuristic.responseStyle,
    expectedOutputShape: motor.expectedOutputShape.length ? motor.expectedOutputShape : heuristic.expectedOutputShape,
    recommendedProfiles,
    profileWeights,
    riskLevel: motor.riskLevel === "high" || heuristic.riskLevel === "high"
      ? "high"
      : motor.riskLevel === "medium" || heuristic.riskLevel === "medium"
        ? "medium"
        : "low",
    needsClarification: heuristic.needsClarification || motor.needsClarification,
    proactivityTolerance: motor.proactivityTolerance,
    estimatedBudgetClass: motor.estimatedBudgetClass,
    selectedMode: heuristic.selectedMode,
    routeHint: heuristic.routeHint,
    usedMotor: motor.source !== "heuristic-fallback",
    fallbackUsed: motor.fallbackUsed,
    dominantSignals: [
      ...intentFusion.dominantSignals,
      ...complexityFusion.dominantSignals,
      motor.fallbackUsed ? "motor_fallback_used" : "motor_analysis_used",
    ],
    motorRoutingAnalysis: motor,
  };
}
