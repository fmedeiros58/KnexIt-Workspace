/**
 * Responsabilidade do arquivo:
 * - Conduzir ciclo completo com pre-route scan, roteamento e governanca.
 * - Classificar falhas, limitar retry por categoria e aplicar fallback explicavel.
 * - Atualizar metricas agregadas de observabilidade por rota/fallback/erro.
 */
import { buildPipelineState } from "./pipeline-state-builder";
import { regulatePipelineDepth } from "./pipeline-depth-regulator";
import { selectPipelineRoute } from "./pipeline-route-selector";
import { runBranchController } from "./pipeline-branch-controller";
import { applyLatencyBudget } from "./pipeline-latency-balancer";
import { prunePipelineState } from "./pipeline-state-pruner";
import { appendPipelineTrace } from "./pipeline-execution-trace";
import { handoffPipelineDelivery } from "./pipeline-delivery-handoff";
import { applyPipelineFallback } from "./pipeline-fallback-manager";
import { ROUTE_EXECUTION_POLICY } from "./pipeline-route-policy";
import { runInputPreRouteScan } from "../01-input-layer/input-pre-route-scan";
import { classifyPipelineError } from "./pipeline-error-classifier";
import { resolveRetryAttemptsByCategory } from "./pipeline-retry-policy";
import {
  bumpErrorCategory,
  bumpFallbackStrategy,
  bumpRouteFailure,
  bumpRouteFallback,
  bumpRouteRun,
  bumpRouteSuccess,
  createObservabilityMetricsStore,
} from "../19-observability-control-and-admin-layer/observability-metrics-store";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import type { PipelineBootstrapInput, PipelineRunResult } from "./pipeline-transition-contracts";
import type { ProcessingState } from "../bridges/contracts/processing-state";

export async function runPipelineConductor(input: PipelineBootstrapInput): Promise<PipelineRunResult> {
  let state: ProcessingState | null = null;

  try {
    state = buildPipelineState(input);
    state = runInputPreRouteScan(state);

    const initialRoute = selectPipelineRoute(state);
    state.executionPlan.selectedRoute = initialRoute;
    state.executionPlan.maxDepth = regulatePipelineDepth(initialRoute);

    applyLatencyBudget(state);
    appendPipelineTrace(state, "route_selected", "orchestration", 0, initialRoute);

    state.observabilityMetrics = state.observabilityMetrics || createObservabilityMetricsStore();
    bumpRouteRun(state.observabilityMetrics, initialRoute);

    const routedState = await runBranchController(state, initialRoute);
    const effectiveRoute = routedState.executionPlan.selectedRoute || initialRoute;
    if (effectiveRoute !== initialRoute) bumpRouteRun(routedState.observabilityMetrics, effectiveRoute);

    const pruningMode = ROUTE_EXECUTION_POLICY[effectiveRoute].pruningMode;

    const prunedState = prunePipelineState(
      routedState,
      pruningMode !== "minimal",
    );

    handoffPipelineDelivery(prunedState);
    bumpRouteSuccess(prunedState.observabilityMetrics, effectiveRoute);

    return {
      state: prunedState,
      route: effectiveRoute,
      responseText: prunedState.deliveryPayload.text,
    };
  } catch (error) {
    const safeState = state ?? runInputPreRouteScan(buildPipelineState(input));
    safeState.observabilityMetrics = safeState.observabilityMetrics || createObservabilityMetricsStore();

    const message = error instanceof Error ? error.message : "unknown_error";
    const classification = classifyPipelineError(message);
    const allowedRetries = resolveRetryAttemptsByCategory(classification.category);

    const plannedRetry = safeState.executionPlan.retryMaxAttempts ?? allowedRetries;
    safeState.executionPlan.retryMaxAttempts = Math.min(
      plannedRetry,
      allowedRetries,
    );

    const fallback = applyPipelineFallback(safeState, message);
    fallback.executionPlan.selectedRoute = fallback.executionPlan.selectedRoute || "minimum";

    fallback.activeConstraints = [
      ...new Set([
        ...fallback.activeConstraints,
        `fallback:${classification.fallbackStrategy}`,
        `error_category:${classification.category}`,
      ]),
    ].slice(-32);

    fallback.executionArtifacts = {
      ...fallback.executionArtifacts,
      errorHandling: {
        category: classification.category,
        retryable: classification.retryable,
        fallbackStrategy: classification.fallbackStrategy,
        retryMaxAttempts: allowedRetries,
      },
    };

    fallback.trace.push(
      makeTraceEvent({
        layer: "pipeline",
        action: "pipeline_fallback_applied",
        route: fallback.executionPlan.selectedRoute,
        latencyMs: 0,
        detail:
          `category=${classification.category}; retryable=${classification.retryable}; ` +
          `strategy=${classification.fallbackStrategy}; message=${message}`,
      }),
    );

    bumpRouteFailure(fallback.observabilityMetrics, fallback.executionPlan.selectedRoute);
    bumpRouteFallback(fallback.observabilityMetrics, fallback.executionPlan.selectedRoute);
    bumpFallbackStrategy(fallback.observabilityMetrics, classification.fallbackStrategy);
    bumpErrorCategory(fallback.observabilityMetrics, classification.category);

    handoffPipelineDelivery(fallback);

    return {
      state: fallback,
      route: fallback.executionPlan.selectedRoute,
      responseText: fallback.deliveryPayload.text,
    };
  }
}
