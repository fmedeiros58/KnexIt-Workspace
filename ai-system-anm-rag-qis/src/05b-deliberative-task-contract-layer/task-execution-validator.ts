/**
 * ESPECIFICAÇÃO DO ARQUIVO
 * ------------------------
 * Nome: task-execution-validator.ts
 * Camada: 05b-deliberative-task-contract-layer
 *
 * Responsabilidade principal:
 * - Validar se a resposta executou de modo suficiente o conjunto de obrigações deliberativas.
 * - Consolidar sinais de execução, cobertura prática, qualidade média e forma mínima de resposta.
 * - Detectar falhas de superfície graves que prejudiquem a execução percebida.
 *
 * Função no pipeline:
 * - Este arquivo NÃO normaliza a resposta.
 * - Este arquivo NÃO decide sozinho a integridade final de entrega.
 * - Este arquivo NÃO extrai obrigações.
 * - Este arquivo avalia o quanto a resposta efetivamente realizou o que as obrigações exigiam.
 *
 * Entradas:
 * - obligations: obrigações deliberativas esperadas.
 * - responseText: resposta a ser validada.
 * - surfacePolicy: política opcional de superfície para endurecer certos checks.
 *
 * Saída:
 * - TaskExecutionResult com:
 *   - aprovação ou reprovação;
 *   - score médio ponderado de execução;
 *   - obrigações executadas;
 *   - obrigações não executadas;
 *   - obrigações fracamente executadas;
 *   - issues consolidadas.
 *
 * Garantias esperadas:
 * - Tornar auditável a relação entre obrigação esperada e execução observada.
 * - Detectar respostas curtas demais ou com forma inadequada para tarefas múltiplas.
 * - Penalizar espelhamento de prompt e vazamentos superficiais incompatíveis com a política.
 */

import type {
  DeliberativeObligation,
  ResponseSurfacePolicy,
} from "./deliberative-task-contract-types";
import { scoreObligationSatisfaction } from "./obligation-satisfaction-scorer";

