/**
 * ai-system-anm - bridge 06b
 * Interpreta sinal afetivo sem alterar logica semantica.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { detectAffectiveState } from "./affective-state-detector";
import { scoreEmotionalIntensity } from "./emotional-intensity-scorer";
import { buildAffectiveContext } from "./affective-context-builder";

export async function runAffectiveSignalLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const text = state.normalizedMessage || state.rawMessage;

  const detected = detectAffectiveState(text);
  const intensity = scoreEmotionalIntensity({
    text,
    dominantAffect: detected.dominantAffect,
  });
  const affectiveState = buildAffectiveContext({
    dominantAffect: detected.dominantAffect,
    emotionalIntensity: intensity,
    markers: detected.markers,
  });

  state.affectiveState = affectiveState;
  state.executionArtifacts = state.executionArtifacts || { knowledge: { cache: {}, lastQuerySignature: "", lastUsedCache: false } };
  state.executionArtifacts.affective = {
    dominantAffect: affectiveState.dominantAffect,
    emotionalIntensity: affectiveState.emotionalIntensity,
    cautionLevel: affectiveState.cautionLevel,
    markers: affectiveState.affectiveMarkers,
  };

  state.activeContext = [
    ...state.activeContext,
    `affective:${affectiveState.dominantAffect}`,
    `affective_intensity:${affectiveState.emotionalIntensity.toFixed(2)}`,
    `affective_caution:${affectiveState.cautionLevel.toFixed(2)}`,
  ].slice(-20);

  state.trace.push(
    makeTraceEvent({
      layer: "affective-signal",
      action: "affective_state_built",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `dominant=${affectiveState.dominantAffect}; intensity=${affectiveState.emotionalIntensity.toFixed(2)}; ` +
        `caution=${affectiveState.cautionLevel.toFixed(2)}`,
    }),
  );

  return state;
}
