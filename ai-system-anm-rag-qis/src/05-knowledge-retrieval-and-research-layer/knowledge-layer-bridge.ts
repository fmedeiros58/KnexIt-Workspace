import type { ProcessingState } from "../bridges/contracts/processing-state";
import type { KnowledgeCandidate } from "./knowledge-types";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { resolveDomainTemplate } from "./internal-knowledge-core/domain-templates";
import { getInternalRules } from "./internal-knowledge-core/internal-rules-registry";
import { getSystemKnowledgeHints } from "./internal-knowledge-core/system-knowledge-base";
import { runRetriever } from "./rag-retrieval-core/retriever";
import { alignEvidenceToQuery } from "./evidence-core/evidence-alignment";
import { collectCitations } from "./evidence-core/citation-collector";
import { detectEvidenceContradictions } from "./evidence-core/contradiction-detector";
import { mergeEvidence } from "./evidence-core/evidence-merger";
import { estimateEvidenceConfidence } from "./evidence-core/confidence-estimator";
import { shouldUseWebResearch } from "./internet-research-core/web-research-router";
import { searchWebFallback } from "./internet-research-core/web-search-client";
import { verifyExternalFacts } from "./internet-research-core/external-fact-verifier";
import { buildLiveKnowledgeHints } from "./internet-research-core/live-knowledge-bridge";
import { handoffKnowledgeToQuantum } from "./knowledge-to-quantum-bridge";

function sanitizeSnippet(value: string, maxChars = 320) {
  const safe = value.replace(/\s+/g, " ").trim();
  if (safe.length <= maxChars) return safe;
  return `${safe.slice(0, maxChars - 1)}...`;
}

function buildCandidatesFromState(state: ProcessingState): KnowledgeCandidate[] {
  const nowIso = new Date().toISOString();
  const fromExisting = state.retrievedSources.map((item) => ({
    title: item.title || "existing-source",
    url: item.url || "about:blank",
    snippet: sanitizeSnippet(item.snippet || state.normalizedMessage),
    freshnessScore: Math.max(0, Math.min(1, item.freshnessScore || 0.4)),
    trustScore: item.url && item.url !== "about:blank" ? 0.62 : 0.28,
    relevanceScore: 0.5,
    sourceType: "existing" as const,
  }));

  const fromContext = state.activeContext.slice(-4).map((content, index) => ({
    title: `context-${index + 1}`,
    url: `memory://context/${index + 1}`,
    snippet: sanitizeSnippet(content),
    freshnessScore: 0.65,
    trustScore: 0.56,
    relevanceScore: 0.45,
    sourceType: "context" as const,
  }));

  const fromMemory = state.memorySnapshot.records.slice(-6).map((record) => ({
    title: `memory-${record.kind}`,
    url: `memory://record/${record.id}`,
    snippet: sanitizeSnippet(record.content),
    freshnessScore: 0.58,
    trustScore: 0.54,
    relevanceScore: Math.max(0.35, Math.min(0.95, record.relevance)),
    sourceType: "memory" as const,
  }));
  const fromGlobalMemory = Object.entries(state.memorySnapshot.globalNamespaces)
    .flatMap(([namespace, values], index) => {
      const snippet = sanitizeSnippet(values.slice(0, 2).join(" | "));
      if (!snippet) return [];
      return [{
        title: `memory-global-${namespace}`,
        url: `memory://global/${namespace}/${index + 1}`,
        snippet,
        freshnessScore: 0.61,
        trustScore: 0.57,
        relevanceScore: 0.52,
        sourceType: "memory" as const,
      }];
    });
  const fromModuleMemory = state.memorySnapshot.moduleNamespaces
    .flatMap((module) =>
      module.entries.slice(0, 3).map((entry, index) => ({
        title: `memory-module-${module.moduleId}-${index + 1}`,
        url: `memory://module/${module.moduleId}/${entry.key}`,
        snippet: sanitizeSnippet(entry.content),
        freshnessScore: 0.59,
        trustScore: 0.55,
        relevanceScore: Math.max(0.38, Math.min(0.9, entry.relevance)),
        sourceType: "memory" as const,
      })),
    );
  const fromRuntimeMemory = state.memorySnapshot.legacyRuntimeTopModules
    .slice(0, 6)
    .map((moduleName, index) => {
      const runtimeScore = state.memorySnapshot.legacyRuntimeModules[moduleName] || 0.5;
      return {
        title: `memory-runtime-${moduleName}`,
        url: `memory://runtime/${moduleName}/${index + 1}`,
        snippet: sanitizeSnippet(`module=${moduleName}; score=${runtimeScore.toFixed(2)}`),
        freshnessScore: 0.57,
        trustScore: 0.56,
        relevanceScore: Math.max(0.4, Math.min(0.92, runtimeScore)),
        sourceType: "memory" as const,
      };
    });

  const domain = resolveDomainTemplate(state.inputSignals.domain || "general");
  const ruleHints = getInternalRules(state.inputSignals.intent).join(" ");
  const systemHints = getSystemKnowledgeHints(state.normalizedMessage).join(" ");
  const fromInternal: KnowledgeCandidate[] = [
    {
      title: `domain-${domain.domain}`,
      url: "internal://domain-template",
      snippet: sanitizeSnippet(domain.focus.join("; ")),
      freshnessScore: 0.7,
      trustScore: 0.74,
      relevanceScore: 0.5,
      sourceType: "internal",
    },
    {
      title: "internal-rules",
      url: "internal://rules",
      snippet: sanitizeSnippet(ruleHints || systemHints || `seed=${nowIso}`),
      freshnessScore: 0.66,
      trustScore: 0.76,
      relevanceScore: 0.48,
      sourceType: "internal",
    },
  ];

  return [...fromExisting, ...fromContext, ...fromMemory, ...fromGlobalMemory, ...fromModuleMemory, ...fromRuntimeMemory, ...fromInternal];
}

