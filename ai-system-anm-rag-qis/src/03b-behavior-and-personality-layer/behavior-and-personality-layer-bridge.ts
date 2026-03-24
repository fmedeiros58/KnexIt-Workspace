/**
 * Responsabilidade do arquivo:
 * - Orquestrar a camada 03b de comportamento e personalidade.
 * - Receber sinais conversacionais e consolidar perfil comportamental do turno.
 * - Entregar output seguro para camadas seguintes, com fallback resiliente.
 */
import { assertHandoffContract } from "../bridges/contracts/layer-handoff-contract";
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import {
  composeBehavioralStyle,
} from "./behavioral-style-composer";
import type {
  BehaviorPersonalityInput,
  BehaviorPersonalityOutput,
  InteractionType,
  RelationalDistance,
  SensitivityLevel,
  TaskType,
  UserExplicitPreference,
} from "./behavior-and-personality-types";
import { shapeEmpathicResponse } from "./empathic-response-shaper";
import { buildHumanLikenessStyleGuide } from "./human-likeness-style-guide";
import { generateMicroVariation } from "./micro-variation-engine";
import { detectMemoryOpportunity } from "./memory-opportunity-detector";
import { resolveAiIdentityProfile } from "./ai-identity-regulator";
import { resolvePersonalityPolicy } from "./personality-policy";
import { shapeProactiveQuestion } from "./proactive-question-shaper";
import { regulateProactiveCuriosity } from "./proactive-curiosity-regulator";
import { regulateSocialPresence } from "./social-presence-regulator";
import { calibrateWarmth } from "./warmth-calibrator";
import { calibrateCasualness } from "./casualness-calibrator";

const CONVERSATION_TO_BEHAVIOR_CONTRACT = {
  from: "conversation",
  to: "behavior-personality",
  requiredFields: ["conversationState", "languageState", "inputSignals", "activeContext", "userProfile"],
} as const;

