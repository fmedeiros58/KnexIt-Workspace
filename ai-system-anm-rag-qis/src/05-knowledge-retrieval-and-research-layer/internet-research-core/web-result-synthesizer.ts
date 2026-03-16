import type { KnowledgeCandidate } from "../knowledge-types";

export function synthesizeWebResults(results: KnowledgeCandidate[]): string[] {
  return results
    .map((item) => `${item.title}: ${item.snippet}`)
    .slice(0, 6);
}
