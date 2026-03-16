import type { KnowledgeCandidate } from "../knowledge-types";

export function collectCitations(candidates: KnowledgeCandidate[]): string[] {
  const seen = new Set<string>();
  const citations: string[] = [];
  for (const item of candidates) {
    if (!item.url || seen.has(item.url)) continue;
    seen.add(item.url);
    citations.push(item.url);
  }
  return citations;
}
