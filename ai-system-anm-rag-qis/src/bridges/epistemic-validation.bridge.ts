/**
 * Responsabilidade do arquivo:
 * - Expor validacao epistemica especializada de forma desacoplada.
 * - Delegar para o bridge da camada 17 sem alterar contratos existentes.
 * - Permitir consumo por camadas superiores e testes de integracao.
 */
import type { ProcessingState } from "./contracts/processing-state";
import { runEpistemicValidationBridge } from "../17-validation-layer/epistemic-validation-bridge";

export function runEpistemicValidationBridgeAdapter(state: ProcessingState) {
  return runEpistemicValidationBridge(state);
}

