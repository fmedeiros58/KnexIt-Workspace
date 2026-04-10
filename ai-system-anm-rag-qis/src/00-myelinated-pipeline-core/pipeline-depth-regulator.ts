import type { PipelineRoute } from "../shared/enums/pipeline-enums";
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { argumentativeDepthDetector } from "../05b-deliberative-task-contract-layer/argumentative-depth-detector";
import { classifyCognitiveDemand } from "../05b-deliberative-task-contract-layer/cognitive-demand-classifier";

export function regulatePipelineDepth(route: PipelineRoute, state?: ProcessingState) {
  const prompt = `${state?.normalizedMessage || state?.rawMessage || ""}`.trim();
  const depth = prompt ? argumentativeDepthDetector(prompt) : null;
  const profile = prompt ? classifyCognitiveDemand(prompt) : null;
  if (route === "minimum") return depth?.requiresDeliberativeContract || profile?.requiresDeliberativeContract ? 18 : 14;

  const base = 18;
  const deliberativeActive = Boolean(depth?.requiresDeliberativeContract || profile?.requiresDeliberativeContract);
  if (!deliberativeActive) return base;
  if (depth?.needsFormalization || profile?.requiresFormalization) return 24;
  if ((profile?.structuralComplexity || 0) >= 0.62) return 22;
  return 21;
}
