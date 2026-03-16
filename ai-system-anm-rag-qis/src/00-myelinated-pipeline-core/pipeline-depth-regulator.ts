import type { PipelineRoute } from "../shared/enums/pipeline-enums";

export function regulatePipelineDepth(route: PipelineRoute) {
  switch (route) {
    case "quantum-state":
      return 20;
    case "inferential":
      return 18;
    case "reflective":
      return 16;
    default:
      return 14;
  }
}
