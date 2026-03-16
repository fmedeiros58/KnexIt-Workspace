import { analyzeSignalText, clamp01, countSignalMatches } from "../signal-utils";

export interface ConversationTimelineInput {
  text?: string;
  score?: number;
  context?: Record<string, unknown>;
}

export interface ConversationTimelineOutput {
  ok: boolean;
  component: string;
  score: number;
  detail: string;
  context: Record<string, unknown>;
}

export function conversationTimeline(input: ConversationTimelineInput = {}): ConversationTimelineOutput {
  const analysis = analyzeSignalText(input.text);
  const temporalMarkers = countSignalMatches(
    analysis.normalized,
    /\b(primeiro|depois|entao|agora|antes|apos|first|then|now|before|after)\b/g,
  );
  const turnMarkers = countSignalMatches(analysis.normalized, /\b(user:|assistant:|usuario:|assistente:)\b/g);
  const segments = analysis.text
    ? analysis.text
      .split(/(?<=[.!?;])\s+|\n+/)
      .map((item) => item.trim())
      .filter(Boolean)
    : [];

  const inferredScore = clamp01(
    0.28 +
    (Math.min(1, temporalMarkers / 3) * 0.34) +
    (Math.min(1, turnMarkers / 4) * 0.24) +
    (Math.min(1, segments.length / 6) * 0.14),
  );
  const finalScore = typeof input.score === "number" && Number.isFinite(input.score)
    ? clamp01(input.score)
    : inferredScore;

  return {
    ok: true,
    component: "conversation-timeline",
    score: Number(finalScore.toFixed(4)),
    detail: analysis.text
      ? `segments=${segments.length}; temporalMarkers=${temporalMarkers}; turnMarkers=${turnMarkers}`
      : "empty_input",
    context: {
      ...(input.context || {}),
      segmentCount: segments.length,
      temporalMarkers,
      turnMarkers,
      hasTimelineSignal: temporalMarkers > 0 || segments.length > 1,
      hasText: Boolean(analysis.text),
    },
  };
}
