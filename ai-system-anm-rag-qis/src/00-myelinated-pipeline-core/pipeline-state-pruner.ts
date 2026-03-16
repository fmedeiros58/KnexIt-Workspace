import type { ProcessingState } from "../bridges/contracts/processing-state";

export function prunePipelineState(state: ProcessingState, aggressive: boolean): ProcessingState {
  if (!aggressive) return state;
  return {
    ...state,
    generationPrompt: "",
  };
}
