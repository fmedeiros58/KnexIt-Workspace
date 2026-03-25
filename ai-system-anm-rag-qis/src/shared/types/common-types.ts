import type { PipelineLayerId, PipelineRoute } from "../enums/pipeline-enums";
import type { EpistemicStatus } from "../enums/epistemic-status-enums";
import type { InteractionMode } from "../enums/mode-enums";

export type LanguageTag = "pt-BR" | "en-US" | "es-ES" | "unknown";

export interface ComplexityProfile {
  score: number;
  ambiguity: number;
  depthRequired: number;
  responseBudget: number;
}

export interface ProcessingTraceEvent {
  layer: PipelineLayerId;
  action: string;
  route: PipelineRoute;
  at: string;
  latencyMs: number;
  detail?: string;
}

export interface HypothesisItem {
  id: string;
  claim: string;
  weight: number;
  supportingSources: string[];
  contradictorySources: string[];
}

export interface CollapsedTruth {
  summary: string;
  dominantHypothesisId: string | null;
  status: EpistemicStatus;
  uncertainty: number;
}

export interface ConfidenceScores {
  retrieval: number;
  epistemic: number;
  coherence: number;
  final: number;
}

export interface ExecutionPlan {
  mode: InteractionMode;
  steps: string[];
  selectedRoute: PipelineRoute;
  maxDepth: number;
  validationProfile?: "light" | "standard" | "strict";
  pruningMode?: "aggressive" | "moderate" | "minimal";
  timeoutMs?: number;
  retryMaxAttempts?: number;
  fallbackStrategy?: string;
}
