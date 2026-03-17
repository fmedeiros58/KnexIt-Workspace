export interface WritingModeInput {
  text: string;
  intent: string;
}

export interface WritingModeOutput {
  mode: "writing";
  score: number;
  rationale: string;
  ok: boolean;
  component: string;
  detail: string;
  context: Record<string, unknown>;
}

export function writingMode(input: WritingModeInput): WritingModeOutput {
  const writingHits = (input.text.match(/\b(escreva|redija|draft|compose|email|mensagem|texto|copy)\b/gi) || []).length;
  const intentBoost = input.intent === "writing" ? 0.26 : 0;
  const score = Math.max(0.05, Math.min(0.99, 0.16 + (writingHits * 0.18) + intentBoost));

  return {
    mode: "writing",
    score: Number(score.toFixed(4)),
    rationale: writingHits > 0 ? "writing_markers" : "low_signal",
    ok: true,
    component: "writing-mode",
    detail: "writing",
    context: {
      writingHits,
      intent: input.intent,
    },
  };
}
