import { analyzeMemoryText, clamp01, countMemoryMatches } from "../memory-signal-utils";

export interface WorkingMemoryInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface WorkingMemoryOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function workingMemory(input: WorkingMemoryInput = {}): WorkingMemoryOutput {
  const analysis = analyzeMemoryText(input.text);
  const immediateCues = countMemoryMatches(
    analysis.normalized,
    /\b(agora|neste momento|current|currently|this request|neste pedido|aqui)\b/g,
  );
  const taskCues = countMemoryMatches(
    analysis.normalized,
    /\b(faca|gere|mostre|execute|build|create|show|implement)\b/g,
  );

  const inferredScore = clamp01(
    0.28 +
    (Math.min(1, immediateCues / 3) * 0.44) +
    (Math.min(1, taskCues / 4) * 0.2) +
    (Math.min(1, analysis.tokenCount / 24) * 0.08),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "working-memory",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `immediateCues=${immediateCues}; taskCues=${taskCues}; tokenCount=${analysis.tokenCount}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      immediateCues,
      taskCues,
      tokenCount: analysis.tokenCount,
      hasText: Boolean(analysis.text),
    },
  };
}
