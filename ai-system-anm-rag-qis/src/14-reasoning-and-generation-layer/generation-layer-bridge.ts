import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { runGenerationMemoryBridge } from "./generation-memory-bridge";
import { runGenerationEvidenceBridge } from "./generation-evidence-bridge";
import { runGenerationLlmBridge } from "./generation-llm-bridge";
import { buildContextInjection } from "./prompt-construction-core/context-injection-builder";
import { buildEvidenceInjection } from "./prompt-construction-core/evidence-injection-builder";
import { buildHypothesisInjection } from "./prompt-construction-core/hypothesis-injection-builder";
import { buildInferenceInjection } from "./prompt-construction-core/inference-injection-builder";
import { buildMemoryInjection } from "./prompt-construction-core/memory-injection-builder";
import { buildReflectionInjection } from "./prompt-construction-core/reflection-injection-builder";
import { buildStyleConstraints } from "./prompt-construction-core/style-constraint-builder";
import { buildSystemPrompt } from "./prompt-construction-core/system-prompt-builder";
import { buildTaskPrompt } from "./prompt-construction-core/task-prompt-builder";
import { buildDirectAnswerPath } from "./reasoning-core/direct-answer-path";
import { buildDecompositionPath } from "./reasoning-core/decomposition-path";
import { buildChainOfTasksPath } from "./reasoning-core/chain-of-tasks-path";
import { buildMultiHypothesisReasoning } from "./reasoning-core/multi-hypothesis-reasoner";
import { buildAbductiveSupportPath } from "./reasoning-core/abductive-support-path";
import { selectReasoningPath } from "./reasoning-core/compare-and-select-path";
import { buildSynthesisPath } from "./reasoning-core/synthesis-path";
import { runSelfCheckPath } from "./reasoning-core/self-check-path";
import { runReasoningToIterativeAcquisitionBridge } from "./reasoning-core/reasoning-to-iterative-acquisition-bridge";
import { buildInitialDraft } from "./draft-generation-core/initial-draft";
import { buildExpandedDraft } from "./draft-generation-core/expanded-draft";
import { buildCondensedDraft } from "./draft-generation-core/condensed-draft";
import { buildAlternativeDraft } from "./draft-generation-core/alternative-draft";
import { buildFactualAnswerFallback } from "./draft-generation-core/factual-answer-fallback";
import { applyMultimodalDraftBridge } from "./draft-generation-core/multimodal-draft-bridge";
import {
  buildConversationalFallback,
  buildNonEchoRecovery,
  isEchoLike,
  resolveConversationFocus,
} from "./draft-generation-core/chat-response-builder";
import { mergeDraftContent } from "./response-assembly-core/content-merger";
import { unifySemantics } from "./response-assembly-core/semantic-unifier";
import { removeRedundancy } from "./response-assembly-core/redundancy-remover";
import { orderSections } from "./response-assembly-core/section-ordering";
import { buildTransitions } from "./response-assembly-core/transition-builder";
import { buildConclusion } from "./response-assembly-core/conclusion-builder";
import { handoffGenerationToStructure } from "./generation-to-structure-bridge";
import { runCommunicativeElaborationBridge } from "../bridges/communicative-elaboration.bridge";
import {
  isAssistantCreatorPrompt,
  isAssistantIdentityPrompt,
  isAssistantNameOriginPrompt,
  isConversationalPrompt,
} from "../shared/utils/conversation-signals";

function isGroundedSourceUrl(url: string): boolean {
  return /^https?:\/\//i.test(`${url || ""}`.trim());
}

function countGroundedSources(state: ProcessingState): number {
  return state.retrievedSources.filter((source) => isGroundedSourceUrl(source.url)).length;
}

function isDirectFactualNameQuestion(text: string): boolean {
  const normalized = `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, " ");
  return (
    /\b(governador|presidente|prefeito)\b/.test(normalized) &&
    /\b(qual|quem|nome)\b/.test(normalized)
  );
}

function hasRecentCivicAnchor(state: ProcessingState): boolean {
  return state.recentTurns
    .slice(-6)
    .some((turn) => /\b(presidente|governador|prefeito|mandato|eleit[oa]|posse)\b/i.test(turn.content));
}

function isDirectFactualTimelineQuestion(text: string, state: ProcessingState): boolean {
  const normalized = `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, " ");
  const hasTimelineCue = /\b(quando|em que ano|que ano|ano|mandato|eleit[oa]|reeleit[oa]|posse)\b/.test(normalized);
  if (!hasTimelineCue) return false;
  if (/\b(presidente|governador|prefeito)\b/.test(normalized)) return true;
  if (/\b(ele|ela|dele|dela|esse|essa)\b/.test(normalized) && hasRecentCivicAnchor(state)) return true;
  return false;
}

