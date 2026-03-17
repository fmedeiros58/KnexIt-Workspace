export interface FinalCognitiveHandoffInput {
  summary: string;
  certaintyBand: string;
  harmonyScore: number;
  revisionNeeded: boolean;
}

export function finalCognitiveHandoff(input: FinalCognitiveHandoffInput): string {
  const revisionFlag = input.revisionNeeded ? "revision:true" : "revision:false";
  return [
    `epistemic_summary:${input.summary || "n/a"}`,
    `certainty:${input.certaintyBand}`,
    `harmony:${input.harmonyScore.toFixed(2)}`,
    revisionFlag,
  ].join(" | ");
}
