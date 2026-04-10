/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 07-knowledge-retrieval-and-research-layer
 * Module: knowledge-layer-bridge
 * Responsibility: Execute retrieval/evidence alignment and apply local knowledge operators before quantum handoff.
 * Primary Inputs: ProcessingState after memory and response-planning preparation.
 * Primary Outputs: Retrieved sources/evidence, retrieval confidence and quantum handoff.
 * Upstream Dependencies: memory layer, retrieval cores, internet research helpers, local knowledge operators
 * Downstream Dependencies: quantum layer
 * Invariants: Retrieval remains inside the descending pipeline and stays subordinate to orchestration plus local evidence policy.
 * Failure Modes: Sparse sources degrade to lighter retrieval and conservative evidence confidence.
 * Audit Events: knowledge_retrieved, knowledge_retrieved_iterative, knowledge_skipped
 * Notes: Local operators prevent unnecessary retrieval pressure and make contradiction/ranking explicit.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import type { KnowledgeCandidate } from "./knowledge-types";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { resolveLayerModeFromState } from "../05-complexity-and-orchestration-layer/activation-policy/layer-mode-resolver";
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
import { runIterativeEvidenceAcquisitionBridge } from "./iterative-evidence-acquisition-core/iterative-evidence-acquisition-bridge";
import { runDeliberativeGroundingBridge } from "../bridges/deliberative-grounding.bridge";
import { handoffKnowledgeToQuantum } from "./knowledge-to-quantum-bridge";
import { isConversationalPrompt } from "../shared/utils/conversation-signals";
import { retrievalNeedEstimator } from "./operators/retrieval-need-estimator";
import { retrievalIntensityResolver } from "./operators/retrieval-intensity-resolver";
import { evidenceRanker } from "./operators/evidence-ranker";
import { contradictionDetector } from "./operators/contradiction-detector";

type TurnRole = "user" | "assistant";
type CivicRole = "presidente" | "governador" | "prefeito";

interface CivicSubject {
  role: CivicRole;
  place: string;
}

function repairCommonMojibake(value: string): string {
  return `${value || ""}`
    .replace(/Ã¡/g, "á")
    .replace(/Ã /g, "à")
    .replace(/Ã¢/g, "â")
    .replace(/Ã£/g, "ã")
    .replace(/Ã¤/g, "ä")
    .replace(/Ã©/g, "é")
    .replace(/Ã¨/g, "è")
    .replace(/Ãª/g, "ê")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ã´/g, "ô")
    .replace(/Ãµ/g, "õ")
    .replace(/Ãº/g, "ú")
    .replace(/Ã§/g, "ç")
    .replace(/Ã\u0081/g, "Á")
    .replace(/Ã\u0089/g, "É")
    .replace(/Ã\u008D/g, "Í")
    .replace(/Ã\u0093/g, "Ó")
    .replace(/Ã\u009A/g, "Ú")
    .replace(/Ã\u0087/g, "Ç")
    .replace(/intelig[\uFFFD]ncia/gi, "inteligencia")
    .replace(/informa[\uFFFD]{1,2}es/gi, "informacoes")
    .replace(/fa[\uFFFD]a/gi, "faca")
    .replace(/d[\uFFFD]vida/gi, "duvida")
    .replace(/o que [\uFFFD]/gi, "o que e")
    .replace(/let[\uFFFD]cia/gi, "Leticia")
    .replace(/usu[\uFFFD]rio/gi, "Usuario")
    .replace(/\uFFFD+/g, "");
}

function collapseWhitespace(value: string): string {
  return `${value || ""}`.replace(/\s+/g, " ").trim();
}

function stripDialogueLabels(value: string): string {
  return `${value || ""}`
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*:\s*/gi, "\n")
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*-\s*/gi, "\n")
    .trim();
}

function sanitizeKnowledgeText(value: string): string {
  return collapseWhitespace(stripDialogueLabels(repairCommonMojibake(value)));
}

function sanitizeSnippet(value: string, maxChars = 320) {
  const safe = sanitizeKnowledgeText(value);
  if (safe.length <= maxChars) return safe;
  return `${safe.slice(0, maxChars - 1)}...`;
}

