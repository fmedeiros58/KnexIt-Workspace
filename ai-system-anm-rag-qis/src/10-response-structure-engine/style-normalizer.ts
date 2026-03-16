export function normalizeStyle(text: string): string {
  let normalized = text;
  normalized = normalized.replace(/\b(nao)\b/gi, "nao");
  normalized = normalized.replace(/\s+([,.;:!?])/g, "$1");
  normalized = normalized.replace(/([,.;:!?])(\S)/g, "$1 $2");
  normalized = normalized.replace(/[ \t]{2,}/g, " ");
  return normalized.trim();
}
