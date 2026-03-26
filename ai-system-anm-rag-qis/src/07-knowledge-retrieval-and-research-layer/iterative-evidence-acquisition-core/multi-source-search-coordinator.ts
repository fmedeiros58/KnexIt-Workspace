/**
 * Responsabilidade do arquivo:
 * - Coordenar busca em multiplas fontes sob estagio/rodada controlados.
 * - Reaproveitar retriever local, RAG, vector lookup e web providers existentes.
 * - Entregar itens homogenizados para conditioning/ranking.
 */
import { normalizeWhitespace, truncateText } from "../../shared/utils/text-utils";
import { getSystemKnowledgeHints } from "../internal-knowledge-core/system-knowledge-base";
import { runRetriever } from "../rag-retrieval-core/retriever";
import { runVectorSearch } from "../rag-retrieval-core/vector-search";
import type { KnowledgeCandidate } from "../knowledge-types";
import { runWebSearchProviderRegistry } from "./web-search-provider-registry";
import { acquireFederatedEvidence } from "./federated-evidence-coordinator";
import {
  retrieveLiveLexicalEvidence,
  retrieveLiveVectorEvidence,
  type LiveRetrievalHit,
} from "./live-retrieval-adapter";
import type {
  EvidenceItem,
  FunctionalSourceType,
  IterativeAcquisitionPolicy,
  IterativeAcquisitionRequest,
  RetrievalStage,
  SearchRoundKind,
} from "./iterative-acquisition-types";

function asKnowledgeCandidate(
  input: {
    title: string;
    url: string;
    snippet: string;
    freshnessScore?: number;
    trustScore?: number;
    relevanceScore?: number;
    sourceType?: KnowledgeCandidate["sourceType"];
  },
): KnowledgeCandidate {
  return {
    title: input.title || "candidate",
    url: input.url || "about:blank",
    snippet: truncateText(normalizeWhitespace(input.snippet || ""), 360),
    freshnessScore: Math.max(0, Math.min(1, input.freshnessScore ?? 0.52)),
    trustScore: Math.max(0, Math.min(1, input.trustScore ?? 0.54)),
    relevanceScore: Math.max(0, Math.min(1, input.relevanceScore ?? 0.5)),
    sourceType: input.sourceType || "existing",
  };
}

function toEvidenceItem(
  candidate: KnowledgeCandidate,
  stage: RetrievalStage,
  round: SearchRoundKind,
  sourceType: FunctionalSourceType,
  provider: string,
  rankBoost = 0,
): EvidenceItem {
  return {
    id: `${sourceType}:${provider}:${candidate.url}:${candidate.title}`.toLowerCase(),
    title: candidate.title,
    url: candidate.url,
    snippet: candidate.snippet,
    sourceType,
    provider,
    stage,
    round,
    relevanceScore: Math.max(0, Math.min(1, candidate.relevanceScore + rankBoost)),
    trustScore: candidate.trustScore,
    freshnessScore: candidate.freshnessScore,
    retrievalScore: Math.max(0, Math.min(1, (candidate.relevanceScore * 0.55) + (candidate.trustScore * 0.45) + rankBoost)),
    tags: [stage, round, sourceType],
  };
}

function toEvidenceItemFromLiveHit(
  hit: LiveRetrievalHit,
  stage: RetrievalStage,
  round: SearchRoundKind,
  overrideSourceType?: FunctionalSourceType,
): EvidenceItem {
  const sourceType = overrideSourceType || hit.sourceType;
  return {
    id: `${sourceType}:${hit.provider}:${hit.id}`.toLowerCase(),
    title: hit.title,
    url: hit.url,
    snippet: hit.snippet,
    sourceType,
    provider: hit.provider,
    stage,
    round,
    relevanceScore: Math.max(0, Math.min(1, hit.relevanceScore)),
    trustScore: Math.max(0, Math.min(1, hit.trustScore)),
    freshnessScore: Math.max(0, Math.min(1, hit.freshnessScore)),
    retrievalScore: Math.max(0, Math.min(1, hit.retrievalScore)),
    tags: [...new Set([stage, round, sourceType, ...(hit.tags || [])])],
  };
}

