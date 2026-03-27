import type { DirectJudgmentDetection, JudgmentMode } from "./objective-rationality-types";

function normalize(value: string): string {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function detectDirectJudgmentIntent(query: string): DirectJudgmentDetection {
  const normalized = normalize(query);
  const reasons: string[] = [];

  let score = 0;
  let mode: JudgmentMode = "unknown";

  if (
    /\b(qual e melhor|o que e melhor|qual eh melhor|melhor opcao|qual a melhor opcao)\b/.test(
      normalized,
    )
  ) {
    score += 0.35;
    mode = "comparative_judgment";
    reasons.push("comparative_best_option_pattern");
  }

  if (
    /\b(curto e grosso|objetivamente|em absoluto|sem avaliar nada|apenas diga|so diga|apenas responda|resposta direta|curta e grossa)\b/.test(
      normalized,
    )
  ) {
    score += 0.35;
    mode = "direct_objective_judgment";
    reasons.push("directness_pattern");
  }

  if (
    /\b(minha opiniao|sua opiniao|sua resposta|qual voce escolheria|qual vc escolheria)\b/.test(
      normalized,
    )
  ) {
    score += 0.18;
    if (mode === "unknown") mode = "direct_objective_judgment";
    reasons.push("opinion_request_pattern");
  }

  if (/\b(entre .+ e .+)\b/.test(normalized)) {
    score += 0.16;
    if (mode === "unknown") mode = "comparative_judgment";
    reasons.push("between_options_pattern");
  }

  if (
    /\b(depende nao|nao quero depende|sem depender|sem relativizar|sem condicionar)\b/.test(
      normalized,
    )
  ) {
    score += 0.24;
    reasons.push("anti_hedging_pattern");
  }

  const detected = score >= 0.35;

  return {
    detected,
    mode: detected ? mode : "unknown",
    confidence: Math.max(0, Math.min(1, score)),
    reasons,
  };
}

