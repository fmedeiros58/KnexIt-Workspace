import { createFederatedResearchClient } from "../../infra/research/federated-research-client";
import type { KnowledgeCandidate } from "../knowledge-types";

const federatedResearchClient = createFederatedResearchClient();
let warmed = false;

export interface WebSearchFallbackDiagnostics {
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
}

function convertToKnowledgeCandidate(item: {
  title: string;
  url?: string;
  snippet: string;
  trustScore?: number;
  freshnessScore?: number;
  relevanceScore?: number;
}): KnowledgeCandidate {
  return {
    title: item.title,
    url: item.url || "",
    snippet: item.snippet,
    trustScore: item.trustScore ?? 0.5,
    freshnessScore: item.freshnessScore ?? 0.5,
    relevanceScore: item.relevanceScore ?? 0.5,
    sourceType: "web",
  };
}

export async function searchWebFallback(query: string): Promise<KnowledgeCandidate[]> {
  const normalized = `${query || ""}`.trim();
  if (!normalized) return [];

  const response = await federatedResearchClient.search(normalized, {
    maxResults: 10,
    includeLocal: true,
    includeRemote: true,
  });

  return response.results.map(convertToKnowledgeCandidate);
}

export async function searchWebFallbackDetailed(query: string): Promise<{
  candidates: KnowledgeCandidate[];
  diagnostics: WebSearchFallbackDiagnostics;
}> {
  const normalized = `${query || ""}`.trim();
  if (!normalized) {
    return {
      candidates: [],
      diagnostics: {
        attempted: false,
        query: normalized,
        resultCount: 0,
        providersTried: [],
        providersSucceeded: [],
        providersFailed: [],
        providerMessages: [],
      },
    };
  }

  const response = await federatedResearchClient.search(normalized, {
    maxResults: 12,
    includeLocal: true,
    includeRemote: true,
  });

  const candidates = response.results.map(convertToKnowledgeCandidate);
  const providersTried = response.diagnostics.map((item) => item.provider);
  const providersSucceeded = response.diagnostics.filter((item) => item.ok).map((item) => item.provider);
  const providersFailed = response.diagnostics.filter((item) => !item.ok).map((item) => item.provider);

  return {
    candidates,
    diagnostics: {
      attempted: true,
      query: normalized,
      resultCount: candidates.length,
      providersTried,
      providersSucceeded,
      providersFailed,
      providerMessages: response.diagnostics.map((item) => ({
        provider: item.provider,
        sourceType: item.sourceType,
        ok: item.ok,
        resultCount: item.resultCount,
        failureKind: item.failureKind,
        message: item.message,
        statusCode: item.statusCode,
        durationMs: item.durationMs,
      })),
    },
  };
}

export function primeWebSearchClient(seedQuery = "noticias de hoje brasil"): void {
  if (warmed) return;
  warmed = true;

  void federatedResearchClient
    .search(seedQuery, {
      maxResults: 4,
      includeLocal: true,
      includeRemote: true,
    })
    .catch(() => {
      // Warmup best-effort.
    });
}
