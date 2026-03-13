import type { PipelineRoute } from "../shared/enums/pipeline-enums";
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { runMinimumFlow } from "./pipeline-flow-minimum";
import { runReflectiveFlow } from "./pipeline-flow-reflective";
import { runInferentialFlow } from "./pipeline-flow-inferential";
import { runQuantumStateFlow } from "./pipeline-flow-quantum-state";

export async function runBranchController(state: ProcessingState, route: PipelineRoute) {
  if (route === "quantum-state") return runQuantumStateFlow(state, route);
  if (route === "inferential") return runInferentialFlow(state, route);
  if (route === "reflective") return runReflectiveFlow(state, route);
  return runMinimumFlow(state, route);
}
