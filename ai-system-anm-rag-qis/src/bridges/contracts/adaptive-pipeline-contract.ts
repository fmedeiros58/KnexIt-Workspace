/**
 * ANM ARCHITECTURAL SPEC
 * Layer: bridges/contracts
 * Module: adaptive-pipeline-contract
 * Responsibility: Define the canonical adaptive contract that modulates the descending pipeline after orchestration.
 * Primary Inputs: Fused heuristic + motor analysis, selected profiles, resolved layer activations.
 * Primary Outputs: AdaptivePipelineContract.
 * Upstream Dependencies: execution-profile, layer-activation, motor-routing-analysis, profile-selection-result
 * Downstream Dependencies: orchestration-layer, pipeline-flow-descending, downstream layers, observability
 * Invariants: The contract modulates the same descending tree; it never becomes a free-agent router.
 * Failure Modes: Missing contract falls back to route policy and existing orchestration heuristics.
 * Audit Events: adaptive_pipeline_contract_built, adaptive_pipeline_contract_fallback
 * Notes: This contract is the shared handoff from layer 05 to the remaining tree.
 */
import type { LayerActivationMap } from "./layer-activation";
import type { MotorRoutingAnalysis } from "./motor-routing-analysis";
import type { ProfileSelectionResult } from "./profile-selection-result";
import type { TaskContract } from "./task-contract";
import type { TaskNatureState } from "./task-nature-state";

export interface AdaptivePipelineContract {
  version: string;
  primaryIntent: string;
  secondaryIntents: string[];
  taskNatureState: TaskNatureState | null;
  taskContract: TaskContract | null;
  finalComplexityScore: number;
  finalComplexityBand: string;
  complexityConfidence: number;
  ambiguityScore: number;
  selectedProfiles: ProfileSelectionResult;
  layerActivations: LayerActivationMap;
  memoryPolicy: string;
  retrievalPolicy: string;
  reflectionPolicy: string;
  validationPolicy: string;
  responsePolicy: string;
  proactivityPolicy: string;
  humanizationPolicy: string;
  responseBudget: number;
  budgetClass: string;
  riskLevel: string;
  needsClarification: boolean;
  topicShift: boolean;
  expectedOutputShape: string[];
  fallbackEvidence: string[];
  decisionTrace: string[];
  motorRoutingAnalysis: MotorRoutingAnalysis;
}
