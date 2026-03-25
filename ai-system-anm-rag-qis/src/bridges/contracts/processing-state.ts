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
import type { TextAnalysisSnapshot } from "../../shared/text-processing/text-analysis-snapshot";
import { buildTextAnalysisSnapshot } from "../../shared/text-processing/text-analysis-snapshot";

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

export interface LanguageState {
  semanticFocus: string;
  primaryIntent: string;
  ambiguity: number;
  speechAct: string;
  politeness: number;
  tone: string;
  register: string;
  mixedLanguage: boolean;
}

export interface ConversationState {
  turnCount: number;
  balanceScore: number;
  activeTopic: string;
  topicShiftDetected: boolean;
  needsClarification: boolean;
  clarificationStrategy: string;
  followUpPrompt: string | null;
  rapportScore: number;
}

export interface PreparatoryState {
  goal: string;
  constraints: string[];
  ambiguityScore: number;
  ambiguityFlags: string[];
  salientTerms: string[];
  cognitivePlan: string[];
}

export interface MetacognitiveState {
  depthAdequate: boolean;
  monitorScore: number;
  overconfidenceRisk: number;
  revisionNeeded: boolean;
  notes: string[];
}

export interface EpistemicIntegrationState {
  mergedSummary: string;
  certaintyBand: "low" | "medium" | "high";
  conflicts: string[];
  harmonyScore: number;
  finalHandoff: string;
}

