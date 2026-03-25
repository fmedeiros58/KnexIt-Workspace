export interface AffectiveSignalDetectorInput {
  text: string;
}

export interface AffectiveSignalDetectorOutput {
  tone: "neutral" | "positive" | "negative" | "frustrated";
  intensity: number;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function affectiveSignalDetector(input: AffectiveSignalDetectorInput): AffectiveSignalDetectorOutput {
  const text = input.text || "";
  const lower = text.toLowerCase();
  const positiveHits = (lower.match(/\b(obrigado|valeu|great|awesome|bom trabalho|perfeito)\b/g) || []).length;
  const negativeHits = (lower.match(/\b(ruim|horrivel|horrível|bad|terrible|lento|travou|quebrou)\b/g) || []).length;
  const frustrationHits = (lower.match(/\b(urgente|n[aã]o aguento|wtf|porra|caramba|pelo amor)\b/g) || []).length;

  let tone: AffectiveSignalDetectorOutput["tone"] = "neutral";
  if (frustrationHits > 0) tone = "frustrated";
  else if (negativeHits > positiveHits) tone = "negative";
  else if (positiveHits > 0) tone = "positive";

  const intensity = Math.max(0.1, Math.min(1, 0.2 + (positiveHits * 0.12) + (negativeHits * 0.15) + (frustrationHits * 0.25)));

  return {
    tone,
    intensity: Number(intensity.toFixed(4)),
    ok: true,
    component: "affective-signal-detector",
    score: Number(intensity.toFixed(4)),
    detail: tone,
    context: {
      positiveHits,
      negativeHits,
      frustrationHits,
    },
  };
}
