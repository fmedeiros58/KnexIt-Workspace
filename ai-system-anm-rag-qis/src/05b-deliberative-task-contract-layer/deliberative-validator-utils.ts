/**
 * Responsabilidade:
 * - Reunir utilitarios pequenos de validacao deliberativa para reduzir duplicacao.
 * - Manter helpers puros e tipados para uso por validators.
 */

import type { AssumptionLedgerEntry, CoverageReport } from "./deliberative-task-contract-types";

function normalize(text: string): string {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => `${item || ""}`.trim()).filter(Boolean)));
}

export function appendUnique(target: string[], values: string[]): void {
  for (const value of values) {
    const normalizedValue = `${value || ""}`.trim();
    if (!normalizedValue) continue;
    if (!target.includes(normalizedValue)) target.push(normalizedValue);
  }
}

export function buildTaggedIssue(prefix: string, values: string[]): string {
  const normalizedValues = uniqueStrings(values);
  return `${prefix}:${normalizedValues.join("|") || "unspecified"}`;
}

export function hasCounterObjectionSignal(text: string): boolean {
  return /\b(objecao|objeccao|steelman|contra argumento|critica forte)\b/.test(normalize(text));
}

export function hasReformulationUnderUncertaintySignal(text: string): boolean {
  return /\b(reformul|incerteza|estimad|cenario alternativo|faixa de confianca)\b/.test(normalize(text));
}

export function hasAssumptionLedgerSignal(text: string, assumptions: AssumptionLedgerEntry[]): boolean {
  if (!assumptions.length) return true;
  return /\b(pressupost|premissa|sem provar|limite)\b/.test(normalize(text));
}

export function buildEmptyPassCoverageReport(expected: number): CoverageReport {
  return {
    expected,
    satisfied: expected,
    missing: [],
    weaklySatisfied: [],
    needsRevision: false,
    obligationScores: [],
    blockingIssues: [],
    gateLevel: "pass",
    executionDiagnostics: {
      inputOverlapScore: 0,
      noveltyScore: 1,
      restatementRisk: 0,
      promptConstraints: [],
      constraintViolations: [],
      premiseLedger: [],
      premiseViolations: [],
      proofVsIllustrationScore: 1,
      proofVsIllustrationIssues: [],
      integrityChecks: {
        isTruncated: false,
        hasAbruptEnding: false,
        issues: [],
        missingSections: [],
      },
      subtaskCoverage: {
        expected,
        satisfied: expected,
        missing: [],
        weak: [],
        passed: true,
      },
      finalExecutionGate: {
        shouldBlock: false,
        blockReasons: [],
      },
    },
  };
}

