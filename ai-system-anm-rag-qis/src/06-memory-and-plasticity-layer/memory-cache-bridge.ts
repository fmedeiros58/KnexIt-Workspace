import type { ProcessingState } from "../bridges/contracts/processing-state";

export async function runMemoryCacheBridge(state: ProcessingState): Promise<ProcessingState> {
  return state;
}
