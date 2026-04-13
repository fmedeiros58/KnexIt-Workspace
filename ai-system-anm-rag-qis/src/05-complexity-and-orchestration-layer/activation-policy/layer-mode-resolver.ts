/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: activation-policy/layer-mode-resolver
 * Responsibility: Resolve the effective mode of a layer from the adaptive contract or default policy.
 * Primary Inputs: ProcessingState and target layer id.
 * Primary Outputs: LayerMode.
 * Upstream Dependencies: bridges/contracts/processing-state, bridges/contracts/layer-mode
 * Downstream Dependencies: pipeline-flow-descending, layer operators
 * Invariants: Missing adaptive contracts degrade to "medium".
 * Failure Modes: Unknown modes normalize to "medium".
 * Audit Events: layer_mode_resolved
 * Notes: This is the runtime consumption point of the activation matrix.
 */
import type { PipelineLayerId } from "../../shared/enums/pipeline-enums";
import type { ProcessingState } from "../../bridges/contracts/processing-state";
import { normalizeLayerMode } from "./layer-mode";

export function resolveLayerModeFromState(
  state: ProcessingState,
  layer: PipelineLayerId,
) {
  return normalizeLayerMode(state.adaptivePipelineContract?.layerActivations[layer]?.mode);
}
