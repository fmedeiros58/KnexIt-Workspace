/**
 * @file first-answer-challenge.ts
 * @description Executa autocritica curta sobre a primeira formulacao da resposta.
 * @layer 10-reflective-layer
 * @purpose Checar se a resposta resolve a tarefa, respeita restricoes, evita exploracao indevida e usa o regime correto.
 * @inputs Resposta candidata e TaskContract.
 * @outputs SelfCritiqueReport.
 * @dependsOn bridges/contracts/task-contract, bridges/contracts/validation-report.
 * @usedBy validation-layer-bridge e auditoria.
 * @invariants A autocritica e curta e nao deve entrar em reflexao infinita.
 * @notes Produz achados acionaveis para validacao; nao reescreve a resposta.
 */
import type { TaskContract } from "../../bridges/contracts/task-contract";
import type { SelfCritiqueReport } from "../../bridges/contracts/validation-report";

function normalizeCritiqueText(value: string): string {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function hasExploratoryStrategy(value: string): boolean {
  return /\b(alternativamente|por exemplo|tente testar|pode tentar|experimentos|em seguida|repita|novamente|caixa aleatoria|qualquer caixa|eliminar combinacoes|hipoteses)\b/.test(value);
}

function hasExtraObservationAction(value: string): boolean {
  return (
    /\b(?:repita|repetir|faca o mesmo|fazer o mesmo|novamente)\b.{0,120}\b(?:caixa|amostra|observacao|retirada|teste|testar)\b/.test(value) ||
    /\b(?:tire|retire|pegue|observe|olhe|abra|verifique|teste|testar)\b.{0,120}\b(?:outra caixa|outras caixas|caixa restante|demais caixas|segunda caixa|terceira caixa|outra amostra|segunda amostra)\b/.test(value)
  );
}

export function challengeFirstAnswer(answer: string, contract: TaskContract | null): SelfCritiqueReport {
  const findings: string[] = [];
  const text = `${answer || ""}`;
  const normalized = normalizeCritiqueText(text);

  if (!contract) {
    return { findings: ["task_contract_missing"], shouldRevise: false, score: 0.5 };
  }

  if (contract.cognitiveTaskType === "closed_constraint_deduction" && normalized.length > 900) {
    findings.push("deducao_fechada_esta_longa_demais");
  }
  if (contract.prohibitedActions.includes("discursar_sem_resolver") && /\b(voce pode tentar|experimentos|em seguida)\b/.test(normalized)) {
    findings.push("resposta_fala_sobre_metodo_em_vez_de_resolver");
  }
  if (contract.explicitConstraints.length > 0 && /\b(sem considerar as restricoes|ignorando)\b/.test(normalized)) {
    findings.push("possivel_violacao_de_restricao_explicita");
  }
  if (
    contract.logicalAdequacy?.actionBudget.maxObservations === 1 &&
    hasExtraObservationAction(normalized)
  ) {
    findings.push("violacao_do_orcamento_de_observacao_unica");
  }
  if (
    contract.logicalAdequacy?.requiresPivotSelection &&
    contract.prohibitedActions.includes("random_choice") &&
    /\b(?:aleatoria|aleatorio|qualquer caixa|caixa qualquer)\b/.test(normalized)
  ) {
    findings.push("faltou_identificar_passo_pivo_informativo");
  }
  if (
    contract.logicalAdequacy?.regime === "closed_constraint_deduction" &&
    hasExploratoryStrategy(normalized)
  ) {
    findings.push("modo_exploratorio_usado_em_tarefa_fechada");
  }
  if (contract.needsCounterposition && !/\b(porem|limite|objecao|por outro lado|contra)\b/.test(normalized)) {
    findings.push("faltou_contraponto_necessario");
  }
  if (!contract.needsCounterposition && /\b(discordo totalmente|isso esta errado)\b/.test(normalized)) {
    findings.push("possivel_contraponto_sem_base_contratual");
  }
  if (hasExploratoryStrategy(normalized) && contract.cognitiveTaskType === "closed_constraint_deduction") {
    findings.push("existe_resposta_mais_curta_e_deterministica");
  }

  const score = Number(Math.max(0, 1 - findings.length * 0.18).toFixed(4));
  return {
    findings,
    shouldRevise: findings.some((item) => /violacao|faltou|resolver|deterministica|longa|exploratorio/i.test(item)),
    score,
  };
}
