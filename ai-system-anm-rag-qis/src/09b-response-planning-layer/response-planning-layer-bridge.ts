/**
 * ai-system-anm - bridge 09b
 * Planeja formato de resposta antes do raciocinio/geracao.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { mapResponseIntent } from "./response-intent-mapper";
import { selectResponseStrategy } from "./response-strategy-selector";
import { regulateDepth } from "./depth-regulator";
import { planStructure } from "./structure-planner";

export async function runResponsePlanningLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const responseIntent = mapResponseIntent(state.normalizedMessage || state.rawMessage);
  const strategy = selectResponseStrategy({
    responseIntent,
    ambiguity: state.languageState.ambiguity,
    cautionLevel: state.affectiveState.cautionLevel,
  });
  const depthLevel = regulateDepth({
    complexityScore: state.complexityProfile.score,
    responseIntent,
  });
  const structurePlan = planStructure({ responseIntent, depthLevel });

  state.responsePlanState = {
    responseIntent,
    strategy,
    structurePlan,
    depthLevel,
    requiresSynthesis: responseIntent !== "direct",
  };

  state.executionArtifacts.responsePlanning = {
    responseIntent,
    strategy,
    depthLevel,
    structurePlan,
    requiresSynthesis: state.responsePlanState.requiresSynthesis,
  };

  state.executionPlan.steps = Array.from(new Set([
    ...state.executionPlan.steps,
    "response_planning",
    `response_intent:${responseIntent}`,
    `response_strategy:${strategy}`,
  ])).slice(-24);

  state.trace.push(
    makeTraceEvent({
      layer: "response-planning",
      action: "response_plan_built",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `intent=${responseIntent}; strategy=${strategy}; depth=${depthLevel}; ` +
        `structure=${structurePlan.join(",")}`,
    }),
  );

  return state;
}
