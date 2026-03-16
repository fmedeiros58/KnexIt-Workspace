export interface ChatBubbleAdapterInput {
  context?: Record<string, unknown>;
  value?: unknown;
  enabled?: boolean;
}

export interface ChatBubbleAdapterOutput {
  ok: boolean;
  component: string;
  score: number;
  payload: Record<string, unknown>;
}

export function chatBubbleAdapter(input: ChatBubbleAdapterInput = {}): ChatBubbleAdapterOutput {
  const context = input.context || {};
  const payload: Record<string, unknown> = {
    ...context,
    value: input.value ?? null,
    enabled: input.enabled !== false,
  };
  const score = Object.keys(payload).length > 2 ? 0.82 : 0.64;
  return {
    ok: true,
    component: "chat-bubble-adapter",
    score,
    payload,
  };
}
