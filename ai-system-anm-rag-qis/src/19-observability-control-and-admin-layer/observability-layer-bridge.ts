/**
 * ANM ARCHITECTURAL SPEC
 * Layer: 19-observability-control-and-admin-layer
 * Module: observability-layer-bridge
 * Responsibility: Consolidate operational and architectural observability after the descending pipeline completes.
 * Primary Inputs: ProcessingState
 * Primary Outputs: executionArtifacts.observability and trace event
 * Upstream Dependencies: observability metrics store, architectural audit collectors
 * Downstream Dependencies: feedback layer and administrative consumers
 * Invariants: Observability remains structured and serializable.
 * Failure Modes: Missing adaptive orchestration data degrades to operational metrics only.
 * Audit Events: observability_aggregated
 * Notes: This layer now exposes the short motor read, profile selection and activation matrix summaries.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { bumpFamilyMetric, createObservabilityMetricsStore } from "./observability-metrics-store";
import { collectPipelineTraceSnapshot } from "./architectural-audit/pipeline-trace-collector";
import { buildProfileSelectionAudit } from "./architectural-audit/profile-selection-audit";
import { buildMotorRoutingStageAudit } from "./architectural-audit/motor-routing-audit";
import { buildLayerActivationAudit } from "./architectural-audit/layer-activation-audit";

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

  const traceSnapshot = collectPipelineTraceSnapshot(state);
  const profileSelectionAudit = buildProfileSelectionAudit(state);
  const motorRoutingAudit = buildMotorRoutingStageAudit(state);
  const layerActivationAudit = buildLayerActivationAudit(state);

  state.executionArtifacts = {
    ...state.executionArtifacts,
    observability: {
      currentRoute,
      routeMetrics,
      topSkipReasons: skipReasons,
      fallbackStrategies: state.observabilityMetrics.fallbackStrategies,
      errorCategories: state.observabilityMetrics.errorCategories,
      activeFamilies,
      traceSnapshot,
      profileSelectionAudit,
      motorRoutingAudit,
      layerActivationAudit,
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
        `topSkipReasons=${skipReasons || "none"}; activeFamilies=${activeFamilies.length}; ` +
        `motorRouting=${motorRoutingAudit?.source || "none"}; profilePrimary=${profileSelectionAudit?.primaryProfileId || "none"}`,
    }),
  );

  return state;
}
