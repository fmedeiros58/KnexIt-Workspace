export interface TurnManagerInput {
  recentTurns: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface TurnManagerResult {
  turnCount: number;
  balanceScore: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function turnManager(input: TurnManagerInput): TurnManagerResult {
  const turns = input.recentTurns || [];
  const userTurns = turns.filter((item) => item.role === "user").length;
  const assistantTurns = turns.filter((item) => item.role === "assistant").length;
  const balance = userTurns + assistantTurns === 0
    ? 0.5
    : clamp01(1 - Math.abs(userTurns - assistantTurns) / (userTurns + assistantTurns));

  return {
    turnCount: turns.length,
    balanceScore: balance,
  };
}
