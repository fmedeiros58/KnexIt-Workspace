export function normalizeLogicalText(value: string): string {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function toUnique(items: string[], limit = 12): string[] {
  const output: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const trimmed = `${item || ""}`.replace(/\s+/g, " ").trim();
    if (!trimmed) continue;
    const key = normalizeLogicalText(trimmed);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    output.push(trimmed);
    if (output.length >= limit) break;
  }
  return output;
}

export function hasAnyPattern(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

export function splitClauses(value: string): string[] {
  return `${value || ""}`
    .split(/[.;!?]+|\s+\be\b\s+|\s+\bou\b\s+/gi)
    .map((item) => item.trim())
    .filter(Boolean);
}

