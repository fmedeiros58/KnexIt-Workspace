/**
 * @file task-nature-classifier.ts
 * @description Classifica a natureza cognitiva da tarefa e preserva intent como eixo separado.
 * @layer 05-complexity-and-orchestration-layer
 * @purpose Produzir TaskNatureState antes da selecao de perfil e do TaskContract.
 * @inputs Texto normalizado, intent conversacional e sinais de snapshot/contexto.
 * @outputs TaskNatureState com hipoteses, confianca e necessidades cognitivas.
 * @dependsOn task-nature-scorer, bridges/contracts/task-nature-state.
 * @usedBy orchestration-layer-bridge, execution-profile-selector e auditoria.
 * @invariants A classificacao nao deve pular camadas nem gerar resposta final.
 * @notes A saida e deterministica para facilitar reproducao em testes.
 */
import type { TaskNatureState } from "../bridges/contracts/task-nature-state";
import { scoreTaskNatureHypotheses, type TaskNatureScorerInput } from "./task-nature-scorer";

export interface TaskNatureClassifierInput extends TaskNatureScorerInput {
  sessionSignals?: string[];
}

const STRONG_VALIDATION_TYPES = new Set([
  "closed_constraint_deduction",
  "debug_and_correction",
  "technical_analysis",
  "retrieval_grounded_analysis",
  "dialectical_counterargument",
]);

export function classifyTaskNature(input: TaskNatureClassifierInput): TaskNatureState {
  const hypotheses = scoreTaskNatureHypotheses(input).slice(0, 5);
  const selected = hypotheses[0];
  const selectedTaskType = selected.taskType;
  const conversationalIntents = [
    input.conversationalIntent || "unknown",
    ...(selectedTaskType === "greeting_light" ? ["react_socially"] : []),
  ].filter(Boolean);

  const requiresRetrieval = selectedTaskType === "retrieval_grounded_analysis" || Boolean(input.hasRetrievalSignal);
  const requiresCounterposition = selectedTaskType === "dialectical_counterargument";
  const requiresStrongValidation = STRONG_VALIDATION_TYPES.has(selectedTaskType);
  const requiresConstraintTracking =
    selectedTaskType === "closed_constraint_deduction" ||
    selectedTaskType === "procedural_instruction" ||
    selectedTaskType === "debug_and_correction";

  const expectedResponseShape =
    selectedTaskType === "closed_constraint_deduction"
      ? ["conclusion-first", "constraint-mapping", "short-proof"]
      : selectedTaskType === "procedural_instruction"
        ? ["ordered-steps"]
        : selectedTaskType === "retrieval_grounded_analysis"
          ? ["grounded-analysis", "evidence-aware"]
          : selectedTaskType === "dialectical_counterargument"
            ? ["position", "counterposition", "balance"]
            : selectedTaskType === "greeting_light" || selectedTaskType === "conversational_light"
              ? ["concise-paragraph"]
              : ["structured-answer"];

  return {
    version: "05.task-nature-state.v1",
    selectedTaskType,
    confidence: selected.score,
    hypotheses,
    conversationalIntents,
    sessionSignals: input.sessionSignals || [],
    requiresRetrieval,
    requiresCounterposition,
    requiresStrongValidation,
    requiresConstraintTracking,
    expectedResponseShape,
    auditTrail: [
      `selected_task_type:${selectedTaskType}`,
      `confidence:${selected.score.toFixed(2)}`,
      `signals:${selected.matchedSignals.slice(0, 4).join("|") || "none"}`,
    ],
  };
}