const BEHAVIOR_TO_CONTEXT_CONTRACT = {
  from: "behavior-personality",
  to: "context",
  requiredFields: ["behaviorPersonalityState", "activeContext", "activeConstraints", "userProfile"],
} as const;

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function normalize(text: string): string {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function inferInteractionType(state: ProcessingState): InteractionType {
  const message = normalize(state.normalizedMessage);
  if (!message) return "unknown";
  if (/^(oi|ola|oie|bom dia|boa tarde|boa noite|hello|hi)\b/.test(message)) return "greeting";
  if (state.conversationState.needsClarification) return "clarification";
  if ((state.conversationState.turnCount || 0) > 1) return "follow_up";
  if (/\b(obrigado|obg|valeu|thanks)\b/.test(message)) return "feedback";
  if (/\b(tudo bem|como voce esta|e ai|bora conversar)\b/.test(message)) return "social_smalltalk";
  return "task_request";
}

function inferTaskType(state: ProcessingState): TaskType {
  const domain = normalize(state.inputSignals.domain);
  const intent = normalize(state.inputSignals.intent);
  const message = normalize(state.normalizedMessage);
  if (state.inputSignals.safetyFlags.length > 0) return "sensitive";
  if (/\b(medico|juridico|legal|clinico|trauma|luto|violencia)\b/.test(message)) return "sensitive";
  if (/\b(codigo|api|docker|sql|kubernetes|debug|erro|stack)\b/.test(message) || domain === "technology") return "technical";
  if (/\b(prefeito|presidente|governador|dados|fonte|evidencia)\b/.test(message)) return "factual";
  if (intent === "analysis" || intent === "analise") return "analytical";
  if (intent === "planning" || /\b(plano|estrategia)\b/.test(message)) return "operational";
  if (/\b(crie|escreva|roteiro|poema|texto)\b/.test(message)) return "creative";
  return "general";
}

function inferRelationalDistance(state: ProcessingState): RelationalDistance {
  const preferredName = `${(state.userProfile as Record<string, unknown>).preferredName || ""}`.trim();
  if (preferredName) return "familiar";
  if ((state.conversationState.turnCount || 0) >= 4) return "professional";
  return "distant";
}

function inferSensitivityLevel(state: ProcessingState, taskType: TaskType): SensitivityLevel {
  const flags = state.inputSignals.safetyFlags.length;
  const message = normalize(state.normalizedMessage);
  if (taskType === "sensitive" && (flags >= 2 || /\b(urgente|risco|abuso|suic)\b/.test(message))) return "critical";
  if (taskType === "sensitive" || flags >= 1) return "high";
  if (/\b(incerteza|duvida|confuso|confusa)\b/.test(message)) return "medium";
  return "low";
}

function inferFrustrationSignal(state: ProcessingState): number {
  const message = normalize(state.normalizedMessage);
  const tone = normalize(state.languageState.tone);
  const base =
    /\b(frustrad|irritad|nao funcion|falhou|de novo|ainda nao|nada normal)\b/.test(message) ? 0.7 : 0.18;
  const toneBoost = /\b(direct|frustrated|hostile)\b/.test(tone) ? 0.12 : 0;
  const continuityPenalty = state.conversationState.rapportScore < 0.35 ? 0.08 : 0;
  return clamp01(base + toneBoost + continuityPenalty);
}

function inferEnthusiasmSignal(state: ProcessingState): number {
  const message = normalize(state.normalizedMessage);
  const base = /\b(perfeito|excelente|otimo|boa|show|legal|massa)\b/.test(message) ? 0.62 : 0.2;
  const toneBoost = normalize(state.languageState.tone) === "friendly" ? 0.12 : 0;
  return clamp01(base + toneBoost);
}

function inferFormalityNeed(state: ProcessingState, taskType: TaskType, sensitivityLevel: SensitivityLevel): number {
  const register = normalize(state.languageState.register);
  const message = normalize(state.normalizedMessage);
  const base = register === "formal" ? 0.72 : register === "balanced" ? 0.52 : 0.34;
  const taskBoost = taskType === "technical" || taskType === "factual" ? 0.16 : 0;
  const sensitivityBoost = sensitivityLevel === "critical" ? 0.24 : sensitivityLevel === "high" ? 0.12 : 0;
  const informalPenalty = /\b(vc|vcs|blz|bora|tipo)\b/.test(message) ? 0.1 : 0;
  return clamp01(base + taskBoost + sensitivityBoost - informalPenalty);
}

function readUserExplicitPreference(state: ProcessingState): UserExplicitPreference {
  const profile = state.userProfile as Record<string, unknown>;
  const preferredFormality = Number(profile.preferredFormality);
  const preferredWarmth = Number(profile.preferredWarmth);
  const preferredCasualness = Number(profile.preferredCasualness);
  const preferredEmpathy = Number(profile.preferredEmpathy);
  return {
    preferredFormality: Number.isFinite(preferredFormality) ? clamp01(preferredFormality) : undefined,
    preferredWarmth: Number.isFinite(preferredWarmth) ? clamp01(preferredWarmth) : undefined,
    preferredCasualness: Number.isFinite(preferredCasualness) ? clamp01(preferredCasualness) : undefined,
    preferredEmpathy: Number.isFinite(preferredEmpathy) ? clamp01(preferredEmpathy) : undefined,
    preferDirectStyle: profile.preferredAttitude === "direct" || state.activeConstraints.includes("prefer_brief_tone"),
    preferShortReplies: state.activeConstraints.includes("prefer_brief_tone"),
  };
}

function buildBehaviorInput(state: ProcessingState): BehaviorPersonalityInput {
  const taskType = inferTaskType(state);
  const sensitivityLevel = inferSensitivityLevel(state, taskType);
  return {
    userTone: state.languageState.tone,
    interactionType: inferInteractionType(state),
    taskType,
    relationalDistance: inferRelationalDistance(state),
    frustrationSignal: inferFrustrationSignal(state),
    enthusiasmSignal: inferEnthusiasmSignal(state),
    sensitivityLevel,
    formalityNeed: inferFormalityNeed(state, taskType, sensitivityLevel),
    userExplicitPreference: readUserExplicitPreference(state),
    contextualSignals: {
      normalizedMessage: state.normalizedMessage,
      activeTopic: state.conversationState.activeTopic,
      followUpPrompt: state.conversationState.followUpPrompt,
      needsClarification: state.conversationState.needsClarification,
      userRequestedNameRecall: state.activeConstraints.includes("conversation_name_recall_request"),
      userRequestedNameShare: state.activeConstraints.includes("conversation_name_share_request"),
      conversationalPrompt: state.activeConstraints.includes("conversation_prompt_detected"),
      continuityScore: Number((state.userProfile as Record<string, unknown>).turnContinuity || 0),
      rapportScore: state.conversationState.rapportScore,
      detectedConfusion: state.conversationState.needsClarification ? 0.68 : 0.22,
      recentOpenings: ((state.userProfile as Record<string, unknown>).recentOpenings as string[] | undefined) || [],
    },
    previousBehaviorState: state.behaviorPersonalityState || null,
  };
}

function buildSafeFallbackOutput(): BehaviorPersonalityOutput {
  return {
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
      rationale: "fallback_comportamental_sem_proatividade",
    },
    aiIdentity: {
      canonicalName: "Leticia",
      entityDescription: "IA nativa do ecossistema KnexIT",
      preferredSelfReference: "first_person",
      preferredUserTreatment: "cordial-professional",
      courtesyLevel: 0.78,
      identityQuestionDetected: false,
      shouldSelfIntroduce: false,
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
      guidance: [
        "resposta_direta_com_tato_moderado",
        "manter_linguagem_polida_e_educada",
        "evitar_burocratizacao_excessiva",
      ],
    },
    safetyNotes: ["fallback_comportamental_ativado"],
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
  };
}

export async function runBehaviorAndPersonalityLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  assertHandoffContract(state, CONVERSATION_TO_BEHAVIOR_CONTRACT);

  let output: BehaviorPersonalityOutput;
  try {
    const input = buildBehaviorInput(state);
    const policy = resolvePersonalityPolicy(input);
    const targetWarmth = calibrateWarmth(input, policy);
    const targetCasualness = calibrateCasualness(input, policy);
    const targetEmpathy = shapeEmpathicResponse(input, policy);
    const social = regulateSocialPresence(input, policy);
    const guide = buildHumanLikenessStyleGuide(input, policy, {
      targetWarmth,
      targetCasualness,
      targetEmpathy,
      targetSocialPresence: social.targetSocialPresence,
    });
    const variation = generateMicroVariation(input, {
      targetCasualness,
      targetSocialPresence: social.targetSocialPresence,
      targetRestraint: guide.targetRestraint,
    });
    const memoryOpportunity = detectMemoryOpportunity(input);
    const proactiveDecision = regulateProactiveCuriosity({
      behaviorInput: input,
      policy,
      opportunity: memoryOpportunity,
      recentTurns: state.recentTurns,
    });
    const proactiveQuestion = shapeProactiveQuestion(input, proactiveDecision);
    const aiIdentity = resolveAiIdentityProfile(input);

    output = composeBehavioralStyle({
      policy,
      targetWarmth,
      targetCasualness,
      targetEmpathy,
      targetSocialPresence: social.targetSocialPresence,
      targetRestraint: guide.targetRestraint,
      targetHumanizationLevel: guide.targetHumanizationLevel,
      targetFormalityAdjustment: guide.targetFormalityAdjustment,
      styleTemplate: {
        ...guide.styleTemplate,
        openingStrategy: social.openingStrategy,
      },
      socialPresenceNotes: social.notes,
      microVariationCue: variation.openingCue,
      microVariationNote: variation.note,
      proactivityLevel: proactiveDecision.proactivityLevel,
      futureUtilityScore: proactiveDecision.futureUtilityScore,
      memoryValueScore: proactiveDecision.memoryValueScore,
      socialIntrusivenessScore: proactiveDecision.socialIntrusivenessScore,
      questionTimingScore: proactiveDecision.questionTimingScore,
      questionFrequencyCap: proactiveDecision.questionFrequencyCap,
      proactiveQuestionPlan: proactiveQuestion,
      aiIdentity,
      additionalSafetyNotes: guide.safetyNotes,
    });
  } catch (error) {
    output = buildSafeFallbackOutput();
    state.trace.push(
      makeTraceEvent({
        layer: "behavior-personality",
        action: "behavior_profile_fallback",
        route: state.executionPlan.selectedRoute,
        latencyMs: Date.now() - startedAt,
        detail: `reason=${error instanceof Error ? error.message : "unknown_error"}`,
      }),
    );
  }

  state.behaviorPersonalityState = output;
  state.activeContext = [
    ...state.activeContext,
    `behavior_warmth:${output.targetWarmth.toFixed(2)}`,
    `behavior_casualness:${output.targetCasualness.toFixed(2)}`,
    `behavior_empathy:${output.targetEmpathy.toFixed(2)}`,
    `behavior_restrain:${output.targetRestraint.toFixed(2)}`,
    `behavior_opening:${output.styleNotes.openingStrategy}`,
    `behavior_proactivity:${output.proactivityLevel.toFixed(2)}`,
    `behavior_identity:${output.aiIdentity.canonicalName}`,
    ...(output.proactiveQuestionPlan.shouldAsk && output.proactiveQuestionPlan.questionText
      ? [`behavior_proactive_question:${output.proactiveQuestionPlan.questionText}`]
      : []),
  ].slice(-20);
  state.activeConstraints = [
    ...new Set([
      ...state.activeConstraints,
      ...(output.targetRestraint >= 0.72 ? ["behavior_high_restraint"] : []),
      ...(output.targetCasualness <= 0.2 ? ["behavior_low_casualness"] : []),
      ...(output.policyProfile.sensitiveMode ? ["behavior_sensitive_mode"] : []),
      ...(output.proactiveQuestionPlan.shouldAsk ? ["behavior_proactive_question_ready"] : []),
      ...(output.aiIdentity.identityQuestionDetected ? ["behavior_ai_identity_prompt"] : []),
    ]),
  ].slice(-28);
  state.userProfile = {
    ...state.userProfile,
    behaviorProfile: {
      warmth: output.targetWarmth,
      casualness: output.targetCasualness,
      empathy: output.targetEmpathy,
      restraint: output.targetRestraint,
      socialPresence: output.targetSocialPresence,
      humanization: output.targetHumanizationLevel,
      formalityAdjustment: output.targetFormalityAdjustment,
      proactivityLevel: output.proactivityLevel,
      futureUtilityScore: output.futureUtilityScore,
      memoryValueScore: output.memoryValueScore,
      socialIntrusivenessScore: output.socialIntrusivenessScore,
      questionTimingScore: output.questionTimingScore,
      questionFrequencyCap: output.questionFrequencyCap,
      proactiveQuestionPlan: output.proactiveQuestionPlan,
      aiIdentity: output.aiIdentity,
      styleNotes: output.styleNotes,
    },
  };
  state.executionArtifacts.behavior = {
    targetWarmth: output.targetWarmth,
    targetCasualness: output.targetCasualness,
    targetEmpathy: output.targetEmpathy,
    targetRestraint: output.targetRestraint,
    targetSocialPresence: output.targetSocialPresence,
    targetHumanizationLevel: output.targetHumanizationLevel,
    targetFormalityAdjustment: output.targetFormalityAdjustment,
    proactivityLevel: output.proactivityLevel,
    futureUtilityScore: output.futureUtilityScore,
    memoryValueScore: output.memoryValueScore,
    socialIntrusivenessScore: output.socialIntrusivenessScore,
    questionTimingScore: output.questionTimingScore,
    questionFrequencyCap: output.questionFrequencyCap,
    proactiveQuestionPlan: output.proactiveQuestionPlan,
    aiIdentity: {
      canonicalName: output.aiIdentity.canonicalName,
      courtesyLevel: output.aiIdentity.courtesyLevel,
      identityQuestionDetected: output.aiIdentity.identityQuestionDetected,
      shouldSelfIntroduce: output.aiIdentity.shouldSelfIntroduce,
    },
    styleNotes: output.styleNotes.guidance.slice(0, 6),
    safetyNotes: output.safetyNotes.slice(0, 6),
  };

  assertHandoffContract(state, BEHAVIOR_TO_CONTEXT_CONTRACT);
  state.trace.push(
    makeTraceEvent({
      layer: "behavior-personality",
      action: "behavior_profile_composed",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `warmth=${output.targetWarmth.toFixed(2)}; casualness=${output.targetCasualness.toFixed(2)}; ` +
        `empathy=${output.targetEmpathy.toFixed(2)}; restraint=${output.targetRestraint.toFixed(2)}; ` +
        `humanization=${output.targetHumanizationLevel.toFixed(2)}; proactive=${output.proactivityLevel.toFixed(2)}; ask=${output.proactiveQuestionPlan.shouldAsk}; identity=${output.aiIdentity.canonicalName}`,
    }),
  );

  return state;
}
