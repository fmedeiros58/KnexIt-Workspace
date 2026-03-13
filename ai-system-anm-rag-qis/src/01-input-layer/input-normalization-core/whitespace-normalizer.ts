export interface WhitespaceNormalizerInput {
  text: string;
  preserveLineBreaks?: boolean;
}

export interface WhitespaceNormalizerOutput {
  text: string;
  collapsedCount: number;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function whitespaceNormalizer(input: WhitespaceNormalizerInput): WhitespaceNormalizerOutput {
  const original = input.text || "";
  const preserveLineBreaks = input.preserveLineBreaks ?? false;
  const normalized = preserveLineBreaks
    ? original.replace(/[^\S\r\n]+/g, " ")
    : original.replace(/\s+/g, " ");
  const text = normalized.trim();
  const collapsedCount = Math.max(0, original.length - text.length);
  const score = text.length ? 0.82 : 0.1;

  return {
    text,
    collapsedCount,
    ok: true,
    component: "whitespace-normalizer",
    score,
    detail: text,
    context: {
      preserveLineBreaks,
    },
  };
}
