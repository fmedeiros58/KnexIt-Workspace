export function ensureTrailingPeriod(text: string): string {
  const normalized = text.trim();
  if (!normalized) return "";
  return /[.!?]$/.test(normalized) ? normalized : `${normalized}.`;
}

