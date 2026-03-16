import type { ProcessingState } from "../bridges/contracts/processing-state";

export async function runMemoryVectorBridge(state: ProcessingState): Promise<ProcessingState> {
  return state;
}
