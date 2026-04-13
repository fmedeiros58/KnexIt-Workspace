/**
 * ANM ARCHITECTURAL SPEC
 * Layer: bridges/contracts
 * Module: motor-routing-analysis
 * Responsibility: Define the structured result of the initial short motor call used by orchestration.
 * Primary Inputs: Initial normalized request and orchestration prompt.
 * Primary Outputs: MotorRoutingAnalysis and DomainProfile.
 * Upstream Dependencies: none
 * Downstream Dependencies: llm-routing, fusion, adaptive contract builder
 * Invariants: This analysis never contains the final user answer.
 * Failure Modes: Invalid or timed-out payloads must degrade to heuristic fallback results.
 * Audit Events: motor_routing_used, motor_routing_timeout, motor_routing_schema_failure
 * Notes: The object is intentionally compact and serializable for caching and auditing.
 */
export type MotorComplexityBand = "very-low" | "low" | "medium" | "high" | "very-high";
export type MotorNeedLevel = "none" | "light" | "standard" | "heavy";
export type MotorRiskLevel = "low" | "medium" | "high";
export type MotorBudgetClass = "tight" | "standard" | "expanded";
export type MotorProactivityTolerance = "low" | "medium" | "high";

export interface MotorDomainProfile {
  primary: string;
  secondary: string[];
}

export interface MotorRoutingAnalysis {
  source: "motor" | "motor-normalized" | "heuristic-fallback";
  primaryIntent: string;
  secondaryIntents: string[];
  complexityBand: MotorComplexityBand;
  complexityConfidence: number;
  ambiguityScore: number;
  taskType: string;
  domainProfile: MotorDomainProfile;
  topicShift: boolean;
  memoryNeed: MotorNeedLevel;
  retrievalNeed: MotorNeedLevel;
  validationNeed: MotorNeedLevel;
  reflectionNeed: MotorNeedLevel;
  responseStyle: string;
  expectedOutputShape: string[];
  recommendedProfiles: string[];
  profileWeights: Record<string, number>;
  riskLevel: MotorRiskLevel;
  needsClarification: boolean;
  proactivityTolerance: MotorProactivityTolerance;
  estimatedBudgetClass: MotorBudgetClass;
  schemaValid: boolean;
  normalized: boolean;
  fallbackUsed: boolean;
  cacheHit: boolean;
  timeoutMs: number;
  errors: string[];
  rawText?: string;
}
