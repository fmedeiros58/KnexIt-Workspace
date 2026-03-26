/**
 * Responsabilidade do arquivo:
 * - Expor bridge de aquisicao iterativa para consumo por knowledge/epistemic/reasoning.
 * - Traduzir ProcessingState em IterativeAcquisitionRequest tipado.
 * - Persistir snapshot operacional no executionArtifacts sem acoplamento excessivo.
 */
import type { ProcessingState } from "../../bridges/contracts/processing-state";
import { runIterativeAcquisitionOrchestrator } from "./iterative-acquisition-orchestrator";
import type { IterativeAcquisitionPolicy, IterativeAcquisitionRequest, IterativeEvidenceBundle } from "./iterative-acquisition-types";
import { readTemporaryEvidenceBundle, sweepTemporaryEvidenceMemory, writeTemporaryEvidenceBundle } from "./temporary-evidence-memory";

function inferTaskType(message: string): string {
  const normalized = `${message || ""}`.toLowerCase();
  if (/\b(analise|plano|compar|hipotese|critica)\b/.test(normalized)) return "analysis";
  if (/\b(quem|qual|quando|atual|hoje|presidente|prefeito|governador|capital)\b/.test(normalized)) return "factual_lookup";
  return "general";
}

function buildIntentProfile(state: ProcessingState) {
  const factualNeed = state.preRouteSignals.hasVerifiableSignal ? 0.78 : 0.42;
  const freshnessNeed = state.preRouteSignals.hasRecencySignal ? 0.82 : 0.4;
  const sourceAuthority = /\b(medico|juridico|cientifico|oficial)\b/i.test(state.normalizedMessage) ? 0.82 : 0.55;
  const ambiguityTolerance = Math.max(0.15, Math.min(0.9, 1 - state.preRouteSignals.quickAmbiguity));
  const conflictSensitivity = state.executionPlan.steps.includes("fact_check") ? 0.76 : 0.48;
  const requiredCorroborationLevel = state.executionPlan.steps.includes("validation") ? 0.7 : 0.5;

  return {
    interactionType: state.selectedMode,
    taskType: inferTaskType(state.normalizedMessage || state.rawMessage),
    factualNeedLevel: factualNeed,
    freshnessNeed,
    sourceAuthorityRequirement: sourceAuthority,
    ambiguityTolerance,
    conflictSensitivity,
    requiredCorroborationLevel,
  };
}

export async function runIterativeEvidenceAcquisitionBridge(
  state: ProcessingState,
  options?: {
    query?: string;
    policyHint?: Partial<IterativeAcquisitionPolicy>;
    forceRefresh?: boolean;
  },
): Promise<IterativeEvidenceBundle> {
  sweepTemporaryEvidenceMemory();
  const query = (options?.query || state.normalizedMessage || state.rawMessage).trim();
  const cached = !options?.forceRefresh ? readTemporaryEvidenceBundle(query) : null;
  if (cached) return cached;

  const request: IterativeAcquisitionRequest = {
    requestId: state.sessionState.turnId || `iterative-${Date.now()}`,
    query,
    route: state.executionPlan.selectedRoute,
    conversationContext: state.activeContext,
    recentTurns: state.recentTurns,
    memoryHints: state.memorySnapshot.records.slice(-8).map((row) => row.content),
    existingSources: state.retrievedSources,
    existingEvidence: state.retrievedEvidence,
    baseCandidates: state.retrievedSources.map((row) => ({
      title: row.title,
      url: row.url,
      snippet: row.snippet,
      freshnessScore: row.freshnessScore,
      trustScore: row.url.startsWith("http") ? 0.62 : 0.5,
      relevanceScore: 0.52,
      sourceType: row.url.startsWith("memory://") ? "memory" : "existing",
    })),
    intentProfile: buildIntentProfile(state),
    policyHint: options?.policyHint,
  };

  const bundle = await runIterativeAcquisitionOrchestrator(request);
  writeTemporaryEvidenceBundle(query, bundle);

  state.executionArtifacts = {
    ...state.executionArtifacts,
    knowledge: {
      ...(state.executionArtifacts.knowledge || { cache: {}, lastQuerySignature: "", lastUsedCache: false }),
      iterativeAcquisition: {
        requestId: bundle.requestId,
        executedRounds: bundle.executedRounds.length,
        sourcesConsulted: bundle.sourcesConsulted.length,
        sufficiencyEstimate: bundle.sufficiencyEstimate,
        freshnessAssessment: bundle.freshnessAssessment,
        stopReason: bundle.stopReason,
      },
    },
  };

  return bundle;
}

