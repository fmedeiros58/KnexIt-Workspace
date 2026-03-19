/**
 * Responsabilidade do arquivo:
 * - Executar retrieval/evidence alignment com cache por assinatura de consulta.
 * - Deduplicar fontes antes de alinhamento e consolidacao final de evidencias.
 * - Atualizar confidence/constraints de conhecimento e entregar handoff ao quantum-layer.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import type { KnowledgeCandidate } from "./knowledge-types";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { mergeConstraints, toConstraint } from "../shared/state/constraint-utils";
import { buildQuerySignature } from "../shared/state/query-signature";
import { textNormalizationService } from "../shared/text-processing/text-normalization.service";
import { resolveDomainTemplate } from "./internal-knowledge-core/domain-templates";
import { getInternalRules } from "./internal-knowledge-core/internal-rules-registry";
import { getSystemKnowledgeHints } from "./internal-knowledge-core/system-knowledge-base";
import { runRetriever } from "./rag-retrieval-core/retriever";
import { alignEvidenceToQuery } from "./evidence-core/evidence-alignment";
import { collectCitations } from "./evidence-core/citation-collector";
import { detectEvidenceContradictions } from "./evidence-core/contradiction-detector";
import { mergeEvidence } from "./evidence-core/evidence-merger";
import { estimateEvidenceConfidence } from "./evidence-core/confidence-estimator";
import { dedupeKnowledgeCandidates } from "./evidence-core/source-dedup";
import { shouldUseWebResearch } from "./internet-research-core/web-research-router";
import { searchWebFallback } from "./internet-research-core/web-search-client";
import { verifyExternalFacts } from "./internet-research-core/external-fact-verifier";
import { buildLiveKnowledgeHints } from "./internet-research-core/live-knowledge-bridge";
import { synthesizeWebResults } from "./internet-research-core/web-result-synthesizer";
import { handoffKnowledgeToQuantum } from "./knowledge-to-quantum-bridge";
import { isConversationalPrompt } from "../shared/utils/conversation-signals";

function sanitizeSnippet(value: string, maxChars = 320) {
  const safe = value.replace(/\s+/g, " ").trim();
  if (safe.length <= maxChars) return safe;
  return `${safe.slice(0, maxChars - 1)}...`;
}

function normalizeText(value: string): string {
  return textNormalizationService.fingerprint(
    textNormalizationService.canonical(value || "", "retrieval"),
  );
}

function buildVariantQueries(query: string): string[] {
  const variants = textNormalizationService.variants(query, "retrieval", {
    maxVariants: 4,
    maxInputLength: 280,
    allowMorphVariant: false,
  });

  const seen = new Set<string>();
  const output: string[] = [];
  for (const variant of variants) {
    const fp = textNormalizationService.fingerprint(variant);
    if (!fp || seen.has(fp)) continue;
    seen.add(fp);
    output.push(variant);
  }
  return output;
}

type CivicRole = "presidente" | "governador" | "prefeito";

interface CivicSubject {
  role: CivicRole;
  place: string;
}

function normalizePlace(value: string): string {
  return value
    .replace(/\b(do|da|de|dos|das)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveLastCivicSubject(state: ProcessingState): CivicSubject | null {
  const turns = state.recentTurns.slice(-8).map((turn) => normalizeText(turn.content)).reverse();
  for (const turn of turns) {
    if (!turn) continue;

    const presidentPlace =
      turn.includes("estados unidos") || /\b(eua|usa)\b/.test(turn)
        ? "estados unidos"
        : turn.includes("brasil")
          ? "brasil"
          : "";
    if (turn.includes("presidente") && presidentPlace) {
      return { role: "presidente", place: presidentPlace };
    }

    const governorMatch = turn.match(/\bgovernador\s+(?:do|da)\s+([\p{L}\s-]{2,})/u);
    if (governorMatch?.[1]) {
      return { role: "governador", place: normalizePlace(governorMatch[1].toLowerCase()) };
    }

    const mayorMatch = turn.match(/\bprefeito\s+(?:do|da|de)\s+([\p{L}\s-]{2,})/u);
    if (mayorMatch?.[1]) {
      return { role: "prefeito", place: normalizePlace(mayorMatch[1].toLowerCase()) };
    }
  }

  return null;
}

function buildFocusedFactualQuery(query: string, state: ProcessingState): string | null {
  const normalized = normalizeText(query);
  if (!normalized) return null;

  if (/\bpresidente\b/.test(normalized)) {
    if (/\b(brasil)\b/.test(normalized)) {
      return "nome do presidente atual do brasil";
    }
    if (/\b(estados unidos|eua|usa)\b/.test(normalized)) {
      return "nome do presidente atual dos estados unidos";
    }
  }

  if (/\bprefeito\b/.test(normalized)) {
    const match = normalized.match(/\bprefeito\s+(?:do|da|de)\s+([\p{L}\s-]{2,})/u);
    const place = normalizePlace(match?.[1] || "");
    if (place) return `nome do prefeito atual de ${place}`;
  }

  if (/\bgovernador\b/.test(normalized)) {
    const match = normalized.match(/\bgovernador\s+(?:do|da)\s+([\p{L}\s-]{2,})/u);
    const place = normalizePlace(match?.[1] || "");
    if (place) return `nome do governador atual do ${place}`;
  }

  const isElectionFollowUp =
    /\b(ele|ela|dele|dela|esse|essa)\b/.test(normalized) &&
    /\b(quando|em que ano|que ano|ano|mandato|eleit[oa]|reeleit[oa]|posse)\b/.test(normalized);
  if (isElectionFollowUp) {
    const subject = resolveLastCivicSubject(state);
    if (subject?.place) {
      if (subject.role === "presidente") return `em que ano foi eleito o atual presidente de ${subject.place}`;
      if (subject.role === "governador") return `em que ano foi eleito o atual governador de ${subject.place}`;
      return `em que ano foi eleito o atual prefeito de ${subject.place}`;
    }
  }

  return null;
}

function buildCandidatesFromState(state: ProcessingState): KnowledgeCandidate[] {
  const nowIso = new Date().toISOString();

  const fromExisting = state.retrievedSources.map((item) => ({
    title: item.title || "existing-source",
    url: item.url || "about:blank",
    snippet: sanitizeSnippet(item.snippet || state.normalizedMessage || state.rawMessage),
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

  const domain = resolveDomainTemplate(state.inputSignals.domain || "general");
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
      snippet: sanitizeSnippet(
        getInternalRules(state.inputSignals.intent).join(" ") ||
        getSystemKnowledgeHints(state.normalizedMessage || state.rawMessage).join(" ") ||
        `seed=${nowIso}`,
      ),
      freshnessScore: 0.66,
      trustScore: 0.76,
      relevanceScore: 0.48,
      sourceType: "internal",
    },
  ];

  return dedupeKnowledgeCandidates([
    ...fromExisting,
    ...fromContext,
    ...fromMemory,
    ...fromInternal,
  ]);
}

export async function runKnowledgeLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const query = state.normalizedMessage || state.rawMessage;
  const focusedQuery = buildFocusedFactualQuery(query, state);
  const retrievalQuery = focusedQuery || query;
  const retrievalQueries = buildVariantQueries(retrievalQuery);
  const conversationalPrompt = isConversationalPrompt(query);
  const requestedSteps = state.executionPlan.steps || [];
  const querySignature = buildQuerySignature(query);
  state.executionArtifacts = state.executionArtifacts || {
    knowledge: {
      cache: {},
      lastQuerySignature: "",
      lastUsedCache: false,
    },
  };

  const explicitlyNeedsKnowledge =
    requestedSteps.includes("retrieval") ||
    requestedSteps.includes("retrieval_augmented") ||
    requestedSteps.includes("research") ||
    requestedSteps.includes("web_search") ||
    requestedSteps.includes("fact_check") ||
    requestedSteps.includes("evidence_alignment");

  const cachedEntry = state.executionArtifacts.knowledge.cache?.[querySignature];
  if (cachedEntry) {
    state.retrievedSources = cachedEntry.retrievedSources;
    state.retrievedEvidence = cachedEntry.retrievedEvidence;
    state.confidenceScores.retrieval = cachedEntry.confidence;
    state.executionArtifacts.knowledge.lastQuerySignature = querySignature;
    state.executionArtifacts.knowledge.lastUsedCache = true;
    state.executionArtifacts.knowledge.activatedFamilies = [
      "knowledge_retrieval",
      "knowledge_cache_hit",
    ];

    state.trace.push(
      makeTraceEvent({
        layer: "knowledge",
        action: "knowledge_cache_hit",
        route: state.executionPlan.selectedRoute,
        latencyMs: Date.now() - startedAt,
        detail: `signature=${querySignature}; sources=${cachedEntry.retrievedSources.length}; evidence=${cachedEntry.retrievedEvidence.length}`,
      }),
    );

    return handoffKnowledgeToQuantum(state);
  }

  if (!explicitlyNeedsKnowledge && conversationalPrompt) {
    state.trace.push(
      makeTraceEvent({
        layer: "knowledge",
        action: "knowledge_skipped",
        route: state.executionPlan.selectedRoute,
        latencyMs: Date.now() - startedAt,
        detail: "reason=conversational_prompt_without_knowledge_step",
      }),
    );
    return handoffKnowledgeToQuantum(state);
  }

  const baseCandidates = buildCandidatesFromState(state);
  const localLimit = Math.max(4, Math.ceil(8 / Math.max(1, retrievalQueries.length)) + 1);
  const retrieved = dedupeKnowledgeCandidates(
    retrievalQueries.flatMap((variant) => runRetriever(variant, baseCandidates, localLimit)),
  );

  const verifiableQuery = /\b(quem|qual|when|who|presidente|governador|prefeito|atual|capital|ceo)\b/i.test(query);

  const useWeb = shouldUseWebResearch({
    query: retrievalQuery,
    localSourceCount: retrieved.length,
    verifiable: verifiableQuery,
    conversationalPrompt,
  });

  const webQueryVariants = retrievalQueries.slice(0, 2);
  const webResults = useWeb
    ? dedupeKnowledgeCandidates(
        (
          await Promise.all(webQueryVariants.map((variant) => searchWebFallback(variant)))
        ).flat(),
      )
    : [];
  const verifiedWeb = verifyExternalFacts(webResults);

  const selected = dedupeKnowledgeCandidates(
    alignEvidenceToQuery(
      retrievalQuery,
      [...retrieved, ...webResults],
      { preferWeb: verifiableQuery },
    ),
  ).slice(0, 10);

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

  const webSummary = synthesizeWebResults(webResults);

  state.retrievedEvidence = [...evidence, ...webSummary, ...liveHints].slice(0, 18);
  state.activeConstraints = mergeConstraints(
    state.activeConstraints,
    contradictions.map((item) => toConstraint("evidence", item)),
    32,
  );
  state.confidenceScores.retrieval = evidenceConfidence;

  state.executionArtifacts.knowledge.cache[querySignature] = {
    retrievedSources: state.retrievedSources,
    retrievedEvidence: state.retrievedEvidence,
    confidence: evidenceConfidence,
    citationsCount: citations.length,
  };
  state.executionArtifacts.knowledge.lastQuerySignature = querySignature;
  state.executionArtifacts.knowledge.lastUsedCache = false;
  state.executionArtifacts.knowledge.activatedFamilies = useWeb
    ? ["knowledge_retrieval", "web_fact_verification"]
    : ["knowledge_retrieval"];

  state.trace.push(
    makeTraceEvent({
      layer: "knowledge",
      action: "knowledge_retrieved",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail: `signature=${querySignature}; sources=${selected.length}; citations=${citations.length}; web=${useWeb}; focusedQuery=${focusedQuery ? "true" : "false"}; variantQueries=${retrievalQueries.length}; confidence=${evidenceConfidence.toFixed(3)}`,
    }),
  );

  return handoffKnowledgeToQuantum(state);
}
