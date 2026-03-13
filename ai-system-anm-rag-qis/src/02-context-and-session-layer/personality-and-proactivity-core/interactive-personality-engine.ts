import { analyzeText, clamp01, countMatches } from "./personality-utils";

export interface InteractivePersonalityEngineInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface InteractivePersonalityEngineOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function selectInteractionStyle(formalHits: number, casualHits: number, collaborativeHits: number) {
  if (formalHits > casualHits && collaborativeHits > 0) return "formal-collaborative";
  if (formalHits > casualHits) return "formal-direct";
  if (casualHits > formalHits && collaborativeHits > 0) return "casual-collaborative";
  if (casualHits > formalHits) return "casual-direct";
  return collaborativeHits > 0 ? "neutral-collaborative" : "neutral-direct";
}

export function interactivePersonalityEngine(
  input: InteractivePersonalityEngineInput = {},
): InteractivePersonalityEngineOutput {
  const analysis = analyzeText(input.text);
  const formalHits = countMatches(
    analysis.normalized,
    /\b(por favor|poderia|gentileza|prezado|formal|cordialmente)\b/g,
  );
  const casualHits = countMatches(
    analysis.normalized,
    /\b(oi|ola|blz|fala|mano|cara|valeu|kkk|haha)\b/g,
  );
  const collaborativeHits = countMatches(
    analysis.normalized,
    /\b(vamos|juntos|podemos|co-criar|coletivo|we can|let us)\b/g,
  );
  const directiveHits = countMatches(
    analysis.normalized,
    /\b(faca|gere|responda|entregue|execute|do|build|produce)\b/g,
  );

  const style = selectInteractionStyle(formalHits, casualHits, collaborativeHits);
  const inferredScore = clamp01(
    0.36 +
    (Math.min(1, (formalHits + casualHits) / 4) * 0.25) +
    (Math.min(1, collaborativeHits / 3) * 0.2) +
    (Math.min(1, directiveHits / 4) * 0.19),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "interactive-personality-engine",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `style=${style}; formal=${formalHits}; casual=${casualHits}; collaborative=${collaborativeHits}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      interactionStyle: style,
      formalHits,
      casualHits,
      collaborativeHits,
      directiveHits,
      hasText: Boolean(analysis.text),
    },
  };
}
