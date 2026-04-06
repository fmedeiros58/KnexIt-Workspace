import type { TextAnalysisSnapshot } from "../../../shared/text-processing/text-analysis-snapshot";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function estimateSemanticDensity(input: {
  snapshot: TextAnalysisSnapshot;
  hasValidationSignal: boolean;
  hasComparisonSignal: boolean;
  hasCorrectionSignal: boolean;
  hasActionRequest: boolean;
  contextDependencyScore: number;
}): { score: number; tags: string[] } {
  const tags: string[] = [];
  const snapshot = input.snapshot;
  if (input.hasValidationSignal) tags.push("validation_density");
  if (input.hasComparisonSignal) tags.push("comparison_density");
  if (input.hasCorrectionSignal) tags.push("correction_density");
  if (input.hasActionRequest) tags.push("action_density");
  if (input.contextDependencyScore >= 0.45) tags.push("context_dependency_density");

  const score = clamp01(
    (Math.min(snapshot.longTokenRatio * 1.3, 1) * 0.12) +
      (Math.min(snapshot.connectiveCount / 4, 1) * 0.10) +
      (Math.min(snapshot.modalCount / 4, 1) * 0.08) +
      (Math.min(snapshot.negationCount / 3, 1) * 0.06) +
      (input.hasValidationSignal ? 0.20 : 0) +
      (input.hasComparisonSignal ? 0.22 : 0) +
      (input.hasCorrectionSignal ? 0.14 : 0) +
      (input.hasActionRequest ? 0.14 : 0) +
      (input.contextDependencyScore * 0.22),
  );

  return { score, tags };
}
