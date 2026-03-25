export interface ConflictResolutionInput {
  caveats: string[];
  assumptions: string[];
  tensions: string[];
}

export interface ConflictResolutionResult {
  conflicts: string[];
  harmonyScore: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function conflictResolutionEngine(input: ConflictResolutionInput): ConflictResolutionResult {
  const conflicts = [...input.caveats, ...input.tensions]
    .filter(Boolean)
    .slice(0, 6);
  const conflictLoad = conflicts.length + Math.max(0, input.assumptions.length - 1);
  const harmonyScore = clamp01(1 - (conflictLoad * 0.14));
  return { conflicts, harmonyScore };
}
