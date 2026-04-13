/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 17b-response-behavior-layer
 * Module: response-behavior-layer-bridge
 * Responsibility: Modulate post-validation response behavior without rewriting semantic content ownership.
 * Primary Inputs: ProcessingState, validated draft and adaptive response-behavior layer mode.
 * Primary Outputs: BehaviorPersonalityState adjustments and a behavior-shaped validatedDraft surface.
 * Upstream Dependencies: validation layer, founder identity bridge, local behavior selector
 * Downstream Dependencies: proactivity gate, delivery profile, humanizer
 * Invariants: This layer only changes behavioral framing; semantic content stays locked after validation.
 * Failure Modes: Missing adaptive signals degrade to balanced behavior targets.
 * Audit Events: response_behavior_modulated
 * Notes: Adaptive behavior remains local to 17b and does not leak orchestration policy as free-form state mutation.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { resolveLayerModeFromState } from "../05-complexity-and-orchestration-layer/activation-policy/layer-mode-resolver";
import { resolveAiIdentityProfile, resolveIdentityFallbackForMessage } from "./ai-identity-regulator";
import { buildFounderIdentityInfluence } from "../12b-founder-influence-layer/founder-identity-bridge";
import type {
  BehaviorPersonalityInput,
  InteractionType,
  RelationalDistance,
  SensitivityLevel,
  TaskType,
} from "./behavior-and-personality-types";
import { responseBehaviorSelector } from "./operators/response-behavior-selector";

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function normalize(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();
}

function resolveInteractionType(state: ProcessingState): InteractionType {
  const message = normalize(state.normalizedMessage);
  if (/^(oi|ola|saudacoes|hello|hi)\b/.test(message)) return "greeting";
  if (state.conversationState.needsClarification) return "clarification";
  if (/\b(obrigad|valeu|perfeito|excelente)\b/.test(message)) return "feedback";
  if (/\b(tudo bem|como vai|boa noite|bom dia|boa tarde)\b/.test(message)) return "social_smalltalk";
  if (state.affectiveState.cautionLevel >= 0.72) return "sensitive_support";
  if (state.conversationState.turnCount > 0) return "follow_up";
  return "task_request";
}

function resolveTaskType(state: ProcessingState): TaskType {
  const message = normalize(state.normalizedMessage);
  if (/\b(api|endpoint|typescript|javascript|python|sql|docker|bug|debug|codigo|code|stack)\b/.test(message)) {
    return "technical";
  }
  if (state.selectedMode === "research") return "factual";
  if (state.selectedMode === "analysis") return "analytical";
  if (state.selectedMode === "technical") return "technical";
  if (state.selectedMode === "writing") return "creative";
  if (/\b(crie|gere|escreva|historia|poema|roteiro)\b/.test(message)) return "creative";
  if (state.affectiveState.cautionLevel >= 0.72) return "sensitive";
  return "general";
}

function resolveRelationalDistance(state: ProcessingState): RelationalDistance {
  const rapport = state.conversationState.rapportScore || 0;
  if (rapport >= 0.72) return "familiar";
  if (rapport <= 0.34) return "distant";
  return "professional";
}

function resolveSensitivityLevel(state: ProcessingState): SensitivityLevel {
  const caution = state.affectiveState.cautionLevel || 0;
  if (caution >= 0.82) return "critical";
  if (caution >= 0.62) return "high";
  if (caution >= 0.34) return "medium";
  return "low";
}

function resolveFormalityNeed(state: ProcessingState): number {
  const profileFormality = state.deliveryProfileState.formality;
  const formalityByProfile =
    profileFormality === "high" ? 0.82 : profileFormality === "low" ? 0.3 : 0.6;
  const directBoost = state.responsePlanState.responseIntent === "direct" ? 0.06 : 0;
  return clamp01(formalityByProfile + directBoost);
}

