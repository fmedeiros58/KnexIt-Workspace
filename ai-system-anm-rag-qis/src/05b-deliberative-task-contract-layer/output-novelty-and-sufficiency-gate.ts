/**
 * ESPECIFICAÇÃO DO ARQUIVO
 * ------------------------
 * Nome: output-novelty-and-sufficiency-gate.ts
 * Camada: 05b-deliberative-task-contract-layer
 *
 * Responsabilidade principal:
 * - Consolidar sinais finais de bloqueio relacionados a novidade, suficiência
 *   de execução e integridade de saída.
 *
 * Função no pipeline:
 * - Este arquivo NÃO normaliza texto.
 * - Este arquivo NÃO repara a resposta.
 * - Este arquivo NÃO calcula cobertura detalhada de obrigações.
 * - Este arquivo apenas agrega sinais já produzidos por validators anteriores
 *   e decide se a saída deve ser bloqueada.
 *
 * Entradas:
 * - Sinais booleanos de restatement, execução, cobertura, integridade e prova.
 * - Violações de constraints e premissas.
 * - Lista de blockingIssues já detectadas anteriormente.
 *
 * Saída:
 * - shouldBlock: indica se a saída deve ser bloqueada.
 * - blockReasons: lista final, única e estável de razões de bloqueio.
 *
 * Garantias esperadas:
 * - Produzir uma lista deduplicada e auditável de motivos.
 * - Evitar ruído de strings vazias ou malformadas.
 * - Manter decisão de bloqueio determinística.
 */

export interface OutputNoveltyAndSufficiencyGateResult {
  shouldBlock: boolean;
  blockReasons: string[];
}

function normalizeReason(value: string): string {
  return `${value || ""}`.trim();
}

function addReason(target: Set<string>, value: string): void {
  const normalized = normalizeReason(value);
  if (!normalized) {
    return;
  }

  target.add(normalized);
}

function addPrefixedReasons(target: Set<string>, prefix: string, values: string[]): void {
  for (const value of values || []) {
    const normalized = normalizeReason(value);
    if (!normalized) {
      continue;
    }

    target.add(`${prefix}:${normalized}`);
  }
}

function stableReasons(values: Set<string>): string[] {
  return Array.from(values).sort((a, b) => a.localeCompare(b));
}

export function runOutputNoveltyAndSufficiencyGate(input: {
  restatementDetected: boolean;
  taskExecutionPassed: boolean;
  subtaskCoveragePassed: boolean;
  integrityPassed: boolean;
  constraintViolations: string[];
  premiseViolations: string[];
  proofVsIllustrationPassed: boolean;
  blockingIssues: string[];
}): OutputNoveltyAndSufficiencyGateResult {
  const reasons = new Set<string>();

  for (const issue of input.blockingIssues || []) {
    addReason(reasons, issue);
  }

  if (input.restatementDetected) {
    addReason(reasons, "output_is_prompt_restatement");
  }

  if (!input.taskExecutionPassed) {
    addReason(reasons, "task_execution_not_satisfied");
  }

  if (!input.subtaskCoveragePassed) {
    addReason(reasons, "subtask_coverage_not_satisfied");
  }

  if (!input.integrityPassed) {
    addReason(reasons, "response_integrity_failed");
  }

  if (!input.proofVsIllustrationPassed) {
    addReason(reasons, "proof_vs_illustration_failed");
  }

  addPrefixedReasons(reasons, "prompt_constraint_violation", input.constraintViolations || []);
  addPrefixedReasons(reasons, "premise_preservation_violation", input.premiseViolations || []);

  const blockReasons = stableReasons(reasons);

  return {
    shouldBlock: blockReasons.length > 0,
    blockReasons,
  };
}