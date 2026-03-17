import type { PipelineRoute } from "../../shared/enums/pipeline-enums";

export interface TimeoutGuardInput {
  route: PipelineRoute;
  complexityScore: number;
}

export interface TimeoutGuardOutput {
  timeoutMs: number;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function timeoutGuard(input: TimeoutGuardInput): TimeoutGuardOutput {
  const base =
    input.route === "quantum-state" ? 14000 :
    input.route === "inferential" ? 11000 :
    input.route === "reflective" ? 8500 :
    6000;
  const timeoutMs = Math.round(base + (Math.max(0, Math.min(1, input.complexityScore)) * 2500));

  return {
    timeoutMs,
    ok: true,
    component: "timeout-guard",
    score: Number(Math.min(1, timeoutMs / 16000).toFixed(4)),
    detail: `timeoutMs=${timeoutMs}`,
    context: {
      route: input.route,
    },
  };
}
