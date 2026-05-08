/**
 * @file constraint-compliance-checker.ts
 * @description Verifica aderencia da resposta a restricoes explicitas e ao diagnostico logico do TaskContract.
 * @layer 17-validation-layer
 * @purpose Detectar quando a resposta ignora regras operacionais do enunciado, como orcamento de uma unica observacao.
 * @inputs Resposta final candidata e TaskContract.
 * @outputs Achados de validacao por classe.
 * @dependsOn bridges/contracts/task-contract, bridges/contracts/validation-report.
 * @usedBy validation-layer-bridge.
 * @invariants O checker nao deve reparar texto; apenas relata violacoes provaveis.
 * @notes A heuristica foca em violacoes operacionais e evita bloquear mencoes validas a caixas restantes por deducao.
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

export function checkConstraintCompliance(answer: string, contract: TaskContract | null): TaskClassValidationFinding[] {
  if (!contract?.explicitConstraints.length) return [];
  const findings: TaskClassValidationFinding[] = [];
  const normalized = normalizeValidationText(answer);
  const prohibited = new Set(contract.prohibitedActions);

  if (
    prohibited.has("discursar_sem_resolver") &&
    normalized.length > 800 &&
    !/\b(resposta|solucao|portanto|logo)\b/.test(normalized)
  ) {
    findings.push({
      validatorId: "constraint-compliance-checker",
      severity: "error",
      message: "resposta longa sem marcador de solucao para tarefa de restricao fechada",
    });
  }

  if (
    /\b(apenas|somente|so)\b/.test(normalizeValidationText(contract.explicitConstraints.join(" "))) &&
    /\b(vamos testar|pode tentar|experimentos|outras caixas)\b/.test(normalized)
  ) {
    findings.push({
      validatorId: "constraint-compliance-checker",
      severity: "error",
      message: "resposta sugere acao alem da restricao de apenas uma observacao",
    });
  }

  const actionBudget = contract.logicalAdequacy?.actionBudget;
  const hasSingleObservationBudget = actionBudget?.maxActions === 1 || actionBudget?.maxObservations === 1;
  const suggestsAdditionalTarget =
    /\b(?:repita|repetir|faca o mesmo|fazer o mesmo|novamente)\b.{0,120}\b(?:caixa|amostra|observacao|retirada|teste|testar)\b/.test(normalized) ||
    /\b(?:tire|retire|pegue|observe|olhe|abra|verifique|teste|testar)\b.{0,120}\b(?:outra caixa|outras caixas|caixa restante|demais caixas|segunda caixa|terceira caixa)\b/.test(normalized);

  if (hasSingleObservationBudget && prohibited.has("iterative_exploration") && suggestsAdditionalTarget) {
    findings.push({
      validatorId: "constraint-compliance-checker",
      severity: "error",
      message: "resposta usa exploracao iterativa apesar de haver orcamento de uma unica acao ou observacao",
    });
  }

  if (
    hasSingleObservationBudget &&
    prohibited.has("extra_observation") &&
    /\b(?:segunda|terceira|nova|outra|mais uma)\s+(?:amostra|observacao|retirada|pergunta|consulta)\b/.test(normalized)
  ) {
    findings.push({
      validatorId: "constraint-compliance-checker",
      severity: "error",
      message: "resposta sugere observacao adicional proibida pelo contrato da tarefa",
    });
  }

  if (
    prohibited.has("random_choice") &&
    /\b(?:aleatori[ao]|qualquer caixa|caixa qualquer|uma caixa qualquer|uma caixa aleatoria)\b/.test(normalized)
  ) {
    findings.push({
      validatorId: "constraint-compliance-checker",
      severity: "error",
      message: "resposta escolhe ponto de partida arbitrario em tarefa logica fechada",
    });
  }

  if (
    prohibited.has("discursive_plausibility") &&
    /\b(?:abordagem consistente|opcoes possiveis|pode tentar|tentar testar|experimentos|eliminar combinacoes|hipoteses)\b/.test(normalized)
  ) {
    findings.push({
      validatorId: "constraint-compliance-checker",
      severity: "warning",
      message: "resposta privilegia plausibilidade discursiva em vez de prova curta sob restricoes",
    });
  }

  return findings;
}
