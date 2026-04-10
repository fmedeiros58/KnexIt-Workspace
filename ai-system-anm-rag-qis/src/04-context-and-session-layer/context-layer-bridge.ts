/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 04-context-and-session-layer
 * Module: context-layer-bridge
 * Responsibility: Consolidate context/session state and apply local context operators before orchestration handoff.
 * Primary Inputs: ProcessingState after conversation consolidation.
 * Primary Outputs: Updated activeContext, activeConstraints, user/session signals and orchestration handoff.
 * Upstream Dependencies: conversation layer, context/session cores, local context operators
 * Downstream Dependencies: orchestration layer
 * Invariants: Context shaping remains local and does not replace orchestration decisions.
 * Failure Modes: Sparse conversation state degrades to conservative focus and context retention.
 * Audit Events: context_buffer_refreshed
 * Notes: Local operators reduce stale carryover and keep session focus explicit.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { resolveLayerModeFromState } from "../05-complexity-and-orchestration-layer/activation-policy/layer-mode-resolver";
import { recentTurnsBuffer } from "./context-core/recent-turns-buffer";
import { contextManager } from "./context-core/context-manager";
import { instructionStack } from "./context-core/instruction-stack";
import { activeConstraints as mergeActiveConstraints } from "./context-core/active-constraints";
import { contextPruner as coreContextPruner } from "./context-core/context-pruner";
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
import { contextPruner } from "./operators/context-pruner";
import { sessionFocusUpdater } from "./operators/session-focus-updater";
import { sessionOperatingModeTracker } from "./operators/session-operating-mode-tracker";
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

function repairCommonMojibake(value: string): string {
  return `${value || ""}`
    .replace(/Ã¡/g, "á")
    .replace(/Ã /g, "à")
    .replace(/Ã¢/g, "â")
    .replace(/Ã£/g, "ã")
    .replace(/Ã¤/g, "ä")
    .replace(/Ã©/g, "é")
    .replace(/Ã¨/g, "è")
    .replace(/Ãª/g, "ê")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ã´/g, "ô")
    .replace(/Ãµ/g, "õ")
    .replace(/Ãº/g, "ú")
    .replace(/Ã§/g, "ç")
    .replace(/Ã\u0081/g, "Á")
    .replace(/Ã\u0089/g, "É")
    .replace(/Ã\u008D/g, "Í")
    .replace(/Ã\u0093/g, "Ó")
    .replace(/Ã\u009A/g, "Ú")
    .replace(/Ã\u0087/g, "Ç")
    .replace(/intelig[\uFFFD]ncia/gi, "inteligencia")
    .replace(/informa[\uFFFD]{1,2}es/gi, "informacoes")
    .replace(/fa[\uFFFD]a/gi, "faca")
    .replace(/d[\uFFFD]vida/gi, "duvida")
    .replace(/o que [\uFFFD]/gi, "o que e")
    .replace(/let[\uFFFD]cia/gi, "Leticia")
    .replace(/usu[\uFFFD]rio/gi, "Usuario")
    .replace(/\uFFFD+/g, "");
}

function collapseWhitespace(value: string): string {
  return `${value || ""}`.replace(/\s+/g, " ").trim();
}

function stripDialogueLabels(value: string): string {
  return `${value || ""}`
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*:\s*/gi, "\n")
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*-\s*/gi, "\n")
    .trim();
}

function sanitizeContextText(value: string): string {
  return collapseWhitespace(stripDialogueLabels(repairCommonMojibake(value)));
}

function sanitizeStringArray(values: string[], limit = 24): string[] {
  return (values || [])
    .map((item) => sanitizeContextText(item))
    .filter(Boolean)
    .slice(-limit);
}

function buildRecentTurnSemanticText(
  turns: Array<{ role: "user" | "assistant"; content: string }>,
  limit = 8,
): string {
  return (turns || [])
    .slice(-limit)
    .map((turn, index) => {
      const cleaned = sanitizeContextText(turn.content);
      if (!cleaned) return "";
      const label = turn.role === "user" ? `pedido_recente_${index + 1}` : `resposta_anterior_${index + 1}`;
      return `${label} ${cleaned}`;
    })
    .filter(Boolean)
    .join(" ");
}

function buildRecentTurnRegistryText(
  turns: Array<{ role: "user" | "assistant"; content: string }>,
  limit = 8,
): string {
  return (turns || [])
    .slice(-limit)
    .map((turn) => {
      const cleaned = sanitizeContextText(turn.content);
      if (!cleaned) return "";
      const label = turn.role === "user" ? "usuario" : "assistant";
      return `${label}: ${cleaned}`;
    })
    .filter(Boolean)
    .join(" ");
}

function sanitizeConstraintTag(value: string): string {
  return sanitizeContextText(value)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}_:-]+/gu, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