function resolveIdentityRuntimeSignal(state: ProcessingState): {
  source?: string;
  recognizedLabels?: string[];
  founderDetected?: boolean;
} {
  const rawProfile = state.userProfile;
  if (!rawProfile || typeof rawProfile !== "object" || Array.isArray(rawProfile)) {
    return {};
  }
  const rawIdentityContext = (rawProfile as Record<string, unknown>).identityRuntimeContext;
  if (!rawIdentityContext || typeof rawIdentityContext !== "object" || Array.isArray(rawIdentityContext)) {
    return {};
  }

  const contextRecord = rawIdentityContext as Record<string, unknown>;
  const source = typeof contextRecord.source === "string" ? contextRecord.source.trim() : "";
  const recognizedLabels = Array.isArray(contextRecord.recognizedLabels)
    ? contextRecord.recognizedLabels
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter(Boolean)
        .slice(0, 8)
    : [];
  const founderDetected = contextRecord.founderDetected === true;

  if (!source && !recognizedLabels.length && !founderDetected) return {};
  return {
    source: source || undefined,
    recognizedLabels: recognizedLabels.length ? recognizedLabels : undefined,
    founderDetected,
  };
}

function buildBehaviorInput(state: ProcessingState): BehaviorPersonalityInput {
  const message = `${state.normalizedMessage || state.rawMessage || ""}`;
  const normalizedMessage = normalize(message);
  const identityRuntimeSignal = resolveIdentityRuntimeSignal(state);
  const frustrationSignal =
    state.affectiveState.dominantAffect === "frustrated"
      ? clamp01(state.affectiveState.emotionalIntensity || 0)
      : 0;
  const enthusiasmSignal =
    state.affectiveState.dominantAffect === "enthusiastic" ||
    state.affectiveState.dominantAffect === "calm"
      ? clamp01(state.affectiveState.emotionalIntensity || 0)
      : 0;

  return {
    userTone: `${state.languageState.tone || "neutral"}`,
    interactionType: resolveInteractionType(state),
    taskType: resolveTaskType(state),
    relationalDistance: resolveRelationalDistance(state),
    frustrationSignal,
    enthusiasmSignal,
    sensitivityLevel: resolveSensitivityLevel(state),
    formalityNeed: resolveFormalityNeed(state),
    userExplicitPreference: {},
    contextualSignals: {
      normalizedMessage,
      activeTopic: state.conversationState.activeTopic || "general",
      followUpPrompt: state.conversationState.followUpPrompt,
      needsClarification: state.conversationState.needsClarification,
      userRequestedNameRecall: /\b(voce lembra meu nome|lembra do meu nome)\b/.test(normalizedMessage),
      userRequestedNameShare: /\b(me chama de|me chame de|meu nome e)\b/.test(normalizedMessage),
      conversationalPrompt: state.selectedMode === "chat",
      continuityScore: state.conversationState.balanceScore,
      rapportScore: state.conversationState.rapportScore,
      detectedConfusion: state.conversationState.needsClarification ? 0.7 : 0.2,
      recentOpenings: [],
      identityRuntimeSource: identityRuntimeSignal.source,
      identityRuntimeLabels: identityRuntimeSignal.recognizedLabels,
      identityRuntimeFounderDetected: identityRuntimeSignal.founderDetected === true,
    },
    previousBehaviorState: state.behaviorPersonalityState,
  };
}

function isIdentityTurn(message: string): boolean {
  const resolved = resolveIdentityFallbackForMessage(message);
  return resolved.shouldHandle;
}

function resolveIdentityCanonicalDraft(
  state: ProcessingState,
  narratives?: { shortNarrative?: string; longNarrative?: string },
): string {
  const shortPreferred =
    state.responsePlanState.responseIntent === "direct" ||
    state.responsePlanState.depthLevel === "shallow" ||
    state.responsePlanState.depthLevel === "standard";

  return shortPreferred
    ? `${narratives?.shortNarrative || state.behaviorPersonalityState.aiIdentity.identityNarrativeShort || ""}`.trim()
    : `${narratives?.longNarrative || state.behaviorPersonalityState.aiIdentity.identityNarrativeLong || ""}`.trim();
}

