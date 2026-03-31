import type { ProcessingState } from "../bridges/contracts/processing-state";
import type { PipelineRoute } from "../shared/enums/pipeline-enums";

export type PipelineBootstrapInput = {
  rawMessage: string;
  sessionId?: string;
  turnId?: string;
  userTimeZone?: string;
  recentTurns?: Array<{ role: "user" | "assistant"; content: string }>;
};

export type PipelineRunResult = {
  state: ProcessingState;
  route: PipelineRoute;
  responseText: string;
};
