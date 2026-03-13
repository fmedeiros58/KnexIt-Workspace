export interface TeachingModeInput {
  text: string;
  intent: string;
}

export interface TeachingModeOutput {
  mode: "teaching";
  score: number;
  rationale: string;
  ok: boolean;
  component: string;
  detail: string;
  context: Record<string, unknown>;
}

export function teachingMode(input: TeachingModeInput): TeachingModeOutput {
  const hits = (input.text.match(/\b(explique|ensine|did[aá]tico|passo a passo|tutorial|teach|explain step by step)\b/gi) || []).length;
  const intentBoost = input.intent === "teaching" ? 0.24 : 0;
  const score = Math.max(0.05, Math.min(0.99, 0.14 + (hits * 0.2) + intentBoost));

  return {
    mode: "teaching",
    score: Number(score.toFixed(4)),
    rationale: hits > 0 ? "teaching_markers" : "low_signal",
    ok: true,
    component: "teaching-mode",
    detail: "teaching",
    context: {
      hits,
      intent: input.intent,
    },
  };
}
