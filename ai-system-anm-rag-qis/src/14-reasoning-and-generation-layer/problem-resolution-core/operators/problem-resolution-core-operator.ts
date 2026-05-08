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

const INTERNAL_REPAIR_TAIL_PATTERN =
  /\n{0,3}Complemento de fechamento[\s\S]*$/i;

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
  const initialStateWithRepair = attachRepairMetadata(
    initialState,
    initialPlan,
    false,
  );
  const originalDraft = String(input.draftAnswer ?? "");

  if (!input.autoRepair || !initialPlan.requiresRepair || !originalDraft.trim()) {
    return {
      state: initialStateWithRepair,
      repairPlan: initialPlan,
      repairedDraft: originalDraft,
      repairApplied: false,
    };
  }

  const repairedDraftRaw = applyProblemResolutionRepair(
    originalDraft,
    initialState,
    initialPlan,
  );
  const repairedDraft = stripInternalRepairTail(repairedDraftRaw);

  if (!repairedDraft || repairedDraft === originalDraft) {
    return {
      state: initialStateWithRepair,
      repairPlan: initialPlan,
      repairedDraft: originalDraft,
      repairApplied: false,
    };
  }

  const repairedState = runProblemResolutionOrchestrator({
    ...input,
    draftAnswer: repairedDraft,
  });
  const repairedPlan = buildAnswerDraftRepairPlan(repairedState);

  return {
    state: attachRepairMetadata(repairedState, repairedPlan, true),
    repairPlan: repairedPlan,
    repairedDraft,
    repairApplied: true,
  };
}

function attachRepairMetadata(
  state: ProblemResolutionState,
  repairPlan: DraftRepairPlan,
  repairApplied: boolean,
): ProblemResolutionState {
  return {
    ...state,
    repairPlan,
    repairMode: repairPlan.repairMode,
    repairApplied,
  };
}

function stripInternalRepairTail(value: string): string {
  return `${value || ""}`.replace(INTERNAL_REPAIR_TAIL_PATTERN, "").trim();
}

