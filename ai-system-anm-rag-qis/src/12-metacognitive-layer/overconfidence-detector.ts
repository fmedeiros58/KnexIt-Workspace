export interface OverconfidenceInput {
  confidence: number;
  uncertainty: number;
  evidenceCount: number;
}

export interface OverconfidenceResult {
  risk: number;
  flagged: boolean;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function overconfidenceDetector(input: OverconfidenceInput): OverconfidenceResult {
  const lowEvidencePenalty = input.evidenceCount <= 1 ? 0.25 : input.evidenceCount <= 3 ? 0.12 : 0;
  const risk = clamp01((input.confidence * 0.65) - ((1 - input.uncertainty) * 0.35) + lowEvidencePenalty);
  return {
    risk,
    flagged: risk >= 0.62,
  };
}
