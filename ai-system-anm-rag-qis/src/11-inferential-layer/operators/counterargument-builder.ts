/**
 * @file counterargument-builder.ts
 * @description Constroi um contra-argumento curto a partir de uma tese.
 * @layer 11-inferential-layer
 * @purpose Dar suporte local a tarefas dialeticas sem centralizar no orquestrador.
 * @inputs Tese, intensidade e base opcional.
 * @outputs Contra-argumento textual compacto.
 * @dependsOn Nenhuma dependencia externa.
 * @usedBy camada inferencial e futuras respostas dialeticas.
 * @invariants Contra-argumento deve explicitar base quando intensidade for alta.
 * @notes Operador deterministico para uso como building block.
 */
export function buildCounterargument(thesis: string, intensity: "low" | "medium" | "high", basis?: string): string {
  const base = basis ? ` com base em ${basis}` : "";
  if (intensity === "low") return `Limite a considerar${base}: ${thesis}`;
  if (intensity === "medium") return `Contra-argumento proporcional${base}: ${thesis}`;
  return `Contra-argumento forte${base}: ${thesis}`;
}

