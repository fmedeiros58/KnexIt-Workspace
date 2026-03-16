import type { DeliveryChannel, DeliveryFormat } from "../../shared/enums/delivery-enums";
import type { EpistemicStatus } from "../../shared/enums/epistemic-status-enums";
import type { InteractionMode } from "../../shared/enums/mode-enums";
import type {
  CollapsedTruth,
  ComplexityProfile,
  ConfidenceScores,
  ExecutionPlan,
  HypothesisItem,
  ProcessingTraceEvent,
} from "../../shared/types/common-types";
import type { InferentialMap } from "../../shared/types/inferential-types";
import type { MemorySnapshot } from "../../shared/types/memory-types";
import type { QuantumState } from "../../shared/types/quantum-types";
import type { ReflectiveNotes } from "../../shared/types/reflective-types";
import type { ResponseDraft } from "../../shared/types/generation-types";

export interface InputSignals {
  intent: string;
  domain: string;
  modality: "text" | "voice" | "api";
  urgency: "low" | "medium" | "high";
  safetyFlags: string[];
}

export interface SessionState {
  sessionId: string;
  turnId: string;
  userId?: string;
}

export interface RetrievedSource {
  title: string;
  url: string;
  snippet: string;
  freshnessScore: number;
}

export interface ValidationReport {
  factual: { ok: boolean; issues: string[] };
  policy: { ok: boolean; issues: string[] };
  structure: { ok: boolean; issues: string[] };
  quality: { score: number; decision: "accept" | "retry" };
}

export interface DeliveryPayload {
  channel: DeliveryChannel;
  format: DeliveryFormat;
  text: string;
  citations: string[];
}

export interface ProcessingState {
  rawMessage: string;
  normalizedMessage: string;
  language: string;
  inputSignals: InputSignals;
  sessionState: SessionState;
  recentTurns: Array<{ role: "user" | "assistant"; content: string }>;
  activeContext: string[];
  activeConstraints: string[];
  userProfile: Record<string, unknown>;
  proactivityMode: "low" | "medium" | "high";
  selectedMode: InteractionMode;
  complexityProfile: ComplexityProfile;
  executionPlan: ExecutionPlan;
  memorySnapshot: MemorySnapshot;
  retrievedSources: RetrievedSource[];
  retrievedEvidence: string[];
  hypothesisSet: HypothesisItem[];
  quantumWeights: Record<string, number>;
  quantumState: QuantumState;
  collapsedTruth: CollapsedTruth;
  epistemicStatus: EpistemicStatus;
  reflectiveNotes: ReflectiveNotes;
  criticalCaveats: string[];
  inferentialMap: InferentialMap;
  scenarioSet: string[];
  generationPrompt: string;
  draftResponse: ResponseDraft;
  structuredResponse: string;
  validationReport: ValidationReport;
  deliveryPayload: DeliveryPayload;
  trace: ProcessingTraceEvent[];
  timings: Record<string, number>;
  confidenceScores: ConfidenceScores;
}

export function createInitialProcessingState(rawMessage: string): ProcessingState {
  const now = new Date().toISOString();
  return {
    rawMessage,
    normalizedMessage: rawMessage.trim(),
    language: "unknown",
    inputSignals: {
      intent: "unknown",
      domain: "general",
      modality: "text",
      urgency: "low",
      safetyFlags: [],
    },
    sessionState: {
      sessionId: `session-${Date.now()}`,
      turnId: `turn-${Date.now()}`,
    },
    recentTurns: [],
    activeContext: [],
    activeConstraints: [],
    userProfile: {},
    proactivityMode: "low",
    selectedMode: "chat",
    complexityProfile: {
      score: 0,
      ambiguity: 0,
      depthRequired: 0,
      responseBudget: 256,
    },
    executionPlan: {
      mode: "chat",
      steps: [],
      selectedRoute: "minimum",
      maxDepth: 9,
    },
    memorySnapshot: {
      records: [],
      selectedRecordIds: [],
      globalNamespaces: {
        identity: [],
        semantic: [],
        procedural: [],
        social: [],
        value: [],
        attention: [],
        metacognitive: [],
        prospective: [],
        perceptual: [],
      },
      moduleNamespaces: [],
      nodularState: {
        attention: 0,
        priming: 0,
        value: 0,
        stability: 0,
        plasticity: 0,
        weight: 0,
        spikeHistory: [],
      },
      regulatoryState: {
        stressLoad: 0.25,
        contextStability: 0.6,
        supportDensity: 0.55,
        recoveryMargin: 0.7,
        readinessTrend: 0,
        blockStructuralConsolidation: false,
      },
      legacyRuntimeModules: {},
      legacyRuntimeTopModules: [],
    },
    retrievedSources: [],
    retrievedEvidence: [],
    hypothesisSet: [],
    quantumWeights: {},
    quantumState: {
      hypotheses: [],
      normalizedWeights: {},
      converged: false,
    },
    collapsedTruth: {
      summary: "",
      dominantHypothesisId: null,
      status: "unknown",
      uncertainty: 1,
    },
    epistemicStatus: "unknown",
    reflectiveNotes: {
      caveats: [],
      assumptions: [],
      tensions: [],
    },
    criticalCaveats: [],
    inferentialMap: {
      implications: [],
      scenarios: [],
      secondOrderEffects: [],
    },
    scenarioSet: [],
    generationPrompt: "",
    draftResponse: {
      text: "",
      sections: [],
    },
    structuredResponse: "",
    validationReport: {
      factual: { ok: true, issues: [] },
      policy: { ok: true, issues: [] },
      structure: { ok: true, issues: [] },
      quality: { score: 0, decision: "retry" },
    },
    deliveryPayload: {
      channel: "rest",
      format: "plain-text",
      text: "",
      citations: [],
    },
    trace: [
      {
        layer: "input",
        action: "state_initialized",
        route: "minimum",
        at: now,
        latencyMs: 0,
      },
    ],
    timings: {},
    confidenceScores: {
      retrieval: 0,
      epistemic: 0,
      coherence: 0,
      final: 0,
    },
  };
}
