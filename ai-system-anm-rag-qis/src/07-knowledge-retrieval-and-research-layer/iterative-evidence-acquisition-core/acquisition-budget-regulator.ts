/**
 * Responsabilidade do arquivo:
 * - Controlar custo de aquisicao (calls, rounds, timeout, retries).
 * - Interromper fluxo quando budget for excedido.
 * - Fornecer criterio de parada orientado por suficiencia e redundancia.
 */
import type {
  BudgetRuntimeState,
  IterativeAcquisitionPolicy,
  SearchRoundExecution,
  SearchRoundKind,
} from "./iterative-acquisition-types";

export function createBudgetRuntimeState(): BudgetRuntimeState {
  return {
    callsUsed: 0,
    callsUsedByRound: {
      exploration: 0,
      focalization: 0,
      confirmation: 0,
      contrast: 0,
    },
    startedAt: Date.now(),
  };
}

export function canExecuteStage(
  policy: IterativeAcquisitionPolicy,
  runtime: BudgetRuntimeState,
  round: SearchRoundKind,
  estimatedCalls = 1,
): boolean {
  if ((runtime.callsUsed + estimatedCalls) > policy.searchBudget.maxCalls) return false;
  if ((runtime.callsUsedByRound[round] + estimatedCalls) > policy.searchBudget.perRoundCallCap) return false;
  return true;
}

export function registerExecution(
  runtime: BudgetRuntimeState,
  round: SearchRoundKind,
  callsUsed: number,
): void {
  runtime.callsUsed += callsUsed;
  runtime.callsUsedByRound[round] += callsUsed;
}

export function isTimeoutExceeded(policy: IterativeAcquisitionPolicy, runtime: BudgetRuntimeState): boolean {
  const elapsed = Date.now() - runtime.startedAt;
  return elapsed > policy.searchBudget.timeoutMs;
}

export function shouldStopByRedundancy(executedRounds: SearchRoundExecution[], latestNewEvidence: number): boolean {
  if (latestNewEvidence > 0) return false;
  if (executedRounds.length < 2) return false;
  const tail = executedRounds.slice(-2);
  return tail.every((row) => row.evidenceAdded === 0);
}

