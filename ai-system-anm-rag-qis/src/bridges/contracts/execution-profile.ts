/**
 * ANM ARCHITECTURAL SPEC
 * Layer: bridges/contracts
 * Module: execution-profile
 * Responsibility: Define declarative execution profiles used by the adaptive orchestrator.
 * Primary Inputs: Catalog declarations, profile selector, profile composer.
 * Primary Outputs: ExecutionProfile values.
 * Upstream Dependencies: shared/enums/pipeline-enums, bridges/contracts/layer-mode
 * Downstream Dependencies: execution-profiles, activation-policy, adaptive contract builder
 * Invariants: Profiles are declarative and composable; they never encode route jumps.
 * Failure Modes: Invalid profiles must be ignored by selectors and recorded in audit.
 * Audit Events: execution_profile_selected, execution_profile_composed
 * Notes: Profiles describe operating regimes over the same descending tree.
 */
import type { PipelineLayerId } from "../../shared/enums/pipeline-enums";
import type { LayerMode } from "./layer-mode";

export type ExecutionProfileDepth = "shallow" | "standard" | "deep";
export type ExecutionPolicyLevel = "disabled" | "light" | "standard" | "heavy";
export type ExecutionProactivityLevel = "low" | "medium" | "high";
export type HumanizationPolicy = "minimal" | "balanced" | "rich";

export interface ExecutionProfile {
  id: string;
  label: string;
  purpose: string;
  defaultDepth: ExecutionProfileDepth;
  memoryPolicy: ExecutionPolicyLevel;
  retrievalPolicy: ExecutionPolicyLevel;
  reflectionPolicy: ExecutionPolicyLevel;
  validationPolicy: ExecutionPolicyLevel;
  proactivityPolicy: ExecutionProactivityLevel;
  humanizationPolicy: HumanizationPolicy;
  preferredFormat: string;
  layerIntensities: Partial<Record<PipelineLayerId, LayerMode>>;
  specialConstraints: string[];
  suggestedFallback: string;
  tags: string[];
}
