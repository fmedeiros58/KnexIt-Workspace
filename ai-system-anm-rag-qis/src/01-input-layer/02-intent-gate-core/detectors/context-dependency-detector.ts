import type { ContextDependencyDetection } from "../intent-gate.types";
import { hasDeicticReference } from "../utils/deixis-patterns";
import { hasContinuationMarker, hasValidationMarker } from "../utils/contextual-markers";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function normalize(value: string): string {
  return `${value || ""}`.toLowerCase().replace(/\s+/g, " ").trim();
}

function hasStrongEllipsis(text: string): boolean {
  return /\b(seria aqui|e nesse caso|isso entra|faz sentido|qual o melhor|qual fica melhor|entao e isso)\b/i.test(text);
}

export function detectContextDependency(input: {
  text: string;
  tokenCount: number;
  questionCount: number;
  recentTurns: Array<{ role: "user" | "assistant"; content: string }>;
  hasGreeting: boolean;
}): ContextDependencyDetection {
  const text = normalize(input.text);
  const hasHistory = (input.recentTurns || []).length > 0;
  const hasDeixis = hasDeicticReference(text);
  const hasContinuation = hasContinuationMarker(text);
  const hasValidation = hasValidationMarker(text);
  const ellipsis = hasStrongEllipsis(text);
  const shortQuestion = input.tokenCount <= 6 && input.questionCount > 0;

  const tags: string[] = [];
  if (hasHistory) tags.push("history_available");
  if (hasDeixis) tags.push("deictic_reference");
  if (hasContinuation) tags.push("continuation_marker");
  if (hasValidation) tags.push("validation_marker");
  if (ellipsis) tags.push("elliptic_query");
  if (shortQuestion) tags.push("short_question");

  const score = clamp01(
    (hasHistory ? 0.18 : 0) +
      (hasDeixis ? 0.28 : 0) +
      (hasContinuation ? 0.24 : 0) +
      (hasValidation ? 0.14 : 0) +
      (ellipsis ? 0.18 : 0) +
      (shortQuestion ? 0.12 : 0) -
      (input.hasGreeting && input.tokenCount <= 3 ? 0.20 : 0),
  );

  return {
    hasContextDependency: score >= 0.34,
    contextDependencyScore: score,
    reasoningTags: tags,
  };
}
