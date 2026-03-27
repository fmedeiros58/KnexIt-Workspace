import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { recentTurnsBuffer } from "./context-core/recent-turns-buffer";
import { contextManager } from "./context-core/context-manager";
import { instructionStack } from "./context-core/instruction-stack";
import { activeConstraints as mergeActiveConstraints } from "./context-core/active-constraints";
import { contextPruner } from "./context-core/context-pruner";
import { persistentUserContext } from "./context-core/persistent-user-context";
import { activeModeState } from "./session-core/active-mode-state";
import { conversationTimeline } from "./session-core/conversation-timeline";
import { sessionManager } from "./session-core/session-manager";
import { sessionState } from "./session-core/session-state";
import { turnRegistry } from "./session-core/turn-registry";
import { conversationalCoherenceEngine } from "./conversational-core/conversational-coherence-engine";
import { conversationalIntentionResolver } from "./conversational-core/conversational-intention-resolver";
import { dialogueContinuityEngine } from "./conversational-core/dialogue-continuity-engine";
import { discourseStateManager } from "./conversational-core/discourse-state-manager";
import { topicAnchor } from "./conversational-core/topic-anchor";
import { turnBalanceEngine } from "./conversational-core/turn-balance-engine";
import { domainPreferenceProfile } from "./personality-and-proactivity-core/domain-preference-profile";
import { initiativeThresholdController } from "./personality-and-proactivity-core/initiative-threshold-controller";
import { interactivePersonalityEngine } from "./personality-and-proactivity-core/interactive-personality-engine";
import { personalConstraintRegistry } from "./personality-and-proactivity-core/personal-constraint-registry";
import { proactivityEngine } from "./personality-and-proactivity-core/proactivity-engine";
import { responseAttitudeManager } from "./personality-and-proactivity-core/response-attitude-manager";
import { responsePreferenceProfile } from "./personality-and-proactivity-core/response-preference-profile";
import { userStyleProfile } from "./personality-and-proactivity-core/user-style-profile";
import { handoffContextToOrchestration } from "./context-to-orchestration-bridge";
import {
  extractPreferredNameFromText,
  extractPreferredNameFromTurns,
  isConversationalPrompt,
  isNameRecallPrompt,
  isNameSharePrompt,
  toDisplayName,
} from "../shared/utils/conversation-signals";

function averageScore(items: Array<{ score: number }>) {
  if (!items.length) return 0;
  return items.reduce((sum, item) => sum + item.score, 0) / items.length;
}

function deriveProactivityMode(
  base: ProcessingState["proactivityMode"],
  signal: number,
): ProcessingState["proactivityMode"] {
  if (signal >= 0.74) return "high";
  if (signal >= 0.52) return base === "high" ? "high" : "medium";
  return base;
}

function readString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function readStringArray(value: unknown) {
  if (!Array.isArray(value)) return [] as string[];
  return value.filter((item): item is string => typeof item === "string");
}

