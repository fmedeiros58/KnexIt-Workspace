/**
 * Responsabilidade do arquivo:
 * - Selecionar evidencias com stance de suporte para a consulta atual.
 * - Reaproveitar retrievedSources/retrievedEvidence ja produzidos no layer 07.
 * - Fornecer itens rankeados para elaboracao comunicativa e auditoria epistemica.
 */
import type { DeliberativeGroundingInput, GroundedEvidenceItem } from "./grounded-evidence-packet";
import { dedupeGroundedItems, normalizeGroundingText, scoreLexicalAffinity } from "./grounding-normalizer";

function isGroundedEvidenceItem(item: GroundedEvidenceItem | null): item is GroundedEvidenceItem {
  return item !== null;
}

export function retrieveSupportingEvidence(input: DeliberativeGroundingInput, maxItems = 8): GroundedEvidenceItem[] {
  const fromSources = input.retrievedSources.map((source, index) => {
    const snippet = normalizeGroundingText(source.snippet || source.title);
    const score = Math.max(
      scoreLexicalAffinity(input.query, `${source.title} ${source.snippet}`),
      Math.max(0.2, Math.min(0.92, source.freshnessScore || 0.3)),
    );
    return {
      id: `support:src:${index + 1}`,
      stance: "supporting" as const,
      sourceType: "retrieved_source" as const,
      title: source.title || `source-${index + 1}`,
      snippet,
      url: source.url || "about:blank",
      score,
      tags: ["retrieved", "support"],
    };
  });

  const fromEvidence = input.retrievedEvidence
    .map<GroundedEvidenceItem | null>((evidence, index) => {
      const affinity = scoreLexicalAffinity(input.query, evidence);
      if (affinity < 0.16) return null;
      return {
        id: `support:evidence:${index + 1}`,
        stance: "supporting" as const,
        sourceType: "retrieved_evidence" as const,
        title: `evidence-${index + 1}`,
        snippet: normalizeGroundingText(evidence),
        url: "memory://retrieved_evidence",
        score: Math.max(0.18, affinity),
        tags: ["retrieved", "support", "memory"],
      };
    })
    .filter(isGroundedEvidenceItem);

  return dedupeGroundedItems([...fromSources, ...fromEvidence])
    .sort((a, b) => b.score - a.score)
    .slice(0, maxItems);
}
