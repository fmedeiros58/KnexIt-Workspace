export interface OverclaimDetectorInput {
  text: string;
  uncertainty: number;
}

export interface OverclaimDetectorOutput {
  overclaims: string[];
  riskScore: number;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

const ABSOLUTIST_TERMS = /\b(sempre|nunca|garantido|definitivo|100%|sem duvida|without doubt|certainly)\b/i;

export function overclaimDetector(input: OverclaimDetectorInput): OverclaimDetectorOutput {
  const overclaims: string[] = [];
  if (ABSOLUTIST_TERMS.test(input.text)) {
    overclaims.push("Linguagem absoluta detectada no resumo colapsado.");
  }
  if (input.uncertainty > 0.38 && ABSOLUTIST_TERMS.test(input.text)) {
    overclaims.push("Certeza lexical elevada conflita com incerteza epistemica residual.");
  }

  const riskScore = Math.max(0, Math.min(1, (overclaims.length * 0.34) + (input.uncertainty * 0.18)));

  return {
    overclaims,
    riskScore: Number(riskScore.toFixed(4)),
    ok: true,
    component: "overclaim-detector",
    score: Number(riskScore.toFixed(4)),
    detail: overclaims.join(" ") || "sem overclaim dominante",
    context: {
      uncertainty: input.uncertainty,
    },
  };
}
