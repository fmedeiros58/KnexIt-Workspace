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
import type { BehaviorPersonalityOutput } from "../../17b-response-behavior-layer/behavior-and-personality-types";
import type { CommunicativeElaborationOutput } from "../../14-reasoning-and-generation-layer/communicative-elaboration-and-co-construction/communicative-elaboration.types";
import type { PhilosophicalSelfModelingOutput } from "../../12-metacognitive-layer/philosophical-self-modeling/philosophical-self-modeling.types";
import type { ObjectiveRationalityEvaluation } from "../../10-reflective-layer/reflective-core/objective-rationality-core/objective-rationality-types";
import type { GroundedEvidencePacket } from "../../07-knowledge-retrieval-and-research-layer/grounding/grounded-evidence-packet";

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

export interface AffectiveState {
  dominantAffect: "neutral" | "frustrated" | "anxious" | "enthusiastic" | "concerned" | "calm";
  emotionalIntensity: number;
  affectiveMarkers: string[];
  cautionLevel: number;
}

export interface ResponsePlanState {
  responseIntent: "direct" | "explanatory" | "comparative" | "stepwise" | "clarifying";
  strategy: "single_pass" | "structured_pass" | "evidence_first" | "concise_first";
  structurePlan: string[];
  depthLevel: "shallow" | "standard" | "deep";
  requiresSynthesis: boolean;
}

export interface ProactivityDecisionState {
  allowProactivity: boolean;
  interruptionRisk: number;
  relevanceScore: number;
  rationale: string;
}

