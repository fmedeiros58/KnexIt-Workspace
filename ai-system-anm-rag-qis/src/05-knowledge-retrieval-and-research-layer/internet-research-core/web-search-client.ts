import type { KnowledgeCandidate } from "../knowledge-types";
import { evaluateSourceTrust } from "./source-trust-evaluator";

export function searchWebFallback(query: string): KnowledgeCandidate[] {
  const normalized = query.trim();
  if (!normalized) return [];
  const candidates: Array<{ title: string; url: string; snippet: string; freshnessScore: number }> = [
    {
      title: "Knowledge Cache Result",
      url: "https://example.org/knowledge-cache",
      snippet: `Resultado sintetico para: ${normalized}`,
      freshnessScore: 0.6,
    },
    {
      title: "Reference Snapshot",
      url: "https://example.com/reference-snapshot",
      snippet: `Referencia externa relacionada a: ${normalized}`,
      freshnessScore: 0.55,
    },
  ];

  return candidates.map((item) => ({
    ...item,
    trustScore: evaluateSourceTrust(item.url),
    relevanceScore: 0.52,
    sourceType: "web" as const,
  }));
}
