import type { KnowledgeCandidate } from "../knowledge-types";

export function detectEvidenceContradictions(candidates: KnowledgeCandidate[]): string[] {
  const issues: string[] = [];
  const snippets = candidates.map((item) => item.snippet.toLowerCase());
  if (snippets.some((item) => item.includes("nao")) && snippets.some((item) => item.includes("sim"))) {
    issues.push("possible_binary_conflict");
  }
  if (candidates.length >= 2) {
    const freshnessSpread = Math.max(...candidates.map((item) => item.freshnessScore))
      - Math.min(...candidates.map((item) => item.freshnessScore));
    if (freshnessSpread > 0.55) issues.push("recency_conflict");
  }
  return issues;
}
