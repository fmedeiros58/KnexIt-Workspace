import { suppressUndueHedging } from "./hedging-suppressor";

export function enforceConclusionFirst(input: {
  selectedAnswer?: string;
  briefReason?: string;
  requireShortAnswer?: boolean;
}): string {
  const answer = `${input.selectedAnswer || ""}`.trim();
  const reason = `${input.briefReason || ""}`.trim();

  if (!answer) return "";

  if (input.requireShortAnswer) {
    return reason ? `${answer}. ${reason}` : `${answer}.`;
  }

  return reason ? `${answer}.\n\n${reason}` : `${answer}.`;
}

export function postProcessDirectAnswer(text: string): string {
  const suppressed = suppressUndueHedging(text);
  return suppressed
    .replace(/\.\./g, ".")
    .replace(/\s+/g, " ")
    .trim();
}

