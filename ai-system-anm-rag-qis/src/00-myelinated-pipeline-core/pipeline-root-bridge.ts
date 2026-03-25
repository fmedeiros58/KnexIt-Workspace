import type { PipelineBootstrapInput } from "./pipeline-transition-contracts";
import { runPipelineConductor } from "./pipeline-conductor";

export async function runPipelineRootBridge(input: PipelineBootstrapInput) {
  return runPipelineConductor(input);
}
