import type { ProcessingState } from "../bridges/contracts/processing-state";

export async function loadContextMemoryBridge(state: ProcessingState): Promise<ProcessingState> {
  return state;
}
