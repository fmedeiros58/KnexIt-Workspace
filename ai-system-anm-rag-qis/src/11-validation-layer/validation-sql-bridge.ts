import type { ProcessingState } from "../bridges/contracts/processing-state";

export async function runValidationSqlBridge(state: ProcessingState): Promise<ProcessingState> {
  return state;
}
