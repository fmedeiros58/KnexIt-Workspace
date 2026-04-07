import type { ProcessingState } from "../bridges/contracts/processing-state";
import type { PipelineRoute } from "../shared/enums/pipeline-enums";

export type PipelineIdentityRuntimeContext = {
  source?: string;
  recognizedLabels?: string[];
  founderDetected?: boolean;
};

export type PipelineBootstrapInput = {
  rawMessage: string;
  sessionId?: string;
  turnId?: string;
  userTimeZone?: string;
  recentTurns?: Array<{ role: "user" | "assistant"; content: string }>;
  identityRuntimeContext?: PipelineIdentityRuntimeContext;
};

export type PipelineRunResult = {
  state: ProcessingState;
  route: PipelineRoute;
  responseText: string;
};
