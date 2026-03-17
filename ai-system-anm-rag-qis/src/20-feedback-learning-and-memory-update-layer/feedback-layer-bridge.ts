import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { handoffFeedbackToMemory } from "./feedback-to-memory-bridge";
import { runFeedbackSqlBridge } from "./feedback-sql-bridge";

export async function runFeedbackLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();

  handoffFeedbackToMemory(state);
  await runFeedbackSqlBridge(state);

  state.trace.push(
    makeTraceEvent({
      layer: "feedback",
      action: "feedback_cycle_applied",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail: `decision=${state.validationReport.quality.decision}; selectedMemory=${state.memorySnapshot.selectedRecordIds.length}`,
    }),
  );
  return state;
}
