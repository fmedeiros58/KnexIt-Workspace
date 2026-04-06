import type { TextAnalysisSnapshot } from "../../../shared/text-processing/text-analysis-snapshot";
import { countDeixisSignals } from "./deixis-patterns";

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function estimateIntentGateAmbiguity(input: {
  text: string;
  snapshot: TextAnalysisSnapshot;
  contextDependencyScore: number;
}): { score: number; tags: string[] } {
  const tags: string[] = [];
  const text = `${input.text || ""}`;
  const snapshot = input.snapshot;
  const deixisCount = countDeixisSignals(text);
  if (deixisCount > 0) tags.push("deixis_present");
  if (snapshot.ambiguousTermCount > 0) tags.push("ambiguous_terms_present");
  if (snapshot.tokenCount <= 4) tags.push("very_short_message");
  if (snapshot.questionCount > 0) tags.push("question_form");

  const score = clamp01(
    (snapshot.ambiguousTermCount * 0.22) +
      (snapshot.pronounCount * 0.08) +
      (deixisCount * 0.14) +
      (snapshot.tokenCount <= 4 ? 0.18 : 0) +
      (snapshot.questionCount > 0 ? 0.07 : 0) +
      (input.contextDependencyScore * 0.34),
  );

  return { score, tags };
}
