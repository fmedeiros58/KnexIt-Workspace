/** ai-system-anm */
export function enhanceTransitions(text: string): string {
  const trimmed = `${text || ""}`.trim();
  if (!trimmed) return "";
  return trimmed
    .replace(/\n{3,}/g, "\n\n")
    .replace(/\.\s+Em resumo,/g, ".\n\nEm resumo,");
}
