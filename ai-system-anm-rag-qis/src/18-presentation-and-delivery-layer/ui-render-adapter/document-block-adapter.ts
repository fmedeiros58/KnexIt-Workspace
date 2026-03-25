export interface DocumentBlockAdapterInput {
  context?: Record<string, unknown>;
  value?: unknown;
  enabled?: boolean;
}

export interface DocumentBlockAdapterOutput {
  ok: boolean;
  component: string;
  score: number;
  payload: Record<string, unknown>;
}

export function documentBlockAdapter(input: DocumentBlockAdapterInput = {}): DocumentBlockAdapterOutput {
  const context = input.context || {};
  const payload: Record<string, unknown> = {
    ...context,
    value: input.value ?? null,
    enabled: input.enabled !== false,
  };
  const score = Object.keys(payload).length > 2 ? 0.82 : 0.64;
  return {
    ok: true,
    component: "document-block-adapter",
    score,
    payload,
  };
}