function toEvidenceItemFromCandidate(
  row: KnowledgeCandidate,
  stage: RetrievalStage,
  round: SearchRoundKind,
  provider: string,
): EvidenceItem {
  return {
    id: `web:${provider}:${row.url}:${row.title}`.toLowerCase(),
    title: row.title || "web-result",
    url: row.url || "about:blank",
    snippet: row.snippet || "",
    sourceType: "web",
    provider,
    stage,
    round,
    relevanceScore: Math.max(0, Math.min(1, row.relevanceScore || 0.5)),
    trustScore: Math.max(0, Math.min(1, row.trustScore || 0.5)),
    freshnessScore: Math.max(0, Math.min(1, row.freshnessScore || 0.5)),
    retrievalScore: Math.max(
      0,
      Math.min(1, (row.relevanceScore || 0.5) * 0.5 + (row.trustScore || 0.5) * 0.3 + (row.freshnessScore || 0.5) * 0.2),
    ),
    tags: ["web", "federated", stage, round],
  };
}

function buildCandidatePool(request: IterativeAcquisitionRequest): KnowledgeCandidate[] {
  const fromExisting = request.existingSources.map((row) =>
    asKnowledgeCandidate({
      title: row.title,
      url: row.url,
      snippet: row.snippet,
      freshnessScore: row.freshnessScore,
      trustScore: row.url.startsWith("http") ? 0.62 : 0.48,
      relevanceScore: 0.52,
      sourceType: "existing",
    }),
  );
  const fromContext = request.conversationContext.slice(-5).map((text, index) =>
    asKnowledgeCandidate({
      title: `context-${index + 1}`,
      url: `memory://context/${index + 1}`,
      snippet: text,
      freshnessScore: 0.64,
      trustScore: 0.5,
      relevanceScore: 0.46,
      sourceType: "context",
    }),
  );
  const fromMemory = request.memoryHints.slice(-6).map((text, index) =>
    asKnowledgeCandidate({
      title: `memory-${index + 1}`,
      url: `memory://short/${index + 1}`,
      snippet: text,
      freshnessScore: 0.58,
      trustScore: 0.52,
      relevanceScore: 0.44,
      sourceType: "memory",
    }),
  );
  return [...request.baseCandidates, ...fromExisting, ...fromContext, ...fromMemory];
}

function dedupeByUrl(items: EvidenceItem[], topK: number): EvidenceItem[] {
  const byUrl = new Map<string, EvidenceItem>();
  for (const item of items) {
    const key = `${item.url}`.toLowerCase();
    if (!key) continue;
    const previous = byUrl.get(key);
    if (!previous || item.retrievalScore > previous.retrievalScore) {
      byUrl.set(key, item);
    }
  }
  return Array.from(byUrl.values())
    .sort((a, b) => b.retrievalScore - a.retrievalScore)
    .slice(0, topK);
}

