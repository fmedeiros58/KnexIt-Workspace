/**
 * Responsabilidade do arquivo:
 * - Aplicar pruning por categoria com limites dependentes do pruningMode.
 * - Preservar constraints criticas mesmo em pruning agressivo.
 * - Reduzir payload de estado sem destruir sinais essenciais.
 */
import type { ProcessingState } from "../bridges/contracts/processing-state";
import { CRITICAL_CONSTRAINT_PATTERNS, PRUNING_LIMITS } from "./pipeline-pruning-policy";

function capArray<T>(value: T[] | undefined, maxItems: number): T[] {
  if (!value?.length) return [];
  return value.slice(-maxItems);
}

function isCriticalConstraint(value: string) {
  return CRITICAL_CONSTRAINT_PATTERNS.some((pattern) => pattern.test(value));
}

function pruneConstraints(constraints: string[] | undefined, maxItems: number) {
  if (!constraints?.length) return [];
  const unique = [...new Set(constraints)];
  const critical = unique.filter(isCriticalConstraint);
  const nonCritical = unique.filter((item) => !isCriticalConstraint(item));
  const remainingSlots = Math.max(0, maxItems - critical.length);
  return [...critical, ...nonCritical.slice(-remainingSlots)];
}

export function prunePipelineState(state: ProcessingState, shouldPrune = true): ProcessingState {
  if (!shouldPrune) return state;

  const pruningMode = state.executionPlan.pruningMode || "moderate";
  const limits = PRUNING_LIMITS[pruningMode];

  return {
    ...state,
    trace: capArray(state.trace, limits.trace),
    activeConstraints: pruneConstraints(state.activeConstraints, limits.activeConstraints),
    activeContext: capArray(state.activeContext, limits.activeContext),
    retrievedSources: capArray(state.retrievedSources, limits.retrievedSources),
    retrievedEvidence: capArray(state.retrievedEvidence, limits.retrievedEvidence),
    scenarioSet: capArray(state.scenarioSet, limits.scenarioSet),
    hypothesisSet: capArray(state.hypothesisSet, limits.hypothesisSet),
    criticalCaveats: capArray(state.criticalCaveats, limits.criticalCaveats),
    reflectiveNotes: {
      ...state.reflectiveNotes,
      assumptions: capArray(state.reflectiveNotes?.assumptions, limits.reflectiveItems),
      caveats: capArray(state.reflectiveNotes?.caveats, limits.reflectiveItems),
      tensions: capArray(state.reflectiveNotes?.tensions, limits.reflectiveItems),
    },
  };
}
