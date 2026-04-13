/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: adaptive-intent-fusion
 * Responsibility: Fuse heuristic and motor intent signals without letting either source dominate blindly.
 * Primary Inputs: Heuristic snapshot and structured motor routing analysis.
 * Primary Outputs: Consolidated primary and secondary intents plus dominant signal labels.
 * Upstream Dependencies: llm-routing/routing-analysis-types, motor-routing-analysis
 * Downstream Dependencies: motor-analysis-fusion
 * Invariants: High-confidence motor intent may refine heuristics, but fallback heuristics remain authoritative when motor confidence is weak.
 * Failure Modes: Unknown intents degrade to heuristic primary intent.
 * Audit Events: intent_fusion_completed
 * Notes: The fusion preserves the hybrid orchestration model required by ANM.
 */
import type { MotorRoutingAnalysis } from "../bridges/contracts/motor-routing-analysis";
import type { HeuristicRoutingSnapshot } from "./llm-routing/routing-analysis-types";

export interface AdaptiveIntentFusionResult {
  primaryIntent: string;
  secondaryIntents: string[];
  dominantSignals: string[];
}

export function adaptiveIntentFusion(
  heuristic: HeuristicRoutingSnapshot,
  motor: MotorRoutingAnalysis,
): AdaptiveIntentFusionResult {
  const useMotorPrimary =
    motor.source !== "heuristic-fallback" &&
    motor.complexityConfidence >= 0.62 &&
    motor.primaryIntent !== "unknown";

  const primaryIntent = useMotorPrimary ? motor.primaryIntent : heuristic.primaryIntent;
  const secondaryIntents = [
    ...new Set([
      ...heuristic.secondaryIntents,
      ...motor.secondaryIntents,
    ].filter(Boolean)),
  ];

  const dominantSignals = [
    useMotorPrimary ? "motor_primary_intent" : "heuristic_primary_intent",
    secondaryIntents.length ? "secondary_intents_present" : "single_intent_path",
  ];

  return {
    primaryIntent,
    secondaryIntents,
    dominantSignals,
  };
}
