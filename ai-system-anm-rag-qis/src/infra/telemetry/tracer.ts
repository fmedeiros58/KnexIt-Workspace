export interface TraceSpan {
  name: string;
  startedAt: number;
  endedAt?: number;
}

export function startSpan(name: string): TraceSpan {
  return { name, startedAt: Date.now() };
}

export function endSpan(span: TraceSpan): TraceSpan {
  return { ...span, endedAt: Date.now() };
}