export async function runKnowledgeLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const baseCandidates = buildCandidatesFromState(state);
  const retrieved = runRetriever(state.normalizedMessage, baseCandidates, 8);

  const useWeb = shouldUseWebResearch({
    query: state.normalizedMessage,
    localSourceCount: retrieved.length,
    verifiable: /\b(quem|qual|when|who|presidente|governador|prefeito|atual)\b/i.test(state.normalizedMessage),
  });
  const webResults = useWeb ? searchWebFallback(state.normalizedMessage) : [];
  const verifiedWeb = verifyExternalFacts(webResults);
  const selected = alignEvidenceToQuery(state.normalizedMessage, [...retrieved, ...webResults]).slice(0, 10);

  state.retrievedSources = selected.map((item) => ({
    title: item.title,
    url: item.url,
    snippet: item.snippet,
    freshnessScore: item.freshnessScore,
  }));

  const contradictions = detectEvidenceContradictions(selected);
  const evidence = mergeEvidence(selected, 12);
  const citations = collectCitations(selected);
  const avgTrust = selected.length
    ? selected.reduce((sum, item) => sum + item.trustScore, 0) / selected.length
    : 0;
  const avgRelevance = selected.length
    ? selected.reduce((sum, item) => sum + item.relevanceScore, 0) / selected.length
    : 0;
  const evidenceConfidence = estimateEvidenceConfidence({
    sourceCount: selected.length,
    contradictionCount: contradictions.length + (verifiedWeb.verified ? 0 : verifiedWeb.issues.length),
    avgTrust,
    avgRelevance,
  });

  const liveHints = buildLiveKnowledgeHints({
    usedWeb: useWeb,
    verified: verifiedWeb.verified,
    issueCount: verifiedWeb.issues.length,
  });

  state.retrievedEvidence = [...evidence, ...liveHints].slice(0, 18);
  state.activeConstraints = [...state.activeConstraints, ...contradictions].slice(-12);
  state.confidenceScores.retrieval = evidenceConfidence;
  state.trace.push(
    makeTraceEvent({
      layer: "knowledge",
      action: "knowledge_retrieved",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail: `sources=${selected.length}; citations=${citations.length}; web=${useWeb}; confidence=${evidenceConfidence}`,
    }),
  );
  return handoffKnowledgeToQuantum(state);
}
