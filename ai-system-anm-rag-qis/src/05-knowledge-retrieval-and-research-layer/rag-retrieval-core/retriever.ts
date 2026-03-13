import type { KnowledgeCandidate } from "../knowledge-types";
import { applyFreshnessControl } from "./freshness-control";
import { runHybridSearch } from "./hybrid-search";
import { rerankCandidates } from "./reranker";
import { rankSourcesByTrustAndFreshness } from "./source-ranking";

export function runRetriever(query: string, candidates: KnowledgeCandidate[], topK = 8): KnowledgeCandidate[] {
  const hybrid = runHybridSearch(query, candidates, topK * 2);
  const fresh = applyFreshnessControl(hybrid);
  const reranked = rerankCandidates(fresh);
  const trustSorted = rankSourcesByTrustAndFreshness(reranked);
  return trustSorted.slice(0, topK);
}
