/**
 * Responsabilidade do arquivo:
 * - Executar analise reflexiva e atualizar estado apenas com sinal suficiente.
 * - Registrar metadados operacionais em executionArtifacts.reflective.
 * - Publicar constraints namespaced para auditabilidade dos sinais reflexivos.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { mergeConstraints, toConstraint } from "../shared/state/constraint-utils";
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

  const handoff = reflectiveHandoff({
    text: [
      ...reflection.assumptions,
      ...reflection.caveats,
      ...reflection.tensions,
      ...reflection.criticalCaveats,
    ].join(" "),
    score: clamp01(
      (reflection.caveats.length * 0.12) +
      (reflection.assumptions.length * 0.08),
    ),
  });

  const lowSignal = handoff.score < 0.36;

  if (!lowSignal) {
    state.reflectiveNotes.assumptions = reflection.assumptions;
    state.reflectiveNotes.caveats = reflection.caveats;
    state.reflectiveNotes.tensions = reflection.tensions;
    state.criticalCaveats = reflection.criticalCaveats;

    state.confidenceScores.coherence = Number(
      clamp01((state.confidenceScores.coherence * 0.70) + (handoff.score * 0.30)).toFixed(4),
    );
  }

  state.executionArtifacts.reflective = {
    lowSignal,
    score: handoff.score,
    assumptionsCount: reflection.assumptions.length,
    caveatsCount: reflection.caveats.length,
    tensionsCount: reflection.tensions.length,
  };

  state.activeConstraints = mergeConstraints(
    state.activeConstraints,
    [
      ...(lowSignal ? [toConstraint("reflection", "low_signal")] : []),
      ...(reflection.criticalCaveats.length ? [toConstraint("reflection", "has_caveats")] : []),
      ...(regulatory.stressLoad >= 0.66 ? [toConstraint("reflection", "memory_regulatory_caution")] : []),
      ...(runtimeTop.length ? [toConstraint("reflection_runtime_top", runtimeTop.slice(0, 2).join(","))] : []),
    ],
    32,
  );

  state.trace.push(
    makeTraceEvent({
      layer: "reflective",
      action: lowSignal ? "critical_reflection_low_signal" : "critical_reflection_built",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `assumptions=${reflection.assumptions.length}; caveats=${reflection.caveats.length}; tensions=${reflection.tensions.length}; ` +
        `handoff=${handoff.score.toFixed(2)}; stress=${regulatory.stressLoad.toFixed(2)}; runtimeTop=${runtimeTop.slice(0, 2).join(",")}`,
    }),
  );

  return handoffReflectiveToInferential(state);
}
