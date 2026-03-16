import { analyzeText, clamp01, countMatches } from "./personality-utils";

export interface ResponseAttitudeManagerInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface ResponseAttitudeManagerOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function pickAttitude(frustrationHits: number, urgencyHits: number, politeHits: number) {
  if (frustrationHits > 0 && urgencyHits > 0) return "empathetic-direct";
  if (frustrationHits > 0) return "empathetic-structured";
  if (urgencyHits > 0) return "neutral-direct";
  if (politeHits > 0) return "polite-collaborative";
  return "balanced-neutral";
}

export function responseAttitudeManager(
  input: ResponseAttitudeManagerInput = {},
): ResponseAttitudeManagerOutput {
  const analysis = analyzeText(input.text);
  const frustrationHits = countMatches(
    analysis.normalized,
    /\b(nao funciona|quebrou|erro|travou|falhou|bug|frustrado|irritado)\b/g,
  );
  const urgencyHits = countMatches(
    analysis.normalized,
    /\b(urgente|agora|imediato|asap|rapido|quickly|hoje)\b/g,
  );
  const politeHits = countMatches(
    analysis.normalized,
    /\b(por favor|obrigado|thanks|valeu|gentileza)\b/g,
  );
  const riskHits = countMatches(
    analysis.normalized,
    /\b(legal|juridico|medico|financeiro|compliance|risk|risco)\b/g,
  );

  const attitude = pickAttitude(frustrationHits, urgencyHits, politeHits);
  const inferredScore = clamp01(
    0.33 +
    (Math.min(1, (frustrationHits + urgencyHits + politeHits) / 5) * 0.35) +
    (Math.min(1, riskHits / 3) * 0.2) +
    (Math.min(1, analysis.punctuationCount / 8) * 0.12),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "response-attitude-manager",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `attitude=${attitude}; frustration=${frustrationHits}; urgency=${urgencyHits}; risk=${riskHits}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      recommendedAttitude: attitude,
      frustrationHits,
      urgencyHits,
      politeHits,
      riskHits,
      hasText: Boolean(analysis.text),
    },
  };
}
