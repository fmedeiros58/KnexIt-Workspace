/**
 * Responsabilidade do arquivo:
 * - Expor entrada/saida do submodulo filosofico para o pipeline.
 * - Atualizar ProcessingState sem acoplamento destrutivo nas camadas existentes.
 * - Publicar sinais de consistencia para generation/presentation.
 */
import type { ProcessingState } from "../../bridges/contracts/processing-state";
import { makeTraceEvent } from "../../shared/utils/trace-utils";
import { runPhilosophicalSelfModelingOrchestrator } from "./philosophical-self-modeling-orchestrator";

function detectPhilosophicalSelfPrompt(message: string) {
  const normalized = `${message || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
  return /\b(quem e voce|quem e vc|origem|criador|medeiros|autoria|existencia|consciencia|limites)\b/.test(normalized);
}

export async function runPhilosophicalSelfModelingBridge(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  if (state.philosophicalSelfModelState && !state.executionPlan.steps.includes("philosophical_self_modeling_refresh")) {
    return state;
  }
  const shouldRun =
    detectPhilosophicalSelfPrompt(state.normalizedMessage || state.rawMessage) ||
    state.executionPlan.steps.includes("philosophical_self_modeling");

  if (!shouldRun) {
    return state;
  }

  const output = runPhilosophicalSelfModelingOrchestrator({
    message: state.normalizedMessage || state.rawMessage,
    recentTurns: state.recentTurns,
    canonicalIdentityNarrative: state.behaviorPersonalityState.aiIdentity?.identityNarrativeLong || "",
  });

  state.philosophicalSelfModelState = output;
  state.executionArtifacts = {
    ...state.executionArtifacts,
    philosophicalSelfModeling: {
      consistencyOk: output.consistencyOk,
      consistencyNotes: output.consistencyNotes,
      continuityRisks: output.continuityAssessment.contradictionRisks,
      boundaryMarkers: output.selfModel.boundaryMarkers,
      philosophicalQuestions: output.philosophicalQuestions,
    },
  };

  state.trace.push(
    makeTraceEvent({
      layer: "metacognitive",
      action: "philosophical_self_modeling_built",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `consistency=${output.consistencyOk}; continuityRisks=${output.continuityAssessment.contradictionRisks.length}; ` +
        `questions=${output.philosophicalQuestions.length}`,
    }),
  );

  return state;
}
