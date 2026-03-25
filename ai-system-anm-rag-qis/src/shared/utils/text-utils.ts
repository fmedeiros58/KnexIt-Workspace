export function normalizeWhitespace(value: string) {
  return `${value || ""}`.replace(/\s+/g, " ").trim();
}

export function truncateText(value: string, maxChars: number) {
  const safe = `${value || ""}`;
  if (safe.length <= maxChars) return safe;
  return `${safe.slice(0, Math.max(0, maxChars - 1))}\u2026`;
}
