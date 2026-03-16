export interface MetricsRegistry {
  counters: Record<string, number>;
}

export function createMetricsRegistry(): MetricsRegistry {
  return { counters: {} };
}

export function incrementCounter(registry: MetricsRegistry, metric: string, amount = 1) {
  registry.counters[metric] = (registry.counters[metric] || 0) + amount;
}
