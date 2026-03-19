/**
 * Responsabilidade do arquivo:
 * - Consolidar metricas agregadas por rota/camada e motivos de skip.
 * - Publicar resumo operacional em executionArtifacts.observability.
 * - Registrar evento de observabilidade compilada no trace.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { bumpFamilyMetric, createObservabilityMetricsStore } from "./observability-metrics-store";

export async function runObservabilityLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();

  state.observabilityMetrics = state.observabilityMetrics || createObservabilityMetricsStore();

  const currentRoute = state.executionPlan.selectedRoute;
  const routeMetrics = state.observabilityMetrics.routeMetrics[currentRoute];
  const activeFamilies = state.executionArtifacts.activeFamilies || [];
  for (const familyId of activeFamilies) {
    bumpFamilyMetric(state.observabilityMetrics, familyId);
  }
  const skipReasons = Object.entries(state.observabilityMetrics.skipReasons)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => `${reason}:${count}`)
    .join(",");

  state.executionArtifacts = {
    ...state.executionArtifacts,
    observability: {
      currentRoute,
      routeMetrics,
      topSkipReasons: skipReasons,
      fallbackStrategies: state.observabilityMetrics.fallbackStrategies,
      errorCategories: state.observabilityMetrics.errorCategories,
      activeFamilies,
    },
  };

  state.trace.push(
    makeTraceEvent({
      layer: "observability",
      action: "observability_aggregated",
      route: currentRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `routeRuns=${routeMetrics?.runs || 0}; succeeded=${routeMetrics?.succeeded || 0}; ` +
        `failed=${routeMetrics?.failed || 0}; fallbacks=${routeMetrics?.fallbacks || 0}; ` +
        `topSkipReasons=${skipReasons || "none"}; activeFamilies=${activeFamilies.length}`,
    }),
  );

  return state;
}
