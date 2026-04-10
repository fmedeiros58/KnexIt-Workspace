/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 17e-linguistic-humanizer-layer
 * Module: operators/humanization-intensity-resolver
 * Responsibility: Resolve how strongly the humanizer should rewrite the validated surface.
 * Primary Inputs: ProcessingState and linguistic-humanizer layer mode.
 * Primary Outputs: Humanization intensity policy.
 * Upstream Dependencies: bridges/contracts/processing-state, bridges/contracts/layer-mode
 * Downstream Dependencies: linguistic-humanizer-layer-bridge
 * Invariants: Humanization remains post-semantic and should not alter substantive claims.
 * Failure Modes: Missing signals degrade to balanced humanization.
 * Audit Events: humanization_intensity_resolved
 * Notes: The operator only decides which local transforms are appropriate for the current mode.
 */
import type { LayerMode } from "../../bridges/contracts/layer-mode";
import type { ProcessingState } from "../../bridges/contracts/processing-state";

export interface HumanizationIntensityPolicy {
  intensity: "minimal" | "balanced" | "rich";
  applyFluidizer: boolean;
  applyTransitions: boolean;
  applyAntiRobotic: boolean;
  applyMicroVariation: boolean;
  rationale: string[];
}

export function humanizationIntensityResolver(
  state: ProcessingState,
  mode: LayerMode,
): HumanizationIntensityPolicy {
  const technical = state.deliveryProfileState.tone === "technical";
  const dense = state.deliveryProfileState.density === "detailed" || state.longFormDiscourseState.isActive;

  if (mode === "delivery-light" || mode === "light") {
    return {
      intensity: "minimal",
      applyFluidizer: true,
      applyTransitions: false,
      applyAntiRobotic: true,
      applyMicroVariation: false,
      rationale: ["humanization_light_mode"],
    };
  }

  if (mode === "delivery-rich" || (!technical && dense)) {
    return {
      intensity: "rich",
      applyFluidizer: true,
      applyTransitions: true,
      applyAntiRobotic: true,
      applyMicroVariation: true,
      rationale: ["humanization_rich_mode"],
    };
  }

  return {
    intensity: "balanced",
    applyFluidizer: true,
    applyTransitions: true,
    applyAntiRobotic: true,
    applyMicroVariation: !technical,
    rationale: ["humanization_balanced_mode"],
  };
}
