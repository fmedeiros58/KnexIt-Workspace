import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { runInferenceEngine } from "./inferential-core/inference-engine";
import { inferentialHandoff } from "./inferential-output-core/inferential-handoff";
import { handoffInferentialToGeneration } from "./inferential-to-generation-bridge";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export async function runInferentialLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const inferentialMap = runInferenceEngine(state);
  const nodular = state.memorySnapshot.nodularState;
  const regulatory = state.memorySnapshot.regulatoryState;
  const runtimeTop = state.memorySnapshot.legacyRuntimeTopModules || [];

  state.inferentialMap = inferentialMap;
  state.scenarioSet = [...inferentialMap.scenarios];

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

  state.activeConstraints = [
    ...new Set([
      ...state.activeConstraints,
      ...(handoff.score < 0.34 ? ["inferential_low_signal"] : []),
      ...(inferentialMap.secondOrderEffects.length ? ["inferential_second_order_active"] : []),
      ...(nodular.priming >= 0.62 ? ["inferential_nodular_priming_high"] : []),
      ...(regulatory.stressLoad >= 0.7 ? ["inferential_regulatory_caution"] : []),
      ...(runtimeTop.length ? [`inferential_runtime_top:${runtimeTop.slice(0, 2).join(",")}`] : []),
    ]),
  ].slice(-24);
  state.confidenceScores.final = Number(
    clamp01((state.confidenceScores.final * 0.72) + (handoff.score * 0.28)).toFixed(4),
  );

  state.trace.push(
    makeTraceEvent({
      layer: "inferential",
      action: "inferential_map_built",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `implications=${inferentialMap.implications.length}; scenarios=${inferentialMap.scenarios.length}; secondOrder=${inferentialMap.secondOrderEffects.length}; ` +
        `handoff=${handoff.score.toFixed(2)}; priming=${nodular.priming.toFixed(2)}; stress=${regulatory.stressLoad.toFixed(2)}; ` +
        `runtimeTop=${runtimeTop.slice(0, 2).join(",")}`,
    }),
  );
  return handoffInferentialToGeneration(state);
}
