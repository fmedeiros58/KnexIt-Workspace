import type { PipelineRoute } from "../shared/enums/pipeline-enums";

export function regulatePipelineDepth(route: PipelineRoute) {
  switch (route) {
    case "quantum-state":
      return 14;
    case "inferential":
      return 12;
    case "reflective":
      return 10;
    default:
      return 9;
  }
}
