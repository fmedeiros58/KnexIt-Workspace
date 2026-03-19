/**
 * Responsabilidade do arquivo:
 * - Executar inferencia e atualizar estado apenas com sinal inferencial valido.
 * - Registrar metadados operacionais em executionArtifacts.inferential.
 * - Publicar constraints namespaced para auditoria de risco/sinal inferencial.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { mergeConstraints, toConstraint } from "../shared/state/constraint-utils";
import { runInferenceEngine } from "./inferential-core/inference-engine";
import { inferentialHandoff } from "./inferential-output-core/inferential-handoff";
import { handoffInferentialToMetacognitive } from "./inferential-to-metacognitive-bridge";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export async function runInferentialLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();

  const inferentialMap = runInferenceEngine(state);
  const nodular = state.memorySnapshot.nodularState;
  const regulatory = state.memorySnapshot.regulatoryState;
  const runtimeTop = state.memorySnapshot.legacyRuntimeTopModules || [];

  const handoff = inferentialHandoff({
    text: [
      ...inferentialMap.implications,
      ...inferentialMap.scenarios,
      ...inferentialMap.secondOrderEffects,
    ].join(" "),
    score: clamp01(
      (inferentialMap.implications.length * 0.09) +
      (inferentialMap.scenarios.length * 0.07) +
      (nodular.priming * 0.08) -
      (regulatory.stressLoad * 0.06),
    ),
  });

  const lowSignal = handoff.score < 0.34;

  if (!lowSignal) {
    state.inferentialMap = inferentialMap;
    state.scenarioSet = [...inferentialMap.scenarios];

    state.confidenceScores.final = Number(
      clamp01((state.confidenceScores.final * 0.75) + (handoff.score * 0.25)).toFixed(4),
    );
  }

  state.executionArtifacts.inferential = {
    familyId: "inferential_projection",
    lowSignal,
    score: handoff.score,
    implicationsCount: inferentialMap.implications.length,
    scenariosCount: inferentialMap.scenarios.length,
    secondOrderCount: inferentialMap.secondOrderEffects.length,
  };

  state.activeConstraints = mergeConstraints(
    state.activeConstraints,
    [
      ...(lowSignal ? [toConstraint("inferential", "low_signal")] : []),
      ...(inferentialMap.secondOrderEffects.length ? [toConstraint("inferential", "second_order_active")] : []),
      ...(nodular.priming >= 0.62 ? [toConstraint("inferential", "nodular_priming_high")] : []),
      ...(regulatory.stressLoad >= 0.70 ? [toConstraint("inferential", "regulatory_caution")] : []),
      ...(runtimeTop.length ? [toConstraint("inferential_runtime_top", runtimeTop.slice(0, 2).join(","))] : []),
    ],
    32,
  );

  state.trace.push(
    makeTraceEvent({
      layer: "inferential",
      action: lowSignal ? "inferential_low_signal" : "inferential_map_built",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `implications=${inferentialMap.implications.length}; scenarios=${inferentialMap.scenarios.length}; secondOrder=${inferentialMap.secondOrderEffects.length}; ` +
        `handoff=${handoff.score.toFixed(2)}; priming=${nodular.priming.toFixed(2)}; stress=${regulatory.stressLoad.toFixed(2)}; ` +
        `runtimeTop=${runtimeTop.slice(0, 2).join(",")}`,
    }),
  );

  return handoffInferentialToMetacognitive(state);
}
