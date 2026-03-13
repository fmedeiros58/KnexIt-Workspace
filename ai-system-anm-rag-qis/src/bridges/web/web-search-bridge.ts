export interface WebSearchBridgeInput {
  context?: Record<string, unknown>;
  value?: unknown;
  enabled?: boolean;
}

export interface WebSearchBridgeOutput {
  ok: boolean;
  component: string;
  score: number;
  payload: Record<string, unknown>;
}

export function webSearchBridge(input: WebSearchBridgeInput = {}): WebSearchBridgeOutput {
  const context = input.context || {};
  const payload: Record<string, unknown> = {
    ...context,
    value: input.value ?? null,
    enabled: input.enabled !== false,
  };
  const score = Object.keys(payload).length > 2 ? 0.82 : 0.64;
  return {
    ok: true,
    component: "web-search-bridge",
    score,
    payload,
  };
}
