/**
 * Responsabilidade do arquivo:
 * - Centralizar estruturas agregadas de metricas operacionais.
 * - Expor helpers de incremento por rota/camada/skip/fallback/erro.
 * - Servir como fonte comum para trace-decision e observability-layer.
 */
export interface RouteMetrics {
  runs: number;
  succeeded: number;
  failed: number;
  fallbacks: number;
}

export interface LayerMetrics {
  executed: number;
  skipped: number;
  failed: number;
}

export interface ObservabilityMetricsStore {
  routeMetrics: Record<string, RouteMetrics>;
  layerMetrics: Record<string, LayerMetrics>;
  skipReasons: Record<string, number>;
  fallbackStrategies: Record<string, number>;
  errorCategories: Record<string, number>;
  familyMetrics: Record<string, number>;
}

export function createObservabilityMetricsStore(): ObservabilityMetricsStore {
  return {
    routeMetrics: {},
    layerMetrics: {},
    skipReasons: {},
    fallbackStrategies: {},
    errorCategories: {},
    familyMetrics: {},
  };
}

export function bumpRouteRun(store: ObservabilityMetricsStore, route: string) {
  store.routeMetrics[route] = store.routeMetrics[route] || { runs: 0, succeeded: 0, failed: 0, fallbacks: 0 };
  store.routeMetrics[route].runs += 1;
}

export function bumpRouteSuccess(store: ObservabilityMetricsStore, route: string) {
  store.routeMetrics[route] = store.routeMetrics[route] || { runs: 0, succeeded: 0, failed: 0, fallbacks: 0 };
  store.routeMetrics[route].succeeded += 1;
}

export function bumpRouteFailure(store: ObservabilityMetricsStore, route: string) {
  store.routeMetrics[route] = store.routeMetrics[route] || { runs: 0, succeeded: 0, failed: 0, fallbacks: 0 };
  store.routeMetrics[route].failed += 1;
}

export function bumpRouteFallback(store: ObservabilityMetricsStore, route: string) {
  store.routeMetrics[route] = store.routeMetrics[route] || { runs: 0, succeeded: 0, failed: 0, fallbacks: 0 };
  store.routeMetrics[route].fallbacks += 1;
}

export function bumpLayerExecuted(store: ObservabilityMetricsStore, layer: string) {
  store.layerMetrics[layer] = store.layerMetrics[layer] || { executed: 0, skipped: 0, failed: 0 };
  store.layerMetrics[layer].executed += 1;
}

export function bumpLayerSkipped(store: ObservabilityMetricsStore, layer: string, reason: string) {
  store.layerMetrics[layer] = store.layerMetrics[layer] || { executed: 0, skipped: 0, failed: 0 };
  store.layerMetrics[layer].skipped += 1;
  store.skipReasons[reason] = (store.skipReasons[reason] || 0) + 1;
}

export function bumpLayerFailed(store: ObservabilityMetricsStore, layer: string) {
  store.layerMetrics[layer] = store.layerMetrics[layer] || { executed: 0, skipped: 0, failed: 0 };
  store.layerMetrics[layer].failed += 1;
}

export function bumpFallbackStrategy(store: ObservabilityMetricsStore, strategy: string) {
  store.fallbackStrategies[strategy] = (store.fallbackStrategies[strategy] || 0) + 1;
}

export function bumpErrorCategory(store: ObservabilityMetricsStore, category: string) {
  store.errorCategories[category] = (store.errorCategories[category] || 0) + 1;
}

export function bumpFamilyMetric(store: ObservabilityMetricsStore, familyId: string) {
  store.familyMetrics[familyId] = (store.familyMetrics[familyId] || 0) + 1;
}
