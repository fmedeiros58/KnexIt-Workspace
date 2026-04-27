/**
 * @file logical-task-adequacy-analyzer.ts
 * @description Analisa se a tarefa exige raciocinio logico fechado, deterministico e governado por restricoes.
 * @layer 05b-deliberative-task-contract-layer
 * @purpose Transformar sinais do enunciado em diagnostico geral de orcamento de acao, mundo fechado e estrategias proibidas.
 * @inputs Texto da tarefa, tipo cognitivo classificado e restricoes explicitas ja extraidas.
 * @outputs LogicalTaskAdequacyReport usado pelo TaskContract, validadores e prompt.
 * @dependsOn bridges/contracts/logical-task-adequacy-report, bridges/contracts/cognitive-task-type.
 * @usedBy task-contract-builder.
 * @invariants O analisador nao pode resolver um puzzle especifico; ele apenas descreve o regime logico exigido.
 * @notes O caso de etiquetas erradas e apenas um dos sinais de mundo fechado; a politica cobre tambem observacao unica e escolhas finitas.
 */
import type { CognitiveTaskType } from "../bridges/contracts/cognitive-task-type";
import type {
  LogicalForbiddenStrategy,
  LogicalRequiredReasoningMove,
  LogicalTaskAdequacyReport,
  LogicalTaskRegime,
} from "../bridges/contracts/logical-task-adequacy-report";

export interface LogicalTaskAdequacyAnalyzerInput {
  text: string;
  cognitiveTaskType: CognitiveTaskType;
  explicitConstraints: string[];
}

const LOGICAL_TASK_TYPES = new Set<CognitiveTaskType>([
  "closed_constraint_deduction",
  "short_deterministic_reasoning",
  "decision_between_alternatives",
]);

