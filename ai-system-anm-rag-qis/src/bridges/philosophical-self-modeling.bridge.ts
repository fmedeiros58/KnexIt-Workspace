/**
 * Responsabilidade do arquivo:
 * - Expor auto-modelagem filosofica via bridge desacoplada.
 * - Delegar para o submodulo da camada 12.
 * - Preservar integracao incremental com pipeline existente.
 */
import type { ProcessingState } from "./contracts/processing-state";
import { runPhilosophicalSelfModelingBridge } from "../12-metacognitive-layer/philosophical-self-modeling/philosophical-self-modeling-bridge";

export async function runPhilosophicalSelfModelingBridgeAdapter(state: ProcessingState) {
  return runPhilosophicalSelfModelingBridge(state);
}

