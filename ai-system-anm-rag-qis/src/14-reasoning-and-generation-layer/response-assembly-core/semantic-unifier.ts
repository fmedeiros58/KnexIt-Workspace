export function unifySemantics(text: string): string {
  return text
    .replace(/\bhipotese\b/gi, "hipotese")
    .replace(/\bepistemico\b/gi, "epistemico")
    .trim();
}
