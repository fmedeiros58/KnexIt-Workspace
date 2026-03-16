import { analyzeText, clamp01, countMatches } from "./personality-utils";

export interface ProactivityEngineInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface ProactivityEngineOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function mapMode(score: number) {
  if (score >= 0.72) return "high";
  if (score >= 0.48) return "medium";
  return "low";
}

export function proactivityEngine(input: ProactivityEngineInput = {}): ProactivityEngineOutput {
  const analysis = analyzeText(input.text);
  const openEndedAsks = countMatches(
    analysis.normalized,
    /\b(como melhorar|o que mais|proximos passos|next steps|sugestoes|recomende|alternativas)\b/g,
  );
  const suppressionAsks = countMatches(
    analysis.normalized,
    /\b(so responda|apenas responda|sem sugestao|nao sugira|somente resposta)\b/g,
  );
  const explorationSignals = countMatches(
    analysis.normalized,
    /\b(compare|comparar|analise|analisa|avaliar|tradeoff|cenario)\b/g,
  );

  const inferredScore = clamp01(
    0.3 +
    (Math.min(1, openEndedAsks / 3) * 0.38) +
    (Math.min(1, explorationSignals / 3) * 0.24) +
    (Math.min(1, analysis.questionCount / 2) * 0.08) -
    (Math.min(1, suppressionAsks / 2) * 0.32),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;
  const mode = mapMode(finalScore);

  return {
    ok: true,
    component: "proactivity-engine",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `mode=${mode}; openEnded=${openEndedAsks}; suppression=${suppressionAsks}; exploration=${explorationSignals}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      recommendedProactivityMode: mode,
      openEndedAsks,
      suppressionAsks,
      explorationSignals,
      hasText: Boolean(analysis.text),
    },
  };
}