export interface TaskExecutionResult {
  passed: boolean;
  executionScore: number;
  executedObligations: string[];
  unexecutedObligations: string[];
  weakObligations: string[];
  issues: string[];
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function normalizeText(text: string): string {
  return `${text || ""}`
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function countParagraphs(text: string): number {
  return normalizeText(text)
    .split(/\n{2,}/g)
    .map((item) => item.trim())
    .filter(Boolean).length;
}

function countSectionSignals(text: string): number {
  const markers =
    `${text || ""}`.match(/(^|\n)(#+\s+|\d+\.\s+|-\s+|\*\s+|•\s+|\([a-z0-9]+\)\s+)/gim) || [];
  return markers.length;
}

function hasAnswerShape(obligationsCount: number, responseText: string): boolean {
  const trimmed = normalizeText(responseText);

  if (!trimmed) {
    return false;
  }

  const paragraphs = countParagraphs(trimmed);
  const sections = countSectionSignals(trimmed);
  const length = trimmed.length;

  if (obligationsCount <= 1) {
    return paragraphs >= 1 || sections >= 1 || length >= 120;
  }

  if (obligationsCount === 2) {
    return paragraphs >= 2 || sections >= 1 || length >= 260;
  }

  if (obligationsCount <= 4) {
    return paragraphs >= 2 || sections >= 2 || length >= 420;
  }

  return paragraphs >= 3 || sections >= 2 || length >= obligationsCount * 105;
}

function hasPromptMirroringSurface(responseText: string): boolean {
  const normalized = normalizeText(responseText).toLowerCase();

  if (!normalized) {
    return false;
  }

  return (
    /regarding your question|to address the question|the problem statement describes|let me clarify some concepts/.test(
      normalized,
    ) ||
    /consideremos um sistema social idealizado|considere um sistema social idealizado|faremos o seguinte|agora suponha|sem recorrer inicialmente a autores/.test(
      normalized,
    ) ||
    /without initially referring to authors|without referring to authors/.test(normalized)
  );
}

function hasPersonaInjectionSurface(responseText: string): boolean {
  return /^\s*(eu\s+sou\s+let[ií]cia|i(?:'m| am)\s+let[ií]cia|my name is let[ií]cia)\b/i.test(
    normalizeText(responseText),
  );
}

function obligationWeight(obligation: DeliberativeObligation): number {
  const explicitWeight =
    typeof obligation.coverageWeight === "number" && Number.isFinite(obligation.coverageWeight)
      ? obligation.coverageWeight
      : 1;

  const priorityBoost = clamp01((obligation.priority || 0) / 100) * 0.35;

  return Math.max(0.5, explicitWeight + priorityBoost);
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => a.localeCompare(b));
}

export function validateTaskExecution(
  obligations: DeliberativeObligation[],
  responseText: string,
  surfacePolicy?: ResponseSurfacePolicy | null,
): TaskExecutionResult {
  if (!obligations.length) {
    return {
      passed: true,
      executionScore: 1,
      executedObligations: [],
      unexecutedObligations: [],
      weakObligations: [],
      issues: [],
    };
  }

  const normalizedResponse = normalizeText(responseText);

  const scores = obligations.map((item) => ({
    obligation: item,
    result: scoreObligationSatisfaction(item, normalizedResponse),
  }));

  const executedObligations = scores
    .filter((item) => item.result.passed)
    .map((item) => item.result.label);

  const weakObligations = scores
    .filter((item) => !item.result.passed && item.result.score >= 0.42)
    .map((item) => item.result.label);

  const unexecutedObligations = scores
    .filter((item) => item.result.score < 0.42)
    .map((item) => item.result.label);

  const totalWeight = scores.reduce((acc, item) => acc + obligationWeight(item.obligation), 0);

  const weightedScoreSum = scores.reduce(
    (acc, item) => acc + item.result.score * obligationWeight(item.obligation),
    0,
  );

  const executionScore = totalWeight > 0 ? weightedScoreSum / totalWeight : 1;
  const executedCoverage = obligations.length > 0 ? executedObligations.length / obligations.length : 1;
  const effectiveCoverage =
    obligations.length > 0
      ? (executedObligations.length + weakObligations.length * 0.6) / obligations.length
      : 1;

  const issues: string[] = [];

  if (obligations.length >= 2 && !hasAnswerShape(obligations.length, normalizedResponse)) {
    issues.push("missing_answer_shape_for_multi_obligation_task");
  }

  if (hasPromptMirroringSurface(normalizedResponse)) {
    issues.push("prompt_mirroring_surface_detected");
  }

  if (surfacePolicy?.forbidPersonaInjection && hasPersonaInjectionSurface(normalizedResponse)) {
    issues.push("persona_injection_surface_detected");
  }

  if (unexecutedObligations.length > 0) {
    issues.push("unexecuted_obligations_present");
  }

  if (weakObligations.length > Math.max(1, Math.ceil(obligations.length * 0.6))) {
    issues.push("too_many_weak_obligations");
  }

  if (executionScore < 0.58) {
    issues.push("low_average_execution_quality");
  }

  if (obligations.length >= 3 && normalizedResponse.length < obligations.length * 110) {
    issues.push("underdeveloped_for_obligation_count");
  }

  const allowedUnexecuted = obligations.length >= 5 ? 1 : 0;

  const hardFail =
    (obligations.length >= 2 && issues.includes("missing_answer_shape_for_multi_obligation_task")) ||
    issues.includes("prompt_mirroring_surface_detected") ||
    issues.includes("persona_injection_surface_detected") ||
    unexecutedObligations.length > allowedUnexecuted ||
    effectiveCoverage < 0.62 ||
    executionScore < 0.55 ||
    weakObligations.length > Math.ceil(obligations.length * 0.5);

  return {
    passed: !hardFail,
    executionScore: Number(executionScore.toFixed(4)),
    executedObligations: uniqueSorted(executedObligations),
    unexecutedObligations: uniqueSorted(unexecutedObligations),
    weakObligations: uniqueSorted(weakObligations),
    issues: uniqueSorted(issues),
  };
}
