export interface CaveatPrioritizerInput {
  caveats: string[];
  reflectionWeight: number;
}

export interface CaveatPrioritizerOutput {
  prioritized: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

function rankCaveat(value: string) {
  let score = 0;
  if (/incerteza|uncertainty|contestad|conflito/i.test(value)) score += 3;
  if (/sem fontes|evidencia insuficiente|lacuna/i.test(value)) score += 2;
  if (/tradeoff|tensao|tensão/i.test(value)) score += 1;
  return score;
}

export function caveatPrioritizer(input: CaveatPrioritizerInput): CaveatPrioritizerOutput {
  const maxItems = input.reflectionWeight >= 0.62 ? 10 : input.reflectionWeight >= 0.34 ? 8 : 6;
  const prioritized = [...input.caveats]
    .sort((a, b) => rankCaveat(b) - rankCaveat(a))
    .slice(0, maxItems);

  return {
    prioritized,
    ok: true,
    component: "caveat-prioritizer",
    score: Number((input.reflectionWeight).toFixed(4)),
    detail: `prioritized=${prioritized.length}`,
    context: {
      maxItems,
      originalCount: input.caveats.length,
    },
  };
}
