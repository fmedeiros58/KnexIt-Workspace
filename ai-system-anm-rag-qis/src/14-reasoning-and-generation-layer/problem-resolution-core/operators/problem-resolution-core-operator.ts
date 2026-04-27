/**
 * Layer: 14-reasoning-and-generation-layer/problem-resolution-core/operators
 * Module: problem-resolution-core-operator
 * Responsibility: Execute problem-resolution core pass with optional deterministic repair cycle.
 */

import type {
  DraftRepairPlan,
  ProblemResolutionInput,
  ProblemResolutionState,
} from "../problem-resolution-types";
import { runProblemResolutionOrchestrator } from "../problem-resolution-orchestrator";
import {
  applyProblemResolutionRepair,
  buildAnswerDraftRepairPlan,
} from "../answer-draft-repair-planner";

export interface ProblemResolutionOperatorInput extends ProblemResolutionInput {
  autoRepair?: boolean;
}

export interface ProblemResolutionOperatorResult {
  state: ProblemResolutionState;
  repairPlan: DraftRepairPlan;
  repairedDraft: string;
  repairApplied: boolean;
}

export function runProblemResolutionCoreOperator(
  input: ProblemResolutionOperatorInput,
): ProblemResolutionOperatorResult {
  const initialState = runProblemResolutionOrchestrator(input);
  const initialPlan = buildAnswerDraftRepairPlan(initialState);
  const originalDraft = String(input.draftAnswer ?? "");

  if (!input.autoRepair || !initialPlan.requiresRepair || !originalDraft.trim()) {
    return {
      state: initialState,
      repairPlan: initialPlan,
      repairedDraft: originalDraft,
      repairApplied: false,
    };
  }

  const repairedDraft = applyProblemResolutionRepair(
    originalDraft,
    initialState,
    initialPlan,
  );

  if (!repairedDraft || repairedDraft === originalDraft) {
    return {
      state: initialState,
      repairPlan: initialPlan,
      repairedDraft: originalDraft,
      repairApplied: false,
    };
  }

  const repairedState = runProblemResolutionOrchestrator({
    ...input,
    draftAnswer: repairedDraft,
  });

  return {
    state: repairedState,
    repairPlan: buildAnswerDraftRepairPlan(repairedState),
    repairedDraft,
    repairApplied: true,
  };
}

