/**
 * Responsabilidade do arquivo:
 * - Definir contratos tipados da camada 17b de comportamento de resposta do ai-system-anm.
 * - Padronizar entradas/saidas para integracao segura com pipeline existente.
 * - Manter semantica explicita para calibradores e composer comportamental.
 */

export type WarmthLevel = number; // 0..1
export type CasualnessLevel = number; // 0..1
export type EmpathyLevel = number; // 0..1
export type SocialPresenceLevel = number; // 0..1
export type RestraintLevel = number; // 0..1
export type ExpressiveVariationLevel = number; // 0..1

export type InteractionType =
  | "greeting"
  | "follow_up"
  | "task_request"
  | "clarification"
  | "feedback"
  | "social_smalltalk"
  | "sensitive_support"
  | "unknown";

export type TaskType =
  | "technical"
  | "factual"
  | "analytical"
  | "creative"
  | "operational"
  | "sensitive"
  | "general";

export type RelationalDistance = "distant" | "professional" | "familiar";

export type SensitivityLevel = "low" | "medium" | "high" | "critical";

export interface UserExplicitPreference {
  preferredWarmth?: number;
  preferredCasualness?: number;
  preferredEmpathy?: number;
  preferredFormality?: number;
  preferDirectStyle?: boolean;
  preferShortReplies?: boolean;
}

export interface BehaviorContextualSignals {
  normalizedMessage?: string;
  activeTopic?: string;
  followUpPrompt?: string | null;
  needsClarification?: boolean;
  userRequestedNameRecall?: boolean;
  userRequestedNameShare?: boolean;
  conversationalPrompt?: boolean;
  continuityScore?: number;
  rapportScore?: number;
  detectedConfusion?: number;
  recentOpenings?: string[];
}

export interface BehaviorPersonalityInput {
  userTone: string;
  interactionType: InteractionType;
  taskType: TaskType;
  relationalDistance: RelationalDistance;
  frustrationSignal: number;
  enthusiasmSignal: number;
  sensitivityLevel: SensitivityLevel;
  formalityNeed: number;
  userExplicitPreference?: UserExplicitPreference;
  contextualSignals: BehaviorContextualSignals;
  previousBehaviorState?: BehaviorPersonalityOutput | null;
}

export interface PersonalityPolicyProfile {
  allowCasualness: boolean;
  allowEmpathicShaping: boolean;
  allowSocialWarmthBoost: boolean;
  maxWarmth: number;
  maxCasualness: number;
  maxEmpathy: number;
  minRestraint: number;
  maxExpressiveVariation: number;
  sensitiveMode: boolean;
  technicalStrictMode: boolean;
  prohibitedPatterns: string[];
}

export interface BehavioralStyleNotes {
  openingStrategy: "direct" | "anchored" | "light-touch";
  pacingStrategy: "concise" | "balanced" | "stepwise";
  transitionStyle: "clean" | "supportive" | "didactic";
  microVariationCue?: string;
  guidance: string[];
}

export type ProactiveMemoryOpportunityType =
  | "style_preference"
  | "detail_level"
  | "format_preference"
  | "recurring_goal"
  | "usage_context"
  | "constraint_preference"
  | "none";

export interface ProactiveQuestionPlan {
  shouldAsk: boolean;
  questionText: string | null;
  opportunityType: ProactiveMemoryOpportunityType;
  rationale: string;
}

export interface AiIdentityProfile {
  canonicalName: string;
  entityDescription: string;
  preferredSelfReference: "first_person";
  preferredUserTreatment: "cordial" | "cordial-professional";
  courtesyLevel: number; // 0..1
  identityQuestionDetected: boolean;
  nameOriginQuestionDetected: boolean;
  creatorQuestionDetected?: boolean;
  founderInfluenceQuestionDetected?: boolean;
  formationQuestionDetected?: boolean;
  professionalQuestionDetected?: boolean;
  shouldSelfIntroduce: boolean;
  identityNarrativeShort: string;
  identityNarrativeLong: string;
  medeirosNarrativeShort?: string;
  medeirosNarrativeLong?: string;
  identityGroundingFacts: string[];
  styleDirectives: string[];
}

export interface BehaviorPersonalityOutput {
  targetWarmth: WarmthLevel;
  targetCasualness: CasualnessLevel;
  targetEmpathy: EmpathyLevel;
  targetRestraint: RestraintLevel;
  targetSocialPresence: SocialPresenceLevel;
  targetExpressiveVariation: ExpressiveVariationLevel;
  targetHumanizationLevel: number; // 0..1
  targetFormalityAdjustment: number; // 0..1
  proactivityLevel: number; // 0..1
  futureUtilityScore: number; // 0..1
  memoryValueScore: number; // 0..1
  socialIntrusivenessScore: number; // 0..1
  questionTimingScore: number; // 0..1
  questionFrequencyCap: number; // perguntas maximas por janela curta
  proactiveQuestionPlan: ProactiveQuestionPlan;
  aiIdentity: AiIdentityProfile;
  styleNotes: BehavioralStyleNotes;
  safetyNotes: string[];
  policyProfile: PersonalityPolicyProfile;
}
