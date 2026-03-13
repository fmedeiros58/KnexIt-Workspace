import type { TextSegment } from "./types";

export function fragmentMerger(segments: TextSegment[]): TextSegment[] {
  const merged: TextSegment[] = [];
  let buffer: string[] = [];

  const flush = () => {
    if (!buffer.length) return;

    const joined = buffer.join(" ").trim();
    merged.push({
      raw: joined,
      cleaned: joined,
      normalized: joined.toLowerCase(),
      kind: "paragraph",
      score: joined.length,
    });

    buffer = [];
  };

  for (const segment of segments) {
    if (segment.kind === "fragment") {
      buffer.push(segment.cleaned);
      continue;
    }

    flush();
    merged.push(segment);
  }

  flush();
  return merged;
}
