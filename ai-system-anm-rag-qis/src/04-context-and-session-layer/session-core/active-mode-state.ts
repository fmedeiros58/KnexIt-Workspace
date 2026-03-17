import { analyzeSignalText, clamp01, countSignalMatches } from "../signal-utils";

export interface ActiveModeStateInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface ActiveModeStateOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function detectMode(normalized: string) {
  const candidates = [
    { mode: "technical", hits: countSignalMatches(normalized, /\b(technical|api|debug|code|typescript|python|sql)\b/g) },
    { mode: "analysis", hits: countSignalMatches(normalized, /\b(analysis|analise|tradeoff|compare|evaluate|infer)\b/g) },
    { mode: "research", hits: countSignalMatches(normalized, /\b(research|pesquisa|fonte|source|evidence|paper)\b/g) },
    { mode: "writing", hits: countSignalMatches(normalized, /\b(writing|texto|rewrite|copy|roteiro|story)\b/g) },
    { mode: "summary", hits: countSignalMatches(normalized, /\b(summary|resumo|resumir|sintese)\b/g) },
    { mode: "teaching", hits: countSignalMatches(normalized, /\b(teach|ensinar|explicar|didatico|tutorial)\b/g) },
  ];

  candidates.sort((a, b) => b.hits - a.hits);
  return candidates[0]?.hits ? candidates[0].mode : "chat";
}

export function activeModeState(input: ActiveModeStateInput = {}): ActiveModeStateOutput {
  const analysis = analyzeSignalText(input.text);
  const detectedMode = detectMode(analysis.normalized);
  const modeHits = countSignalMatches(
    analysis.normalized,
    /\b(chat|technical|analysis|research|writing|summary|teaching)\b/g,
  );

  const inferredScore = clamp01(
    0.3 +
    (Math.min(1, modeHits / 3) * 0.42) +
    (Math.min(1, analysis.tokenCount / 20) * 0.18) +
    (analysis.uniqueRatio * 0.1),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "active-mode-state",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `mode=${detectedMode}; modeHits=${modeHits}; tokenCount=${analysis.tokenCount}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      detectedMode,
      modeHits,
      tokenCount: analysis.tokenCount,
      hasText: Boolean(analysis.text),
    },
  };
}
