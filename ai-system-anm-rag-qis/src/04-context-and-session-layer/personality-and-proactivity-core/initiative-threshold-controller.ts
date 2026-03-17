import { analyzeText, clamp01, countMatches } from "./personality-utils";

export interface InitiativeThresholdControllerInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface InitiativeThresholdControllerOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function mapInitiativeBand(score: number) {
  if (score >= 0.72) return "high";
  if (score >= 0.46) return "medium";
  return "low";
}

export function initiativeThresholdController(
  input: InitiativeThresholdControllerInput = {},
): InitiativeThresholdControllerOutput {
  const analysis = analyzeText(input.text);
  const proactiveAsks = countMatches(
    analysis.normalized,
    /\b(sugira|sugestao|proponha|proximo passo|next step|melhore|otimize|aprofunde|continue)\b/g,
  );
  const restrictiveAsks = countMatches(
    analysis.normalized,
    /\b(apenas|so|somente|sem sugestao|nao sugira|curto|resuma|objetivo)\b/g,
  );
  const explicitCommands = countMatches(
    analysis.normalized,
    /\b(faca|gere|crie|mostre|traga|build|create|generate|show)\b/g,
  );

  const inferredScore = clamp01(
    0.34 +
    (Math.min(1, proactiveAsks / 3) * 0.36) +
    (Math.min(1, explicitCommands / 4) * 0.22) +
    (Math.min(1, analysis.questionCount / 2) * 0.08) -
    (Math.min(1, restrictiveAsks / 3) * 0.3),
  );

  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;
  const initiativeBand = mapInitiativeBand(finalScore);

  return {
    ok: true,
    component: "initiative-threshold-controller",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `band=${initiativeBand}; proactiveAsks=${proactiveAsks}; restrictiveAsks=${restrictiveAsks}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      initiativeBand,
      proactiveAsks,
      restrictiveAsks,
      explicitCommands,
      questionCount: analysis.questionCount,
      hasText: Boolean(analysis.text),
    },
  };
}
