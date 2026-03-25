import type { KnowledgeCandidate } from "../knowledge-types";

export function mergeEvidence(candidates: KnowledgeCandidate[], maxItems = 10): string[] {
  const merged = new Set<string>();
  for (const item of candidates) {
    const snippet = item.snippet.trim();
    if (snippet) merged.add(snippet);
    if (merged.size >= maxItems) break;
  }
  return [...merged];
}
