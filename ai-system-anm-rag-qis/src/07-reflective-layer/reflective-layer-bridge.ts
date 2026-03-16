import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { buildCriticalReflection } from "./reflective-core/critical-reflection-engine";
import { reflectiveHandoff } from "./reflective-output-core/reflective-handoff";
import { handoffReflectiveToInferential } from "./reflective-to-inferential-bridge";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export async function runReflectiveLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const reflection = buildCriticalReflection(state);
  const regulatory = state.memorySnapshot.regulatoryState;
  const runtimeTop = state.memorySnapshot.legacyRuntimeTopModules || [];

  state.reflectiveNotes.assumptions = reflection.assumptions;
  state.reflectiveNotes.caveats = reflection.caveats;
  state.reflectiveNotes.tensions = reflection.tensions;
  state.criticalCaveats = reflection.criticalCaveats;

  const handoff = reflectiveHandoff({
    text: [
      ...reflection.assumptions,
      ...reflection.caveats,
      ...reflection.tensions,
      ...reflection.criticalCaveats,
    ].join(" "),
    score: clamp01((reflection.caveats.length * 0.12) + (reflection.assumptions.length * 0.08)),
  });

  state.activeConstraints = [
    ...new Set([
      ...state.activeConstraints,
      ...(handoff.score < 0.36 ? ["reflection_low_signal"] : []),
      ...(reflection.criticalCaveats.length ? ["reflection_has_caveats"] : []),
      ...(regulatory.stressLoad >= 0.66 ? ["reflection_memory_regulatory_caution"] : []),
      ...(runtimeTop.length ? [`reflection_runtime_top:${runtimeTop.slice(0, 2).join(",")}`] : []),
    ]),
  ].slice(-24);
  state.confidenceScores.coherence = Number(
    clamp01((state.confidenceScores.coherence * 0.65) + (handoff.score * 0.35)).toFixed(4),
  );

  state.trace.push(
    makeTraceEvent({
      layer: "reflective",
      action: "critical_reflection_built",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `assumptions=${reflection.assumptions.length}; caveats=${reflection.caveats.length}; tensions=${reflection.tensions.length}; handoff=${handoff.score.toFixed(2)}; ` +
        `stress=${regulatory.stressLoad.toFixed(2)}; runtimeTop=${runtimeTop.slice(0, 2).join(",")}`,
    }),
  );
  return handoffReflectiveToInferential(state);
}
