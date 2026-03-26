/**
 * Responsabilidade do arquivo:
 * - Detectar lacunas de cobertura entre consulta e evidencia disponivel.
 * - Sinalizar gaps de alta utilidade para refinamento comunicativo/epistemico.
 * - Evitar extrapolacao quando faltam dados para sustentar claims.
 */
import type { DeliberativeGroundingInput, GroundingGap } from "./grounded-evidence-packet";
import { normalizeGroundingFingerprint } from "./grounding-normalizer";

function tokenize(value: string) {
  return normalizeGroundingFingerprint(value)
    .split(" ")
    .filter((token) => token.length >= 4);
}

function pickTopTokens(tokens: string[], max = 5) {
  const counts = new Map<string, number>();
  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1);
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map((item) => item[0]);
}

export function retrieveEvidenceGaps(input: DeliberativeGroundingInput): GroundingGap[] {
  const queryTokens = pickTopTokens(tokenize(input.query), 8);
  if (!queryTokens.length) {
    return [
      {
        id: "gap:query:empty",
        label: "consulta_pouco_especifica",
        reason: "A pergunta esta ampla e sem termos nucleares suficientes para cobertura robusta.",
        severity: "medium",
      },
    ];
  }

  const coveredText = [
    ...input.retrievedSources.map((item) => `${item.title} ${item.snippet}`),
    ...input.retrievedEvidence,
  ].join(" ");

  const covered = new Set(tokenize(coveredText));
  const missing = queryTokens.filter((token) => !covered.has(token));

  const gaps: GroundingGap[] = [];
  if (missing.length >= 3) {
    gaps.push({
      id: "gap:coverage:high",
      label: "cobertura_semantica_insuficiente",
      reason: `Termos centrais nao cobertos: ${missing.slice(0, 4).join(", ")}.`,
      severity: "high",
    });
  } else if (missing.length > 0) {
    gaps.push({
      id: "gap:coverage:partial",
      label: "cobertura_semantica_parcial",
      reason: `Ainda faltam sinais para: ${missing.slice(0, 3).join(", ")}.`,
      severity: "medium",
    });
  }

  if (!input.retrievedSources.length) {
    gaps.push({
      id: "gap:sources:none",
      label: "sem_fontes_recuperadas",
      reason: "Nao ha fontes recuperadas para auditar factualmente a resposta.",
      severity: "high",
    });
  }

  if (!input.hypothesisSet.length) {
    gaps.push({
      id: "gap:hypothesis:none",
      label: "sem_hipoteses_competidoras",
      reason: "Nao foram abertas hipoteses alternativas para comparar explicacoes.",
      severity: "low",
    });
  }

  return gaps.slice(0, 4);
}

