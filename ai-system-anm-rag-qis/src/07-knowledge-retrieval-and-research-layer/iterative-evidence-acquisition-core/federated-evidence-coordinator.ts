import { searchWebFallbackDetailed } from "../internet-research-core/web-search-client";
import type { KnowledgeCandidate } from "../knowledge-types";

export interface FederatedEvidencePackage {
  candidates: KnowledgeCandidate[];
  accepted: KnowledgeCandidate[];
  rejected: KnowledgeCandidate[];
  diagnostics: {
    attempted: boolean;
    query: string;
    resultCount: number;
    providersTried: string[];
    providersSucceeded: string[];
    providersFailed: string[];
    providerMessages: Array<{
      provider: string;
      sourceType: string;
      ok: boolean;
      resultCount: number;
      failureKind?: string;
      message?: string;
      statusCode?: number;
      durationMs?: number;
    }>;
  };
}

function scoreCandidate(candidate: KnowledgeCandidate): number {
  return (candidate.relevanceScore || 0) * 0.5 + (candidate.trustScore || 0) * 0.3 + (candidate.freshnessScore || 0) * 0.2;
}

export async function acquireFederatedEvidence(query: string): Promise<FederatedEvidencePackage> {
  const response = await searchWebFallbackDetailed(query);

  const accepted: KnowledgeCandidate[] = [];
  const rejected: KnowledgeCandidate[] = [];

  for (const candidate of response.candidates) {
    const score = scoreCandidate(candidate);
    if (score >= 0.62) {
      accepted.push(candidate);
    } else {
      rejected.push(candidate);
    }
  }

  accepted.sort((a, b) => scoreCandidate(b) - scoreCandidate(a));

  return {
    candidates: response.candidates,
    accepted,
    rejected,
    diagnostics: response.diagnostics,
  };
}
