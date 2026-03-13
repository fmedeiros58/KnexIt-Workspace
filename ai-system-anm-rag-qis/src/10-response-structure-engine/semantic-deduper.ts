import type { TextSegment } from "./types";

function toTokenSet(value: string): Set<string> {
  const tokens = value.split(" ").filter(Boolean);
  return new Set(tokens);
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  let intersection = 0;
  for (const token of a) {
    if (b.has(token)) intersection += 1;
  }
  const union = a.size + b.size - intersection;
  return union > 0 ? intersection / union : 0;
}

function isNearDuplicate(current: TextSegment, existing: TextSegment): boolean {
  if (current.normalized === existing.normalized) return true;

  const short = current.normalized.length <= existing.normalized.length ? current.normalized : existing.normalized;
  const long = short === current.normalized ? existing.normalized : current.normalized;
  if (short.length >= 8 && long.includes(short) && short.length / Math.max(1, long.length) >= 0.72) {
    return true;
  }

  const similarity = jaccard(toTokenSet(current.normalized), toTokenSet(existing.normalized));
  return similarity >= 0.9;
}

export function semanticDeduper(segments: TextSegment[]): TextSegment[] {
  const result: TextSegment[] = [];

  for (const segment of segments) {
    if (segment.kind === "internal") continue;

    const duplicate = result.some((existing) => isNearDuplicate(segment, existing));
    if (duplicate) continue;

    result.push(segment);
  }

  return result;
}
