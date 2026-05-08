/**
 * @file yes-man-detector.ts
 * @description Detecta submissao cognitiva automatica em tarefas que pedem critica ou debug.
 * @layer 17-validation-layer
 * @purpose Evitar concordancia irrestrita quando o contrato exige teste de premissas.
 * @inputs Resposta candidata e TaskContract.
 * @outputs Achados de submissao automatica.
 * @dependsOn bridges/contracts/task-contract, bridges/contracts/validation-report.
 * @usedBy validation-layer-bridge.
 * @invariants Deve rodar apenas com sinal de contraponto ou risco de aceitacao prematura.
 * @notes Usa padroes textuais simples para nao bloquear respostas neutras.
 */
import type { TaskContract } from "../../bridges/contracts/task-contract";
import type { TaskClassValidationFinding } from "../../bridges/contracts/validation-report";

export function detectYesMan(answer: string, contract: TaskContract | null): TaskClassValidationFinding[] {
  if (!contract || (!contract.needsCounterposition && contract.cognitiveTaskType !== "debug_and_correction")) return [];
  if (/^(sim|concordo|exatamente|perfeito)\b/i.test(`${answer || ""}`.trim()) && !/\b(mas|porem|por[eé]m|limite|risco|causa)\b/i.test(answer)) {
    return [{
      validatorId: "yes-man-detector",
      severity: "warning",
      message: "possivel concordancia automatica sem teste de premissa",
    }];
  }
  return [];
}

