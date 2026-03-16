import type { EpistemicStatus } from "../../shared/enums/epistemic-status-enums";

export function determineEpistemicStatus(input: {
  confidence: number;
  uncertainty: number;
  sourceCount: number;
  contradictionCount: number;
}): EpistemicStatus {
  const confidence = Number.isFinite(input.confidence) ? Math.min(1, Math.max(0, input.confidence)) : 0;
  const uncertainty = Number.isFinite(input.uncertainty) ? Math.min(1, Math.max(0, input.uncertainty)) : 1;
  const sourceCount = Math.max(0, Math.floor(input.sourceCount));
  const contradictionCount = Math.max(0, Math.floor(input.contradictionCount));

  if (sourceCount === 0) return "insufficient-evidence";
  if (contradictionCount >= 2 && confidence < 0.72) return "contested";
  if (confidence >= 0.86 && uncertainty <= 0.24) return "supported";
  if (confidence >= 0.62) return "probable";
  if (confidence >= 0.4) return "hypothesis";
  return "unknown";
}