export async function runMultiSourceSearchCoordinator(input: {
  request: IterativeAcquisitionRequest;
  policy: IterativeAcquisitionPolicy;
  stage: RetrievalStage;
  round: SearchRoundKind;
  queries: string[];
  topK: number;
}): Promise<EvidenceItem[]> {
  const query = input.queries[0] || input.request.query;
  const candidatePool = buildCandidatePool(input.request);
  const topK = Math.max(1, input.topK);

  if (input.stage === "context_immediate") {
    const rows = candidatePool
      .filter((row) => row.sourceType === "context" || row.sourceType === "existing")
      .slice(0, topK)
      .map((row) => toEvidenceItem(row, input.stage, input.round, row.sourceType === "context" ? "context" : "existing", "local_cache", 0.03));
    return dedupeByUrl(rows, topK);
  }

  if (input.stage === "transient_memory") {
    const rows = candidatePool
      .filter((row) => row.sourceType === "memory" || row.url.startsWith("memory://"))
      .slice(0, topK)
      .map((row) => toEvidenceItem(row, input.stage, input.round, "memory", "local_cache", 0.02));
    return dedupeByUrl(rows, topK);
  }

  if (input.stage === "local_retriever") {
    const retrieved = runRetriever(query, candidatePool, topK);
    return dedupeByUrl(
      retrieved.map((row) => toEvidenceItem(row, input.stage, input.round, "retriever", "rag_retriever", 0.05)),
      topK,
    );
  }

  if (input.stage === "rag_internal") {
    const expanded = input.queries.flatMap((variant) => runRetriever(variant, candidatePool, Math.max(topK, 6)));
    const liveRows = await retrieveLiveLexicalEvidence(query, Math.max(topK, 6));
    const fromLocal = expanded.map((row) => toEvidenceItem(row, input.stage, input.round, "rag", "rag_retriever", 0.07));
    const fromLive = liveRows.map((row) => toEvidenceItemFromLiveHit(row, input.stage, input.round, "rag"));
    return dedupeByUrl([...fromLive, ...fromLocal], topK);
  }

  if (input.stage === "vector_lookup") {
    const vectorRows = runVectorSearch(query, candidatePool, topK);
    const liveRows = await retrieveLiveVectorEvidence(query, topK);
    const fromLocal = vectorRows.map((row) => toEvidenceItem(row, input.stage, input.round, "vector", "vector_lookup", 0.04));
    const fromLive = liveRows.map((row) => toEvidenceItemFromLiveHit(row, input.stage, input.round, "vector"));
    return dedupeByUrl([...fromLive, ...fromLocal], topK);
  }

  if (input.stage === "local_structured_sources") {
    const docs = input.request.existingSources.map((row) =>
      asKnowledgeCandidate({
        title: row.title,
        url: row.url,
        snippet: row.snippet,
        freshnessScore: row.freshnessScore,
        trustScore: row.url.startsWith("http") ? 0.66 : 0.6,
        relevanceScore: 0.58,
        sourceType: "existing",
      }),
    );
    const liveRows = await retrieveLiveLexicalEvidence(query, topK);
    const fromLocal = docs.map((row) => toEvidenceItem(row, input.stage, input.round, "docs", "local_structured_sources", 0.06));
    const fromLive = liveRows.map((row) => toEvidenceItemFromLiveHit(row, input.stage, input.round, "docs"));
    return dedupeByUrl([...fromLive, ...fromLocal], topK);
  }

  if (input.stage === "internal_connectors") {
    const hints = getSystemKnowledgeHints(query).map((text, index) =>
      toEvidenceItem(
        asKnowledgeCandidate({
          title: `connector-hint-${index + 1}`,
          url: `internal://connector/${index + 1}`,
          snippet: text,
          freshnessScore: 0.7,
          trustScore: 0.72,
          relevanceScore: 0.55,
          sourceType: "internal",
        }),
        input.stage,
        input.round,
        "connector",
        "internal_connector",
        0.08,
      ),
    );
    return dedupeByUrl(hints, topK);
  }

  if (input.stage === "web_multi_provider" || input.stage === "confirmatory_round" || input.stage === "contrastive_round") {
    if (!input.policy.enableWeb) return [];
    const queryLine =
      input.stage === "confirmatory_round"
        ? `${query} confirmacao fonte independente`
        : input.stage === "contrastive_round"
          ? `${query} contradicao divergencia`
          : query;
    const federated = await acquireFederatedEvidence(queryLine).catch(() => null);
    const federatedRows = (federated?.accepted || []).map((row) =>
      toEvidenceItemFromCandidate(row, input.stage, input.round, "federated_research"),
    );
    const web = await runWebSearchProviderRegistry({
      query: queryLine,
      stage: "web_multi_provider",
      round: input.round,
      providers: input.policy.preferredWebProviders.slice(0, input.policy.searchBudget.providerCap),
      maxResults: topK,
    }).catch(() => []);
    return dedupeByUrl(
      [...federatedRows, ...web.map((row) => ({ ...row, stage: input.stage }))],
      topK,
    );
  }

  return [];
}
