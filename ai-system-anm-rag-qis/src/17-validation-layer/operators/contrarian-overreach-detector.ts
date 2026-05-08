/**
 * @file contrarian-overreach-detector.ts
 * @description Detecta contrarianismo artificial sem base suficiente.
 * @layer 17-validation-layer
 * @purpose Evitar oposicao gratuita quando o contrato pede equilibrio.
 * @inputs Resposta candidata e TaskContract.
 * @outputs Achados de contrarianismo excessivo.
 * @dependsOn bridges/contracts/task-contract, bridges/contracts/validation-report.
 * @usedBy validation-layer-bridge.
 * @invariants Nao deve penalizar contraponto fundamentado.
 * @notes Procura marcadores fortes de negacao sem evidencias ou criterios.
 */
import type { TaskContract } from "../../bridges/contracts/task-contract";
import type { TaskClassValidationFinding } from "../../bridges/contracts/validation-report";

export function detectContrarianOverreach(answer: string, contract: TaskContract | null): TaskClassValidationFinding[] {
  if (!contract?.needsCounterposition) return [];
  const negativeClaims = (answer.match(/\b(errado|falso|inaceit[aá]vel|sem fundamento|discordo totalmente)\b/gi) || []).length;
  const hasBasis = /\bporque|pois|criterio|crit[eé]rio|evid[eê]ncia|premissa|restri[cç][aã]o\b/i.test(answer);
  return negativeClaims >= 2 && !hasBasis
    ? [{
        validatorId: "contrarian-overreach-detector",
        severity: "warning",
        message: "contraponto forte sem base explicita",
      }]
    : [];
}

