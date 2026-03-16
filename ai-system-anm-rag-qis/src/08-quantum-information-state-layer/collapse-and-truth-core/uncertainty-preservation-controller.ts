export function preserveUncertainty(confidence: number, ambiguity: number): number {
  const safeConfidence = Number.isFinite(confidence) ? Math.min(1, Math.max(0, confidence)) : 0;
  const safeAmbiguity = Number.isFinite(ambiguity) ? Math.min(1, Math.max(0, ambiguity)) : 0;
  const uncertainty = 1 - (safeConfidence * 0.8 + (1 - safeAmbiguity) * 0.2);
  return Number(Math.min(1, Math.max(0, uncertainty)).toFixed(4));
}
