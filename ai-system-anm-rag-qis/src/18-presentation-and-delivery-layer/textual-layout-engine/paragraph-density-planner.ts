import type { ResponseComplexity, ResponseLayoutPlan, RhetoricalShape } from "./response-layout-types";

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function resolveSentenceRange(complexity: ResponseComplexity, shape: RhetoricalShape): [number, number] {
  if (shape === "single_compact_paragraph") return [2, 4];
  if (shape === "two_paragraph_explanation") return [3, 5];
  if (shape === "enumerated_technical") return [2, 4];
  if (shape === "headed_analysis") return [4, 8];

  if (complexity === "micro") return [1, 2];
  if (complexity === "short") return [2, 3];
  if (complexity === "medium") return [3, 5];
  if (complexity === "long") return [4, 7];
  return [5, 9];
}

function resolveCharRange(complexity: ResponseComplexity, shape: RhetoricalShape): [number, number] {
  if (shape === "single_compact_paragraph") return [140, 520];
  if (shape === "two_paragraph_explanation") return [280, 880];
  if (shape === "enumerated_technical") return [220, 760];
  if (shape === "headed_analysis") return [420, 1400];

  if (complexity === "micro") return [80, 260];
  if (complexity === "short") return [120, 420];
  if (complexity === "medium") return [260, 780];
  if (complexity === "long") return [380, 1180];
  return [520, 1600];
}

export function applyParagraphDensityTargets(
  base: Omit<ResponseLayoutPlan, "targetParagraphSentenceRange" | "targetParagraphCharRange" | "mergeAggressiveness" | "flushThreshold" | "allowSingleSentenceParagraphs" | "keepDenseParagraphs">,
): ResponseLayoutPlan {
  const sentenceRange = resolveSentenceRange(base.complexity, base.rhetoricalShape);
  const charRange = resolveCharRange(base.complexity, base.rhetoricalShape);

  const mergeAggressiveness = clamp01(
    base.complexity === "micro"
      ? 0.35
      : base.complexity === "short"
        ? 0.48
        : base.complexity === "medium"
          ? 0.62
          : base.complexity === "long"
            ? 0.74
            : 0.82,
  );

  const flushThreshold = clamp01(
    base.rhetoricalShape === "headed_analysis"
      ? 0.74
      : base.rhetoricalShape === "enumerated_technical"
        ? 0.69
        : base.complexity === "micro"
          ? 0.55
          : base.complexity === "short"
            ? 0.61
            : base.complexity === "medium"
              ? 0.67
              : 0.75,
  );

  const allowSingleSentenceParagraphs =
    base.rhetoricalShape === "enumerated_technical" || base.complexity === "micro";

  return {
    ...base,
    targetParagraphSentenceRange: sentenceRange,
    targetParagraphCharRange: charRange,
    mergeAggressiveness,
    flushThreshold,
    allowSingleSentenceParagraphs,
    keepDenseParagraphs: base.complexity === "long" || base.complexity === "deep",
  };
}
