/**
 * @file dialogical-balance-checker.ts
 * @description Verifica equilibrio dialogico quando a tarefa exige contraponto.
 * @layer 17-validation-layer
 * @purpose Garantir que contraponto tenha base e que concordancia nao seja automatica.
 * @inputs Resposta candidata e TaskContract.
 * @outputs Achados de equilibrio dialogico.
 * @dependsOn bridges/contracts/task-contract, bridges/contracts/validation-report.
 * @usedBy validation-layer-bridge.
 * @invariants O checker nao deve forcar discordancia quando o contrato nao pede.
 * @notes Complementa yes-man e contrarian-overreach.
 */
import type { TaskContract } from "../../bridges/contracts/task-contract";
import type { TaskClassValidationFinding } from "../../bridges/contracts/validation-report";

export function checkDialogicalBalance(answer: string, contract: TaskContract | null): TaskClassValidationFinding[] {
  if (!contract?.needsCounterposition) return [];
  const hasCounterSignal = /\b(por outro lado|contra|objec[aã]o|limite|problema|discord|porem|por[eé]m)\b/i.test(answer);
  return hasCounterSignal
    ? []
    : [{
        validatorId: "dialogical-balance-checker",
        severity: "error",
        message: "tarefa dialetica sem contraponto identificavel",
      }];
}

