/**
 * Responsabilidade do arquivo:
 * - Decidir se ha espaco para pergunta proativa nao invasiva no turno.
 * - Balancear utilidade futura vs custo social da pergunta.
 * - Aplicar limite de frequencia e bloqueios contextuais.
 */
import type {
  BehaviorPersonalityInput,
  PersonalityPolicyProfile,
  ProactiveQuestionPlan,
} from "./behavior-and-personality-types";
import type { MemoryOpportunityDetection } from "./memory-opportunity-detector";

export interface ProactiveCuriosityDecision {
  proactivityLevel: number;
  futureUtilityScore: number;
  memoryValueScore: number;
  socialIntrusivenessScore: number;
  questionTimingScore: number;
  questionFrequencyCap: number;
  shouldAskProactiveQuestion: boolean;
  rationale: string;
  opportunityType: ProactiveQuestionPlan["opportunityType"];
}

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function detectRushSignal(input: BehaviorPersonalityInput): boolean {
  const message = `${input.contextualSignals.normalizedMessage || ""}`.toLowerCase();
  return /\b(rapido|rapid|agora|urgente|direto|sem rodeios|objetivo)\b/.test(message);
}

function countRecentAssistantQuestions(recentTurns: Array<{ role: "user" | "assistant"; content: string }>): number {
  return recentTurns
    .slice(-8)
    .filter((turn) => turn.role === "assistant")
    .filter((turn) => /\?/.test(turn.content))
    .length;
}

export function regulateProactiveCuriosity(input: {
  behaviorInput: BehaviorPersonalityInput;
  policy: PersonalityPolicyProfile;
  opportunity: MemoryOpportunityDetection;
  recentTurns: Array<{ role: "user" | "assistant"; content: string }>;
}): ProactiveCuriosityDecision {
  const behaviorInput = input.behaviorInput;
  const policy = input.policy;
  const opportunity = input.opportunity;

  const rushSignal = detectRushSignal(behaviorInput);
  const recentQuestions = countRecentAssistantQuestions(input.recentTurns);
  const questionFrequencyCap = 1;
  const frequencyPenalty = recentQuestions >= questionFrequencyCap ? 0.42 : recentQuestions * 0.2;
  const sensitiveBlock = policy.sensitiveMode || behaviorInput.sensitivityLevel === "critical";
  const strictTaskBlock =
    behaviorInput.taskType === "sensitive" ||
    (policy.technicalStrictMode && behaviorInput.userExplicitPreference?.preferDirectStyle);

  const questionTimingScore = clamp01(
    0.56 +
      ((behaviorInput.interactionType === "follow_up" || behaviorInput.interactionType === "clarification") ? 0.16 : 0) +
      ((behaviorInput.contextualSignals.needsClarification === true) ? 0.08 : 0) -
      (rushSignal ? 0.42 : 0) -
      frequencyPenalty -
      (sensitiveBlock ? 0.32 : 0),
  );

  const socialIntrusivenessScore = clamp01(
    opportunity.intrusivenessBaseScore +
      (rushSignal ? 0.24 : 0) +
      (strictTaskBlock ? 0.18 : 0) +
      (behaviorInput.formalityNeed * 0.12) +
      frequencyPenalty,
  );

  const futureUtilityScore = clamp01(opportunity.futureUtilityScore);
  const memoryValueScore = clamp01(opportunity.memoryValueScore);

  const proactivityLevel = clamp01(
    (futureUtilityScore * 0.38) +
      (memoryValueScore * 0.34) +
      (questionTimingScore * 0.28) -
      (socialIntrusivenessScore * 0.46),
  );

  const shouldAskProactiveQuestion =
    opportunity.opportunityType !== "none" &&
    !sensitiveBlock &&
    !strictTaskBlock &&
    !rushSignal &&
    futureUtilityScore >= 0.58 &&
    memoryValueScore >= 0.56 &&
    socialIntrusivenessScore <= 0.44 &&
    questionTimingScore >= 0.52 &&
    recentQuestions < questionFrequencyCap;

  const rationale = shouldAskProactiveQuestion
    ? `proactive_enabled:${opportunity.opportunityType}`
    : `proactive_blocked:reason=${[
        opportunity.opportunityType === "none" ? "no_functional_gap" : "",
        sensitiveBlock ? "sensitive_mode" : "",
        strictTaskBlock ? "strict_task_mode" : "",
        rushSignal ? "rush_signal" : "",
        recentQuestions >= questionFrequencyCap ? "frequency_cap" : "",
        futureUtilityScore < 0.58 ? "low_future_utility" : "",
        memoryValueScore < 0.56 ? "low_memory_value" : "",
        socialIntrusivenessScore > 0.44 ? "high_intrusiveness" : "",
        questionTimingScore < 0.52 ? "low_timing" : "",
      ].filter(Boolean).join("|")}`;

  return {
    proactivityLevel,
    futureUtilityScore,
    memoryValueScore,
    socialIntrusivenessScore,
    questionTimingScore,
    questionFrequencyCap,
    shouldAskProactiveQuestion,
    rationale,
    opportunityType: opportunity.opportunityType,
  };
}

