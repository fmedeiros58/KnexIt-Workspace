import type { PipelineRoute } from "../shared/enums/pipeline-enums";

export function regulatePipelineDepth(route: PipelineRoute) {
  if (route === "minimum") return 14;
  return 18;
}
