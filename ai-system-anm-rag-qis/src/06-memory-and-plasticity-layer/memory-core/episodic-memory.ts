import { analyzeMemoryText, clamp01, countMemoryMatches } from "../memory-signal-utils";

export interface EpisodicMemoryInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface EpisodicMemoryOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function episodicMemory(input: EpisodicMemoryInput = {}): EpisodicMemoryOutput {
  const analysis = analyzeMemoryText(input.text);
  const eventCues = countMemoryMatches(
    analysis.normalized,
    /\b(quando|ontem|amanha|depois|antes|evento|when|yesterday|tomorrow|after|before)\b/g,
  );
  const timestampCues = countMemoryMatches(
    analysis.normalized,
    /\b\d{1,2}[:/]\d{1,2}\b|\b\d{4}\b/g,
  );

  const inferredScore = clamp01(
    0.24 +
    (Math.min(1, eventCues / 4) * 0.4) +
    (Math.min(1, timestampCues / 3) * 0.26) +
    (Math.min(1, analysis.punctuationCount / 8) * 0.08),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "episodic-memory",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `eventCues=${eventCues}; timestampCues=${timestampCues}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      eventCues,
      timestampCues,
      hasText: Boolean(analysis.text),
    },
  };
}
