export interface RetryReconnectHandlerInput {
  maxAttempts?: number;
  baseBackoffMs?: number;
  jitterMs?: number;
}

export interface RetryReconnectHandlerOutput {
  ok: boolean;
  component: string;
  score: number;
  policy: {
    maxAttempts: number;
    baseBackoffMs: number;
    jitterMs: number;
  };
}

export function retryReconnectHandler(input: RetryReconnectHandlerInput = {}): RetryReconnectHandlerOutput {
  const maxAttempts = Number.isFinite(input.maxAttempts) ? Math.max(1, Math.trunc(input.maxAttempts as number)) : 5;
  const baseBackoffMs = Number.isFinite(input.baseBackoffMs)
    ? Math.max(100, Math.trunc(input.baseBackoffMs as number))
    : 1200;
  const jitterMs = Number.isFinite(input.jitterMs) ? Math.max(0, Math.trunc(input.jitterMs as number)) : 250;

  return {
    ok: true,
    component: "retry-reconnect-handler",
    score: 0.9,
    policy: {
      maxAttempts,
      baseBackoffMs,
      jitterMs,
    },
  };
}
