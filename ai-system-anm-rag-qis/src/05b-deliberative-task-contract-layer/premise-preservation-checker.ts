/**
 * ESPECIFICACAO DO ARQUIVO
 * ------------------------
 * Nome: premise-preservation-checker.ts
 * Camada: 05b-deliberative-task-contract-layer
 *
 * Responsabilidade principal:
 * - Extrair premissas relevantes do prompt do usuario.
 * - Construir um ledger auditavel dessas premissas.
 * - Verificar se a resposta enfraqueceu, relativizou ou rebaixou premissas fortes
 *   sem justificativa suficiente.
 */

import type { PremiseLedgerEntry } from "./deliberative-task-contract-types";

export interface PremisePreservationResult {
  premiseLedger: PremiseLedgerEntry[];
  violations: string[];
  score: number;
  passed: boolean;
}

function normalize(text: string): string {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[_/\\-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.map((item) => `${item || ""}`.trim()).filter(Boolean)));
}

function isNormativeClause(text: string): boolean {
  const normalized = normalize(text);
  return (
    /\b(principio|principle|deve|must|obrigatori|mandatory|nao pode|cannot|should)\b/i.test(
      normalized,
    ) ||
    /\bnenhuma\b.*\bpode\b/.test(normalized) ||
    /\btoda\b.*\bdeve\b/.test(normalized)
  );
}

function isInstructionalClause(text: string): boolean {
  return /\b(demonstre|explique|compare|analise|mostre|proponha|reformule|explicite|faca o seguinte|follow these steps)\b/i.test(
    normalize(text),
  );
}

function extractPremiseCandidates(userPrompt: string): string[] {
  const raw = `${userPrompt || ""}`.trim();
  if (!raw) return [];

  const numberedPremises = Array.from(
    raw.matchAll(/(?:\(\s*\d+\s*\)|(?:^|\s)\d+\.)\s*([\s\S]*?)(?=(?:\(\s*\d+\s*\)|(?:^|\s)\d+\.)|$)/gm),
  )
    .map((item) => `${item[0] || ""}`.replace(/[;,\s]+$/g, "").trim())
    .filter(Boolean)
    .filter((item) => isNormativeClause(item));

  if (numberedPremises.length > 0) {
    return numberedPremises;
  }

  const clauses = raw
    .replace(/\r\n?/g, "\n")
    .split(/\n+|(?<=[.;!?])\s+/g)
    .map((line) => line.trim())
    .filter(Boolean);

  const normativeClauses = clauses.filter((line) => isNormativeClause(line) && !isInstructionalClause(line));
  if (normativeClauses.length > 0) {
    return normativeClauses;
  }

  return clauses
    .filter((line) => line.length >= 40)
    .filter((line) => !isInstructionalClause(line))
    .slice(0, 4);
}

function toCoreTerms(text: string): string[] {
  const stopTokens = new Set([
    "nenhuma",
    "toda",
    "decisao",
    "coletiva",
    "deve",
    "podem",
    "pode",
    "possa",
    "dever",
    "aplicada",
    "aplicado",
    "aplicavel",
    "obrigatorio",
    "obrigatoria",
    "regra",
    "criterio",
    "criterios",
  ]);

  const tokens = normalize(text)
    .split(" ")
    .filter((token) => token.length >= 4)
    .filter((token) => !stopTokens.has(token));

  const phrases: string[] = [];
  for (let index = 0; index < tokens.length - 1; index += 1) {
    const first = tokens[index];
    const second = tokens[index + 1];
    if (first.length >= 4 && second.length >= 4) {
      phrases.push(`${first} ${second}`);
    }
  }

  return Array.from(new Set([...phrases, ...tokens])).slice(0, 10);
}

function inferNormativeStrength(text: string): PremiseLedgerEntry["normativeStrength"] {
  const normalized = normalize(text);

  const strongSignal =
    /\b(obrigatori|mandatory|must|deve|should|nao pode|cannot)\b/.test(normalized) ||
    /\bnenhuma\b.*\bpode\b/.test(normalized) ||
    /\btoda\b.*\bdeve\b/.test(normalized);

  return strongSignal ? "strong" : "moderate";
}

function toLedger(userPrompt: string): PremiseLedgerEntry[] {
  const candidates = extractPremiseCandidates(userPrompt);

  return candidates.map((text, idx) => ({
    id: `premise_${idx + 1}`,
    text,
    coreTerms: toCoreTerms(text),
    normativeStrength: inferNormativeStrength(text),
  }));
}

function splitSentences(text: string): string[] {
  return `${text || ""}`
    .split(/(?<=[.!?])\s+|\n+/g)
    .map((item) => item.trim())
    .filter(Boolean);
}

function hasTermOverlap(sentence: string, terms: string[]): boolean {
  return terms.some((term) => term.length >= 5 && sentence.includes(term));
}

function downgradePattern(): RegExp {
  return /\b(e|eh)\s+(?:apenas|so|somente)\s+uma?\s+(?:preferencia|opcao|conveniencia|escolha|diretriz)\b|\b(?:mera|meramente)\s+(?:preferencia|opcao|conveniencia)\b|\bnao\s+(?:e|eh)\s+obrigatori[ao]\b|\b(?:pode|podem)\s+ser\s+(?:flexibilizad[ao]s?|relativizad[ao]s?|dispensad[ao]s?)\b|\bdepende da perspectiva\b/;
}

function contradictionSoftenerPattern(): RegExp {
  return /\b(na pratica nao precisa|nao necessariamente|pode ser dispensad[ao]|dispensavel|nao e obrigatori[ao]|nao eh obrigatori[ao])\b/;
}

function justificationPattern(): RegExp {
  return /\b(porque|pois|since|because|sob a condicao|desde que|if and only if|se e somente se|justifica se|somente quando)\b/;
}

export function checkPremisePreservation(
  userPrompt: string,
  responseText: string,
): PremisePreservationResult {
  const premiseLedger = toLedger(userPrompt);

  if (!premiseLedger.length) {
    return {
      premiseLedger: [],
      violations: [],
      score: 1,
      passed: true,
    };
  }

  const violations: string[] = [];
  const responseSentences = splitSentences(responseText).map((sentence) => normalize(sentence));

  const downgrade = downgradePattern();
  const contradictionSoftener = contradictionSoftenerPattern();
  const justification = justificationPattern();

  for (const premise of premiseLedger) {
    const premiseHits = responseSentences.filter((sentence) =>
      hasTermOverlap(sentence, premise.coreTerms),
    );

    if (!premiseHits.length) {
      continue;
    }

    const hasDowngrade = premiseHits.some(
      (sentence) => downgrade.test(sentence) || contradictionSoftener.test(sentence),
    );

    const hasJustification = premiseHits.some((sentence) => justification.test(sentence));

    if (premise.normativeStrength === "strong" && hasDowngrade && !hasJustification) {
      violations.push(`premise_downgraded_without_justification:${premise.id}`);
    }
  }

  const uniqueViolations = uniqueStrings(violations);
  const score = Math.max(0, Math.min(1, 1 - uniqueViolations.length / Math.max(1, premiseLedger.length)));

  return {
    premiseLedger,
    violations: uniqueViolations,
    score: Number(score.toFixed(4)),
    passed: uniqueViolations.length === 0,
  };
}
