import type { TextSegment } from "./types";
import { finalPolisher } from "./final-polisher";

export function discourseRebuilder(segments: TextSegment[]): string {
  const body: string[] = [];
  const conclusions: string[] = [];
  const seen = new Set<string>();

  for (const segment of segments) {
    if (segment.kind === "heading") continue;

    const polished = finalPolisher(segment.cleaned);
    if (!polished) continue;

    const key = polished.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, "").replace(/\s+/g, " ").trim();
    if (seen.has(key)) continue;
    seen.add(key);

    if (segment.kind === "conclusion") conclusions.push(polished);
    else body.push(polished);
  }

  return [...body, ...conclusions]
    .join("\n\n")
    .trim();
}
