export interface RapportInput {
  politeness: number;
  tone: string;
  emotionalTone?: string;
  urgency?: "low" | "medium" | "high";
}

export interface RapportResult {
  rapportScore: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function rapportManager(input: RapportInput): RapportResult {
  const toneBonus = input.tone === "friendly" ? 0.18 : input.tone === "formal" ? 0.08 : input.tone === "direct" ? -0.02 : 0;
  const emotionalAdjustment =
    input.emotionalTone === "positive" ? 0.08 : input.emotionalTone === "frustrated" ? -0.12 : 0;
  const urgencyAdjustment = input.urgency === "high" ? -0.05 : input.urgency === "medium" ? -0.02 : 0;
  return {
    rapportScore: clamp01((input.politeness * 0.74) + toneBonus + emotionalAdjustment + urgencyAdjustment),
  };
}
