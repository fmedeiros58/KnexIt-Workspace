/**
 * ESPECIFICAÇÃO DO ARQUIVO
 * ------------------------
 * Nome: subtask-coverage-validator.ts
 * Camada: 05b-deliberative-task-contract-layer
 *
 * Responsabilidade principal:
 * - Validar a cobertura local das subtarefas/obrigações deliberativas.
 * - Consolidar quais obrigações foram satisfeitas, ficaram fracas ou ausentes.
 * - Produzir um score simples e auditável de cobertura subtask-level.
 *
 * Função no pipeline:
 * - Este arquivo NÃO normaliza texto.
 * - Este arquivo NÃO calcula integridade de superfície.
 * - Este arquivo NÃO decide sozinho o gate global da resposta.
 * - Este arquivo apenas resume, no nível das obrigações, o estado de cobertura.
 *
 * Garantias esperadas:
 * - Lidar de forma estável com listas incompletas ou desalinhadas de scores.
 * - Tornar explícitas as obrigações faltantes e fracamente satisfeitas.
 * - Produzir saída compatível com o agregador de coverage do módulo.
 */

import type {
  DeliberativeObligation,
  ObligationSatisfactionScore,
} from "./deliberative-task-contract-types";

export interface SubtaskCoverageResult {
  expected: number;
  satisfied: number;
  missing: string[];
  weak: string[];
  score: number;
  passed: boolean;
  issues: string[];
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => `${item || ""}`.trim()).filter(Boolean)));
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(1, value));
}

function indexScoresByObligation(scores: ObligationSatisfactionScore[]): Map<string, ObligationSatisfactionScore> {
  const map = new Map<string, ObligationSatisfactionScore>();

  for (const score of scores || []) {
    const key = `${score?.obligationId || ""}`.trim();
    if (!key) {
      continue;
    }

    map.set(key, score);
  }

  return map;
}

export function validateSubtaskCoverage(params: {
  obligations: DeliberativeObligation[];
  scores: ObligationSatisfactionScore[];
}): SubtaskCoverageResult {
  const obligations = params.obligations || [];
  const scores = params.scores || [];

  if (!obligations.length) {
    return {
      expected: 0,
      satisfied: 0,
      missing: [],
      weak: [],
      score: 1,
      passed: true,
      issues: [],
    };
  }

  const scoresByObligation = indexScoresByObligation(scores);

  const missing: string[] = [];
  const weak: string[] = [];
  let satisfied = 0;
  let weightedScoreSum = 0;

  for (const obligation of obligations) {
    const scoreEntry = scoresByObligation.get(obligation.obligationId);

    if (!scoreEntry) {
      missing.push(obligation.label);
      continue;
    }

    const score = clamp01(scoreEntry.score);
    weightedScoreSum += score;

    if (scoreEntry.passed) {
      satisfied += 1;
      continue;
    }

    if (score < 0.42) {
      missing.push(scoreEntry.label || obligation.label);
    } else {
      weak.push(scoreEntry.label || obligation.label);
    }
  }

  const uniqueMissing = uniqueStrings(missing);
  const uniqueWeak = uniqueStrings(weak);
  const expected = obligations.length;
  const score = expected > 0 ? clamp01(weightedScoreSum / expected) : 1;

  const issues: string[] = [];

  if (scores.length < obligations.length) {
    issues.push("incomplete_obligation_scoring_input");
  }

  if (uniqueMissing.length > 0) {
    issues.push("missing_subtasks_present");
  }

  if (uniqueWeak.length > Math.max(1, Math.floor(expected * 0.3))) {
    issues.push("too_many_weak_subtasks");
  }

  if (score < 0.72) {
    issues.push("low_subtask_coverage_score");
  }

  const passed =
    uniqueMissing.length === 0 &&
    uniqueWeak.length <= Math.floor(expected * 0.25) &&
    score >= 0.72;

  return {
    expected,
    satisfied,
    missing: uniqueMissing,
    weak: uniqueWeak,
    score: Number(score.toFixed(4)),
    passed,
    issues: uniqueStrings(issues),
  };
}