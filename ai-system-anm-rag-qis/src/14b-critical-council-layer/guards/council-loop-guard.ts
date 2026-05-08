import type { ProcessingState } from "../../bridges/contracts/processing-state";

export const MAX_COUNCIL_REVISIONS = 2;

export interface CouncilLoopGuardOptions {
  readonly maxRevisions?: number;
}

export interface CouncilLoopStatus {
  readonly attempts: number;
  readonly maxRevisions: number;
  readonly remainingAttempts: number;
  readonly canRevise: boolean;
  readonly exhausted: boolean;
}

export function getCouncilRevisionAttempts(state: ProcessingState): number {
  return normalizeAttemptCount(
    state.executionArtifacts.criticalCouncil?.revisionAttempts,
  );
}

export function getCouncilLoopStatus(
  state: ProcessingState,
  options: CouncilLoopGuardOptions = {},
): CouncilLoopStatus {
  const maxRevisions = normalizeMaxRevisions(options.maxRevisions);
  const attempts = getCouncilRevisionAttempts(state);
  const remainingAttempts = Math.max(0, maxRevisions - attempts);
  const exhausted = attempts >= maxRevisions;

  return {
    attempts,
    maxRevisions,
    remainingAttempts,
    canRevise: !exhausted,
    exhausted,
  };
}

export function canApplyCouncilRevision(
  state: ProcessingState,
  options: CouncilLoopGuardOptions = {},
): boolean {
  return getCouncilLoopStatus(state, options).canRevise;
}

export function bumpCouncilRevisionAttempt(state: ProcessingState): void {
  const current = getCouncilRevisionAttempts(state);

  state.executionArtifacts.criticalCouncil = {
    ...(state.executionArtifacts.criticalCouncil || {}),
    revisionAttempts: current + 1,
  };
}

export function hasCouncilLoopExhausted(
  state: ProcessingState,
  options: CouncilLoopGuardOptions = {},
): boolean {
  return getCouncilLoopStatus(state, options).exhausted;
}

export function resetCouncilRevisionAttempts(state: ProcessingState): void {
  state.executionArtifacts.criticalCouncil = {
    ...(state.executionArtifacts.criticalCouncil || {}),
    revisionAttempts: 0,
  };
}

export function assertCouncilRevisionAllowed(
  state: ProcessingState,
  options: CouncilLoopGuardOptions = {},
): void {
  const status = getCouncilLoopStatus(state, options);

  if (!status.exhausted) {
    return;
  }

  throw new Error(
    `Council revision loop exhausted: ${status.attempts}/${status.maxRevisions} attempts used.`,
  );
}

function normalizeAttemptCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.floor(value));
}

function normalizeMaxRevisions(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return MAX_COUNCIL_REVISIONS;
  }

  return Math.max(0, Math.floor(value));
}