export function selectReasoningPath(input: {
  complexity: number;
  uncertainty: number;
  evidenceCount: number;
}): "direct" | "decomposition" | "synthesis" {
  if (input.complexity >= 0.7 || input.uncertainty >= 0.45) return "decomposition";
  if (input.evidenceCount >= 4) return "synthesis";
  return "direct";
}
