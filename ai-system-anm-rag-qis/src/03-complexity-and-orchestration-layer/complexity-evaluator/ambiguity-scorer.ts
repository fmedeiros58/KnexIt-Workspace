export interface AmbiguityScorerInput {
  text: string;
}

export interface AmbiguityScorerOutput {
  score: number;
  reasons: string[];
  ok: boolean;
  component: string;
  detail: string;
  context: Record<string, unknown>;
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

export function ambiguityScorer(input: AmbiguityScorerInput): AmbiguityScorerOutput {
  const text = input.text || "";
  const reasons: string[] = [];

  const disjunction = (text.match(/\b(ou|or|either)\b/gi) || []).length;
  const hedges = (text.match(/\b(talvez|maybe|aprox|around|depende|it depends|possivelmente|possibly)\b/gi) || []).length;
  const deictics = (text.match(/\b(isso|isto|aquilo|that|this|it)\b/gi) || []).length;
  const shortPrompt = text.split(/\s+/).filter(Boolean).length < 5 ? 1 : 0;

  if (disjunction > 0) reasons.push("disjunction");
  if (hedges > 0) reasons.push("hedging");
  if (deictics > 0) reasons.push("deictic_reference");
  if (shortPrompt > 0) reasons.push("short_prompt");

  const score = clamp01((disjunction * 0.15) + (hedges * 0.18) + (deictics * 0.08) + (shortPrompt * 0.12));

  return {
    score: Number(score.toFixed(4)),
    reasons,
    ok: true,
    component: "ambiguity-scorer",
    detail: reasons.join(",") || "clear",
    context: {
      disjunction,
      hedges,
      deictics,
      shortPrompt: Boolean(shortPrompt),
    },
  };
}
