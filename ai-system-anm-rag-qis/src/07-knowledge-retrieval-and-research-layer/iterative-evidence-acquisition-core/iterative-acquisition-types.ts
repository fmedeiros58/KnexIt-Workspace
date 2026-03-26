/**
 * Responsabilidade do arquivo:
 * - Definir contratos do nucleo iterative-evidence-acquisition-core.
 * - Padronizar entrada, politica de busca e pacote de saida.
 * - Manter tipagem clara para bridges de knowledge/epistemic/reasoning.
 */
import type { KnowledgeCandidate } from "../knowledge-types";

export type RetrievalStage =
  | "context_immediate"
  | "transient_memory"
  | "local_retriever"
  | "rag_internal"
  | "vector_lookup"
  | "local_structured_sources"
  | "internal_connectors"
  | "web_multi_provider"
  | "confirmatory_round"
  | "contrastive_round";

export type SearchRoundKind = "exploration" | "focalization" | "confirmation" | "contrast";

export type FunctionalSourceType =
  | "context"
  | "memory"
  | "retriever"
  | "rag"
  | "vector"
  | "docs"
  | "connector"
  | "web"
  | "existing"
  | "internal";

export interface EvidenceQueryIntentProfile {
  interactionType: string;
  taskType: string;
  factualNeedLevel: number;
  freshnessNeed: number;
  sourceAuthorityRequirement: number;
  ambiguityTolerance: number;
  conflictSensitivity: number;
  requiredCorroborationLevel: number;
}

export interface IterativeAcquisitionPolicy {
  retrievalDepth: number;
  searchBudget: {
    maxCalls: number;
    maxRounds: number;
    timeoutMs: number;
    retries: number;
    perRoundCallCap: number;
    providerCap: number;
  };
  minSufficiencyToStop: number;
  order: RetrievalStage[];
  enableWeb: boolean;
  enableConfirmatoryRound: boolean;
  enableContrastiveRound: boolean;
  preferredWebProviders: string[];
}

export interface IterativeAcquisitionRequest {
  requestId: string;
  query: string;
  route: string;
  conversationContext: string[];
  recentTurns: Array<{ role: "user" | "assistant"; content: string }>;
  memoryHints: string[];
  existingSources: Array<{
    title: string;
    url: string;
    snippet: string;
    freshnessScore: number;
  }>;
  existingEvidence: string[];
  baseCandidates: KnowledgeCandidate[];
  intentProfile: EvidenceQueryIntentProfile;
  policyHint?: Partial<IterativeAcquisitionPolicy>;
}

export interface QueryDecomposition {
  centralQuestion: string;
  subQueries: string[];
  entities: string[];
  requiredTerms: string[];
  optionalTerms: string[];
  exclusions: string[];
  helperQuestions: string[];
}

export interface EvidenceItem {
  id: string;
  title: string;
  url: string;
  snippet: string;
  sourceType: FunctionalSourceType;
  provider: string;
  stage: RetrievalStage;
  round: SearchRoundKind;
  relevanceScore: number;
  trustScore: number;
  freshnessScore: number;
  retrievalScore: number;
  publishedAt?: string;
  extractedDate?: string | null;
  tags: string[];
}

export interface EvidenceConvergenceCluster {
  clusterId: string;
  signal: string;
  supportCount: number;
  evidenceIds: string[];
}

export interface EvidenceConflictCandidate {
  conflictId: string;
  conflictType: "binary_conflict" | "freshness_conflict" | "numeric_conflict" | "stance_conflict";
  evidenceIds: string[];
  sensitivity: number;
  notes: string[];
}

export interface SearchRoundExecution {
  round: SearchRoundKind;
  objective: string;
  stages: RetrievalStage[];
  callsUsed: number;
  evidenceAdded: number;
}

export interface IterativeEvidenceBundle {
  requestId: string;
  queryIntentProfile: EvidenceQueryIntentProfile;
  acquisitionPolicy: IterativeAcquisitionPolicy;
  executedRounds: SearchRoundExecution[];
  sourcesConsulted: Array<{ sourceType: FunctionalSourceType; provider: string; count: number }>;
  evidenceItems: EvidenceItem[];
  rankedEvidence: EvidenceItem[];
  convergenceClusters: EvidenceConvergenceCluster[];
  conflictCandidates: EvidenceConflictCandidate[];
  unresolvedGaps: string[];
  sufficiencyEstimate: number;
  freshnessAssessment: number;
  recommendedEpistemicPosture: "strict" | "balanced" | "cautious";
  recommendedReasoningUsage: "direct" | "augmented" | "defer";
  stopReason: "sufficiency_reached" | "budget_exhausted" | "redundancy" | "no_signal";
}

export interface SearchRoundPlan {
  round: SearchRoundKind;
  objective: string;
  stages: RetrievalStage[];
}

export interface BudgetRuntimeState {
  callsUsed: number;
  callsUsedByRound: Record<SearchRoundKind, number>;
  startedAt: number;
}

