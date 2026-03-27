/** ai-system-anm */
export function decideProactivity(input: {
  interruptionRisk: number;
  relevanceScore: number;
  questionFrequencyCap: number;
  selectedMode: string;
}) {
  const allowByRisk = input.interruptionRisk < 0.48;
  const allowByRelevance = input.relevanceScore >= 0.42;
  const allowByMode = input.selectedMode === "chat" || input.selectedMode === "analysis";
  const allowByFrequency = input.questionFrequencyCap > 0;

  const allowProactivity = allowByRisk && allowByRelevance && allowByMode && allowByFrequency;
  const rationale = allowProactivity
    ? "proactivity_allowed_by_gate"
    : "proactivity_blocked_by_gate";

  return {
    allowProactivity,
    rationale,
  };
}
