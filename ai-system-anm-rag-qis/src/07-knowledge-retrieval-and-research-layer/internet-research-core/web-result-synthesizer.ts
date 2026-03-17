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

export function synthesizeWebResults(results: KnowledgeCandidate[]): string[] {
  const snippets: string[] = [];
  const seen = new Set<string>();

  for (const item of results) {
    const line = `${item.title}: ${item.snippet}`;
    const key = normalize(line);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    snippets.push(line);
    if (snippets.length >= 6) break;
  }

  return snippets;
}
