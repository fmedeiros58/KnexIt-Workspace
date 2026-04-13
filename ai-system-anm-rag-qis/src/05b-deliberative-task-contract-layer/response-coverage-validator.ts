/**
 * ESPECIFICAÇÃO DO ARQUIVO
 * ------------------------
 * Nome: response-coverage-validator.ts
 * Camada: 05b-deliberative-task-contract-layer
 *
 * Responsabilidade principal:
 * - Consolidar a validação final de cobertura deliberativa da resposta.
 * - Agregar sinais vindos de satisfação de obrigações, execução da tarefa,
 *   integridade textual, constraints do prompt, preservação de premissas,
 *   suficiência demonstrativa, novidade e bloqueio final.
 *
 * Função no pipeline:
 * - Este arquivo NÃO normaliza a resposta.
 * - Este arquivo NÃO repara a resposta.
 * - Este arquivo reúne validadores especializados e devolve um CoverageReport
 *   unificado, auditável e utilizável pelo bridge da camada deliberativa.
 *
 * Entradas:
 * - obligations: obrigações deliberativas esperadas.
 * - contract: contrato deliberativo ativo.
 * - responseText: resposta a ser avaliada.
 * - userPrompt: prompt original do usuário.
 * - requiresCounterObjection: exige objeção forte explícita.
 * - requiresAssumptionAudit: exige explicitação de pressupostos.
 * - requiresReformulation: exige reformulação sob incerteza.
 * - assumptionLedger: ledger de pressupostos relevantes.
 *
 * Saída:
 * - CoverageReport com:
 *   - total esperado e satisfeito;
 *   - obrigações faltantes ou fracas;
 *   - issues bloqueantes;
 *   - gateLevel final;
 *   - executionDiagnostics detalhado.
 *
 * Garantias esperadas:
 * - Tornar explícita a origem de falhas de cobertura.
 * - Encaminhar surfacePolicy aos validators que dependem dela.
 * - Evitar que uma resposta aparentemente “longa” mas estruturalmente ruim
 *   passe sem rastreamento claro.
 */

import type {
  AssumptionLedgerEntry,
  CoverageReport,
  DeliberativeObligation,
  ReasoningContract,
} from "./deliberative-task-contract-types";
import { detectAssertionVsProofGap } from "./assertion-vs-proof-detector";
import { validateDemonstrationSufficiency } from "./demonstration-sufficiency-validator";
import { detectPromptRestatement } from "./prompt-restatement-detector";
import { scoreObligationSatisfaction } from "./obligation-satisfaction-scorer";
import { validateTaskExecution } from "./task-execution-validator";
import { detectProofVsIllustration } from "./proof-vs-illustration-detector";
import { enforcePromptConstraints } from "./instruction-constraint-enforcer";
import { checkPremisePreservation } from "./premise-preservation-checker";
import { validateSubtaskCoverage } from "./subtask-coverage-validator";
import { checkResponseIntegrity } from "./response-integrity-gate";
import { runOutputNoveltyAndSufficiencyGate } from "./output-novelty-and-sufficiency-gate";

function normalize(text: string): string {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => `${item || ""}`.trim()).filter(Boolean)));
}

function appendUnique(target: string[], values: string[]): void {
  for (const value of values) {
    const normalized = `${value || ""}`.trim();
    if (!normalized) continue;
    if (!target.includes(normalized)) {
      target.push(normalized);
    }
  }
}

function buildTaggedIssue(prefix: string, values: string[]): string {
  const normalized = uniqueStrings(values);
  return `${prefix}:${normalized.join("|") || "unspecified"}`;
}

function hasCounterObjectionSignal(text: string): boolean {
  return /\b(objecao|objeccao|steelman|contra argumento|critica forte)\b/.test(normalize(text));
}

function hasReformulationUnderUncertaintySignal(text: string): boolean {
  return /\b(reformul\w*|incerteza|estimad\w*|cenario alternativo|faixa de confianca|erro de medicao|intervalos?)\b/.test(
    normalize(text),
  );
}