function isAuthorYearReferencePrompt(text: string): boolean {
  const normalized = `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!normalized) return false;
  const hasAuthorFrame =
    /\b(segundo|conforme|de acordo com|autor|autora|presented by|according to)\b/.test(normalized) ||
    /\b(de|da|do)\s+[a-z][a-z.'\-\s]{1,80}\s*\((19|20)\d{2}\)/.test(normalized);
  const hasInlineAuthorYear = /\b[a-z][a-z.'\-\s]{1,80}\s*\((19|20)\d{2}\)/.test(normalized);
  const hasYear = /\b(19|20)\d{2}\b/.test(normalized);
  const hasAcademicSourceCue = /\b(dissertacao|tese|artigo|paper|estudo|livro|obra|resenha|citacao|referencia)\b/.test(
    normalized,
  );
  return hasYear && hasAcademicSourceCue && (hasAuthorFrame || hasInlineAuthorYear);
}

function buildUnresolvedFactualMessage(state: ProcessingState): string {
  const sourceCount = state.retrievedSources.length;
  if (sourceCount > 0) {
    return "Nao consegui confirmar com seguranca o fato pedido nas fontes recuperadas. Posso refazer priorizando fontes oficiais e mais recentes.";
  }
  return "Nao encontrei fontes suficientes para confirmar o fato com seguranca. Posso refazer a busca web agora.";
}

function buildReferenceGroundingMessage(state: ProcessingState): string {
  const groundedSourceCount = countGroundedSources(state);
  if (groundedSourceCount > 0) {
    return "As fontes recuperadas nao permitem confirmar com seguranca a referencia autor-ano pedida. Se voce enviar o trecho ou link da dissertacao, eu explico com base nela.";
  }
  return "Nao encontrei base documental para sustentar a referencia autor-ano pedida. Envie o trecho, link ou DOI da dissertacao para eu explicar com lastro.";
}

function resolveSafeSummary(state: ProcessingState): string {
  const collapsedSummary = `${state.collapsedTruth.summary || ""}`.trim();
  if (collapsedSummary && !isEchoLike(collapsedSummary, state.normalizedMessage)) {
    return collapsedSummary;
  }
  const groundedSourceCount = countGroundedSources(state);
  if (isAuthorYearReferencePrompt(state.normalizedMessage) && groundedSourceCount === 0) {
    return "Nao ha base documental suficiente para uma sintese autor-ano confiavel neste turno.";
  }
  if (groundedSourceCount > 0) {
    return "Ha indicios parciais nas fontes recuperadas, mas ainda sem base suficiente para uma sintese confiavel.";
  }
  return "Nao ha evidencias suficientes no contexto atual para uma sintese confiavel.";
}

function buildPrompt(state: ProcessingState): string {
  const communicativeInjection = state.communicativeElaborationState
    ? [
        "Communicative elaboration (co-construction):",
        `- Idea seed: ${state.communicativeElaborationState.ideaSeed.coreClaim}`,
        `- Tensions: ${state.communicativeElaborationState.tensions.map((row) => `${row.poleA} x ${row.poleB}`).join("; ") || "none"}`,
        `- Hypothesis branches: ${state.communicativeElaborationState.hypothesisBranches.map((row) => row.claim).join(" | ") || "none"}`,
        `- Refinement unresolved points: ${state.communicativeElaborationState.refinement.unresolvedPoints.join(", ") || "none"}`,
      ].join("\n")
    : "";

  return [
    buildSystemPrompt(),
    buildTaskPrompt(state),
    buildContextInjection(state),
    buildMemoryInjection(state),
    buildEvidenceInjection(state),
    buildHypothesisInjection(state),
    buildReflectionInjection(state),
    buildInferenceInjection(state),
    buildStyleConstraints(state),
    communicativeInjection,
  ].join("\n");
}

function buildReasoningBlock(state: ProcessingState): string {
  const route = selectReasoningPath({
    complexity: state.complexityProfile.score,
    uncertainty: state.collapsedTruth.uncertainty,
    evidenceCount: state.retrievedEvidence.length,
  });

  const direct = buildDirectAnswerPath(state);
  const decomposition = buildDecompositionPath(state);
  const chain = buildChainOfTasksPath(decomposition);
  const multi = buildMultiHypothesisReasoning(state);
  const abductive = buildAbductiveSupportPath(state);
  const synthesis = buildSynthesisPath([direct, chain, multi, abductive]);

  if (route === "direct") return direct;
  if (route === "decomposition") return [chain, multi, abductive].join("\n");
  return synthesis;
}

export async function runGenerationLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();

  await runGenerationMemoryBridge(state);
  await runGenerationEvidenceBridge(state);
  const reasoningAugmentedEvidence = await runReasoningToIterativeAcquisitionBridge(state);
  await runGenerationLlmBridge(state);
  await runCommunicativeElaborationBridge(state);
  const groundedSourceCount = countGroundedSources(state);
  const llmDraft = state.executionArtifacts.generationRuntime?.llmDraft || "";
  const llmDraftAvailable = llmDraft.trim().length > 0;

  const factualFallback = buildFactualAnswerFallback({
    question: state.normalizedMessage,
    sources: state.retrievedSources,
  });
  if (factualFallback && !llmDraftAvailable) {
    const factualText = applyMultimodalDraftBridge(factualFallback.answer, state.inputSignals.modality);
    state.generationPrompt = buildPrompt(state);
    state.draftResponse = {
      text: factualText,
      sections: [{ title: "Resposta", content: factualText }],
    };
    state.trace.push(
      makeTraceEvent({
        layer: "generation",
        action: "factual_fallback_generated",
        route: state.executionPlan.selectedRoute,
        latencyMs: Date.now() - startedAt,
        detail:
          `role=${factualFallback.role}; place=${factualFallback.place}; confidence=${factualFallback.confidence.toFixed(2)}; ` +
          `iterativeAugmentation=${reasoningAugmentedEvidence ? "true" : "false"}`,
      }),
    );
    return handoffGenerationToStructure(state);
  }

  if (
    !llmDraftAvailable &&
    (
      isDirectFactualNameQuestion(state.normalizedMessage) ||
      isDirectFactualTimelineQuestion(state.normalizedMessage, state)
    )
  ) {
    const unresolvedText = applyMultimodalDraftBridge(
      buildUnresolvedFactualMessage(state),
      state.inputSignals.modality,
    );
    state.generationPrompt = buildPrompt(state);
    state.draftResponse = {
      text: unresolvedText,
      sections: [{ title: "Resposta", content: unresolvedText }],
    };
    state.trace.push(
      makeTraceEvent({
        layer: "generation",
        action: "factual_fallback_unresolved",
        route: state.executionPlan.selectedRoute,
        latencyMs: Date.now() - startedAt,
        detail: `sources=${state.retrievedSources.length}`,
      }),
    );
    return handoffGenerationToStructure(state);
  }

  if (!llmDraftAvailable && isAuthorYearReferencePrompt(state.normalizedMessage) && groundedSourceCount === 0) {
    const unresolvedText = applyMultimodalDraftBridge(
      buildReferenceGroundingMessage(state),
      state.inputSignals.modality,
    );
    state.generationPrompt = buildPrompt(state);
    state.draftResponse = {
      text: unresolvedText,
      sections: [{ title: "Resposta", content: unresolvedText }],
    };
    state.trace.push(
      makeTraceEvent({
        layer: "generation",
        action: "reference_grounding_required",
        route: state.executionPlan.selectedRoute,
        latencyMs: Date.now() - startedAt,
        detail: `author_year_reference_without_grounded_sources; totalSources=${state.retrievedSources.length}; groundedSources=${groundedSourceCount}`,
      }),
    );
    return handoffGenerationToStructure(state);
  }

  const focusForFallbackPriority = resolveConversationFocus(state.normalizedMessage);
  const shouldPrioritizeConversationalFallback =
    state.behaviorPersonalityState?.aiIdentity.identityQuestionDetected === true ||
    state.behaviorPersonalityState?.aiIdentity.nameOriginQuestionDetected === true ||
    isAssistantIdentityPrompt(focusForFallbackPriority) ||
    isAssistantNameOriginPrompt(focusForFallbackPriority) ||
    isAssistantCreatorPrompt(focusForFallbackPriority);

  if (shouldPrioritizeConversationalFallback && !llmDraftAvailable) {
    const priorityFallback = buildConversationalFallback(state);
    if (priorityFallback) {
      const chatText = applyMultimodalDraftBridge(priorityFallback, state.inputSignals.modality);
      state.generationPrompt = buildPrompt(state);
      state.draftResponse = {
        text: chatText,
        sections: [{ title: "Resposta", content: chatText }],
      };
      state.trace.push(
        makeTraceEvent({
          layer: "generation",
          action: "chat_fallback_priority_generated",
          route: state.executionPlan.selectedRoute,
          latencyMs: Date.now() - startedAt,
          detail: "mode=chat-fallback-priority; reason=identity_cue",
        }),
      );
      return handoffGenerationToStructure(state);
    }
  }

  const shouldPrioritizeClarificationFallback =
    state.selectedMode === "chat" &&
    state.conversationState.needsClarification &&
    (
      isConversationalPrompt(state.normalizedMessage) ||
      state.normalizedMessage.trim().split(/\s+/g).filter(Boolean).length <= 8
    );
  if (shouldPrioritizeClarificationFallback) {
    const clarificationFallback = buildConversationalFallback(state);
    if (clarificationFallback) {
      const chatText = applyMultimodalDraftBridge(clarificationFallback, state.inputSignals.modality);
      state.generationPrompt = buildPrompt(state);
      state.draftResponse = {
        text: chatText,
        sections: [{ title: "Resposta", content: chatText }],
      };
      state.trace.push(
        makeTraceEvent({
          layer: "generation",
          action: "chat_clarification_fallback_generated",
          route: state.executionPlan.selectedRoute,
          latencyMs: Date.now() - startedAt,
          detail: "mode=chat-fallback-priority; reason=conversation_clarification",
        }),
      );
      return handoffGenerationToStructure(state);
    }
  }

  if (llmDraft) {
    const llmText = applyMultimodalDraftBridge(llmDraft, state.inputSignals.modality);
    state.generationPrompt = buildPrompt(state);
    state.draftResponse = {
      text: llmText,
      sections: [{ title: "Resposta", content: llmText }],
    };
    state.trace.push(
      makeTraceEvent({
        layer: "generation",
        action: "llm_runtime_draft_adopted",
        route: state.executionPlan.selectedRoute,
        latencyMs: Date.now() - startedAt,
        detail: `chars=${llmDraft.length}`,
      }),
    );
    return handoffGenerationToStructure(state);
  }

  const conversationalFallback = buildConversationalFallback(state);
  if (conversationalFallback) {
    const chatText = applyMultimodalDraftBridge(conversationalFallback, state.inputSignals.modality);
    state.generationPrompt = buildPrompt(state);
    state.draftResponse = {
      text: chatText,
      sections: [{ title: "Resposta", content: chatText }],
    };
    state.trace.push(
      makeTraceEvent({
        layer: "generation",
        action: "chat_fallback_generated",
        route: state.executionPlan.selectedRoute,
        latencyMs: Date.now() - startedAt,
        detail: `mode=chat-fallback; iterativeAugmentation=${reasoningAugmentedEvidence ? "true" : "false"}`,
      }),
    );
    return handoffGenerationToStructure(state);
  }

  state.generationPrompt = buildPrompt(state);
  const safeSummary = resolveSafeSummary(state);
  const initialDraft = buildInitialDraft({
    summary: safeSummary,
    status: state.epistemicStatus,
    confidence: state.confidenceScores.epistemic,
  });

  const reasoningBlock = buildReasoningBlock(state);
  const expanded = buildExpandedDraft(initialDraft, [reasoningBlock, ...state.inferentialMap.implications.slice(0, 3)]);
  const condensed = buildCondensedDraft(expanded);
  const alternative = buildAlternativeDraft({
    summary: safeSummary,
    caveat: state.criticalCaveats[0] || "sem ressalvas adicionais",
  });

  const merged = mergeDraftContent([condensed, alternative]);
  const unified = unifySemantics(merged);
  const deduped = removeRedundancy(unified);
  const transitioned = buildTransitions(deduped.split(/\n{2,}/g).filter(Boolean)).join("\n\n");
  const conclusion = buildConclusion({
    summary: safeSummary,
    epistemicStatus: state.epistemicStatus,
  });
  let finalDraftText = applyMultimodalDraftBridge(`${transitioned}\n\n${conclusion}`, state.inputSignals.modality);
  const focusReference = resolveConversationFocus(state.normalizedMessage);
  if (
    isEchoLike(finalDraftText, state.normalizedMessage) ||
    isEchoLike(finalDraftText, focusReference)
  ) {
    finalDraftText = applyMultimodalDraftBridge(buildNonEchoRecovery(state), state.inputSignals.modality);
  }

  const sections = orderSections([
    { title: "Resposta", content: safeSummary },
    { title: "Base inferencial", content: state.inferentialMap.implications.join(" ") || "sem implicacoes" },
    { title: "Caveats", content: state.criticalCaveats.join(" ") || "sem caveats" },
    { title: "Conclusao", content: conclusion },
  ]);

  const selfCheck = runSelfCheckPath({ text: finalDraftText, caveats: state.criticalCaveats });
  if (!selfCheck.ok) {
    state.activeConstraints = [...state.activeConstraints, ...selfCheck.notes].slice(-16);
  }

  state.draftResponse = {
    text: finalDraftText,
    sections,
  };

  state.trace.push(
    makeTraceEvent({
      layer: "generation",
      action: "draft_generated",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail: `sections=${sections.length}; selfCheckOk=${selfCheck.ok}`,
    }),
  );

  return handoffGenerationToStructure(state);
}
