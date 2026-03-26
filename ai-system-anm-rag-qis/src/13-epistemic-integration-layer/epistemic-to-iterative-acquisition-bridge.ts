/**
 * Responsabilidade do arquivo:
 * - Permitir que o modulo epistemico governe aquisicao iterativa por politica.
 * - Traduzir exigencia epistêmica em hint de busca (depth, budget, corroboracao).
 * - Devolver bundle condicionado sem acionar buscadores diretamente aqui.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { runIterativeEvidenceAcquisitionBridge } from "../07-knowledge-retrieval-and-research-layer/iterative-evidence-acquisition-core/iterative-evidence-acquisition-bridge";
import type { IterativeEvidenceBundle } from "../07-knowledge-retrieval-and-research-layer/iterative-evidence-acquisition-core/iterative-acquisition-types";

function shouldRequestEpistemicAugmentation(state: ProcessingState): boolean {
  if (state.retrievedSources.length < 2) return true;
  if (state.executionPlan.steps.includes("fact_check")) return true;
  if (state.preRouteSignals.hasRecencySignal || state.preRouteSignals.hasVerifiableSignal) return true;
  if (state.criticalCaveats.length >= 2) return true;
  return false;
}

export async function runEpistemicToIterativeAcquisitionBridge(
  state: ProcessingState,
): Promise<IterativeEvidenceBundle | null> {
  if (!shouldRequestEpistemicAugmentation(state)) return null;

  const bundle = await runIterativeEvidenceAcquisitionBridge(state, {
    policyHint: {
      retrievalDepth: 3,
      minSufficiencyToStop: 0.62,
      enableWeb: true,
      enableConfirmatoryRound: true,
      enableContrastiveRound: true,
      searchBudget: {
        maxCalls: 20,
        maxRounds: 4,
        timeoutMs: 12_000,
        retries: 1,
        perRoundCallCap: 6,
        providerCap: 3,
      },
    },
  });

  const topEvidence = bundle.rankedEvidence.slice(0, 12);
  state.retrievedSources = topEvidence.map((item) => ({
    title: item.title,
    url: item.url,
    snippet: item.snippet,
    freshnessScore: item.freshnessScore,
  }));
  state.retrievedEvidence = topEvidence.map((item) => item.snippet);
  state.confidenceScores.retrieval = Math.max(state.confidenceScores.retrieval, bundle.sufficiencyEstimate);

  return bundle;
}

