/** ai-system-anm - bridge 17d */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { buildToneProfile } from "./tone-profile-builder";
import { resolveDensity } from "./density-controller";
import { resolveFormality } from "./formality-resolver";
import { aggregateDeliveryProfile } from "./delivery-profile-aggregator";

export async function runDeliveryProfileLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();

  const tone = buildToneProfile({
    dominantAffect: state.affectiveState.dominantAffect,
    responseIntent: state.responsePlanState.responseIntent,
  });
  const density = resolveDensity({
    depthLevel: state.responsePlanState.depthLevel,
    responseIntent: state.responsePlanState.responseIntent,
  });
  const formality = resolveFormality({
    targetRestraint: state.behaviorPersonalityState.targetRestraint,
    selectedMode: state.selectedMode,
  });

  const profile = aggregateDeliveryProfile({
    tone,
    density,
    formality,
    technicality: state.selectedMode === "technical" ? 0.82 : 0.54,
    proximity: state.behaviorPersonalityState.targetWarmth,
    rhythm: state.responsePlanState.responseIntent === "stepwise" ? "didactic" : "direct",
  });

  state.deliveryProfileState = profile;
  state.executionArtifacts.deliveryProfile = profile;

  state.trace.push(
    makeTraceEvent({
      layer: "delivery-profile",
      action: "delivery_profile_built",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail: `tone=${profile.tone}; density=${profile.density}; formality=${profile.formality}; rhythm=${profile.rhythm}`,
    }),
  );

  return state;
}
