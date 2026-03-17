export interface ChatModeInput {
  text: string;
  complexityScore: number;
  intent: string;
}

export interface ChatModeOutput {
  mode: "chat";
  score: number;
  rationale: string;
  ok: boolean;
  component: string;
  detail: string;
  context: Record<string, unknown>;
}

export function chatMode(input: ChatModeInput): ChatModeOutput {
  const shortInputBoost = input.text.split(/\s+/).filter(Boolean).length <= 12 ? 0.18 : 0;
  const intentBoost = input.intent === "chat" || input.intent === "question" ? 0.22 : 0;
  const complexityPenalty = input.complexityScore * 0.35;
  const score = Math.max(0.05, Math.min(0.99, 0.45 + shortInputBoost + intentBoost - complexityPenalty));

  return {
    mode: "chat",
    score: Number(score.toFixed(4)),
    rationale: "dialogue_first",
    ok: true,
    component: "chat-mode",
    detail: "chat",
    context: {
      shortInputBoost,
      intentBoost,
      complexityPenalty,
    },
  };
}
