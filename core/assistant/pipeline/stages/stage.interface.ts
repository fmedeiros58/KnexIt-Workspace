import type { PipelineContext } from "@/core/assistant/pipeline/pipeline-context";

export interface Stage {
  run(ctx: PipelineContext): Promise<void>;
}

