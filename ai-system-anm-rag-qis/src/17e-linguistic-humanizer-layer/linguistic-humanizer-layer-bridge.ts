/** ai-system-anm - bridge 17e */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { fluidizeSentences } from "./sentence-fluidizer";
import { enhanceTransitions } from "./transition-enhancer";
import { applyAntiRoboticRewrite } from "./anti-robotic-rewriter";
import { applyMicroVariation } from "./micro-variation-applier";

export async function runLinguisticHumanizerLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const source = `${state.structuredResponse || state.validatedDraft || ""}`;

  const fluidized = fluidizeSentences(source);
  const transitioned = enhanceTransitions(fluidized);
  const antiRobotic = applyAntiRoboticRewrite(transitioned);
  const varied = applyMicroVariation(antiRobotic, state.deliveryProfileState.tone);

  state.humanizedResponse = varied;
  state.structuredResponse = varied;
  state.executionArtifacts.linguisticHumanizer = {
    applied: true,
    steps: ["sentence_fluidizer", "transition_enhancer", "anti_robotic_rewriter", "micro_variation_applier"],
  };

  state.trace.push(
    makeTraceEvent({
      layer: "linguistic-humanizer",
      action: "response_humanized",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail: `chars=${varied.length}; tone=${state.deliveryProfileState.tone}`,
    }),
  );

  return state;
}