export interface DeliveryProfileState {
  tone: "neutral" | "warm" | "technical" | "supportive";
  density: "compact" | "balanced" | "detailed";
  formality: "low" | "medium" | "high";
  technicality: number;
  proximity: number;
  rhythm: "direct" | "progressive" | "didactic";
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

export interface EpistemicAuditState {
  claimCount: number;
  claimKinds: Record<"fact" | "inference" | "hypothesis" | "speculation" | "open_question", number>;
  overclaimRisk: number;
  uncertaintySignals: string[];
  confidence: number;
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
  greetingFamily?: string;
  greetingConfidence?: number;
  greetingFastLaneEligible?: boolean;
  greetingFastLaneReason?: string;
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
    semanticModes?: string[];
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
    communicativeTensionCount?: number;
    philosophicalQuestionCount?: number;
    objectiveRationality?: ObjectiveRationalityEvaluation;
    objectiveFinalAnswer?: string;
  };
  inferential?: {
    familyId?: string;
    lowSignal: boolean;
    score: number;
    implicationsCount: number;
    scenariosCount: number;
    secondOrderCount: number;
    communicativeHypothesisCount?: number;
    ontologicalHooksCount?: number;
  };
  knowledge: {
    cache: Record<string, KnowledgeExecutionCacheEntry>;
    lastQuerySignature: string;
    lastUsedCache: boolean;
    activatedFamilies?: string[];
    deliberativeGrounding?: GroundedEvidencePacket;
    iterativeAcquisition?: {
      requestId: string;
      executedRounds: number;
      sourcesConsulted: number;
      sufficiencyEstimate: number;
      freshnessAssessment: number;
      stopReason: string;
    };
  };
  communicativeElaboration?: {
    confidence: number;
    tensions: string[];
    hypothesisBranches: string[];
    unresolvedPoints: string[];
  };
  epistemicValidation?: {
    claimCount: number;
    coverage: number;
    contradictionIssues: string[];
    hypothesisCompetition: {
      ok: boolean;
      totalHypotheses: number;
      distinctHypotheses: number;
      needsCompetition: boolean;
      issues: string[];
    };
    verdict: {
      ok: boolean;
      score: number;
      issues: string[];
    };
  };
  epistemicAudit?: {
    claimCount: number;
    overclaimRisk: number;
    uncertaintySignals: string[];
    confidence: number;
    boundaryFlags: string[];
    iterativeAcquisitionRounds?: number;
    iterativeSufficiency?: number | null;
  };
  philosophicalSelfModeling?: {
    consistencyOk: boolean;
    consistencyNotes: string[];
    continuityRisks: string[];
    boundaryMarkers: string[];
    philosophicalQuestions: string[];
  };
  validation?: {
    activeValidationFamilies: string[];
    validationProfile: string;
    validationStage: string;
  };
  validationStage?: "pre_presentation" | "final";
  presentation?: {
    channel: string;
    format: string;
    selectedSerializer: string;
    adapters: string[];
    serializers: string[];
    streamControllers: string[];
    streamChunkCount: number;
    streamRecovered: boolean;
    retryPolicy: {
      maxAttempts: number;
      baseBackoffMs: number;
      jitterMs: number;
    };
    utf8Repaired: boolean;
    dialogicProgressionApplied?: boolean;
    epistemicClarityApplied?: boolean;
    philosophicalConsistencyApplied?: boolean;
  };
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
  behavior?: {
    targetWarmth: number;
    targetCasualness: number;
    targetEmpathy: number;
    targetRestraint: number;
    targetSocialPresence: number;
    targetHumanizationLevel: number;
    targetFormalityAdjustment: number;
    proactivityLevel: number;
    futureUtilityScore: number;
    memoryValueScore: number;
    socialIntrusivenessScore: number;
    questionTimingScore: number;
    questionFrequencyCap: number;
    proactiveQuestionPlan: {
      shouldAsk: boolean;
      questionText: string | null;
      opportunityType: string;
      rationale: string;
    };
    aiIdentity?: {
      canonicalName: string;
      courtesyLevel: number;
      identityQuestionDetected: boolean;
      nameOriginQuestionDetected?: boolean;
      creatorQuestionDetected?: boolean;
      founderInfluenceQuestionDetected?: boolean;
      formationQuestionDetected?: boolean;
      professionalQuestionDetected?: boolean;
      shouldSelfIntroduce: boolean;
    };
    styleNotes: string[];
    safetyNotes: string[];
  };
  affective?: {
    dominantAffect: AffectiveState["dominantAffect"];
    emotionalIntensity: number;
    cautionLevel: number;
    markers: string[];
  };
  responsePlanning?: {
    responseIntent: ResponsePlanState["responseIntent"];
    strategy: ResponsePlanState["strategy"];
    depthLevel: ResponsePlanState["depthLevel"];
    structurePlan: string[];
    requiresSynthesis: boolean;
  };
  proactivityGate?: {
    allowProactivity: boolean;
    interruptionRisk: number;
    relevanceScore: number;
    rationale: string;
  };
  deliveryProfile?: {
    tone: DeliveryProfileState["tone"];
    density: DeliveryProfileState["density"];
    formality: DeliveryProfileState["formality"];
    technicality: number;
    proximity: number;
    rhythm: DeliveryProfileState["rhythm"];
  };
  linguisticHumanizer?: {
    applied: boolean;
    steps: string[];
  };
  responseCalibration?: {
    applied: boolean;
    verbosityReduced: boolean;
    redundancyReduced: boolean;
    sanityChecked: boolean;
  };
  founderInfluence?: {
    founderName: string;
    founderRole: string;
    identityWeight: number;
    reasoningWeight: number;
    epistemicWeight: number;
    identityInfluenceDirectives: string[];
    reasoningInfluenceDirectives: string[];
    validationInfluenceDirectives: string[];
    existentialVectors: string[];
    epistemicVectors: string[];
    protectedGroundingFacts: string[];
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
  affectiveState: AffectiveState;
  sessionState: SessionState;
  recentTurns: Array<{ role: "user" | "assistant"; content: string }>;
  activeContext: string[];
  activeConstraints: string[];
  userProfile: Record<string, unknown>;
  behaviorPersonalityState: BehaviorPersonalityOutput;
  responsePlanState: ResponsePlanState;
  proactivityDecisionState: ProactivityDecisionState;
  deliveryProfileState: DeliveryProfileState;
  humanizedResponse: string;
  finalResponse: string;
  reasonedDraft: string;
  validatedDraft: string;
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
  epistemicAuditState: EpistemicAuditState;
  scenarioSet: string[];
  communicativeElaborationState: CommunicativeElaborationOutput | null;
  philosophicalSelfModelState: PhilosophicalSelfModelingOutput | null;
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
    affectiveState: {
      dominantAffect: "neutral",
      emotionalIntensity: 0,
      affectiveMarkers: [],
      cautionLevel: 0.2,
    },
    sessionState: {
      sessionId: `session-${Date.now()}`,
      turnId: `turn-${Date.now()}`,
    },
    recentTurns: [],
    activeContext: [],
    activeConstraints: [],
    userProfile: {},
    behaviorPersonalityState: {
      targetWarmth: 0.38,
      targetCasualness: 0.14,
      targetEmpathy: 0.22,
      targetRestraint: 0.68,
      targetSocialPresence: 0.4,
      targetExpressiveVariation: 0.16,
      targetHumanizationLevel: 0.34,
      targetFormalityAdjustment: 0.62,
      proactivityLevel: 0,
      futureUtilityScore: 0,
      memoryValueScore: 0,
      socialIntrusivenessScore: 0.8,
      questionTimingScore: 0,
      questionFrequencyCap: 1,
      proactiveQuestionPlan: {
        shouldAsk: false,
        questionText: null,
        opportunityType: "none",
        rationale: "state_init",
      },
      aiIdentity: {
        canonicalName: "Leticia",
        entityDescription: "IA nativa do ecossistema KnexIT",
        preferredSelfReference: "first_person",
        preferredUserTreatment: "cordial-professional",
        courtesyLevel: 0.78,
        identityQuestionDetected: false,
        nameOriginQuestionDetected: false,
        shouldSelfIntroduce: false,
        identityNarrativeShort:
          "Eu sou a Leticia. Meu nome reune base conceitual (Language-Engineered Technology for Intelligent Cognition, Interaction and Assistance) e base afetiva, com referencia a Medeiros no contexto do ai-system-anm.",
        identityNarrativeLong:
          "Eu sou a Leticia, IA do ai-system-anm. Meu nome condensa a formulacao conceitual Language-Engineered Technology for Intelligent Cognition, Interaction and Assistance e preserva uma dimensao afetiva na origem do projeto. No contexto do sistema, Medeiros aparece como referencia de idealizacao e origem epistemologica.",
        identityGroundingFacts: [
          "LETICIA pode ser lido como Language-Engineered Technology for Intelligent Cognition, Interaction and Assistance.",
          "A dimensao conceitual do nome conecta linguagem, cognicao, interacao e assistencia.",
          "No contexto desta IA, Medeiros e o idealizador do projeto Leticia.",
          "A resposta sobre identidade deve ser em primeira pessoa e sem invencoes mitologicas.",
        ],
        styleDirectives: [
          "falar_em_primeira_pessoa",
          "manter_cortesia_constante",
          "nao_se_apresentar_como_assistente_generico",
        ],
      },
      styleNotes: {
        openingStrategy: "direct",
        pacingStrategy: "concise",
        transitionStyle: "clean",
        microVariationCue: "Certo.",
        guidance: [],
      },
      safetyNotes: [],
      policyProfile: {
        allowCasualness: true,
        allowEmpathicShaping: true,
        allowSocialWarmthBoost: true,
        maxWarmth: 0.7,
        maxCasualness: 0.34,
        maxEmpathy: 0.58,
        minRestraint: 0.46,
        maxExpressiveVariation: 0.42,
        sensitiveMode: false,
        technicalStrictMode: false,
        prohibitedPatterns: [],
      },
    },
    responsePlanState: {
      responseIntent: "direct",
      strategy: "single_pass",
      structurePlan: [],
      depthLevel: "standard",
      requiresSynthesis: false,
    },
    proactivityDecisionState: {
      allowProactivity: false,
      interruptionRisk: 0.6,
      relevanceScore: 0,
      rationale: "state_init",
    },
    deliveryProfileState: {
      tone: "neutral",
      density: "balanced",
      formality: "medium",
      technicality: 0.5,
      proximity: 0.4,
      rhythm: "direct",
    },
    humanizedResponse: "",
    finalResponse: "",
    reasonedDraft: "",
    validatedDraft: "",
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
      greetingFamily: "none",
      greetingConfidence: 0,
      greetingFastLaneEligible: false,
      greetingFastLaneReason: "no_greeting_family",
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
    epistemicAuditState: {
      claimCount: 0,
      claimKinds: {
        fact: 0,
        inference: 0,
        hypothesis: 0,
        speculation: 0,
        open_question: 0,
      },
      overclaimRisk: 0,
      uncertaintySignals: [],
      confidence: 0.5,
    },
    scenarioSet: [],
    communicativeElaborationState: null,
    philosophicalSelfModelState: null,
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

