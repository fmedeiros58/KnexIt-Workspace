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
import { runCommunicativeElaborationBridge } from "../bridges/communicative-elaboration.bridge";
import { runPhilosophicalSelfModelingBridgeAdapter } from "../bridges/philosophical-self-modeling.bridge";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export async function runInferentialLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  if (!state.communicativeElaborationState) {
    await runCommunicativeElaborationBridge(state);
  }
  if (!state.philosophicalSelfModelState) {
    await runPhilosophicalSelfModelingBridgeAdapter(state);
  }

  const inferentialMap = runInferenceEngine(state);
  const communicativeBranches = state.communicativeElaborationState?.hypothesisBranches || [];
  const ontologicalHooks = state.philosophicalSelfModelState?.ontologyStatements || [];
  const enrichedInferentialMap = {
    implications: [
      ...inferentialMap.implications,
      ...communicativeBranches.map((row) => `implicacao_da_hipotese: ${row.claim}`),
      ...(ontologicalHooks.length > 0
        ? [`enquadramento_ontologico: ${ontologicalHooks.slice(0, 2).map((row) => row.claim).join(" | ")}`]
        : []),
    ].slice(0, 18),
    scenarios: inferentialMap.scenarios,
    secondOrderEffects: inferentialMap.secondOrderEffects,
  };
  const nodular = state.memorySnapshot.nodularState;
  const regulatory = state.memorySnapshot.regulatoryState;
  const runtimeTop = state.memorySnapshot.legacyRuntimeTopModules || [];

  const handoff = inferentialHandoff({
    text: [
      ...enrichedInferentialMap.implications,
      ...enrichedInferentialMap.scenarios,
      ...enrichedInferentialMap.secondOrderEffects,
    ].join(" "),
    score: clamp01(
      (enrichedInferentialMap.implications.length * 0.09) +
      (enrichedInferentialMap.scenarios.length * 0.07) +
      (nodular.priming * 0.08) -
      (regulatory.stressLoad * 0.06),
    ),
  });

  const lowSignal = handoff.score < 0.34;

  if (!lowSignal) {
    state.inferentialMap = enrichedInferentialMap;
    state.scenarioSet = [...enrichedInferentialMap.scenarios];

    state.confidenceScores.final = Number(
      clamp01((state.confidenceScores.final * 0.75) + (handoff.score * 0.25)).toFixed(4),
    );
  }

  state.executionArtifacts.inferential = {
    familyId: "inferential_projection",
    lowSignal,
    score: handoff.score,
    implicationsCount: enrichedInferentialMap.implications.length,
    scenariosCount: enrichedInferentialMap.scenarios.length,
    secondOrderCount: enrichedInferentialMap.secondOrderEffects.length,
    communicativeHypothesisCount: communicativeBranches.length,
    ontologicalHooksCount: ontologicalHooks.length,
  };

  state.activeConstraints = mergeConstraints(
    state.activeConstraints,
    [
      ...(lowSignal ? [toConstraint("inferential", "low_signal")] : []),
      ...(enrichedInferentialMap.secondOrderEffects.length ? [toConstraint("inferential", "second_order_active")] : []),
      ...(communicativeBranches.length ? [toConstraint("inferential", "communicative_hypothesis_hooks")] : []),
      ...(ontologicalHooks.length ? [toConstraint("inferential", "ontological_framing_hooks")] : []),
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
        `implications=${enrichedInferentialMap.implications.length}; scenarios=${enrichedInferentialMap.scenarios.length}; secondOrder=${enrichedInferentialMap.secondOrderEffects.length}; ` +
        `commBranches=${communicativeBranches.length}; ontoHooks=${ontologicalHooks.length}; ` +
        `handoff=${handoff.score.toFixed(2)}; priming=${nodular.priming.toFixed(2)}; stress=${regulatory.stressLoad.toFixed(2)}; ` +
        `runtimeTop=${runtimeTop.slice(0, 2).join(",")}`,
    }),
  );

  return handoffInferentialToMetacognitive(state);
}
