/**
 * Responsabilidade do arquivo:
 * - Permitir evidence augmentation sob demanda do reasoning.
 * - Solicitar aquisicao iterativa quando houver lacuna factual/ambiguidade.
 * - Entregar pacote resumido ao reasoning sem acoplamento a buscadores.
 */
import type { ProcessingState } from "../../bridges/contracts/processing-state";
import { runIterativeEvidenceAcquisitionBridge } from "../../07-knowledge-retrieval-and-research-layer/iterative-evidence-acquisition-core/iterative-evidence-acquisition-bridge";
import type { IterativeEvidenceBundle } from "../../07-knowledge-retrieval-and-research-layer/iterative-evidence-acquisition-core/iterative-acquisition-types";
import { isConversationalPrompt, isReferentialFactualPrompt } from "../../shared/utils/conversation-signals";

function shouldAugmentReasoningEvidence(state: ProcessingState): boolean {
  const normalizedMessage = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  const directAnswerCue = /\b(curta e grossa|curto e grosso|resposta curta|apenas responda|s[oó] diga|sem explicar|sem analisar|direto ao ponto)\b/i.test(
    normalizedMessage,
  );
  const hasVerifiableSignal =
    state.preRouteSignals.hasVerifiableSignal ||
    state.textAnalysisSnapshot?.hasVerifiableSignal === true ||
    isReferentialFactualPrompt(normalizedMessage);
  const conversationalNoFactDemand =
    state.selectedMode === "chat" &&
    isConversationalPrompt(normalizedMessage) &&
    !hasVerifiableSignal;

  if (conversationalNoFactDemand) return false;
  if (directAnswerCue && !hasVerifiableSignal) return false;
  if (state.conversationState.needsClarification && state.selectedMode === "chat") return false;
  if (state.retrievedEvidence.length < 3) return true;
  if (state.confidenceScores.retrieval < 0.55) return true;
  if (state.inferentialMap.scenarios.length >= 2 && state.retrievedSources.length < 4) return true;
  return false;
}

export async function runReasoningToIterativeAcquisitionBridge(
  state: ProcessingState,
): Promise<IterativeEvidenceBundle | null> {
  if (!shouldAugmentReasoningEvidence(state)) return null;

  const bundle = await runIterativeEvidenceAcquisitionBridge(state, {
    policyHint: {
      retrievalDepth: 2,
      minSufficiencyToStop: 0.56,
      enableWeb: true,
      enableConfirmatoryRound: true,
      enableContrastiveRound: false,
      searchBudget: {
        maxCalls: 14,
        maxRounds: 3,
        timeoutMs: 10_000,
        retries: 1,
        perRoundCallCap: 5,
        providerCap: 2,
      },
    },
  });

  const top = bundle.rankedEvidence.slice(0, 8);
  if (top.length) {
    state.retrievedSources = top.map((item) => ({
      title: item.title,
      url: item.url,
      snippet: item.snippet,
      freshnessScore: item.freshnessScore,
    }));
    state.retrievedEvidence = top.map((item) => item.snippet);
    state.confidenceScores.retrieval = Math.max(state.confidenceScores.retrieval, bundle.sufficiencyEstimate);
  }

  return bundle;
}
