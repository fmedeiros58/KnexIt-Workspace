/**
 * @file task-mode-fit-validator.ts
 * @description Valida se a forma da resposta combina com a natureza cognitiva e com o diagnostico logico da tarefa.
 * @layer 17-validation-layer
 * @purpose Reduzir respostas discursivas ou exploratorias quando a tarefa pede resolver, depurar ou decidir.
 * @inputs Resposta candidata e TaskContract.
 * @outputs Achados de adequacao tarefa-formato.
 * @dependsOn bridges/contracts/task-contract, bridges/contracts/validation-report.
 * @usedBy validation-layer-bridge.
 * @invariants A validacao avalia fit de modo; nao reclassifica a tarefa.
 * @notes Ajuda a bloquear genericidade por escolha errada de regime cognitivo.
 */
import type { TaskContract } from "../../bridges/contracts/task-contract";
import type { TaskClassValidationFinding } from "../../bridges/contracts/validation-report";

function normalizeValidationText(value: string): string {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasExploratoryStrategy(value: string): boolean {
  return /\b(alternativamente|pode tentar|tente testar|experimentos|em seguida|repita|novamente|caixa aleatoria|qualquer caixa|eliminar combinacoes|hipoteses)\b/.test(value);
}

export function validateTaskModeFit(answer: string, contract: TaskContract | null): TaskClassValidationFinding[] {
  if (!contract) return [];
  const findings: TaskClassValidationFinding[] = [];
  const normalized = normalizeValidationText(answer);

  if (contract.deliveryRegime === "direct" && normalized.length > 1200 && hasExploratoryStrategy(normalized)) {
    findings.push({
      validatorId: "task-mode-fit-validator",
      severity: "warning",
      message: "resposta em modo discursivo para tarefa que pediu entrega direta",
    });
  }

  if (
    contract.logicalAdequacy?.regime === "closed_constraint_deduction" &&
    contract.logicalAdequacy.forbiddenStrategies.some((item) => item === "iterative_exploration" || item === "random_choice") &&
    hasExploratoryStrategy(normalized)
  ) {
    findings.push({
      validatorId: "task-mode-fit-validator",
      severity: "error",
      message: "tarefa logica fechada foi respondida em modo exploratorio ou arbitrario",
    });
  }

  if (
    contract.logicalAdequacy?.requiresPivotSelection &&
    !/\b(rotulad|etiquetad|pivo|decisiv|mais informativ|comece pela|retire da|tire da)\b/.test(normalized) &&
    hasExploratoryStrategy(normalized)
  ) {
    findings.push({
      validatorId: "task-mode-fit-validator",
      severity: "warning",
      message: "resposta nao evidencia passo-pivo em tarefa com restricao informativa",
    });
  }

  if (contract.cognitiveTaskType === "debug_and_correction" && !/\b(causa|correcao|corrig|falha|arquivo|linha)\b/.test(normalized)) {
    findings.push({
      validatorId: "task-mode-fit-validator",
      severity: "warning",
      message: "resposta de debug sem causa ou correcao identificavel",
    });
  }

  return findings;
}
