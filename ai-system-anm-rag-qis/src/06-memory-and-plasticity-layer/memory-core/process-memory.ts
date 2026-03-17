import { analyzeMemoryText, clamp01, countMemoryMatches } from "../memory-signal-utils";

export interface ProcessMemoryInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface ProcessMemoryOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function processMemory(input: ProcessMemoryInput = {}): ProcessMemoryOutput {
  const analysis = analyzeMemoryText(input.text);
  const sequenceCues = countMemoryMatches(
    analysis.normalized,
    /\b(passo|etapa|sequencia|ordem|step|stage|sequence|first|then)\b/g,
  );
  const proceduralVerbs = countMemoryMatches(
    analysis.normalized,
    /\b(instalar|configurar|executar|rodar|install|configure|run|deploy|apply)\b/g,
  );

  const inferredScore = clamp01(
    0.24 +
    (Math.min(1, sequenceCues / 5) * 0.36) +
    (Math.min(1, proceduralVerbs / 5) * 0.3) +
    (Math.min(1, analysis.tokenCount / 28) * 0.1),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "process-memory",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `sequenceCues=${sequenceCues}; proceduralVerbs=${proceduralVerbs}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      sequenceCues,
      proceduralVerbs,
      tokenCount: analysis.tokenCount,
      hasText: Boolean(analysis.text),
    },
  };
}