function normalizeLoose(value: string): string {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasIdentityAnchor(text: string): boolean {
  const normalized = normalizeLoose(text);
  if (!normalized) return false;
  return /\b(leticia|medeiros|criador|idealizador|origem|nome|fundador|homenagem)\b/.test(normalized);
}

function isShortFollowUpIdentityPrompt(state: ProcessingState, message: string): boolean {
  const normalized = normalizeLoose(message);
  if (!normalized) return false;

  const tokenCount = normalized.split(" ").filter(Boolean).length;
  if (tokenCount === 0 || tokenCount > 14) return false;

  const hasFollowUpCue =
    /^(e|entao|mas|humm|hum|ta|ok|certo|certo,|pois)\b/.test(normalized) ||
    /\b(esse|essa|isso|assim|ele|dele|de onde|como)\b/.test(normalized);
  const hasQuestionCue =
    /\?$/.test(message.trim()) ||
    /\b(quem|qual|por que|porque|pq|de onde|como)\b/.test(normalized);
  if (!hasFollowUpCue || !hasQuestionCue) return false;

  const hasRecentIdentityContext =
    hasIdentityAnchor(state.conversationState.activeTopic || "") ||
    state.recentTurns.slice(-6).some((turn) => hasIdentityAnchor(turn.content));
  return hasRecentIdentityContext;
}

function resolveContextualIdentityFallback(
  state: ProcessingState,
  message: string,
): ReturnType<typeof resolveIdentityFallbackForMessage> | null {
  if (!isShortFollowUpIdentityPrompt(state, message)) return null;

  const historyWindow = state.recentTurns
    .slice(-6)
    .map((turn) => `${turn.content || ""}`.trim())
    .filter(Boolean)
    .join(" ");
  const composite = `${historyWindow} ${message}`.trim();
  const fallback = resolveIdentityFallbackForMessage(composite);
  return fallback.shouldHandle ? fallback : null;
}

function resolveToneTargets(state: ProcessingState) {
  const affective = state.affectiveState;
  const plan = state.responsePlanState;

  const targetWarmth = affective.dominantAffect === "frustrated"
    ? 0.46
    : affective.dominantAffect === "anxious" || affective.dominantAffect === "concerned"
      ? 0.52
      : 0.38;

  const targetRestraint = plan.responseIntent === "direct" ? 0.76 : 0.66;
  const targetCasualness = plan.depthLevel === "shallow" ? 0.16 : 0.10;
  const targetEmpathy = affective.emotionalIntensity >= 0.6 ? 0.48 : 0.28;

  return {
    targetWarmth: clamp01(targetWarmth),
    targetRestraint: clamp01(targetRestraint),
    targetCasualness: clamp01(targetCasualness),
    targetEmpathy: clamp01(targetEmpathy),
  };
}

export async function runResponseBehaviorLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const behaviorMode = resolveLayerModeFromState(state, "response-behavior");
  let validatedDraft = `${state.validatedDraft || state.structuredResponse || state.draftResponse?.text || ""}`.trim();
  const behaviorInput = buildBehaviorInput(state);
  const aiIdentity = resolveAiIdentityProfile(behaviorInput);
  const messageForIdentity = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  const contextualIdentityFallback = resolveContextualIdentityFallback(state, messageForIdentity);
  const effectiveAiIdentity = contextualIdentityFallback
    ? {
        ...aiIdentity,
        identityQuestionDetected:
          aiIdentity.identityQuestionDetected || contextualIdentityFallback.identityQuestionDetected,
        nameOriginQuestionDetected:
          aiIdentity.nameOriginQuestionDetected || contextualIdentityFallback.nameOriginQuestionDetected,
        creatorQuestionDetected:
          aiIdentity.creatorQuestionDetected === true || contextualIdentityFallback.creatorQuestionDetected,
        founderInfluenceQuestionDetected:
          aiIdentity.founderInfluenceQuestionDetected === true ||
          contextualIdentityFallback.founderInfluenceQuestionDetected,
        formationQuestionDetected:
          aiIdentity.formationQuestionDetected === true || contextualIdentityFallback.formationQuestionDetected,
        professionalQuestionDetected:
          aiIdentity.professionalQuestionDetected === true || contextualIdentityFallback.professionalQuestionDetected,
        identityNarrativeShort:
          contextualIdentityFallback.shortNarrative || aiIdentity.identityNarrativeShort,
        identityNarrativeLong:
          contextualIdentityFallback.longNarrative || aiIdentity.identityNarrativeLong,
        styleDirectives: [
          ...new Set([
            ...aiIdentity.styleDirectives,
            "identity_contextual_continuation_detected",
          ]),
        ],
      }
    : aiIdentity;
  const founderIdentityInfluence = buildFounderIdentityInfluence();

  const targets = resolveToneTargets(state);
  const localBehaviorPolicy = responseBehaviorSelector(state, behaviorMode);
  state.behaviorPersonalityState = {
    ...state.behaviorPersonalityState,
    targetWarmth: clamp01(targets.targetWarmth + localBehaviorPolicy.warmthBias),
    targetCasualness: targets.targetCasualness,
    targetEmpathy: clamp01(targets.targetEmpathy + localBehaviorPolicy.empathyBias),
    targetRestraint: clamp01(targets.targetRestraint + localBehaviorPolicy.restraintBias),
    targetHumanizationLevel: clamp01(
      Math.min(localBehaviorPolicy.humanizationCap, 1 - targets.targetRestraint + 0.22 + localBehaviorPolicy.warmthBias),
    ),
    targetFormalityAdjustment: clamp01(targets.targetRestraint + Math.max(0, localBehaviorPolicy.restraintBias)),
    targetSocialPresence: clamp01(1 - targets.targetRestraint + 0.12 + localBehaviorPolicy.socialPresenceBias),
    styleNotes: {
      ...state.behaviorPersonalityState.styleNotes,
      guidance: [
        ...effectiveAiIdentity.styleDirectives.slice(0, 6),
        "response_behavior_post_validation",
        "semantic_content_locked",
        "no_fact_injection",
        `behavior_mode:${behaviorMode}`,
        ...localBehaviorPolicy.guidance,
      ],
    },
    aiIdentity: effectiveAiIdentity,
    safetyNotes: [
      ...new Set([
        ...state.behaviorPersonalityState.safetyNotes,
        "post_validation_semantic_lock",
      ]),
    ].slice(0, 8),
  };

  let identityCanonicalApplied = false;
  if (
    isIdentityTurn(messageForIdentity) ||
    contextualIdentityFallback != null ||
    effectiveAiIdentity.identityQuestionDetected ||
    effectiveAiIdentity.nameOriginQuestionDetected ||
    effectiveAiIdentity.creatorQuestionDetected === true ||
    effectiveAiIdentity.founderInfluenceQuestionDetected === true ||
    effectiveAiIdentity.formationQuestionDetected === true ||
    effectiveAiIdentity.professionalQuestionDetected === true
  ) {
    const identityDraft = resolveIdentityCanonicalDraft(state, {
      shortNarrative: effectiveAiIdentity.identityNarrativeShort,
      longNarrative: effectiveAiIdentity.identityNarrativeLong,
    });
    if (identityDraft) {
      validatedDraft = identityDraft;
      identityCanonicalApplied = true;
      state.activeConstraints = [
        ...new Set([
          ...state.activeConstraints,
          "identity_semantic_guard:canonical_profile",
        ]),
      ].slice(-32);
    }
  }

  state.validatedDraft = validatedDraft;
  state.structuredResponse = validatedDraft;

  state.executionArtifacts.behavior = {
    targetWarmth: state.behaviorPersonalityState.targetWarmth,
    targetCasualness: state.behaviorPersonalityState.targetCasualness,
    targetEmpathy: state.behaviorPersonalityState.targetEmpathy,
    targetRestraint: state.behaviorPersonalityState.targetRestraint,
    targetSocialPresence: state.behaviorPersonalityState.targetSocialPresence,
    targetHumanizationLevel: state.behaviorPersonalityState.targetHumanizationLevel,
    targetFormalityAdjustment: state.behaviorPersonalityState.targetFormalityAdjustment,
    proactivityLevel: state.behaviorPersonalityState.proactivityLevel,
    futureUtilityScore: state.behaviorPersonalityState.futureUtilityScore,
    memoryValueScore: state.behaviorPersonalityState.memoryValueScore,
    socialIntrusivenessScore: state.behaviorPersonalityState.socialIntrusivenessScore,
    questionTimingScore: state.behaviorPersonalityState.questionTimingScore,
    questionFrequencyCap: state.behaviorPersonalityState.questionFrequencyCap,
    proactiveQuestionPlan: state.behaviorPersonalityState.proactiveQuestionPlan,
    aiIdentity: {
      canonicalName: state.behaviorPersonalityState.aiIdentity.canonicalName,
      courtesyLevel: state.behaviorPersonalityState.aiIdentity.courtesyLevel,
      identityQuestionDetected: state.behaviorPersonalityState.aiIdentity.identityQuestionDetected,
      nameOriginQuestionDetected: state.behaviorPersonalityState.aiIdentity.nameOriginQuestionDetected,
      creatorQuestionDetected: state.behaviorPersonalityState.aiIdentity.creatorQuestionDetected,
      founderInfluenceQuestionDetected: state.behaviorPersonalityState.aiIdentity.founderInfluenceQuestionDetected,
      formationQuestionDetected: state.behaviorPersonalityState.aiIdentity.formationQuestionDetected,
      professionalQuestionDetected: state.behaviorPersonalityState.aiIdentity.professionalQuestionDetected,
      shouldSelfIntroduce: state.behaviorPersonalityState.aiIdentity.shouldSelfIntroduce,
    },
    styleNotes: state.behaviorPersonalityState.styleNotes.guidance.slice(0, 8),
    safetyNotes: state.behaviorPersonalityState.safetyNotes.slice(0, 6),
  };

  state.executionArtifacts.founderInfluence = {
    founderName: founderIdentityInfluence.founderName,
    founderRole: founderIdentityInfluence.founderRole,
    identityWeight: founderIdentityInfluence.identityWeight,
    reasoningWeight: state.executionArtifacts.founderInfluence?.reasoningWeight || 0,
    epistemicWeight: state.executionArtifacts.founderInfluence?.epistemicWeight || 0,
    identityInfluenceDirectives: [...founderIdentityInfluence.identityInfluenceDirectives],
    reasoningInfluenceDirectives: [...(state.executionArtifacts.founderInfluence?.reasoningInfluenceDirectives || [])],
    validationInfluenceDirectives: [...(state.executionArtifacts.founderInfluence?.validationInfluenceDirectives || [])],
    existentialVectors: [...founderIdentityInfluence.existentialVectors],
    epistemicVectors: [...(state.executionArtifacts.founderInfluence?.epistemicVectors || [])],
    protectedGroundingFacts: [...founderIdentityInfluence.protectedGroundingFacts],
  };

  state.activeConstraints = [
    ...new Set([
      ...state.activeConstraints,
      "response_behavior_post_validation",
      "semantic_lock:validated_draft",
    ]),
  ].slice(-32);

  state.trace.push(
    makeTraceEvent({
      layer: "response-behavior",
      action: "response_behavior_modulated",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `mode=${behaviorMode}; warmth=${state.behaviorPersonalityState.targetWarmth.toFixed(2)}; restraint=${state.behaviorPersonalityState.targetRestraint.toFixed(2)}; ` +
        `identityDetected=${effectiveAiIdentity.identityQuestionDetected || effectiveAiIdentity.nameOriginQuestionDetected}; ` +
        `contextualIdentityFallback=${contextualIdentityFallback ? "true" : "false"}; ` +
        `canonicalApplied=${identityCanonicalApplied}; chars=${validatedDraft.length}`,
    }),
  );

  return state;
}

export async function runBehaviorAndPersonalityLayer(state: ProcessingState): Promise<ProcessingState> {
  return runResponseBehaviorLayer(state);
}
