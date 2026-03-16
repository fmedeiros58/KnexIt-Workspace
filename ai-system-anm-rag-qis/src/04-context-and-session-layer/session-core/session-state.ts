import { analyzeSignalText, clamp01, countSignalMatches } from "../signal-utils";

export interface SessionStateInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface SessionStateOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function classifySessionState(continueHits: number, resetHits: number, questionHits: number) {
  if (resetHits > continueHits) return "resetting";
  if (continueHits > 0) return "continuing";
  if (questionHits > 0) return "inquiry";
  return "fresh";
}

export function sessionState(input: SessionStateInput = {}): SessionStateOutput {
  const analysis = analyzeSignalText(input.text);
  const continueHits = countSignalMatches(
    analysis.normalized,
    /\b(continuar|continue|como antes|same thread|seguindo|retomar)\b/g,
  );
  const resetHits = countSignalMatches(
    analysis.normalized,
    /\b(reiniciar|reset|novo assunto|start over|from scratch|zerar)\b/g,
  );
  const stateName = classifySessionState(continueHits, resetHits, analysis.questionCount);

  const inferredScore = clamp01(
    0.26 +
    (Math.min(1, (continueHits + resetHits) / 3) * 0.34) +
    (Math.min(1, analysis.questionCount / 2) * 0.2) +
    (analysis.uniqueRatio * 0.12),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "session-state",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `state=${stateName}; continueHits=${continueHits}; resetHits=${resetHits}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      sessionPhase: stateName,
      continueHits,
      resetHits,
      questionCount: analysis.questionCount,
      hasText: Boolean(analysis.text),
    },
  };
}
