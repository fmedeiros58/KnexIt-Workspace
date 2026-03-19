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

function buildUnresolvedFactualMessage(state: ProcessingState): string {
  const sourceCount = state.retrievedSources.length;
  if (sourceCount > 0) {
    return "Nao consegui confirmar com seguranca o fato pedido nas fontes recuperadas. Posso refazer priorizando fontes oficiais e mais recentes.";
  }
  return "Nao encontrei fontes suficientes para confirmar o fato com seguranca. Posso refazer a busca web agora.";
}

function buildPrompt(state: ProcessingState): string {
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
  await runGenerationLlmBridge(state);

  const factualFallback = buildFactualAnswerFallback({
    question: state.normalizedMessage,
    sources: state.retrievedSources,
  });
  if (factualFallback) {
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
        detail: `role=${factualFallback.role}; place=${factualFallback.place}; confidence=${factualFallback.confidence.toFixed(2)}`,
      }),
    );
    return handoffGenerationToStructure(state);
  }

  if (
    isDirectFactualNameQuestion(state.normalizedMessage) ||
    isDirectFactualTimelineQuestion(state.normalizedMessage, state)
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
        detail: "mode=chat-fallback",
      }),
    );
    return handoffGenerationToStructure(state);
  }

  const llmDraft = state.executionArtifacts.generationRuntime?.llmDraft || "";
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

  state.generationPrompt = buildPrompt(state);
  const initialDraft = buildInitialDraft({
    summary: state.collapsedTruth.summary,
    status: state.epistemicStatus,
    confidence: state.confidenceScores.epistemic,
  });

  const reasoningBlock = buildReasoningBlock(state);
  const expanded = buildExpandedDraft(initialDraft, [reasoningBlock, ...state.inferentialMap.implications.slice(0, 3)]);
  const condensed = buildCondensedDraft(expanded);
  const alternative = buildAlternativeDraft({
    summary: state.collapsedTruth.summary,
    caveat: state.criticalCaveats[0] || "sem ressalva dominante",
  });

  const merged = mergeDraftContent([condensed, alternative]);
  const unified = unifySemantics(merged);
  const deduped = removeRedundancy(unified);
  const transitioned = buildTransitions(deduped.split(/\n{2,}/g).filter(Boolean)).join("\n\n");
  const conclusion = buildConclusion({
    summary: state.collapsedTruth.summary || state.normalizedMessage,
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
    { title: "Resposta", content: state.collapsedTruth.summary || state.normalizedMessage },
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