export interface AcademicNormalizationState {
  applied: boolean;
  style: string;
  citationCount: number;
  consistencyNotes: string[];
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

export interface PreRouteSignals {
  quickIntent: string;
  quickUrgency: string;
  quickComplexity: number;
  quickAmbiguity: number;
  hasGreetingSignal: boolean;
  hasVerifiableSignal: boolean;
  hasRecencySignal: boolean;
  hasSafetyRisk: boolean;
  safetyAction: string;
  tokenCount: number;
  questionCount: number;
}

export interface KnowledgeExecutionCacheEntry {
  retrievedSources: RetrievedSource[];
  retrievedEvidence: string[];
  confidence: number;
  citationsCount: number;
}

export interface ExecutionArtifacts {
  activeFamilies?: string[];
  generationRuntime?: {
    provider: string;
    model: string;
    baseUrl: string;
    maxTokens: number;
    enabled: boolean;
    used: boolean;
    llmDraft: string;
  };
  languageLayer?: {
    stageOrder: string[];
    languageEvidence: string[];
    normalizationSteps: string[];
    validation: unknown;
  };
  orchestration?: {
    selectedMode: string;
    planningRoute: string;
    routeHint: string;
    complexityScore: number;
    ambiguityScore: number;
    needRetrieval: boolean;
    needWebSearch: boolean;
    needMemoryReinforcement: boolean;
    timeoutMs: number;
    retryMaxAttempts: number;
    fallbackStrategy: string;
    steps: string[];
    activeFamilies?: string[];
  };
  decisionGuard?: {
    enforced: boolean;
    stage: "pre_branch" | "post_orchestration";
    routeFloor: "minimum" | "reflective" | "inferential" | "quantum-state";
    requiredSteps: string[];
    reasonTags: string[];
    requiresKnowledge: boolean;
    requiresWeb: boolean;
    followUpDependency: boolean;
    blockedBySafety: boolean;
  };
  reflective?: {
    familyId?: string;
    lowSignal: boolean;
    score: number;
    assumptionsCount: number;
    caveatsCount: number;
    tensionsCount: number;
  };
  inferential?: {
    familyId?: string;
    lowSignal: boolean;
    score: number;
    implicationsCount: number;
    scenariosCount: number;
    secondOrderCount: number;
  };
  knowledge: {
    cache: Record<string, KnowledgeExecutionCacheEntry>;
    lastQuerySignature: string;
    lastUsedCache: boolean;
    activatedFamilies?: string[];
  };
  validation?: {
    activeValidationFamilies: string[];
    validationProfile: string;
    validationStage: string;
  };
  validationStage?: "pre_presentation" | "final";
  errorHandling?: {
    category: string;
    retryable: boolean;
    fallbackStrategy: string;
    retryMaxAttempts: number;
  };
  observability?: {
    currentRoute: string;
    routeMetrics?: {
      runs: number;
      succeeded: number;
      failed: number;
      fallbacks: number;
    };
    topSkipReasons: string;
    fallbackStrategies: Record<string, number>;
    errorCategories: Record<string, number>;
    activeFamilies?: string[];
  };
}

export interface ObservabilityMetrics {
  routeMetrics: Record<string, {
    runs: number;
    succeeded: number;
    failed: number;
    fallbacks: number;
  }>;
  layerMetrics: Record<string, {
    executed: number;
    skipped: number;
    failed: number;
  }>;
  skipReasons: Record<string, number>;
  fallbackStrategies: Record<string, number>;
  errorCategories: Record<string, number>;
  familyMetrics: Record<string, number>;
}

export interface ProcessingState {
  rawMessage: string;
  normalizedMessage: string;
  textAnalysisSnapshot: TextAnalysisSnapshot;
  preRouteSignals: PreRouteSignals;
  language: string;
  languageState: LanguageState;
  inputSignals: InputSignals;
  conversationState: ConversationState;
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
  preparatoryState: PreparatoryState;
  collapsedTruth: CollapsedTruth;
  epistemicStatus: EpistemicStatus;
  reflectiveNotes: ReflectiveNotes;
  criticalCaveats: string[];
  inferentialMap: InferentialMap;
  metacognitiveState: MetacognitiveState;
  epistemicIntegrationState: EpistemicIntegrationState;
  scenarioSet: string[];
  generationPrompt: string;
  draftResponse: ResponseDraft;
  structuredResponse: string;
  academicNormalizationState: AcademicNormalizationState;
  validationReport: ValidationReport;
  deliveryPayload: DeliveryPayload;
  trace: ProcessingTraceEvent[];
  timings: Record<string, number>;
  confidenceScores: ConfidenceScores;
  executionArtifacts: ExecutionArtifacts;
  observabilityMetrics: ObservabilityMetrics;
}

export function createInitialProcessingState(rawMessage: string): ProcessingState {
  const now = new Date().toISOString();
  const normalizedMessage = rawMessage.trim();
  return {
    rawMessage,
    normalizedMessage,
    textAnalysisSnapshot: buildTextAnalysisSnapshot(normalizedMessage),
    language: "unknown",
    languageState: {
      semanticFocus: "conversation",
      primaryIntent: "chat",
      ambiguity: 0,
      speechAct: "statement",
      politeness: 0.5,
      tone: "neutral",
      register: "balanced",
      mixedLanguage: false,
    },
    inputSignals: {
      intent: "unknown",
      domain: "general",
      modality: "text",
      urgency: "low",
      safetyFlags: [],
    },
    conversationState: {
      turnCount: 0,
      balanceScore: 0.5,
      activeTopic: "general",
      topicShiftDetected: false,
      needsClarification: false,
      clarificationStrategy: "none",
      followUpPrompt: null,
      rapportScore: 0.5,
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
    preRouteSignals: {
      quickIntent: "chat",
      quickUrgency: "low",
      quickComplexity: 0,
      quickAmbiguity: 0,
      hasGreetingSignal: false,
      hasVerifiableSignal: false,
      hasRecencySignal: false,
      hasSafetyRisk: false,
      safetyAction: "allow",
      tokenCount: 0,
      questionCount: 0,
    },
    executionPlan: {
      mode: "chat",
      steps: [],
      selectedRoute: "minimum",
      maxDepth: 0,
      validationProfile: "light",
      pruningMode: "aggressive",
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
    preparatoryState: {
      goal: "respond",
      constraints: [],
      ambiguityScore: 0,
      ambiguityFlags: [],
      salientTerms: [],
      cognitivePlan: [],
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
    metacognitiveState: {
      depthAdequate: true,
      monitorScore: 0.5,
      overconfidenceRisk: 0,
      revisionNeeded: false,
      notes: [],
    },
    epistemicIntegrationState: {
      mergedSummary: "",
      certaintyBand: "low",
      conflicts: [],
      harmonyScore: 1,
      finalHandoff: "",
    },
    scenarioSet: [],
    generationPrompt: "",
    draftResponse: {
      text: "",
      sections: [],
    },
    structuredResponse: "",
    academicNormalizationState: {
      applied: false,
      style: "none",
      citationCount: 0,
      consistencyNotes: [],
    },
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
    timings: {
      pipelineStartedAt: Date.now(),
    },
    confidenceScores: {
      retrieval: 0,
      epistemic: 0,
      coherence: 0,
      final: 0,
    },
    executionArtifacts: {
      activeFamilies: [],
      knowledge: {
        cache: {},
        lastQuerySignature: "",
        lastUsedCache: false,
      },
    },
    observabilityMetrics: {
      routeMetrics: {},
      layerMetrics: {},
      skipReasons: {},
      fallbackStrategies: {},
      errorCategories: {},
      familyMetrics: {},
    },
  };
}
