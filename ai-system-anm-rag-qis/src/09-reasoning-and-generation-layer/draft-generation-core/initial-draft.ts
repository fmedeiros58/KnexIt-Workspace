export function buildInitialDraft(input: {
  summary: string;
  status: string;
  confidence: number;
}): string {
  return [
    input.summary || "Sem sintese disponivel.",
    `Status epistemico: ${input.status}.`,
    `Confianca estimada: ${(input.confidence * 100).toFixed(0)}%.`,
  ].join("\n\n");
}
