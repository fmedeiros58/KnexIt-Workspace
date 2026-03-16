import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { problemStructurer } from "./problem-modeling-core/problem-structurer";
import { reasoningPlanBuilder } from "./cognitive-planning-core/reasoning-plan-builder";
import { preparatoryAmbiguityDetector } from "./ambiguity-resolution-support-core/ambiguity-detector";
import { salienceDetector } from "./cognitive-salience-core/salience-detector";
import { handoffPreparatoryToReflective } from "./preparatory-to-reflective-bridge";

export async function runPreparatoryCognitiveLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const text = state.normalizedMessage || state.rawMessage;

  const problem = problemStructurer({ text });
  const ambiguity = preparatoryAmbiguityDetector({
    text,
    baselineAmbiguity: state.complexityProfile.ambiguity,
  });
  const salience = salienceDetector({ text });
  const plan = reasoningPlanBuilder({
    goal: problem.goal,
    route: state.executionPlan.selectedRoute,
    ambiguity: ambiguity.ambiguityScore,
  });

  state.preparatoryState = {
    goal: problem.goal,
    constraints: problem.constraints,
    ambiguityScore: ambiguity.ambiguityScore,
    ambiguityFlags: ambiguity.ambiguityFlags,
    salientTerms: salience.salientTerms,
    cognitivePlan: plan.steps,
  };
  state.activeConstraints = [
    ...new Set([
      ...state.activeConstraints,
      ...problem.constraints,
      ...ambiguity.ambiguityFlags.map((flag) => `preparatory:${flag}`),
    ]),
  ].slice(-28);
  state.executionPlan.steps = [...new Set([...state.executionPlan.steps, ...plan.steps])];

  state.trace.push(
    makeTraceEvent({
      layer: "preparatory",
      action: "problem_modeled",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail: `goal=${problem.goal}; salience=${salience.salientTerms.slice(0, 3).join(",")}; ambiguity=${ambiguity.ambiguityScore.toFixed(2)}`,
    }),
  );

  return handoffPreparatoryToReflective(state);
}
