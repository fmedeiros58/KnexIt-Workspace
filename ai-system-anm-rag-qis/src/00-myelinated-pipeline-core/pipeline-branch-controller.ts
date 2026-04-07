/**
 * Responsabilidade do arquivo:
 * - Direcionar estado para wrapper de fluxo conforme rota selecionada.
 * - Manter interface unica para o conductor.
 */
import type { PipelineRoute } from "../shared/enums/pipeline-enums";
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { runMinimumFlow } from "./pipeline-flow-minimum";
import { runInferentialFlow } from "./pipeline-flow-inferential";

export async function runBranchController(state: ProcessingState, route: PipelineRoute) {
  if (route === "minimum") return runMinimumFlow(state);
  return runInferentialFlow(state);
}
