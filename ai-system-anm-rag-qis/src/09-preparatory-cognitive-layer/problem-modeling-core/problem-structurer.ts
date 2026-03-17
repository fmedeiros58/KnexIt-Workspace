export interface ProblemStructurerInput {
  text: string;
}

export interface ProblemStructure {
  goal: string;
  constraints: string[];
}

export function problemStructurer(input: ProblemStructurerInput): ProblemStructure {
  const text = `${input.text || ""}`.trim();
  const lowered = text.toLowerCase();
  const goal =
    /\b(corrigir|ajustar|fix|resolver)\b/.test(lowered) ? "fix" :
    /\b(criar|implementar|build|fazer)\b/.test(lowered) ? "implement" :
    /\b(explicar|ensinar|resumo|analisar)\b/.test(lowered) ? "explain" :
    "respond";

  const constraints: string[] = [];
  if (/\b(rapido|rápido|curto|objetivo)\b/.test(lowered)) constraints.push("response_short");
  if (/\b(detalhado|profundo|completo)\b/.test(lowered)) constraints.push("response_deep");
  if (/\b(fontes|cite|source|referencia)\b/.test(lowered)) constraints.push("source_required");

  return { goal, constraints };
}
