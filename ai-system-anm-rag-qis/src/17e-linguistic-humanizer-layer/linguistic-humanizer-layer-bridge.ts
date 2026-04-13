/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 17e-linguistic-humanizer-layer
 * Module: linguistic-humanizer-layer-bridge
 * Responsibility: Apply post-validation linguistic smoothing according to the local humanization mode.
 * Primary Inputs: ProcessingState, structured/validated response surface and adaptive humanizer mode.
 * Primary Outputs: humanizedResponse and updated structuredResponse.
 * Upstream Dependencies: delivery profile, behavior layer, local humanization operator
 * Downstream Dependencies: response calibration, presentation
 * Invariants: Humanization must remain stylistic and must not alter semantic commitments.
 * Failure Modes: Missing adaptive signals degrade to balanced humanization steps.
 * Audit Events: response_humanized
 * Notes: The layer remains in the descending pipeline; the mode only changes local rewrite intensity.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { resolveLayerModeFromState } from "../05-complexity-and-orchestration-layer/activation-policy/layer-mode-resolver";
import { fluidizeSentences } from "./sentence-fluidizer";
import { enhanceTransitions } from "./transition-enhancer";
import { applyAntiRoboticRewrite } from "./anti-robotic-rewriter";
import { applyMicroVariation } from "./micro-variation-applier";
import { humanizationIntensityResolver } from "./operators/humanization-intensity-resolver";

export async function runLinguisticHumanizerLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const humanizerMode = resolveLayerModeFromState(state, "linguistic-humanizer");
  const source = `${state.structuredResponse || state.validatedDraft || ""}`;
  const policy = humanizationIntensityResolver(state, humanizerMode);

  const fluidized = policy.applyFluidizer ? fluidizeSentences(source) : source;
  const transitioned = policy.applyTransitions ? enhanceTransitions(fluidized) : fluidized;
  const antiRobotic = policy.applyAntiRobotic ? applyAntiRoboticRewrite(transitioned) : transitioned;
  const varied = policy.applyMicroVariation ? applyMicroVariation(antiRobotic, state.deliveryProfileState.tone) : antiRobotic;
  const appliedSteps = [
    ...(policy.applyFluidizer ? ["sentence_fluidizer"] : []),
    ...(policy.applyTransitions ? ["transition_enhancer"] : []),
    ...(policy.applyAntiRobotic ? ["anti_robotic_rewriter"] : []),
    ...(policy.applyMicroVariation ? ["micro_variation_applier"] : []),
  ];

  state.humanizedResponse = varied;
  state.structuredResponse = varied;
  state.executionArtifacts.linguisticHumanizer = {
    applied: true,
    steps: [...appliedSteps, ...policy.rationale],
  };

  state.trace.push(
    makeTraceEvent({
      layer: "linguistic-humanizer",
      action: "response_humanized",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail: `mode=${humanizerMode}; intensity=${policy.intensity}; chars=${varied.length}; tone=${state.deliveryProfileState.tone}`,
    }),
  );

  return state;
}
