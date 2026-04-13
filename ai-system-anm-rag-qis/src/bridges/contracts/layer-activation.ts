/**
 * ANM ARCHITECTURAL SPEC
 * Layer: bridges/contracts
 * Module: layer-activation
 * Responsibility: Define the resolved activation contract for each layer under adaptive orchestration.
 * Primary Inputs: Execution profiles, profile weights, adaptive pipeline contract builders.
 * Primary Outputs: LayerActivation and LayerActivationMap.
 * Upstream Dependencies: shared/enums/pipeline-enums, bridges/contracts/layer-mode
 * Downstream Dependencies: activation-policy, pipeline-flow-descending, operators
 * Invariants: Every activation record is serializable and scoped to one pipeline layer.
 * Failure Modes: Missing activation map falls back to default route policy.
 * Audit Events: layer_activation_resolved, layer_activation_defaulted
 * Notes: The map modulates the descending execution without introducing cross-layer jumps.
 */
import type { PipelineLayerId } from "../../shared/enums/pipeline-enums";
import type { LayerMode } from "./layer-mode";

export interface LayerActivation {
  layer: PipelineLayerId;
  mode: LayerMode;
  profileIds: string[];
  rationale: string[];
  weight: number;
}

export type LayerActivationMap = Partial<Record<PipelineLayerId, LayerActivation>>;
