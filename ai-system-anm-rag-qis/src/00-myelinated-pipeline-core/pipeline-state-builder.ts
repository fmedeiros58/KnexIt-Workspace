import { createInitialProcessingState, type ProcessingState } from "../bridges/contracts/processing-state";
import type { PipelineBootstrapInput } from "./pipeline-transition-contracts";

export function buildPipelineState(input: PipelineBootstrapInput): ProcessingState {
  const state = createInitialProcessingState(input.rawMessage);
  if (input.sessionId) state.sessionState.sessionId = input.sessionId;
  if (input.turnId) state.sessionState.turnId = input.turnId;
  if (Array.isArray(input.recentTurns)) state.recentTurns = input.recentTurns.slice(-12);
  return state;
}
