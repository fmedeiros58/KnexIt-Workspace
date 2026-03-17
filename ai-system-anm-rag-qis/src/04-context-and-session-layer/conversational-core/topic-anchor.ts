import { analyzeSignalText, clamp01, pickTopKeywords } from "../signal-utils";

export interface TopicAnchorInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface TopicAnchorOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function topicAnchor(input: TopicAnchorInput = {}): TopicAnchorOutput {
  const analysis = analyzeSignalText(input.text);
  const anchors = pickTopKeywords(analysis.tokens, 4);
  const anchorDensity = analysis.tokenCount ? anchors.length / Math.min(analysis.tokenCount, 8) : 0;

  const inferredScore = clamp01(
    0.25 +
    (Math.min(1, anchors.length / 4) * 0.5) +
    (Math.min(1, anchorDensity) * 0.15) +
    (analysis.uniqueRatio * 0.1),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "topic-anchor",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `anchors=${anchors.join(",") || "none"}; tokenCount=${analysis.tokenCount}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      anchors,
      anchorDensity: Number(anchorDensity.toFixed(4)),
      tokenCount: analysis.tokenCount,
      hasText: Boolean(analysis.text),
    },
  };
}
