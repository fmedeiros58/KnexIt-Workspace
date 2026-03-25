import type { ProcessingTraceEvent } from "../types/common-types";
import type { PipelineLayerId, PipelineRoute } from "../enums/pipeline-enums";

export function makeTraceEvent(input: {
  layer: PipelineLayerId;
  action: string;
  route: PipelineRoute;
  latencyMs: number;
  detail?: string;
}): ProcessingTraceEvent {
  return {
    layer: input.layer,
    action: input.action,
    route: input.route,
    at: new Date().toISOString(),
    latencyMs: Math.max(0, Math.round(input.latencyMs)),
    detail: input.detail,
  };
}