export async function runContextLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const contextMode = resolveLayerModeFromState(state, "context");

  const turnBuffer = recentTurnsBuffer({
    turns: state.recentTurns,
    limit: 8,
  });

  const managedContext = contextManager({
    normalizedMessage: sanitizeContextText(state.normalizedMessage),
    recentBuffer: sanitizeStringArray(turnBuffer.buffer, 8),
    memoryHints: state.memorySnapshot.records
      .slice(-4)
      .map((record) => sanitizeContextText(record.content))
      .filter(Boolean),
    existingConstraints: sanitizeStringArray(state.activeConstraints, 24),
    safetyFlags: sanitizeStringArray(state.inputSignals.safetyFlags, 12),
    urgency: state.inputSignals.urgency,
    continuityScore: turnBuffer.continuityScore,
  });

  const instructionFlags = instructionStack({
    normalizedMessage: sanitizeContextText(state.normalizedMessage),
    activeConstraints: sanitizeStringArray(managedContext.derivedConstraints, 24),
  });

  const mergedConstraints = mergeActiveConstraints({
    existing: sanitizeStringArray(managedContext.derivedConstraints, 24),
    safetyFlags: sanitizeStringArray(state.inputSignals.safetyFlags, 12),
    instructionFlags: sanitizeStringArray(instructionFlags.instructions, 24),
  });

  const pruned = coreContextPruner({
    query: sanitizeContextText(state.normalizedMessage),
    contextItems: sanitizeStringArray(managedContext.activeContext, 24),
    maxItems: 10,
  });

  const persistent = persistentUserContext({
    currentProfile: state.userProfile,
    language: state.language,
    intent: state.inputSignals.intent,
    urgency: state.inputSignals.urgency,
    instructions: sanitizeStringArray(instructionFlags.instructions, 24),
  });

  const recentTurnSemanticText = buildRecentTurnSemanticText(state.recentTurns, 8);
  const recentTurnRegistryText = buildRecentTurnRegistryText(state.recentTurns, 8);

  const sharedText = [
    sanitizeContextText(state.normalizedMessage),
    ...sanitizeStringArray(pruned.prunedContext.slice(-4), 4),
    recentTurnSemanticText,
  ]
    .filter(Boolean)
    .join(" ");

  const sessionSignals = {
    manager: sessionManager({ text: sharedText, score: turnBuffer.continuityScore }),
    session: sessionState({ text: sharedText }),
    turnRegistry: turnRegistry({ text: recentTurnRegistryText }),
    timeline: conversationTimeline({ text: recentTurnRegistryText }),
    modeState: activeModeState({
      text: sanitizeContextText(`${state.selectedMode} ${state.inputSignals.intent}`),
    }),
  };

  const conversationalSignals = {
    coherence: conversationalCoherenceEngine({ text: sharedText }),
    intention: conversationalIntentionResolver({ text: sanitizeContextText(state.normalizedMessage) }),
    continuity: dialogueContinuityEngine({
      text: recentTurnSemanticText,
      score: turnBuffer.continuityScore,
    }),
    discourse: discourseStateManager({ text: sharedText }),
    topic: topicAnchor({ text: sanitizeContextText(state.normalizedMessage) }),
    turnBalance: turnBalanceEngine({ text: recentTurnRegistryText }),
  };

  const personalitySignals = {
    domain: domainPreferenceProfile({
      text: sanitizeContextText(`${state.inputSignals.domain} ${sharedText}`),
    }),
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

  const explicitUserConstraints = sanitizeStringArray(
    readStringArray(personalitySignals.personalConstraints.context.constraints),
    12,
  );

  const resolvedIntent = readString(conversationalSignals.intention.context.resolvedIntent, "chat");
  const dominantDomain = readString(personalitySignals.domain.context.dominantDomain, "general");
  const preferredFormat = readString(personalitySignals.responsePreference.context.formatPreference, "paragraph");
  const preferredLength = readString(personalitySignals.responsePreference.context.lengthPreference, "medium");
  const preferredAttitude = readString(
    personalitySignals.responseAttitude.context.recommendedAttitude,
    "balanced-neutral",
  );
  const styleTag = readString(personalitySignals.style.context.styleTag, "neutral");

  const currentPreferredName =
    typeof state.userProfile.preferredName === "string"
      ? toDisplayName(state.userProfile.preferredName)
      : "";

  const preferredNameFromMessage = extractPreferredNameFromText(sanitizeContextText(state.normalizedMessage));
  const preferredNameFromTurns = extractPreferredNameFromTurns(
    state.recentTurns.map((turn) => ({
      role: turn.role,
      content: sanitizeContextText(turn.content),
    })),
  );

  const preferredName = preferredNameFromMessage || currentPreferredName || preferredNameFromTurns || "";
  const asksNameRecall = isNameRecallPrompt(sanitizeContextText(state.normalizedMessage));
  const asksNameShare = isNameSharePrompt(sanitizeContextText(state.normalizedMessage));
  const conversationalPrompt = isConversationalPrompt(sanitizeContextText(state.normalizedMessage));

  const identityHint = preferredName ? `Nome preferido do usuario: ${preferredName}.` : "";
  const behaviorProfile = state.behaviorPersonalityState;
  const behaviorHint = behaviorProfile
    ? `Perfil comportamental: warmth=${behaviorProfile.targetWarmth.toFixed(2)}; casualness=${behaviorProfile.targetCasualness.toFixed(2)}; empathy=${behaviorProfile.targetEmpathy.toFixed(2)}; restraint=${behaviorProfile.targetRestraint.toFixed(2)}.`
    : "";

  const locallyPrunedContext = contextPruner(
    {
      ...state,
      activeContext: sanitizeStringArray(pruned.prunedContext, 12),
    },
    contextMode,
  ).map((item) => sanitizeContextText(item)).filter(Boolean);

  const focusUpdate = sessionFocusUpdater(
    {
      ...state,
      activeContext: locallyPrunedContext,
    },
    contextMode,
  );

  const sessionModeTracking = sessionOperatingModeTracker(state, contextMode);

  state.activeContext = [
    ...new Set([
      ...locallyPrunedContext,
      ...sanitizeStringArray(focusUpdate.updatedContext, 12),
      ...(sessionModeTracking.changed ? [`session_mode:${sanitizeConstraintTag(sessionModeTracking.operatingMode)}`] : []),
      ...(identityHint ? [sanitizeContextText(identityHint)] : []),
      ...(behaviorHint ? [sanitizeContextText(behaviorHint)] : []),
    ]),
  ].slice(-12);

  state.activeConstraints = [
    ...new Set([
      ...sanitizeStringArray(mergedConstraints.constraints, 24),
      ...(sessionScore < 0.35 ? ["session_reanchor_needed"] : []),
      ...(conversationScore < 0.4 ? ["conversation_low_coherence"] : []),
      ...(personalitySignals.personalConstraints.score >= 0.62 ? ["persona_constraint_guarded"] : []),
      ...(proactivitySignal >= 0.7 ? ["proactivity_elevated"] : ["proactivity_limited"]),
      ...(asksNameRecall ? ["conversation_name_recall_request"] : []),
      ...(asksNameShare ? ["conversation_name_share_request"] : []),
      ...(conversationalPrompt ? ["conversation_prompt_detected"] : []),
      ...(sessionModeTracking.changed ? ["context_session_mode_shifted"] : []),
      ...(focusUpdate.primaryFocus ? ["context_focus_resolved"] : []),
      ...(behaviorProfile && behaviorProfile.targetRestraint >= 0.72 ? ["behavior_high_restraint"] : []),
      ...(behaviorProfile && behaviorProfile.targetCasualness <= 0.2 ? ["behavior_low_casualness"] : []),
      ...explicitUserConstraints
        .map((constraint) => sanitizeConstraintTag(constraint))
        .filter(Boolean)
        .map((constraint) => `user_constraint:${constraint}`),
    ]),
  ].slice(-24);

  state.proactivityMode = deriveProactivityMode(managedContext.proactivityMode, proactivitySignal);

  state.userProfile = {
    ...persistent.profile,
    topicHints: sanitizeStringArray(managedContext.topicHints, 12),
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
    sessionFocus: sanitizeContextText(focusUpdate.primaryFocus || ""),
    sessionOperatingMode: sessionModeTracking.operatingMode,
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

  state.executionArtifacts = {
    ...state.executionArtifacts,
    context: {
      operatorMode: contextMode,
      prunedContextCount: locallyPrunedContext.length,
      primaryFocus: sanitizeContextText(focusUpdate.primaryFocus || ""),
      sessionOperatingMode: sessionModeTracking.operatingMode,
      sessionOperatingModeChanged: sessionModeTracking.changed,
    },
  };

  state.trace.push(
    makeTraceEvent({
      layer: "context",
      action: "context_buffer_refreshed",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `mode=${contextMode}; activeContext=${state.activeContext.length}; focus=${sanitizeContextText(focusUpdate.primaryFocus || "")}; continuity=${turnBuffer.continuityScore}; ` +
        `constraints=${state.activeConstraints.length}; proactivity=${state.proactivityMode}; sessionMode=${sessionModeTracking.operatingMode}; ` +
        `session=${sessionScore.toFixed(2)}; conversation=${conversationScore.toFixed(2)}; personality=${personalityScore.toFixed(2)}`,
    }),
  );

  return handoffContextToOrchestration(state);
}