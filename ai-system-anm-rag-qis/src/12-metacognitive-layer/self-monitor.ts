export interface SelfMonitorInput {
  route: string;
  confidence: number;
  uncertainty: number;
}

export interface SelfMonitorResult {
  depthAdequate: boolean;
  monitorScore: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function selfMonitor(input: SelfMonitorInput): SelfMonitorResult {
  const expectedDepth = input.route === "quantum-state" ? 0.72 : input.route === "inferential" ? 0.58 : 0.42;
  const monitorScore = clamp01((input.confidence * 0.55) + ((1 - input.uncertainty) * 0.45));
  return {
    depthAdequate: monitorScore >= expectedDepth,
    monitorScore,
  };
}
