import type {
  DominanceSignal,
  ObjectiveAnswerSelection,
} from "./objective-rationality-types";

export function selectObjectiveAnswer(input: {
  query: string;
  options: string[];
  dominance: DominanceSignal;
}): ObjectiveAnswerSelection {
  const { options, dominance } = input;

  if (!dominance.detected || dominance.winningOptionIndex == null) {
    return {
      selected: false,
      confidence: 0.22,
      reasons: ["no_dominant_option_selected"],
    };
  }

  const winner = options[dominance.winningOptionIndex];
  if (!winner) {
    return {
      selected: false,
      confidence: 0.12,
      reasons: ["winner_option_missing"],
    };
  }

  const briefReason =
    dominance.kind === "strict_dominance"
      ? "Ela entrega objetivamente mais recursos para o objetivo apresentado."
      : "Ela parece superior para o objetivo apresentado.";

  return {
    selected: true,
    selectedOptionIndex: dominance.winningOptionIndex,
    answer: winner,
    briefReason,
    confidence: dominance.confidence,
    reasons: dominance.reasons,
  };
}

