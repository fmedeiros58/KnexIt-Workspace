/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05b-deliberative-task-contract-layer
 * Module: adaptive-pipeline-contract-builder
 * Responsibility: Build the final adaptive pipeline contract consumed by the remaining descending tree.
 * Primary Inputs: Fused routing decision, selected profiles, resolved layer activations, current ProcessingState.
 * Primary Outputs: AdaptivePipelineContract.
 * Upstream Dependencies: bridges/contracts/adaptive-pipeline-contract, execution profiles, activation policy, deliberative-task state
 * Downstream Dependencies: orchestration-layer, pipeline-flow-descending, downstream layers
 * Invariants: The contract modulates the existing pipeline; it does not replace it.
 * Failure Modes: Missing profile or activation inputs degrade to conservative defaults.
 * Audit Events: adaptive_pipeline_contract_built
 * Notes: The builder lives in 05b because it must remain compatible with the deliberative task contract family.
 */
import type { AdaptivePipelineContract } from "../bridges/contracts/adaptive-pipeline-contract";
import type { LayerActivationMap } from "../bridges/contracts/layer-activation";
import type { ProfileSelectionResult } from "../bridges/contracts/profile-selection-result";
import type { ProcessingState } from "../bridges/contracts/processing-state";
import type { FusedRoutingDecision } from "../05-complexity-and-orchestration-layer/llm-routing/routing-analysis-types";
import { composeProfilePolicies } from "../05-complexity-and-orchestration-layer/activation-policy/profile-composition-rules";
import type { ExecutionProfile } from "../bridges/contracts/execution-profile";

export interface AdaptivePipelineContractBuilderInput {
  state: ProcessingState;
  fusedDecision: FusedRoutingDecision;
  selectedProfiles: ExecutionProfile[];
  profileSelection: ProfileSelectionResult;
  layerActivations: LayerActivationMap;
  responseBudget: number;
}

export function buildAdaptivePipelineContract(
  input: AdaptivePipelineContractBuilderInput,
): AdaptivePipelineContract {
  const { state, fusedDecision, selectedProfiles, profileSelection, layerActivations, responseBudget } = input;
  const policies = composeProfilePolicies(selectedProfiles);
  const fallbackEvidence = [
    ...(fusedDecision.fallbackUsed ? ["motor_fallback_used"] : []),
    ...fusedDecision.motorRoutingAnalysis.errors,
  ];

  return {
    version: "05b.adaptive-pipeline-contract.v1",
    primaryIntent: fusedDecision.primaryIntent,
    secondaryIntents: fusedDecision.secondaryIntents,
    finalComplexityScore: fusedDecision.finalComplexityScore,
    finalComplexityBand: fusedDecision.finalComplexityBand,
    complexityConfidence: fusedDecision.complexityConfidence,
    ambiguityScore: fusedDecision.ambiguityScore,
    selectedProfiles: profileSelection,
    layerActivations,
    memoryPolicy: policies.memoryPolicy,
    retrievalPolicy: policies.retrievalPolicy,
    reflectionPolicy: policies.reflectionPolicy,
    validationPolicy: policies.validationPolicy,
    responsePolicy: policies.responsePolicy,
    proactivityPolicy: policies.proactivityPolicy,
    humanizationPolicy: policies.humanizationPolicy,
    responseBudget,
    budgetClass: fusedDecision.estimatedBudgetClass,
    riskLevel: fusedDecision.riskLevel,
    needsClarification: fusedDecision.needsClarification,
    topicShift: fusedDecision.topicShift,
    expectedOutputShape: fusedDecision.expectedOutputShape,
    fallbackEvidence,
    decisionTrace: [
      ...fusedDecision.dominantSignals,
      `route_hint:${fusedDecision.routeHint}`,
      `selected_mode:${fusedDecision.selectedMode}`,
      `deliberative_active:${state.deliberativeTaskState.isActive ? "true" : "false"}`,
      `profile_primary:${profileSelection.primaryProfileId}`,
    ],
    motorRoutingAnalysis: fusedDecision.motorRoutingAnalysis,
  };
}
