export interface HealthChecksInput {
  context?: Record<string, unknown>;
  value?: unknown;
  enabled?: boolean;
}

export interface HealthChecksOutput {
  ok: boolean;
  component: string;
  score: number;
  payload: Record<string, unknown>;
}

export function healthChecks(input: HealthChecksInput = {}): HealthChecksOutput {
  const context = input.context || {};
  const payload: Record<string, unknown> = {
    ...context,
    value: input.value ?? null,
    enabled: input.enabled !== false,
  };
  const score = Object.keys(payload).length > 2 ? 0.82 : 0.64;
  return {
    ok: true,
    component: "health-checks",
    score,
    payload,
  };
}
