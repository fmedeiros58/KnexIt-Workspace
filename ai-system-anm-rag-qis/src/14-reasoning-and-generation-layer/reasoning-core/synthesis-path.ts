export function buildSynthesisPath(chunks: string[]): string {
  return `Sintese: ${chunks.filter(Boolean).join(" ")}`.trim();
}
