/** ai-system-anm */
function normalize(value: string) {
  return `${value || ""}`.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function checkContextualRelevance(input: { userMessage: string; draft: string }): number {
  const message = normalize(input.userMessage);
  const draft = normalize(input.draft);
  const tokens = Array.from(new Set(message.split(/\s+/g).filter((t) => t.length >= 4)));
  if (!tokens.length) return 0.5;
  const hits = tokens.filter((token) => draft.includes(token)).length;
  return Math.max(0, Math.min(1, hits / tokens.length));
}
