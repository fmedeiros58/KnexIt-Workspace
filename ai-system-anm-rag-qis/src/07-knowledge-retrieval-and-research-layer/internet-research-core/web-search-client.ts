import { createSearchClient } from "../../infra/web/search-client";
import type { KnowledgeCandidate } from "../knowledge-types";
import { evaluateRecency } from "./recency-checker";
import { evaluateSourceTrust } from "./source-trust-evaluator";

const searchClient = createSearchClient();
let warmed = false;

function normalize(value: string): string {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function computeRelevance(query: string, title: string, snippet: string): number {
  const queryTokens = new Set(normalize(query).split(" ").filter(Boolean));
  const docTokens = new Set(normalize(`${title} ${snippet}`).split(" ").filter(Boolean));
  if (!queryTokens.size || !docTokens.size) return 0.42;

  let overlap = 0;
  for (const token of queryTokens) {
    if (docTokens.has(token)) overlap += 1;
  }
  const ratio = overlap / queryTokens.size;
  return Math.max(0.35, Math.min(0.96, 0.35 + (ratio * 0.61)));
}

export async function searchWebFallback(query: string): Promise<KnowledgeCandidate[]> {
  const normalized = query.trim();
  if (!normalized) return [];

  const results = await searchClient.search(normalized);
  return results.map((item) => {
    const trustScore = evaluateSourceTrust(item.url);
    const freshnessScore = evaluateRecency({
      updatedAt: item.publishedAt,
      freshnessScore: item.provider === "wikipedia_api" ? 0.76 : undefined,
      snippet: item.snippet,
    });
    const relevanceScore = computeRelevance(normalized, item.title, item.snippet);

    return {
      title: item.title,
      url: item.url,
      snippet: item.snippet,
      freshnessScore,
      trustScore,
      relevanceScore,
      sourceType: "web" as const,
    };
  });
}

export function primeWebSearchClient(seedQuery = "noticias de hoje brasil"): void {
  if (warmed) return;
  warmed = true;
  void searchClient.search(seedQuery, { maxResults: 2 }).catch(() => {
    // Warmup best-effort: nao deve interromper fluxo principal.
  });
}
