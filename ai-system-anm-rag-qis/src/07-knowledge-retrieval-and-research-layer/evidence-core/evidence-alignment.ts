import type { KnowledgeCandidate } from "../knowledge-types";

function normalize(value: string): string {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hitScore(query: string, text: string) {
  const terms = normalize(query).split(/\W+/g).filter((item) => item.length > 2);
  const hay = normalize(text);
  const hits = terms.filter((term) => hay.includes(term)).length;
  return hits / Math.max(1, terms.length);
}

function sourceWeight(sourceType: KnowledgeCandidate["sourceType"]): number {
  if (sourceType === "web") return 1;
  if (sourceType === "existing") return 0.76;
  if (sourceType === "internal") return 0.64;
  if (sourceType === "memory") return 0.46;
  return 0.38;
}

function queryEchoPenalty(query: string, snippet: string): number {
  const normalizedQuery = normalize(query);
  const normalizedSnippet = normalize(snippet);
  if (!normalizedQuery || !normalizedSnippet) return 0;

  if (normalizedSnippet === normalizedQuery) return 0.38;
  if (normalizedSnippet.includes(normalizedQuery) && normalizedSnippet.length <= normalizedQuery.length + 24) return 0.24;
  return 0;
}

export function alignEvidenceToQuery(
  query: string,
  candidates: KnowledgeCandidate[],
  options?: { preferWeb?: boolean },
): KnowledgeCandidate[] {
  return candidates
    .map((item) => {
      const lexical = Math.max(item.relevanceScore, hitScore(query, item.snippet));
      const base =
        (lexical * 0.55) +
        (Math.max(0, Math.min(1, item.trustScore)) * 0.25) +
        (Math.max(0, Math.min(1, item.freshnessScore)) * 0.15) +
        (sourceWeight(item.sourceType) * 0.05);
      const preferWebBonus = options?.preferWeb && item.sourceType === "web" ? 0.1 : 0;
      const score = Math.max(0, Math.min(1, base + preferWebBonus - queryEchoPenalty(query, item.snippet)));
      return {
        ...item,
        relevanceScore: score,
      };
    })
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}
