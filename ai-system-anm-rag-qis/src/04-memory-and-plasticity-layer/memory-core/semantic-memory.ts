import { analyzeMemoryText, clamp01, countMemoryMatches } from "../memory-signal-utils";

export interface SemanticMemoryInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface SemanticMemoryOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function semanticMemory(input: SemanticMemoryInput = {}): SemanticMemoryOutput {
  const analysis = analyzeMemoryText(input.text);
  const conceptCues = countMemoryMatches(
    analysis.normalized,
    /\b(definicao|conceito|meaning|definition|termo|semantic|categoria|classificacao)\b/g,
  );
  const relationCues = countMemoryMatches(
    analysis.normalized,
    /\b(relacao|relaciona|depends|implica|causa|effect|association)\b/g,
  );

  const inferredScore = clamp01(
    0.26 +
    (analysis.uniqueRatio * 0.26) +
    (Math.min(1, conceptCues / 4) * 0.28) +
    (Math.min(1, relationCues / 4) * 0.16),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "semantic-memory",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `conceptCues=${conceptCues}; relationCues=${relationCues}; uniqueRatio=${analysis.uniqueRatio.toFixed(2)}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      conceptCues,
      relationCues,
      uniqueRatio: Number(analysis.uniqueRatio.toFixed(4)),
      hasText: Boolean(analysis.text),
    },
  };
}
