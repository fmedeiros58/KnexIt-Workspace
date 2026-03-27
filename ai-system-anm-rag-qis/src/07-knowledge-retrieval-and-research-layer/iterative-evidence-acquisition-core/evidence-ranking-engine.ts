/**
 * Responsabilidade do arquivo:
 * - Ranquear evidencia condicionada para consumo epistêmico e de reasoning.
 * - Combinar relevancia, confiabilidade, frescor e convergencia preliminar.
 * - Produzir ordenacao estavel para reduzir oscilacao de resposta.
 */
import { resolveSourceReliabilityWeight } from "./source-reliability-profile";
import type { EvidenceItem } from "./iterative-acquisition-types";

function stagePriority(stage: EvidenceItem["stage"]): number {
  if (stage === "context_immediate" || stage === "transient_memory") return 0.46;
  if (stage === "local_retriever" || stage === "rag_internal") return 0.62;
  if (stage === "vector_lookup") return 0.58;
  if (stage === "local_structured_sources" || stage === "internal_connectors") return 0.68;
  if (stage === "confirmatory_round") return 0.72;
  if (stage === "contrastive_round") return 0.63;
  return 0.56;
}

function resolveRoundBonus(round: EvidenceItem["round"]): number {
  if (round === "confirmation") return 0.06;
  if (round === "contrast") return 0.04;
  if (round === "focalization") return 0.03;
  return 0;
}

export function rankConditionedEvidence(items: EvidenceItem[]): EvidenceItem[] {
  return [...items]
    .map((row) => {
      const reliability = resolveSourceReliabilityWeight(row.sourceType, row.provider);
      const score = (
        (row.relevanceScore * 0.3) +
        (row.trustScore * 0.22) +
        (row.freshnessScore * 0.18) +
        (row.retrievalScore * 0.2) +
        (reliability * 0.1) +
        resolveRoundBonus(row.round) +
        ((stagePriority(row.stage) - 0.5) * 0.04)
      );
      return {
        ...row,
        retrievalScore: Math.max(0, Math.min(1, score)),
      };
    })
    .sort((a, b) => b.retrievalScore - a.retrievalScore);
}

