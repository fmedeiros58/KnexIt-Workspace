export function buildAlternativeDraft(input: {
  summary: string;
  caveat: string;
}): string {
  return `${input.summary}\n\nLeitura alternativa: ${input.caveat || "sem caveat adicional"}.`;
}
