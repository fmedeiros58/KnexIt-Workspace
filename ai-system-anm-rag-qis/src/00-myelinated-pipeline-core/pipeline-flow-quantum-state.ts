import type { PipelineRoute } from "../shared/enums/pipeline-enums";
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { runInferentialFlow } from "./pipeline-flow-inferential";

export async function runQuantumStateFlow(state: ProcessingState, route: PipelineRoute) {
  return runInferentialFlow(state, route);
}
