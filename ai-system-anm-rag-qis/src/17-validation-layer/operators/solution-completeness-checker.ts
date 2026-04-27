/**
 * @file solution-completeness-checker.ts
 * @description Verifica completude minima da solucao conforme a classe cognitiva e o diagnostico logico.
 * @layer 17-validation-layer
 * @purpose Detectar resposta que fala sobre o problema sem resolve-lo ou sem explicitar a prova curta exigida.
 * @inputs Resposta candidata e TaskContract.
 * @outputs Achados de completude.
 * @dependsOn bridges/contracts/task-contract, bridges/contracts/validation-report.
 * @usedBy validation-layer-bridge.
 * @invariants Nao deve hardcodar entidades de um enigma especifico; valida a estrutura da solucao.
 * @notes Para deducao fechada exige conclusao, restricao visivel e, quando aplicavel, passo-pivo.
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

export function checkSolutionCompleteness(answer: string, contract: TaskContract | null): TaskClassValidationFinding[] {
  if (!contract) return [];
  const findings: TaskClassValidationFinding[] = [];
  const normalized = normalizeValidationText(answer);

  if (contract.cognitiveTaskType === "closed_constraint_deduction") {
    const hasConclusion = /\b(portanto|logo|resposta|solucao|retire|tire|pegue|a caixa|as caixas|a opcao|as opcoes)\b/.test(normalized);
    const hasConstraintUse = /\b(apenas|somente|unica|unico|restricao|etiqueta|rotulo|errad[ao]s?|nao pode|sem olhar|sem abrir)\b/.test(normalized);
    const hasElimination = /\b(eliminacao|exclusao|deduz|determina|restante|outras duas|por isso|com isso)\b/.test(normalized);
    const hasPivot = /\b(rotulad[ao]|etiquetad[ao]|pivo|mais informativ[ao]|retire da|tire da|pegue da|comece pela)\b/.test(normalized);

    if (!hasConclusion || !hasConstraintUse || !hasElimination) {
      findings.push({
        validatorId: "solution-completeness-checker",
        severity: "error",
        message: "deducao fechada sem conclusao, restricao usada ou fechamento por eliminacao",
      });
    }

    if (contract.logicalAdequacy?.requiresPivotSelection && !hasPivot) {
      findings.push({
        validatorId: "solution-completeness-checker",
        severity: "warning",
        message: "deducao fechada nao explicita a escolha-pivo exigida pela restricao informativa",
      });
    }
  }

  if (contract.cognitiveTaskType === "procedural_instruction" && !/(^|\n)\s*(1\.|-|\*)\s+/m.test(answer)) {
    findings.push({
      validatorId: "solution-completeness-checker",
      severity: "warning",
      message: "instrucao procedural sem passos identificaveis",
    });
  }

  return findings;
}