export async function runContextLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();

  const turnBuffer = recentTurnsBuffer({
    turns: state.recentTurns,
    limit: 8,
  });
  const managedContext = contextManager({
    normalizedMessage: state.normalizedMessage,
    recentBuffer: turnBuffer.buffer,
    memoryHints: state.memorySnapshot.records.slice(-4).map((record) => record.content),
    existingConstraints: state.activeConstraints,
    safetyFlags: state.inputSignals.safetyFlags,
    urgency: state.inputSignals.urgency,
    continuityScore: turnBuffer.continuityScore,
  });

  const instructionFlags = instructionStack({
    normalizedMessage: state.normalizedMessage,
    activeConstraints: managedContext.derivedConstraints,
  });
  const mergedConstraints = mergeActiveConstraints({
    existing: managedContext.derivedConstraints,
    safetyFlags: state.inputSignals.safetyFlags,
    instructionFlags: instructionFlags.instructions,
  });
  const pruned = contextPruner({
    query: state.normalizedMessage,
    contextItems: managedContext.activeContext,
    maxItems: 10,
  });
  const persistent = persistentUserContext({
    currentProfile: state.userProfile,
    language: state.language,
    intent: state.inputSignals.intent,
    urgency: state.inputSignals.urgency,
    instructions: instructionFlags.instructions,
  });

  const recentTurnText = state.recentTurns
    .slice(-8)
    .map((turn) => `${turn.role}:${turn.content}`)
    .join(" ");
  const sharedText = [state.normalizedMessage, ...pruned.prunedContext.slice(-4), recentTurnText]
    .filter(Boolean)
    .join(" ");

  const sessionSignals = {
    manager: sessionManager({ text: sharedText, score: turnBuffer.continuityScore }),
    session: sessionState({ text: sharedText }),
    turnRegistry: turnRegistry({ text: recentTurnText }),
    timeline: conversationTimeline({ text: recentTurnText }),
    modeState: activeModeState({ text: `${state.selectedMode} ${state.inputSignals.intent}` }),
  };

  const conversationalSignals = {
    coherence: conversationalCoherenceEngine({ text: sharedText }),
    intention: conversationalIntentionResolver({ text: state.normalizedMessage }),
    continuity: dialogueContinuityEngine({ text: recentTurnText, score: turnBuffer.continuityScore }),
    discourse: discourseStateManager({ text: sharedText }),
    topic: topicAnchor({ text: state.normalizedMessage }),
    turnBalance: turnBalanceEngine({ text: recentTurnText }),
  };

  const personalitySignals = {
    domain: domainPreferenceProfile({ text: `${state.inputSignals.domain} ${sharedText}` }),
    initiative: initiativeThresholdController({ text: sharedText }),
    interactiveEngine: interactivePersonalityEngine({ text: sharedText }),
    personalConstraints: personalConstraintRegistry({ text: sharedText }),
    proactivity: proactivityEngine({ text: sharedText }),
    responseAttitude: responseAttitudeManager({ text: sharedText }),
    responsePreference: responsePreferenceProfile({ text: sharedText }),
    style: userStyleProfile({ text: sharedText }),
  };

  const sessionScore = averageScore(Object.values(sessionSignals));
  const conversationScore = averageScore(Object.values(conversationalSignals));
  const personalityScore = averageScore(Object.values(personalitySignals));
  const proactivitySignal = averageScore([
    personalitySignals.initiative,
    personalitySignals.proactivity,
    personalitySignals.interactiveEngine,
  ]);
  const explicitUserConstraints = readStringArray(personalitySignals.personalConstraints.context.constraints);
  const resolvedIntent = readString(conversationalSignals.intention.context.resolvedIntent, "chat");
  const dominantDomain = readString(personalitySignals.domain.context.dominantDomain, "general");
  const preferredFormat = readString(personalitySignals.responsePreference.context.formatPreference, "paragraph");
  const preferredLength = readString(personalitySignals.responsePreference.context.lengthPreference, "medium");
  const preferredAttitude = readString(personalitySignals.responseAttitude.context.recommendedAttitude, "balanced-neutral");
  const styleTag = readString(personalitySignals.style.context.styleTag, "neutral");
  const currentPreferredName = typeof state.userProfile.preferredName === "string"
    ? toDisplayName(state.userProfile.preferredName)
    : "";
  const preferredNameFromMessage = extractPreferredNameFromText(state.normalizedMessage);
  const preferredNameFromTurns = extractPreferredNameFromTurns(state.recentTurns);
  const preferredName = preferredNameFromMessage || currentPreferredName || preferredNameFromTurns || "";
  const asksNameRecall = isNameRecallPrompt(state.normalizedMessage);
  const asksNameShare = isNameSharePrompt(state.normalizedMessage);
  const conversationalPrompt = isConversationalPrompt(state.normalizedMessage);
  const identityHint = preferredName ? `Nome preferido do usuario: ${preferredName}.` : "";
  const behaviorProfile = state.behaviorPersonalityState;
  const behaviorHint = behaviorProfile
    ? `Perfil comportamental: warmth=${behaviorProfile.targetWarmth.toFixed(2)}; casualness=${behaviorProfile.targetCasualness.toFixed(2)}; empathy=${behaviorProfile.targetEmpathy.toFixed(2)}; restraint=${behaviorProfile.targetRestraint.toFixed(2)}.`
    : "";

  state.activeContext = [
    ...pruned.prunedContext,
    ...(identityHint ? [identityHint] : []),
    ...(behaviorHint ? [behaviorHint] : []),
  ].slice(-12);
  state.activeConstraints = [
    ...new Set([
      ...mergedConstraints.constraints,
      ...(sessionScore < 0.35 ? ["session_reanchor_needed"] : []),
      ...(conversationScore < 0.4 ? ["conversation_low_coherence"] : []),
      ...(personalitySignals.personalConstraints.score >= 0.62 ? ["persona_constraint_guarded"] : []),
      ...(proactivitySignal >= 0.7 ? ["proactivity_elevated"] : ["proactivity_limited"]),
      ...(asksNameRecall ? ["conversation_name_recall_request"] : []),
      ...(asksNameShare ? ["conversation_name_share_request"] : []),
      ...(conversationalPrompt ? ["conversation_prompt_detected"] : []),
      ...(behaviorProfile && behaviorProfile.targetRestraint >= 0.72 ? ["behavior_high_restraint"] : []),
      ...(behaviorProfile && behaviorProfile.targetCasualness <= 0.2 ? ["behavior_low_casualness"] : []),
      ...explicitUserConstraints.map((constraint) => `user_constraint:${constraint}`),
    ]),
  ].slice(-24);
  state.proactivityMode = deriveProactivityMode(managedContext.proactivityMode, proactivitySignal);
  state.userProfile = {
    ...persistent.profile,
    topicHints: managedContext.topicHints,
    turnContinuity: turnBuffer.continuityScore,
    sessionScore: Number(sessionScore.toFixed(4)),
    conversationScore: Number(conversationScore.toFixed(4)),
    personalityScore: Number(personalityScore.toFixed(4)),
    activeModeSignal: Number(sessionSignals.modeState.score.toFixed(4)),
    responseStyleSignal: Number(personalitySignals.style.score.toFixed(4)),
    turnBalanceSignal: Number(conversationalSignals.turnBalance.score.toFixed(4)),
    resolvedIntent,
    dominantDomain,
    preferredFormat,
    preferredLength,
    preferredAttitude,
    styleTag,
    preferredName,
    asksNameRecall,
    asksNameShare,
    conversationalPrompt,
    behaviorTargets: behaviorProfile
      ? {
          warmth: behaviorProfile.targetWarmth,
          casualness: behaviorProfile.targetCasualness,
          empathy: behaviorProfile.targetEmpathy,
          restraint: behaviorProfile.targetRestraint,
          socialPresence: behaviorProfile.targetSocialPresence,
          expressiveVariation: behaviorProfile.targetExpressiveVariation,
          humanization: behaviorProfile.targetHumanizationLevel,
          formalityAdjustment: behaviorProfile.targetFormalityAdjustment,
          proactivityLevel: behaviorProfile.proactivityLevel,
          futureUtilityScore: behaviorProfile.futureUtilityScore,
          memoryValueScore: behaviorProfile.memoryValueScore,
          socialIntrusivenessScore: behaviorProfile.socialIntrusivenessScore,
          questionTimingScore: behaviorProfile.questionTimingScore,
          questionFrequencyCap: behaviorProfile.questionFrequencyCap,
          proactiveQuestionPlan: behaviorProfile.proactiveQuestionPlan,
          aiIdentity: behaviorProfile.aiIdentity,
          styleNotes: behaviorProfile.styleNotes,
        }
      : null,
  };

  state.trace.push(
    makeTraceEvent({
      layer: "context",
      action: "context_buffer_refreshed",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail: `activeContext=${state.activeContext.length}; continuity=${turnBuffer.continuityScore}; constraints=${state.activeConstraints.length}; proactivity=${state.proactivityMode}; session=${sessionScore.toFixed(2)}; conversation=${conversationScore.toFixed(2)}; personality=${personalityScore.toFixed(2)}`,
    }),
  );

  return handoffContextToOrchestration(state);
}
