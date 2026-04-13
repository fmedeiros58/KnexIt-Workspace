/**
 * ESPECIFICAÇÃO DO ARQUIVO
 * ------------------------
 * Nome: assertion-vs-proof-detector.ts
 * Camada: 05b-deliberative-task-contract-layer
 *
 * Responsabilidade principal:
 * - Detectar descompasso entre linguagem assertiva/conclusiva
 *   e presença real de sinais inferenciais ou demonstrativos.
 *
 * Função no pipeline:
 * - Este arquivo NÃO prova nada por si só.
 * - Este arquivo NÃO normaliza a resposta para entrega.
 * - Este arquivo NÃO decide sozinho o gate global.
 * - Este arquivo apenas estima se a resposta usa conclusão demais
 *   para sustentação de menos.
 *
 * Garantias esperadas:
 * - Sinalizar excesso de linguagem conclusiva sem derivação.
 * - Fornecer score simples e auditável.
 * - Produzir lista curta de marcadores suspeitos para depuração.
 */

export interface AssertionVsProofResult {
  score: number;
  passed: boolean;
  suspiciousAssertions: string[];
  issues: string[];
}

function normalize(text: string): string {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => `${item || ""}`.trim()).filter(Boolean)));
}

const ASSERTION_PATTERNS: RegExp[] = [
  /\bha contextos? em que\b/g,
  /\bo conflito e estrutural\b/g,
  /\blogo\b/g,
  /\bportanto\b/g,
  /\bfica claro que\b/g,
  /\btorna se\b/g,
  /\bdisso segue que\b/g,
  /\bconclui se que\b/g,
  /\bconsideremos um sistema social idealizado\b/g,
  /\bfaremos o seguinte\b/g,
  /\bagora suponha\b/g,
  /\bdemonstraremos formalmente\b/g,
  /\bmostraremos\b/g,
];

const PROOF_PATTERNS: RegExp[] = [
  /\bse .* entao\b/g,
  /\bif .* then\b/g,
  /\bimplica\b/g,
  /\bimplies\b/g,
  /\bderiva\b/g,
  /\bconstrua? um estado\b/g,
  /\bcondicoes suficientes\b/g,
  /\bmostramos que\b/g,
  /\bnao existe decisao\b/g,
  /\bassuma\b/g,
  /\bdado que\b/g,
  /\bsob essas condicoes\b/g,
  /\bpara todo\b/g,
  /\bexiste\b/g,
  /\binsatisfazibilidade\b/g,
  /\bpredicad(?:o|os)\b/g,
];

function collectMatches(source: string, patterns: RegExp[]): string[] {
  const out: string[] = [];

  for (const pattern of patterns) {
    const matches = source.match(pattern) || [];
    out.push(...matches.map((item) => item.trim()));
  }

  return uniqueStrings(out);
}

function responseSentenceCount(text: string): number {
  return `${text || ""}`
    .split(/(?<=[.!?])\s+|\n+/g)
    .map((item) => item.trim())
    .filter(Boolean).length;
}

function lightLengthGuard(score: number, text: string): number {
  const sentences = responseSentenceCount(text);
  const length = `${text || ""}`.trim().length;

  if (length < 120 || sentences <= 1) {
    return Math.min(score, 0.45);
  }

  if (length < 220 || sentences <= 2) {
    return Math.min(score, 0.62);
  }

  return score;
}

function hasIllustrativeSubstitution(source: string): boolean {
  return /\b(por exemplo|for example|imagine|caso concreto|uma lei que|a law that)\b/.test(source);
}

function hasPromptReplayLead(source: string): boolean {
  return /^consideremos um sistema social idealizado\b/.test(source) ||
    /^considere um sistema social idealizado\b/.test(source) ||
    /\bfaremos o seguinte\b/.test(source) ||
    /\bagora suponha\b/.test(source);
}

function hasOpenEnding(source: string): boolean {
  if (/[:;,\-]$/.test(source)) return true;
  if (/\b(e|ou|mas|porque|portanto|logo|assim|entao|and|or|but|because|therefore)\s*$/.test(source)) return true;
  if (!/[.!?)]$/.test(source)) {
    const tail = (source.match(/([a-zA-Z\u00C0-\u017F]{3,24})$/) || [])[1] || "";
    if (tail && !/^(sim|nao|fim|logo|assim|entao|portanto|conclusao|sintese)$/i.test(tail)) {
      return true;
    }
  }
  return false;
}

export function detectAssertionVsProofGap(responseText: string): AssertionVsProofResult {
  const rawText = `${responseText || ""}`.trim();
  const normalized = normalize(rawText);

  if (!normalized) {
    return {
      score: 0,
      passed: false,
      suspiciousAssertions: [],
      issues: ["empty_response"],
    };
  }

  const assertions = collectMatches(normalized, ASSERTION_PATTERNS);
  const proofSignals = collectMatches(normalized, PROOF_PATTERNS);

  const assertionCount = assertions.length;
  const proofCount = proofSignals.length;
  const replayLead = hasPromptReplayLead(normalized);

  const supportRatio =
    assertionCount === 0
      ? proofCount > 0
        ? 1
        : 0.85
      : Math.min(1, proofCount / assertionCount);

  let score = Math.max(0, Math.min(1, 0.3 + supportRatio * 0.7));
  score = lightLengthGuard(score, rawText);

  const issues: string[] = [];

  if (assertionCount >= 2 && proofCount === 0) {
    issues.push("assertions_without_inference_support");
  }

  if (assertionCount > proofCount + 1) {
    issues.push("excess_conclusive_language_without_derivation");
  }

  if (assertionCount >= 3 && proofCount <= 1) {
    issues.push("conclusion_density_exceeds_proof_density");
  }

  if (score < 0.5) {
    issues.push("weak_proof_signal_profile");
  }
  if (/\b(demonstraremos|mostraremos|faremos o seguinte)\b/.test(normalized) && proofCount < 2) {
    issues.push("declared_demonstration_without_effective_derivation");
  }
  if (hasIllustrativeSubstitution(normalized) && proofCount < 2) {
    issues.push("illustrative_example_substitutes_formal_proof");
  }
  if (replayLead && proofCount < 2) {
    issues.push("prompt_replay_instead_of_demonstration");
  }
  if (hasOpenEnding(rawText)) {
    issues.push("truncated_or_open_ending_detected");
  }

  const uniqueIssues = uniqueStrings(issues);
  const criticalIssue =
    uniqueIssues.includes("prompt_replay_instead_of_demonstration") ||
    uniqueIssues.includes("declared_demonstration_without_effective_derivation") ||
    uniqueIssues.includes("illustrative_example_substitutes_formal_proof") ||
    uniqueIssues.includes("truncated_or_open_ending_detected");

  return {
    score: Number(score.toFixed(4)),
    passed: !criticalIssue && (uniqueIssues.length === 0 || score >= 0.74),
    suspiciousAssertions: assertions.slice(0, 8),
    issues: uniqueIssues,
  };
}
