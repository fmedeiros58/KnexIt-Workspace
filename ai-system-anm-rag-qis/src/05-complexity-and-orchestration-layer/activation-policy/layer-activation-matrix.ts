/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 05-complexity-and-orchestration-layer
 * Module: activation-policy/layer-activation-matrix
 * Responsibility: Resolve the central layer activation matrix from composed profiles.
 * Primary Inputs: Selected execution profiles and profile weights.
 * Primary Outputs: LayerActivationMap.
 * Upstream Dependencies: bridges/contracts/layer-activation, activation-policy/layer-mode
 * Downstream Dependencies: layer-mode-resolver, adaptive contract builder, pipeline-flow-descending
 * Invariants: The matrix modulates intensity per layer while preserving descending order.
 * Failure Modes: Empty profile sets fall back to base required/medium modes.
 * Audit Events: layer_activation_matrix_resolved
 * Notes: No layer jumps are introduced here; only per-layer intensity modes.
 */
import type { PipelineLayerId } from "../../shared/enums/pipeline-enums";
import type { ExecutionProfile } from "../../bridges/contracts/execution-profile";
import type { LayerActivationMap } from "../../bridges/contracts/layer-activation";
import { pickDominantLayerMode } from "./layer-mode";

const COVERED_LAYERS: PipelineLayerId[] = [
  "input",
  "language",
  "conversation",
  "context",
  "orchestration",
  "deliberative-task-contract",
  "memory",
  "knowledge",
  "quantum",
  "preparatory",
  "response-planning",
  "reflective",
  "inferential",
  "metacognitive",
  "epistemic-integration",
  "generation",
  "structure",
  "academic-normalization",
  "validation",
  "response-behavior",
  "proactivity-gate",
  "delivery-profile",
  "linguistic-humanizer",
  "response-calibration",
  "presentation",
  "observability",
  "feedback",
];

export function buildLayerActivationMatrix(
  profiles: ExecutionProfile[],
  weights: Record<string, number>,
): LayerActivationMap {
  const matrix: LayerActivationMap = {};

  for (const layer of COVERED_LAYERS) {
    let mode = profiles[0]?.layerIntensities[layer] || "medium";
    const rationale: string[] = [];
    const profileIds: string[] = [];
    let weight = 0;

    for (const profile of profiles) {
      const profileMode = profile.layerIntensities[layer];
      if (!profileMode) continue;
      mode = pickDominantLayerMode(mode, profileMode);
      profileIds.push(profile.id);
      rationale.push(`${profile.id}:${profileMode}`);
      weight += weights[profile.id] || 0;
    }

    matrix[layer] = {
      layer,
      mode,
      profileIds,
      rationale,
      weight: Number(Math.min(1, weight || 0.5).toFixed(4)),
    };
  }

  return matrix;
}
