/**
 * @file task-contract-builder.ts
 * @description Constroi o TaskContract canonico a partir da natureza cognitiva e da selecao de perfil.
 * @layer 05b-deliberative-task-contract-layer
 * @purpose Formalizar objetivo, restricoes, necessidades e entrega antes da resposta.
 * @inputs ProcessingState, TaskNatureState, ProfileSelectionResult e budget.
 * @outputs TaskContract.
 * @dependsOn task-contract, task-nature-state, profile-selection-result, logical-task-adequacy-analyzer e resolvers locais.
 * @usedBy orchestration-layer-bridge e adaptive-pipeline-contract-builder.
 * @invariants O contrato deve ser serializavel e nao executar a tarefa diretamente.
 * @notes Reaproveita restricoes ativas existentes para evitar duplicacao funcional.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import type { ProfileSelectionResult } from "../bridges/contracts/profile-selection-result";
import type { TaskContract, TaskRiskLevel } from "../bridges/contracts/task-contract";
import type { TaskNatureState } from "../bridges/contracts/task-nature-state";
import { analyzeLogicalTaskAdequacy } from "./logical-task-adequacy-analyzer";
import { extractTaskConstraints } from "./task-constraint-extractor";
import { resolveTaskObjective } from "./task-objective-resolver";
import { resolveTaskOutputExpectation } from "./task-output-expectation-resolver";

export interface TaskContractBuilderInput {
  state: ProcessingState;
  taskNatureState: TaskNatureState;
  profileSelection: ProfileSelectionResult;
  responseBudget: number;
  riskLevel?: string;
}

function normalizeRiskLevel(value: string | undefined): TaskRiskLevel {
  return value === "high" || value === "medium" || value === "low" ? value : "low";
}

function uniqueItems(items: string[]): string[] {
  return [...new Set(items.filter(Boolean))];
}

function isContinuationRewritePrompt(text: string): boolean {
  return /\b(outra forma|responder de outra forma|reformule|reescreva|mesma pergunta|essa pergunta|essa resposta|isso|mais eficiente|eficiente)\b/i.test(
    `${text || ""}`,
  );
}

function buildContractAnalysisText(state: ProcessingState, currentText: string): string {
  const activeTopic = `${state.conversationState?.activeTopic || ""}`.trim();
  if (!activeTopic || state.conversationState?.topicShiftDetected || !isContinuationRewritePrompt(currentText)) {
    return currentText;
  }

  return `${currentText}\nTopico ativo anterior: ${activeTopic}`;
}

export function buildTaskContract(input: TaskContractBuilderInput): TaskContract {
  const { state, taskNatureState, profileSelection, responseBudget } = input;
  const text = state.normalizedMessage || state.rawMessage;
  const contractAnalysisText = buildContractAnalysisText(state, text);
  const output = resolveTaskOutputExpectation(taskNatureState);
  const extractedConstraints = extractTaskConstraints(contractAnalysisText, state.activeConstraints);
  const logicalAdequacy = analyzeLogicalTaskAdequacy({
    text: contractAnalysisText,
    cognitiveTaskType: taskNatureState.selectedTaskType,
    explicitConstraints: extractedConstraints,
  });
  const explicitConstraints = uniqueItems([
    ...extractedConstraints,
    ...logicalAdequacy.extractedRestrictions,
  ]).slice(0, 24);
  const prohibitedActions = uniqueItems([
    "ignorar_restricoes_explicitas",
    ...(taskNatureState.selectedTaskType === "closed_constraint_deduction" ? ["discursar_sem_resolver"] : []),
    ...(taskNatureState.selectedTaskType === "dialectical_counterargument" ? ["aceitar_premissa_sem_teste", "contrariar_sem_base"] : []),
    ...logicalAdequacy.forbiddenStrategies,
  ]);

  return {
    version: "05b.task-contract.v1",
    objective: resolveTaskObjective(text, taskNatureState.selectedTaskType),
    cognitiveTaskType: taskNatureState.selectedTaskType,
    conversationalIntents: taskNatureState.conversationalIntents,
    explicitConstraints,
    logicalAdequacy,
    allowedActions: [
      "responder_conforme_contrato",
      ...(taskNatureState.requiresCounterposition ? ["contrapor_proporcionalmente"] : []),
      ...(taskNatureState.requiresRetrieval ? ["usar_evidencia_recuperada"] : []),
    ],
    prohibitedActions,
    needsMemory: profileSelection.selectedProfileIds.includes("memory-intensive-profile"),
    needsRetrieval: taskNatureState.requiresRetrieval,
    needsCounterposition: taskNatureState.requiresCounterposition,
    needsStrongValidation: taskNatureState.requiresStrongValidation || logicalAdequacy.requiresConstraintProof,
    expectedOutputFormat: output.expectedOutputFormat,
    riskLevel: normalizeRiskLevel(input.riskLevel),
    depthExpectation: responseBudget >= 900 ? "deep" : output.depthExpectation,
    deliveryRegime: output.deliveryRegime,
    primaryProfileId: profileSelection.primaryProfileId,
    secondaryProfileIds: profileSelection.selectedProfileIds.filter((id) => id !== profileSelection.primaryProfileId),
    auditReasons: [
      ...taskNatureState.auditTrail,
      `primary_profile:${profileSelection.primaryProfileId}`,
      `constraints:${explicitConstraints.length}`,
      `logical_regime:${logicalAdequacy.regime}`,
      `logical_confidence:${logicalAdequacy.confidence.toFixed(2)}`,
      `logical_forbidden:${logicalAdequacy.forbiddenStrategies.join("|") || "none"}`,
      `budget:${responseBudget}`,
    ],
  };
}
