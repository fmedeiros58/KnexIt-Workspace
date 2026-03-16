export interface RecentTurnsBufferInput {
  turns: Array<{ role: "user" | "assistant"; content: string }>;
  limit?: number;
}

export interface RecentTurnsBufferOutput {
  buffer: string[];
  userTurnCount: number;
  assistantTurnCount: number;
  continuityScore: number;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function tokenize(value: string) {
  return value
    .toLowerCase()
    .split(/\s+/)
    .map((token) => token.replace(/[^\p{L}\p{N}_-]/gu, ""))
    .filter(Boolean);
}

export function recentTurnsBuffer(input: RecentTurnsBufferInput): RecentTurnsBufferOutput {
  const limit = Math.max(1, Math.min(16, input.limit ?? 8));
  const turns = input.turns.slice(-limit);
  const buffer = turns.map((turn) => turn.content.trim()).filter(Boolean);
  const userTurnCount = turns.filter((turn) => turn.role === "user").length;
  const assistantTurnCount = turns.length - userTurnCount;

  const lastUserTurn = [...turns].reverse().find((turn) => turn.role === "user")?.content || "";
  const previousUserTurn = [...turns.slice(0, -1)].reverse().find((turn) => turn.role === "user")?.content || "";

  const currentTokens = new Set(tokenize(lastUserTurn));
  const previousTokens = new Set(tokenize(previousUserTurn));
  const overlap = [...currentTokens].filter((token) => previousTokens.has(token)).length;
  const continuityScore = currentTokens.size
    ? Math.max(0, Math.min(1, overlap / currentTokens.size))
    : 0;

  return {
    buffer,
    userTurnCount,
    assistantTurnCount,
    continuityScore: Number(continuityScore.toFixed(4)),
    ok: true,
    component: "recent-turns-buffer",
    score: Number(continuityScore.toFixed(4)),
    detail: `turns=${buffer.length}`,
    context: {
      limit,
      userTurnCount,
      assistantTurnCount,
    },
  };
}
