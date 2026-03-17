export interface ForgetCandidateDetectorInput {
  context?: Record<string, unknown>;
  value?: unknown;
  enabled?: boolean;
}

export interface ForgetCandidateDetectorOutput {
  ok: boolean;
  component: string;
  score: number;
  payload: Record<string, unknown>;
}

export function forgetCandidateDetector(input: ForgetCandidateDetectorInput = {}): ForgetCandidateDetectorOutput {
  const context = input.context || {};
  const payload: Record<string, unknown> = {
    ...context,
    value: input.value ?? null,
    enabled: input.enabled !== false,
  };
  const score = Object.keys(payload).length > 2 ? 0.82 : 0.64;
  return {
    ok: true,
    component: "forget-candidate-detector",
    score,
    payload,
  };
}
