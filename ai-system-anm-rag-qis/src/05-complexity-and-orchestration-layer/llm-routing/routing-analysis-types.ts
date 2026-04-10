/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: llm-routing/routing-analysis-types
 * Responsibility: Define shared types for heuristic snapshots and fused routing decisions.
 * Primary Inputs: Orchestration heuristics and motor routing analysis.
 * Primary Outputs: HeuristicRoutingSnapshot and FusedRoutingDecision.
 * Upstream Dependencies: shared/enums, bridges/contracts/motor-routing-analysis
 * Downstream Dependencies: llm-routing, activation-policy, profile selection
 * Invariants: These types carry planning signals only and never final answer text.
 * Failure Modes: Missing fields must degrade to safe defaults in downstream normalizers.
 * Audit Events: heuristic_snapshot_built, fused_routing_decision_created
 * Notes: The fused decision is the orchestration-facing synthesis of heuristic and motor signals.
 */
import type { InteractionMode } from "../../shared/enums/mode-enums";
import type { PipelineRoute } from "../../shared/enums/pipeline-enums";
import type {
  MotorBudgetClass,
  MotorDomainProfile,
  MotorNeedLevel,
  MotorProactivityTolerance,
  MotorRiskLevel,
  MotorRoutingAnalysis,
} from "../../bridges/contracts/motor-routing-analysis";

export interface HeuristicRoutingSnapshot {
  normalizedMessage: string;
  primaryIntent: string;
  secondaryIntents: string[];
  complexityScore: number;
  ambiguityScore: number;
  selectedMode: InteractionMode;
  routeHint: PipelineRoute;
  domain: string;
  semanticModes: string[];
  hasGreetingSignal: boolean;
  hasVerifiableSignal: boolean;
  hasRecencySignal: boolean;
  needsRetrieval: boolean;
  needsWebSearch: boolean;
  needsMemoryReinforcement: boolean;
  needsClarification: boolean;
  topicShift: boolean;
  responseStyle: string;
  expectedOutputShape: string[];
  riskLevel: MotorRiskLevel;
  validationNeed: MotorNeedLevel;
  reflectionNeed: MotorNeedLevel;
  proactivityTolerance: MotorProactivityTolerance;
  estimatedBudgetClass: MotorBudgetClass;
}

export interface FusedRoutingDecision {
  primaryIntent: string;
  secondaryIntents: string[];
  finalComplexityScore: number;
  finalComplexityBand: string;
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
  selectedMode: InteractionMode;
  routeHint: PipelineRoute;
  usedMotor: boolean;
  fallbackUsed: boolean;
  dominantSignals: string[];
  motorRoutingAnalysis: MotorRoutingAnalysis;
}