function sanitizeStringArray(values: string[], limit: number): string[] {
  return (values || [])
    .map((item) => sanitizeKnowledgeText(item))
    .filter(Boolean)
    .slice(-limit);
}

function sanitizeRecentTurns(
  turns: Array<{ role: "user" | "assistant"; content: string }>,
  limit = 12,
): Array<{ role: "user" | "assistant"; content: string }> {
  const sanitized: Array<{ role: "user" | "assistant"; content: string }> = [];

  for (const turn of turns || []) {
    const role: TurnRole = turn.role === "assistant" ? "assistant" : "user";
    const content = sanitizeKnowledgeText(turn.content);
    if (!content) continue;

    sanitized.push({
      role,
      content,
    });
  }

  return sanitized.slice(-limit);
}

function sanitizeKnowledgeCandidates(candidates: KnowledgeCandidate[]): KnowledgeCandidate[] {
  return (candidates || [])
    .map((item) => ({
      ...item,
      title: sanitizeSnippet(item.title || "source", 140),
      url: item.url || "about:blank",
      snippet: sanitizeSnippet(item.snippet || "", 320),
      freshnessScore: Math.max(0, Math.min(1, item.freshnessScore || 0)),
      trustScore: Math.max(0, Math.min(1, item.trustScore || 0)),
      relevanceScore: Math.max(0, Math.min(1, item.relevanceScore || 0)),
    }))
    .filter((item) => Boolean(item.snippet));
}

function normalizeText(value: string): string {
  return textNormalizationService.fingerprint(
    textNormalizationService.canonical(sanitizeKnowledgeText(value || ""), "retrieval"),
  );
}

function buildVariantQueries(query: string): string[] {
  const safeQuery = sanitizeKnowledgeText(query);
  const variants = textNormalizationService.variants(safeQuery, "retrieval", {
    maxVariants: 4,
    maxInputLength: 280,
    allowMorphVariant: false,
  });

  const seen = new Set<string>();
  const output: string[] = [];
  for (const variant of variants) {
    const sanitizedVariant = sanitizeKnowledgeText(variant);
    const fp = textNormalizationService.fingerprint(sanitizedVariant);
    if (!fp || seen.has(fp)) continue;
    seen.add(fp);
    output.push(sanitizedVariant);
  }
  return output;
}

