import { buildPipelineState } from "./pipeline-state-builder";
import { regulatePipelineDepth } from "./pipeline-depth-regulator";
import { selectPipelineRoute } from "./pipeline-route-selector";
import { runBranchController } from "./pipeline-branch-controller";
import { applyLatencyBudget } from "./pipeline-latency-balancer";
import { prunePipelineState } from "./pipeline-state-pruner";
import { appendPipelineTrace } from "./pipeline-execution-trace";
import { handoffPipelineDelivery } from "./pipeline-delivery-handoff";
import { applyPipelineFallback } from "./pipeline-fallback-manager";
import type { PipelineBootstrapInput, PipelineRunResult } from "./pipeline-transition-contracts";

export async function runPipelineConductor(input: PipelineBootstrapInput): Promise<PipelineRunResult> {
  const state = buildPipelineState(input);

  try {
    const route = selectPipelineRoute(state);
    state.executionPlan.selectedRoute = route;
    state.executionPlan.maxDepth = regulatePipelineDepth(route);
    applyLatencyBudget(state);
    appendPipelineTrace(state, "route_selected", "orchestration", 0, route);

    const routedState = await runBranchController(state, route);
    const prunedState = prunePipelineState(routedState, route !== "quantum-state");
    handoffPipelineDelivery(prunedState);

    return {
      state: prunedState,
      route,
      responseText: prunedState.deliveryPayload.text,
    };
  } catch (error) {
    const fallback = applyPipelineFallback(state, error instanceof Error ? error.message : "unknown_error");
    handoffPipelineDelivery(fallback);
    return {
      state: fallback,
      route: state.executionPlan.selectedRoute,
      responseText: fallback.deliveryPayload.text,
    };
  }
}
