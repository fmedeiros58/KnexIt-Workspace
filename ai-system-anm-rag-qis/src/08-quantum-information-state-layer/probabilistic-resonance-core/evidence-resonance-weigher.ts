import type { QuantumHypothesis } from "../quantum-core-types";

export interface EvidenceResonanceWeigherInput {
  hypotheses: QuantumHypothesis[];
  evidenceHints: string[];
}

export interface EvidenceResonanceWeigherOutput {
  weights: Record<string, number>;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function overlapRatio(claim: string, hints: string[]) {
  if (!hints.length) return 0;
  const lowerClaim = claim.toLowerCase();
  const hits = hints.filter((item) => lowerClaim.includes(item.toLowerCase().split(/\s+/)[0] || "")).length;
  return hits / hints.length;
}

export function evidenceResonanceWeigher(input: EvidenceResonanceWeigherInput): EvidenceResonanceWeigherOutput {
  const weights = Object.fromEntries(
    input.hypotheses.map((hypothesis) => {
      const ratio = overlapRatio(hypothesis.claim, input.evidenceHints);
      const weight = Math.max(0.05, Math.min(0.98, hypothesis.evidenceSupport + (ratio * 0.22)));
      return [hypothesis.id, Number(weight.toFixed(6))];
    }),
  );

  const avg = input.hypotheses.length
    ? input.hypotheses.reduce((sum, item) => sum + (weights[item.id] ?? 0), 0) / input.hypotheses.length
    : 0;

  return {
    weights,
    ok: true,
    component: "evidence-resonance-weigher",
    score: Number(avg.toFixed(4)),
    detail: `hypotheses=${input.hypotheses.length}`,
    context: {
      evidenceHints: input.evidenceHints.length,
    },
  };
}
