/**
 * Responsabilidade do arquivo:
 * - Bridge desacoplada para construir grounding deliberativo no runtime.
 * - Reaproveitar retrieval existente e entregar pacote semantico tipado.
 * - Evitar acoplamento direto entre camadas superiores e detalhes do layer 07.
 */
import type { ProcessingState } from "./contracts/processing-state";
import { buildDeliberativeGroundingPacket } from "../07-knowledge-retrieval-and-research-layer/grounding/retrieval-for-deliberation-adapter";

export function runDeliberativeGroundingBridge(state: ProcessingState) {
  const packet = buildDeliberativeGroundingPacket({
    query: state.normalizedMessage || state.rawMessage,
    retrievedSources: state.retrievedSources,
    retrievedEvidence: state.retrievedEvidence,
    activeContext: state.activeContext,
    recentTurns: state.recentTurns,
    hypothesisSet: state.hypothesisSet,
  });
  state.executionArtifacts = {
    ...state.executionArtifacts,
    knowledge: {
      ...(state.executionArtifacts.knowledge || { cache: {}, lastQuerySignature: "", lastUsedCache: false }),
      deliberativeGrounding: packet,
    },
  };
  return packet;
}

