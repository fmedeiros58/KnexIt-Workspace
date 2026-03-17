import { analyzeSignalText, clamp01, countSignalMatches } from "../signal-utils";

export interface DialogueContinuityEngineInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface DialogueContinuityEngineOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function dialogueContinuityEngine(
  input: DialogueContinuityEngineInput = {},
): DialogueContinuityEngineOutput {
  const analysis = analyzeSignalText(input.text);
  const continuationHits = countSignalMatches(
    analysis.normalized,
    /\b(continuar|continue|como antes|mesma linha|retomar|follow up)\b/g,
  );
  const shiftHits = countSignalMatches(
    analysis.normalized,
    /\b(novo topico|novo assunto|mudar tema|switch topic|different question)\b/g,
  );
  const anaphoraHits = countSignalMatches(analysis.normalized, /\b(isso|isto|aquilo|that|this|it)\b/g);

  const inferredScore = clamp01(
    0.3 +
    (Math.min(1, continuationHits / 3) * 0.36) +
    (Math.min(1, anaphoraHits / 5) * 0.14) -
    (Math.min(1, shiftHits / 3) * 0.22),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "dialogue-continuity-engine",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `continuationHits=${continuationHits}; shiftHits=${shiftHits}; anaphora=${anaphoraHits}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      continuationHits,
      shiftHits,
      anaphoraHits,
      hasText: Boolean(analysis.text),
    },
  };
}