function normalizePlace(value: string): string {
  return sanitizeKnowledgeText(value)
    .replace(/\b(do|da|de|dos|das)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveLastCivicSubject(state: ProcessingState): CivicSubject | null {
  const turns = sanitizeRecentTurns(state.recentTurns, 8)
    .map((turn) => normalizeText(turn.content))
    .reverse();

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
  const safeActiveContext = sanitizeStringArray(state.activeContext, 12);

  const fromExisting = (state.retrievedSources || [])
    .map((item) => ({
      title: sanitizeSnippet(item.title || "existing-source", 140),
      url: item.url || "about:blank",
      snippet: sanitizeSnippet(item.snippet || state.normalizedMessage || state.rawMessage),
      freshnessScore: Math.max(0, Math.min(1, item.freshnessScore || 0.4)),
      trustScore: item.url && item.url !== "about:blank" ? 0.62 : 0.28,
      relevanceScore: 0.5,
      sourceType: "existing" as const,
    }))
    .filter((item) => Boolean(item.snippet));

  const fromContext = safeActiveContext.slice(-4).map((content, index) => ({
    title: `context-${index + 1}`,
    url: `memory://context/${index + 1}`,
    snippet: sanitizeSnippet(content),
    freshnessScore: 0.65,
    trustScore: 0.56,
    relevanceScore: 0.45,
    sourceType: "context" as const,
  }));

  const fromMemory = (state.memorySnapshot.records || [])
    .slice(-6)
    .map((record) => ({
      title: `memory-${record.kind}`,
      url: `memory://record/${record.id}`,
      snippet: sanitizeSnippet(record.content),
      freshnessScore: 0.58,
      trustScore: 0.54,
      relevanceScore: Math.max(0.35, Math.min(0.95, record.relevance)),
      sourceType: "memory" as const,
    }))
    .filter((item) => Boolean(item.snippet));

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

  return dedupeKnowledgeCandidates(
    sanitizeKnowledgeCandidates([
      ...fromExisting,
      ...fromContext,
      ...fromMemory,
      ...fromInternal,
    ]),
  );
}

export async function runKnowledgeLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const knowledgeMode = resolveLayerModeFromState(state, "knowledge");

  state.normalizedMessage = sanitizeKnowledgeText(state.normalizedMessage || state.rawMessage);
  state.activeContext = sanitizeStringArray(state.activeContext, 20);
  state.activeConstraints = sanitizeStringArray(state.activeConstraints, 32);
  state.recentTurns = sanitizeRecentTurns(state.recentTurns, 12);

  const localRetrievalNeed = retrievalNeedEstimator(state, knowledgeMode);
  const retrievalIntensity = retrievalIntensityResolver(state, knowledgeMode);
  const query = state.normalizedMessage || state.rawMessage;
  const focusedQuery = buildFocusedFactualQuery(query, state);
  const retrievalQuery = sanitizeKnowledgeText(focusedQuery || query);
  const retrievalQueries = buildVariantQueries(retrievalQuery);
  const conversationalPrompt = isConversationalPrompt(query);
  const requestedSteps = state.executionPlan.steps || [];
  const querySignature = buildQuerySignature(retrievalQuery);

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
    requestedSteps.includes("deliberative_contract") ||
    requestedSteps.includes("research") ||
    requestedSteps.includes("web_search") ||
    requestedSteps.includes("fact_check") ||
    requestedSteps.includes("evidence_alignment");

  const cachedEntry = state.executionArtifacts.knowledge.cache?.[querySignature];
  if (cachedEntry) {
    state.retrievedSources = (cachedEntry.retrievedSources || []).map((item) => ({
      title: sanitizeSnippet(item.title || "source", 140),
      url: item.url || "about:blank",
      snippet: sanitizeSnippet(item.snippet || ""),
      freshnessScore: Math.max(0, Math.min(1, item.freshnessScore || 0)),
    }));
    state.retrievedEvidence = sanitizeStringArray(cachedEntry.retrievedEvidence || [], 18);
    state.confidenceScores.retrieval = cachedEntry.confidence;
    state.executionArtifacts.knowledge.lastQuerySignature = querySignature;
    state.executionArtifacts.knowledge.lastUsedCache = true;
    state.executionArtifacts.knowledge.activatedFamilies = [
      "knowledge_retrieval",
      "knowledge_cache_hit",
    ];
    state.executionArtifacts.knowledge.retrievalIntensity = retrievalIntensity;
    state.executionArtifacts.knowledge.localRetrievalNeeded = localRetrievalNeed.needed;
    state.executionArtifacts.knowledge.contradictionSignals = contradictionDetector(state, knowledgeMode).signals;

    state.trace.push(
      makeTraceEvent({
        layer: "knowledge",
        action: "knowledge_cache_hit",
        route: state.executionPlan.selectedRoute,
        latencyMs: Date.now() - startedAt,
        detail:
          `mode=${knowledgeMode}; intensity=${retrievalIntensity}; signature=${querySignature}; ` +
          `sources=${state.retrievedSources.length}; evidence=${state.retrievedEvidence.length}`,
      }),
    );

    return handoffKnowledgeToQuantum(state);
  }

  if (!explicitlyNeedsKnowledge && conversationalPrompt && !localRetrievalNeed.needed) {
    if (state.executionArtifacts?.knowledge) {
      state.executionArtifacts.knowledge.retrievalIntensity = retrievalIntensity;
      state.executionArtifacts.knowledge.localRetrievalNeeded = localRetrievalNeed.needed;
      state.executionArtifacts.knowledge.contradictionSignals = [];
    }

    state.trace.push(
      makeTraceEvent({
        layer: "knowledge",
        action: "knowledge_skipped",
        route: state.executionPlan.selectedRoute,
        latencyMs: Date.now() - startedAt,
        detail:
          `mode=${knowledgeMode}; reason=conversational_prompt_without_knowledge_step; ` +
          `localNeed=${localRetrievalNeed.needed}; intensity=${retrievalIntensity}`,
      }),
    );

    return handoffKnowledgeToQuantum(state);
  }

  const baseCandidates = buildCandidatesFromState(state);
  const localLimitBase =
    retrievalIntensity === "heavy" ? 10 : retrievalIntensity === "standard" ? 7 : 4;
  const localLimit = Math.max(4, Math.ceil(localLimitBase / Math.max(1, retrievalQueries.length)) + 1);

  try {
    const deliberativeActive = Boolean(state.deliberativeTaskState?.isActive);
    const iterativeBundle = await runIterativeEvidenceAcquisitionBridge(state, {
      query: retrievalQuery,
      policyHint: {
        retrievalDepth:
          retrievalIntensity === "heavy" ? 4 : deliberativeActive ? 4 : explicitlyNeedsKnowledge ? 3 : 2,
        enableWeb:
          retrievalIntensity === "heavy" ||
          deliberativeActive ||
          explicitlyNeedsKnowledge ||
          state.preRouteSignals.hasVerifiableSignal ||
          state.preRouteSignals.hasRecencySignal,
      },
    });

    if (iterativeBundle.rankedEvidence.length > 0) {
      const selectedFromIterative = iterativeBundle.rankedEvidence.slice(0, 10);
      state.retrievedSources = selectedFromIterative.map((item) => ({
        title: sanitizeSnippet(item.title || "source", 140),
        url: item.url || "about:blank",
        snippet: sanitizeSnippet(item.snippet || ""),
        freshnessScore: Math.max(0, Math.min(1, item.freshnessScore || 0)),
      }));

      state.retrievedSources = evidenceRanker(state, knowledgeMode).map((item) => ({
        title: sanitizeSnippet(item.title || "source", 140),
        url: item.url || "about:blank",
        snippet: sanitizeSnippet(item.snippet || ""),
        freshnessScore: Math.max(0, Math.min(1, item.freshnessScore || 0)),
      }));

      const contradictions = iterativeBundle.conflictCandidates.map((item) => item.conflictType);
      const evidence = selectedFromIterative.map((item) => sanitizeSnippet(item.snippet || ""));
      const citations = collectCitations(
        selectedFromIterative.map((item) => ({
          title: sanitizeSnippet(item.title || "source", 140),
          url: item.url || "about:blank",
          snippet: sanitizeSnippet(item.snippet || ""),
          freshnessScore: item.freshnessScore,
          trustScore: item.trustScore,
          relevanceScore: item.relevanceScore,
          sourceType: item.sourceType === "web" ? "web" : "existing",
        })),
      );

      state.retrievedEvidence = sanitizeStringArray(
        [...evidence, ...iterativeBundle.unresolvedGaps.slice(0, 2)],
        18,
      );

      const localContradictions = contradictionDetector(state, knowledgeMode);
      const deliberativeGrounding = runDeliberativeGroundingBridge(state);

      state.activeConstraints = mergeConstraints(
        state.activeConstraints,
        [
          ...contradictions.map((item) => toConstraint("evidence", item)),
          ...localContradictions.signals.map((item) => toConstraint("knowledge_operator", item)),
        ],
        32,
      );

      state.confidenceScores.retrieval = Math.max(
        state.confidenceScores.retrieval,
        iterativeBundle.sufficiencyEstimate,
      );

      state.executionArtifacts.knowledge.cache[querySignature] = {
        retrievedSources: state.retrievedSources,
        retrievedEvidence: state.retrievedEvidence,
        confidence: state.confidenceScores.retrieval,
        citationsCount: citations.length,
      };
      state.executionArtifacts.knowledge.lastQuerySignature = querySignature;
      state.executionArtifacts.knowledge.lastUsedCache = false;
      state.executionArtifacts.knowledge.activatedFamilies = [
        "knowledge_retrieval",
        "iterative_evidence_acquisition",
      ];
      state.executionArtifacts.knowledge.retrievalIntensity = retrievalIntensity;
      state.executionArtifacts.knowledge.localRetrievalNeeded = localRetrievalNeed.needed;
      state.executionArtifacts.knowledge.contradictionSignals = localContradictions.signals;

      state.trace.push(
        makeTraceEvent({
          layer: "knowledge",
          action: "knowledge_retrieved_iterative",
          route: state.executionPlan.selectedRoute,
          latencyMs: Date.now() - startedAt,
          detail:
            `mode=${knowledgeMode}; intensity=${retrievalIntensity}; signature=${querySignature}; sources=${selectedFromIterative.length}; rounds=${iterativeBundle.executedRounds.length}; ` +
            `sufficiency=${iterativeBundle.sufficiencyEstimate.toFixed(3)}; stop=${iterativeBundle.stopReason}; ` +
            `deliberative=${deliberativeGrounding.summary}`,
        }),
      );

      return handoffKnowledgeToQuantum(state);
    }
  } catch (error) {
    state.trace.push(
      makeTraceEvent({
        layer: "knowledge",
        action: "iterative_acquisition_fallback",
        route: state.executionPlan.selectedRoute,
        latencyMs: Date.now() - startedAt,
        detail: `reason=${error instanceof Error ? error.message : "unknown_error"}`,
      }),
    );
  }

  const retrieved = dedupeKnowledgeCandidates(
    sanitizeKnowledgeCandidates(
      retrievalQueries.flatMap((variant) => runRetriever(variant, baseCandidates, localLimit)),
    ),
  );

  const verifiableQuery = /\b(quem|qual|when|who|presidente|governador|prefeito|atual|capital|ceo)\b/i.test(query);

  const useWeb =
    shouldUseWebResearch({
      query: retrievalQuery,
      localSourceCount: retrieved.length,
      verifiable: verifiableQuery,
      conversationalPrompt,
    }) || retrievalIntensity === "heavy";

  const webQueryVariants = retrievalQueries.slice(0, 2);
  const webResults = useWeb
    ? dedupeKnowledgeCandidates(
        sanitizeKnowledgeCandidates(
          (
            await Promise.all(webQueryVariants.map((variant) => searchWebFallback(variant)))
          ).flat(),
        ),
      )
    : [];

  const verifiedWeb = verifyExternalFacts(webResults);

  const selected = dedupeKnowledgeCandidates(
    sanitizeKnowledgeCandidates(
      alignEvidenceToQuery(
        retrievalQuery,
        [...retrieved, ...webResults],
        { preferWeb: verifiableQuery },
      ),
    ),
  ).slice(0, 10);

  state.retrievedSources = selected.map((item) => ({
    title: sanitizeSnippet(item.title || "source", 140),
    url: item.url || "about:blank",
    snippet: sanitizeSnippet(item.snippet || ""),
    freshnessScore: Math.max(0, Math.min(1, item.freshnessScore || 0)),
  }));

  state.retrievedSources = evidenceRanker(state, knowledgeMode).map((item) => ({
    title: sanitizeSnippet(item.title || "source", 140),
    url: item.url || "about:blank",
    snippet: sanitizeSnippet(item.snippet || ""),
    freshnessScore: Math.max(0, Math.min(1, item.freshnessScore || 0)),
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

  state.retrievedEvidence = sanitizeStringArray(
    [...evidence, ...webSummary, ...liveHints],
    18,
  );

  const localContradictions = contradictionDetector(state, knowledgeMode);
  const deliberativeGrounding = runDeliberativeGroundingBridge(state);

  state.activeConstraints = mergeConstraints(
    state.activeConstraints,
    [
      ...contradictions.map((item) => toConstraint("evidence", item)),
      ...localContradictions.signals.map((item) => toConstraint("knowledge_operator", item)),
    ],
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
  state.executionArtifacts.knowledge.retrievalIntensity = retrievalIntensity;
  state.executionArtifacts.knowledge.localRetrievalNeeded = localRetrievalNeed.needed;
  state.executionArtifacts.knowledge.contradictionSignals = localContradictions.signals;

  state.trace.push(
    makeTraceEvent({
      layer: "knowledge",
      action: "knowledge_retrieved",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `mode=${knowledgeMode}; intensity=${retrievalIntensity}; signature=${querySignature}; sources=${selected.length}; citations=${citations.length}; web=${useWeb}; ` +
        `focusedQuery=${focusedQuery ? "true" : "false"}; variantQueries=${retrievalQueries.length}; confidence=${evidenceConfidence.toFixed(3)}; ` +
        `deliberative=${deliberativeGrounding.summary}`,
    }),
  );

  return handoffKnowledgeToQuantum(state);
}