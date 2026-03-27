import { detectDirectJudgmentIntent } from "./direct-judgment-detector";
import { lockExplicitConstraints } from "./constraint-locker";
import { evaluateDominance } from "./dominance-evaluator";
import { selectObjectiveAnswer } from "./objective-answer-selector";
import { containsStrongHedging } from "./hedging-suppressor";
import { enforceConclusionFirst, postProcessDirectAnswer } from "./response-directness-enforcer";
import type { ObjectiveRationalityEvaluation } from "./objective-rationality-types";

function shouldRequireShortAnswer(constraints: string[]): boolean {
  return constraints.includes("require_short_answer");
}

export function evaluateObjectiveRationality(input: {
  query: string;
  options?: string[];
  draftAnswer?: string;
}): ObjectiveRationalityEvaluation {
  const directJudgment = detectDirectJudgmentIntent(input.query);
  const constraints = lockExplicitConstraints(input.query);
  const dominance = evaluateDominance(input.options || []);

  const shouldSuppressHedging =
    directJudgment.detected &&
    (constraints.constraints.includes("exclude_multiple_conditions") ||
      constraints.constraints.includes("require_absolute_evaluation") ||
      dominance.detected);

  const shouldForceDirectAnswer =
    directJudgment.detected &&
    (constraints.constraints.includes("require_direct_opinion") || dominance.detected);

  const shouldAnswerWithConclusionFirst = shouldForceDirectAnswer || dominance.detected;

  const recommendedAnswerStyle =
    shouldForceDirectAnswer && dominance.detected
      ? "direct_then_brief_reason"
      : shouldForceDirectAnswer
        ? "direct"
        : "normal_reflective";

  const summary = [
    ...(directJudgment.detected ? ["direct_judgment_detected"] : ["direct_judgment_not_detected"]),
    ...(constraints.locked ? ["constraints_locked"] : ["no_explicit_constraints"]),
    ...(dominance.detected ? [`dominance_${dominance.kind}`] : ["no_clear_dominance"]),
  ];

  return {
    directJudgment,
    constraints,
    dominance,
    shouldSuppressHedging,
    shouldForceDirectAnswer,
    shouldAnswerWithConclusionFirst,
    recommendedAnswerStyle,
    summary,
  };
}

export function synthesizeObjectiveAnswer(input: {
  query: string;
  options?: string[];
  draftAnswer?: string;
}): {
  evaluation: ObjectiveRationalityEvaluation;
  finalAnswer?: string;
} {
  const evaluation = evaluateObjectiveRationality(input);

  if (!evaluation.shouldForceDirectAnswer || !input.options?.length) {
    if (
      evaluation.shouldSuppressHedging &&
      input.draftAnswer &&
      containsStrongHedging(input.draftAnswer)
    ) {
      return {
        evaluation,
        finalAnswer: postProcessDirectAnswer(input.draftAnswer),
      };
    }

    return {
      evaluation,
      finalAnswer: input.draftAnswer,
    };
  }

  const selected = selectObjectiveAnswer({
    query: input.query,
    options: input.options,
    dominance: evaluation.dominance,
  });

  if (!selected.selected || !selected.answer) {
    return {
      evaluation,
      finalAnswer: input.draftAnswer,
    };
  }

  const finalAnswer = enforceConclusionFirst({
    selectedAnswer: selected.answer,
    briefReason: selected.briefReason,
    requireShortAnswer: shouldRequireShortAnswer(evaluation.constraints.constraints),
  });

  return {
    evaluation,
    finalAnswer: postProcessDirectAnswer(finalAnswer),
  };
}

