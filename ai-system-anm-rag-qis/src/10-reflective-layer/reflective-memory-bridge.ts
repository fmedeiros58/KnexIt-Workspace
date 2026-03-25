import type { ProcessingState } from "../bridges/contracts/processing-state";

export async function runReflectiveMemoryBridge(state: ProcessingState): Promise<ProcessingState> {
  return state;
}
