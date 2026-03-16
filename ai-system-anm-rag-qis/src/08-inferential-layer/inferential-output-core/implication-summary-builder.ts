export interface ImplicationSummaryBuilderInput {
  implications: string[];
}

export interface ImplicationSummaryBuilderOutput {
  summary: string;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function implicationSummaryBuilder(input: ImplicationSummaryBuilderInput): ImplicationSummaryBuilderOutput {
  const top = input.implications.slice(0, 3);
  const summary = top.length
    ? `Sintese inferencial: ${top.join(" | ")}`
    : "Sintese inferencial: sem implicacoes suficientes.";

  return {
    summary,
    ok: true,
    component: "implication-summary-builder",
    score: Number((top.length ? Math.min(1, top.length / 3) : 0.2).toFixed(4)),
    detail: summary,
    context: {
      implicationCount: input.implications.length,
    },
  };
}
