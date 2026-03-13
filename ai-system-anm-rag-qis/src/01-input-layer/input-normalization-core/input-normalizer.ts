import { encodingNormalizer } from "./encoding-normalizer";
import { textCleaner } from "./text-cleaner";
import { inputCanonicalizer } from "./input-canonicalizer";
import { whitespaceNormalizer } from "./whitespace-normalizer";
import { languageDetector } from "./language-detector";

export interface InputNormalizerInput {
  rawText: string;
  preserveLineBreaks?: boolean;
}

export interface InputNormalizerOutput {
  normalizedText: string;
  languageHint: "pt-BR" | "en-US" | "es-ES" | "unknown";
  removedChars: number;
  issues: string[];
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function inputNormalizer(input: InputNormalizerInput): InputNormalizerOutput {
  const original = `${input.rawText || ""}`;
  const encoding = encodingNormalizer({ text: original });
  const cleaned = textCleaner({ text: encoding.text });
  const canonical = inputCanonicalizer({ text: cleaned.text });
  const whitespace = whitespaceNormalizer({
    text: canonical.text,
    preserveLineBreaks: input.preserveLineBreaks,
  });
  const language = languageDetector({ text: whitespace.text });

  const issues: string[] = [];
  if (cleaned.removedControlChars > 0) issues.push("control_chars_removed");
  if (encoding.hadEncodingNoise) issues.push("encoding_noise_normalized");
  if (!whitespace.text) issues.push("empty_after_normalization");

  const qualityScore = whitespace.text
    ? Math.max(0.1, Math.min(1, 1 - (cleaned.removedControlChars / Math.max(1, original.length))))
    : 0.05;

  return {
    normalizedText: whitespace.text,
    languageHint: language.language,
    removedChars: cleaned.removedControlChars,
    issues,
    ok: whitespace.text.length > 0,
    component: "input-normalizer",
    score: Number(qualityScore.toFixed(4)),
    detail: whitespace.text,
    context: {
      originalLength: original.length,
      normalizedLength: whitespace.text.length,
      languageHint: language.language,
      encodingNoise: encoding.hadEncodingNoise,
    },
  };
}