function normalizeText(value: string): string {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniq<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function clamp01(value: number): number {
  return Number(Math.max(0, Math.min(1, value)).toFixed(4));
}

function resolveRegime(taskType: CognitiveTaskType, isClosedWorld: boolean, isDeterministic: boolean): LogicalTaskRegime {
  if (taskType === "closed_constraint_deduction" || (isClosedWorld && isDeterministic)) {
    return "closed_constraint_deduction";
  }
  if (taskType === "short_deterministic_reasoning" || isDeterministic) {
    return "short_deterministic_reasoning";
  }
  if (taskType === "open_exploration") {
    return "open_exploration";
  }
  return LOGICAL_TASK_TYPES.has(taskType) ? "short_deterministic_reasoning" : "non_logical";
}

function detectSingleActionLimit(normalized: string): boolean {
  return (
    /\b(?:apenas|somente|so)\s+(?:1|um|uma)\b/.test(normalized) ||
    /\b(?:1|um|uma)\s+unic[ao]\b/.test(normalized) ||
    /\buma\s+unica\s+(?:acao|observacao|pergunta|tentativa|amostra|retirada|consulta|caixa)\b/.test(normalized)
  );
}

function detectNoExtraInspection(normalized: string): boolean {
  return /\bsem\s+(?:olhar|abrir|consultar|testar|ver|examinar|inspecionar)\b/.test(normalized);
}

function detectAllLabelsWrong(normalized: string): boolean {
  return (
    /\btod[ao]s?\s+(?:as\s+)?(?:etiquetas|rotulos|labels)\s+(?:estao|sao|estavam|ficaram)?\s*errad[ao]s?\b/.test(normalized) ||
    /\b(?:etiquetas|rotulos|labels)\s+errad[ao]s?\b/.test(normalized)
  );
}

function detectFiniteChoiceSpace(normalized: string): boolean {
  return (
    /\b(?:duas|dois|tres|3|2)\s+(?:caixas|opcoes|alternativas|cartas|portas|rotulos|etiquetas)\b/.test(normalized) ||
    /\b(?:caixas|opcoes|alternativas|cartas|portas|rotulos|etiquetas)\b/.test(normalized)
  );
}

function detectDeductionRequest(normalized: string): boolean {
  return /\b(?:deduz|descobrir|determinar|resolver|qual|como|provar|inferir|logica|raciocinio)\b/.test(normalized);
}

function scoreConfidence(signals: string[], isLogicalTaskType: boolean): number {
  const base = isLogicalTaskType ? 0.42 : 0.2;
  return clamp01(base + Math.min(0.48, signals.length * 0.08));
}

export function analyzeLogicalTaskAdequacy(input: LogicalTaskAdequacyAnalyzerInput): LogicalTaskAdequacyReport {
  const joined = `${input.text || ""} ${input.explicitConstraints.join(" ")}`;
  const normalized = normalizeText(joined);
  const auditSignals: string[] = [];

  const isLogicalTaskType = LOGICAL_TASK_TYPES.has(input.cognitiveTaskType);
  if (isLogicalTaskType) auditSignals.push(`task_type:${input.cognitiveTaskType}`);

  const hasSingleActionLimit = detectSingleActionLimit(normalized);
  if (hasSingleActionLimit) auditSignals.push("single_action_or_observation_limit");

  const hasNoExtraInspection = detectNoExtraInspection(normalized);
  if (hasNoExtraInspection) auditSignals.push("no_extra_inspection");

  const hasAllLabelsWrong = detectAllLabelsWrong(normalized);
  if (hasAllLabelsWrong) auditSignals.push("all_labels_wrong");

  const hasFiniteChoiceSpace = detectFiniteChoiceSpace(normalized);
  if (hasFiniteChoiceSpace) auditSignals.push("finite_choice_space");

  const hasDeductionRequest = detectDeductionRequest(normalized);
  if (hasDeductionRequest) auditSignals.push("deduction_request");

  const isClosedWorld =
    input.cognitiveTaskType === "closed_constraint_deduction" ||
    hasAllLabelsWrong ||
    (hasFiniteChoiceSpace && (hasSingleActionLimit || hasDeductionRequest));

  const isDeterministic =
    input.cognitiveTaskType === "short_deterministic_reasoning" ||
    input.cognitiveTaskType === "closed_constraint_deduction" ||
    (isClosedWorld && (hasSingleActionLimit || hasDeductionRequest));

  const regime = resolveRegime(input.cognitiveTaskType, isClosedWorld, isDeterministic);
  const requiresConstraintProof = regime === "closed_constraint_deduction" || (isDeterministic && hasSingleActionLimit);
  const requiresPivotSelection = Boolean(isClosedWorld && (hasSingleActionLimit || hasAllLabelsWrong || hasFiniteChoiceSpace));

  const extractedRestrictions: string[] = [];
  if (hasSingleActionLimit) {
    extractedRestrictions.push("max_actions:1", "max_observations:1");
  }
  if (hasNoExtraInspection) {
    extractedRestrictions.push("no_extra_hidden_state_inspection");
  }
  if (hasAllLabelsWrong) {
    extractedRestrictions.push("all_labels_are_wrong");
  }
  if (isClosedWorld) {
    extractedRestrictions.push("closed_world_reasoning_required");
  }
  if (isDeterministic) {
    extractedRestrictions.push("deterministic_answer_required");
  }

  const forbiddenStrategies: LogicalForbiddenStrategy[] = [];
  if (hasSingleActionLimit || hasNoExtraInspection) {
    forbiddenStrategies.push("iterative_exploration", "extra_observation");
  }
  if (isClosedWorld || requiresPivotSelection) {
    forbiddenStrategies.push("random_choice", "discursive_plausibility");
  }
  if (hasAllLabelsWrong) {
    forbiddenStrategies.push("premise_relaxation");
  }

  const requiredReasoningMoves: LogicalRequiredReasoningMove[] = [];
  if (requiresConstraintProof) {
    requiredReasoningMoves.push("extract_constraints", "respect_action_budget");
  }
  if (requiresPivotSelection) {
    requiredReasoningMoves.push("identify_pivot");
  }
  if (isClosedWorld) {
    requiredReasoningMoves.push("deduce_by_elimination", "check_completeness");
  }
  if (isDeterministic) {
    requiredReasoningMoves.push("answer_directly");
  }

  return {
    version: "05b.logical-task-adequacy.v1",
    sourceTaskType: input.cognitiveTaskType,
    regime,
    isClosedWorld,
    isDeterministic,
    requiresConstraintProof,
    requiresPivotSelection,
    actionBudget: {
      maxActions: hasSingleActionLimit ? 1 : null,
      maxObservations: hasSingleActionLimit ? 1 : null,
      source: hasSingleActionLimit ? "explicit_single_action_or_observation_signal" : null,
    },
    extractedRestrictions: uniq(extractedRestrictions),
    forbiddenStrategies: uniq(forbiddenStrategies),
    requiredReasoningMoves: uniq(requiredReasoningMoves),
    auditSignals: uniq(auditSignals),
    confidence: scoreConfidence(auditSignals, isLogicalTaskType),
  };
}
