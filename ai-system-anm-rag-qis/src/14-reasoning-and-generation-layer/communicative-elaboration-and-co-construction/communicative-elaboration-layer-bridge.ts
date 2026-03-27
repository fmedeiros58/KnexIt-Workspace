/**
 * Responsabilidade do arquivo:
 * - Integrar o submodulo comunicativo ao ProcessingState sem acoplamento excessivo.
 * - Transformar sinais de grounding/contexto em output consumivel por generation/inferential.
 * - Publicar metadados no executionArtifacts para observabilidade.
 */
import type { ProcessingState } from "../../bridges/contracts/processing-state";
import { makeTraceEvent } from "../../shared/utils/trace-utils";
import type { GroundedEvidencePacket } from "../../07-knowledge-retrieval-and-research-layer/grounding/grounded-evidence-packet";
import { runCommunicativeElaborationOrchestrator } from "./communicative-elaboration-orchestrator";

function resolveGroundingPacket(state: ProcessingState): GroundedEvidencePacket | null {
  const candidate = state.executionArtifacts?.knowledge?.deliberativeGrounding;
  if (!candidate || typeof candidate !== "object") return null;
  return candidate as GroundedEvidencePacket;
}

export async function runCommunicativeElaborationLayerBridge(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  if (state.communicativeElaborationState && !state.executionPlan.steps.includes("communicative_elaboration_refresh")) {
    return state;
  }
  const grounding = resolveGroundingPacket(state);

  const output = runCommunicativeElaborationOrchestrator({
    message: state.normalizedMessage || state.rawMessage,
    activeContext: state.activeContext,
    constraints: state.activeConstraints,
    route: state.executionPlan.selectedRoute,
    grounding,
  });

  state.communicativeElaborationState = output;
  state.executionArtifacts = {
    ...state.executionArtifacts,
    communicativeElaboration: {
      confidence: output.confidence,
      tensions: output.tensions.map((row) => row.productiveQuestion),
      hypothesisBranches: output.hypothesisBranches.map((row) => row.claim),
      unresolvedPoints: output.refinement.unresolvedPoints,
    },
  };

  state.trace.push(
    makeTraceEvent({
      layer: "generation",
      action: "communicative_elaboration_built",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `seed_conf=${output.ideaSeed.confidence.toFixed(2)}; tensions=${output.tensions.length}; ` +
        `hypotheses=${output.hypothesisBranches.length}; unresolved=${output.refinement.unresolvedPoints.length}`,
    }),
  );

  return state;
}
