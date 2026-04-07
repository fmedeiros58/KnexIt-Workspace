export interface TextCleanerInput {
  text: string;
}

export interface TextCleanerOutput {
  text: string;
  removedControlChars: number;
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function textCleaner(input: TextCleanerInput): TextCleanerOutput {
  const original = input.text || "";
  const noZeroWidth = original.replace(/[\u200B-\u200D\uFEFF]/g, "");
  const cleaned = noZeroWidth.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ");
  const removedControlChars = Math.max(0, original.length - cleaned.length);
  const score = cleaned.trim().length ? 0.84 : 0.1;

  return {
    text: cleaned,
    removedControlChars,
    ok: true,
    component: "text-cleaner",
    score,
    detail: cleaned,
    context: {
      removedControlChars,
    },
  };
}
