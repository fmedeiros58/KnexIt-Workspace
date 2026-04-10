/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: complexity-fusion-engine
 * Responsibility: Fuse existing heuristic complexity signals with structured motor complexity analysis.
 * Primary Inputs: Heuristic complexity score, motor complexity band, confidence and ambiguity.
 * Primary Outputs: Consolidated complexity score and band.
 * Upstream Dependencies: llm-routing/routing-analysis-types, motor-routing-analysis
 * Downstream Dependencies: motor-analysis-fusion, orchestration-layer
 * Invariants: Heuristics and motor both contribute; neither source is absolute.
 * Failure Modes: Weak or missing motor analysis degrades to heuristic complexity.
 * Audit Events: complexity_fusion_completed
 * Notes: This preserves the hybrid orchestration model mandated by ANM.
 */
import type { MotorComplexityBand, MotorRoutingAnalysis } from "../bridges/contracts/motor-routing-analysis";
import type { HeuristicRoutingSnapshot } from "./llm-routing/routing-analysis-types";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function bandToScore(band: MotorComplexityBand): number {
  switch (band) {
    case "very-low":
      return 0.1;
    case "low":
      return 0.28;
    case "medium":
      return 0.52;
    case "high":
      return 0.76;
    case "very-high":
      return 0.92;
  }
}

function scoreToBand(score: number): MotorComplexityBand {
  if (score >= 0.88) return "very-high";
  if (score >= 0.68) return "high";
  if (score >= 0.42) return "medium";
  if (score >= 0.18) return "low";
  return "very-low";
}

export interface ComplexityFusionResult {
  score: number;
  band: MotorComplexityBand;
  confidence: number;
  dominantSignals: string[];
}

export function complexityFusionEngine(
  heuristic: HeuristicRoutingSnapshot,
  motor: MotorRoutingAnalysis,
): ComplexityFusionResult {
  const heuristicScore = clamp01(heuristic.complexityScore);
  const motorScore = bandToScore(motor.complexityBand);
  const motorInfluence = motor.source === "heuristic-fallback"
    ? 0
    : Math.max(0.12, Math.min(0.42, motor.complexityConfidence * 0.42));
  const heuristicInfluence = 1 - motorInfluence;
  const ambiguityLift = heuristic.ambiguityScore >= 0.5 || motor.ambiguityScore >= 0.5 ? 0.04 : 0;
  const score = clamp01(
    (heuristicScore * heuristicInfluence) +
    (motorScore * motorInfluence) +
    ambiguityLift,
  );

  return {
    score,
    band: scoreToBand(score),
    confidence: Number(clamp01((0.58 * heuristicInfluence) + (motor.complexityConfidence * motorInfluence)).toFixed(4)),
    dominantSignals: [
      motorInfluence > 0.2 ? "motor_complexity_weighted" : "heuristic_complexity_dominant",
      ambiguityLift > 0 ? "ambiguity_lift_applied" : "no_ambiguity_lift",
    ],
  };
}
