/**
 * Responsabilidade do arquivo:
 * - Expor acesso modular ao communicative-elaboration sem acoplamento excessivo.
 * - Delegar execucao ao bridge da camada 14.
 * - Preservar compatibilidade com pipeline atual.
 */
import type { ProcessingState } from "./contracts/processing-state";
import { runCommunicativeElaborationLayerBridge } from "../14-reasoning-and-generation-layer/communicative-elaboration-and-co-construction/communicative-elaboration-layer-bridge";

export async function runCommunicativeElaborationBridge(state: ProcessingState) {
  return runCommunicativeElaborationLayerBridge(state);
}