function hasAssumptionLedgerSignal(text: string, assumptions: AssumptionLedgerEntry[]): boolean {
  if (!assumptions.length) return true;
  return /\b(pressupost|premissa|sem provar|limite)\b/.test(normalize(text));
}

function countSectionSignals(text: string): number {
  const markers =
    text.match(/(^|\n|\s)(#+\s+|\d+\.\s+|-\s+|\*\s+|•\s+|\([a-z0-9]+\)\s+)/gim) || [];
  return markers.length;
}

function countParagraphs(text: string): number {
  return `${text || ""}`
    .split(/\n{2,}/g)
    .map((item) => item.trim())
    .filter(Boolean).length;
}

function isLikelyPortuguesePrompt(prompt: string): boolean {
  const normalized = normalize(prompt);
  if (!normalized) return false;

  const ptSignals =
    (normalized.match(/\b(qual|como|porque|por que|voce|você|nao|não|entao|então|responda|demonstre|explique|mostre|pressupostos)\b/g) || [])
      .length;
  const enSignals =
    (normalized.match(/\b(the|and|with|without|question|consider|demonstrate|show|assumptions)\b/g) || [])
      .length;

  return ptSignals >= Math.max(2, enSignals + 1);
}

function hasStrongEnglishLeak(response: string): boolean {
  const normalized = normalize(response);
  if (!normalized) return false;

  if (
    /\b(regarding your question|to address the question|let me clarify some concepts|the problem statement describes|without initially referring)\b/.test(
      normalized,
    )
  ) {
    return true;
  }

  const enSignals =
    (normalized.match(/\b(the|and|with|without|must|should|consider|question|principles|collective|decision|aggregate|welfare|however|therefore)\b/g) || [])
      .length;
  const ptSignals =
    (normalized.match(/\b(que|como|porque|nao|não|entao|então|deve|coletiva|bem estar|liberdade|resposta)\b/g) || [])
      .length;

  return enSignals >= 8 && enSignals >= ptSignals * 1.25;
}

function buildEmptyPassReport(expected: number): CoverageReport {
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

export function responseCoverageValidator(input: {
  obligations: DeliberativeObligation[];
  contract: ReasoningContract | null;
  responseText: string;
  userPrompt?: string;
  requiresCounterObjection: boolean;
  requiresAssumptionAudit: boolean;
  requiresReformulation: boolean;
  assumptionLedger: AssumptionLedgerEntry[];
}): CoverageReport {
  const obligations = input.obligations || [];
  const expected = obligations.length;
  const effectiveContract: ReasoningContract = input.contract || {
    targetMode: "conversational",
    responseArchitecture: "natural_progressive_response",
    requiredSections: [],
    requiredTransitions: [],
    prohibitedShortcuts: [],
    proofDemandLevel: 0,
    objectionStrengthLevel: 0,
    uncertaintyHandlingMode: "standard",
    assumptionDisclosureMode: "minimal",
    minCoverageThreshold: 0.64,
    preferredAnswerOrder: [],
    terminationCriteria: [],
    surfacePolicy: undefined,
  };
  const surfacePolicy = effectiveContract.surfacePolicy ?? null;

  const responseText = `${input.responseText || ""}`.trim();
  const userPrompt = `${input.userPrompt || ""}`.trim();

  if (expected === 0 && !userPrompt && !responseText) {
    return buildEmptyPassReport(expected);
  }

  if (!responseText) {
    return {
      expected,
      satisfied: 0,
      missing: obligations.map((item) => item.label),
      weaklySatisfied: [],
      needsRevision: true,
      obligationScores: obligations.map((obligation) =>
        scoreObligationSatisfaction(obligation, responseText),
      ),
      blockingIssues: ["empty_response"],
      gateLevel: "hard_fail",
      executionDiagnostics: {
        inputOverlapScore: 0,
        noveltyScore: 0,
        restatementRisk: 0,
        promptConstraints: [],
        constraintViolations: [],
        premiseLedger: [],
        premiseViolations: [],
        proofVsIllustrationScore: 0,
        proofVsIllustrationIssues: ["empty_response"],
        integrityChecks: {
          isTruncated: true,
          hasAbruptEnding: true,
          issues: ["empty_response"],
          missingSections: effectiveContract.requiredSections || [],
        },
        subtaskCoverage: {
          expected,
          satisfied: 0,
          missing: obligations.map((item) => item.label),
          weak: [],
          passed: false,
        },
        finalExecutionGate: {
          shouldBlock: true,
          blockReasons: ["empty_response"],
        },
      },
    };
  }

  const missing: string[] = [];
  const weaklySatisfied: string[] = [];
  const blockingIssues: string[] = [];

  const obligationScores = obligations.map((obligation) =>
    scoreObligationSatisfaction(obligation, responseText),
  );

  let satisfied = 0;
  for (const scored of obligationScores) {
    if (scored.passed) {
      satisfied += 1;
      continue;
    }

    if (scored.score < 0.42) {
      missing.push(scored.label);
    } else {
      weaklySatisfied.push(scored.label);
    }
  }

  const taskExecution = validateTaskExecution(obligations, responseText, surfacePolicy);
  if (!taskExecution.passed) {
    blockingIssues.push(buildTaggedIssue("task_execution_failed", taskExecution.issues));
    appendUnique(missing, taskExecution.unexecutedObligations || []);
    appendUnique(weaklySatisfied, taskExecution.weakObligations || []);
  }

  const restatement = userPrompt ? detectPromptRestatement(userPrompt, responseText) : null;
  if (restatement?.detected) {
    blockingIssues.push(buildTaggedIssue("prompt_restatement_detected", restatement.issues));
  }
  if (restatement && !restatement.detected && restatement.score >= 0.58 && restatement.overlapRatio >= 0.62) {
    blockingIssues.push("prompt_restatement_high_risk_by_score");
  }

  const demonstrationObligations = obligations.filter((item) => item.type === "demonstration");
  const proofVsIllustration = detectProofVsIllustration(responseText, {
    requiresDemonstration: demonstrationObligations.length > 0,
  });
  if (!proofVsIllustration.passed) {
    blockingIssues.push(
      buildTaggedIssue("proof_vs_illustration_failed", proofVsIllustration.issues),
    );
  }

  const constraints = enforcePromptConstraints(userPrompt, responseText);
  if (!constraints.passed) {
    blockingIssues.push(buildTaggedIssue("prompt_constraints_failed", constraints.violations));
  }

  if (isLikelyPortuguesePrompt(userPrompt) && hasStrongEnglishLeak(responseText)) {
    blockingIssues.push("language_mismatch_pt_prompt_with_en_response");
  }

  const premisePreservation = checkPremisePreservation(userPrompt, responseText);
  if (!premisePreservation.passed) {
    blockingIssues.push(
      buildTaggedIssue("premise_preservation_failed", premisePreservation.violations),
    );
  }

  if (demonstrationObligations.length > 0) {
    const demo = validateDemonstrationSufficiency(responseText);
    if (!demo.passed) {
      blockingIssues.push(buildTaggedIssue("demonstration_sufficiency_failed", demo.issues));
    }

    const assertionGap = detectAssertionVsProofGap(responseText);
    if (!assertionGap.passed) {
      blockingIssues.push(buildTaggedIssue("assertion_vs_proof_gap", assertionGap.issues));
    }
  }

  if (input.requiresCounterObjection && !hasCounterObjectionSignal(responseText)) {
    missing.push("objection_missing");
  }

  if (input.requiresReformulation && !hasReformulationUnderUncertaintySignal(responseText)) {
    missing.push("reformulation_missing");
  }

  if (input.requiresAssumptionAudit && !hasAssumptionLedgerSignal(responseText, input.assumptionLedger)) {
    missing.push("assumption_audit_missing");
  }

  const subtaskCoverage = validateSubtaskCoverage({
    obligations,
    scores: obligationScores,
  });

  if (!subtaskCoverage.passed) {
    blockingIssues.push(buildTaggedIssue("subtask_coverage_failed", subtaskCoverage.issues));
    appendUnique(missing, subtaskCoverage.missing || []);
    appendUnique(weaklySatisfied, subtaskCoverage.weak || []);
  }

  const integrity = checkResponseIntegrity({
    responseText,
    expectedObligations: expected,
    satisfiedObligations: subtaskCoverage.satisfied,
    surfacePolicy,
  });

  if (!integrity.passed) {
    blockingIssues.push(buildTaggedIssue("response_integrity_failed", integrity.issues));
  }

  if (expected >= 4 && responseText.length < expected * 180) {
    blockingIssues.push("global_overcompression_for_multi_obligation_task");
  }

  if (expected >= 6 && responseText.length < 1200) {
    blockingIssues.push("underdeveloped_length_for_deep_multi_obligation_task");
  }

  const paragraphCount = countParagraphs(responseText);
  if (
    (expected >= 5 || (effectiveContract.requiredSections || []).length >= 5) &&
    countSectionSignals(responseText) < 3 &&
    paragraphCount < 4
  ) {
    blockingIssues.push("insufficient_structural_sectioning_for_complex_task");
  }

  const coverageRatio = expected > 0 ? satisfied / expected : 1;
  const uniqueMissing = uniqueStrings(missing);
  const uniqueWeak = uniqueStrings(weaklySatisfied);
  const uniqueBlocking = uniqueStrings(blockingIssues);

  const hasSoftFailures =
    uniqueMissing.length > 0 ||
    uniqueWeak.length > Math.max(0, Math.floor(expected * 0.35)) ||
    coverageRatio < effectiveContract.minCoverageThreshold;

  const noveltyGate = runOutputNoveltyAndSufficiencyGate({
    restatementDetected: Boolean(restatement?.detected),
    taskExecutionPassed: taskExecution.passed,
    subtaskCoveragePassed: subtaskCoverage.passed,
    integrityPassed: integrity.passed,
    constraintViolations: constraints.violations,
    premiseViolations: premisePreservation.violations,
    proofVsIllustrationPassed: proofVsIllustration.passed,
    blockingIssues: uniqueBlocking,
  });

  const finalBlockingIssues = uniqueStrings([
    ...uniqueBlocking,
    ...noveltyGate.blockReasons,
  ]);

  const hasHardFailures = finalBlockingIssues.length > 0;
  const gateLevel: CoverageReport["gateLevel"] = hasHardFailures
    ? "hard_fail"
    : hasSoftFailures
      ? "soft_fail"
      : "pass";

  return {
    expected,
    satisfied,
    missing: uniqueMissing,
    weaklySatisfied: uniqueWeak,
    needsRevision: gateLevel !== "pass",
    obligationScores,
    blockingIssues: finalBlockingIssues,
    gateLevel,
    executionDiagnostics: {
      inputOverlapScore: restatement?.overlapRatio ?? 0,
      noveltyScore: restatement?.noveltyRatio ?? 1,
      restatementRisk: restatement?.score ?? 0,
      promptConstraints: constraints.constraints.map((item) => item.description),
      constraintViolations: constraints.violations,
      premiseLedger: premisePreservation.premiseLedger.map((item) => item.text),
      premiseViolations: premisePreservation.violations,
      proofVsIllustrationScore: proofVsIllustration.score,
      proofVsIllustrationIssues: proofVsIllustration.issues,
      integrityChecks: {
        isTruncated: integrity.isTruncated,
        hasAbruptEnding: integrity.hasAbruptEnding,
        issues: integrity.issues,
        missingSections: integrity.missingSections,
      },
      subtaskCoverage: {
        expected: subtaskCoverage.expected,
        satisfied: subtaskCoverage.satisfied,
        missing: subtaskCoverage.missing,
        weak: subtaskCoverage.weak,
        passed: subtaskCoverage.passed,
      },
      finalExecutionGate: {
        shouldBlock: noveltyGate.shouldBlock || finalBlockingIssues.length > 0,
        blockReasons: finalBlockingIssues,
      },
    },
  };
}

