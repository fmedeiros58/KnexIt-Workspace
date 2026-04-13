import type { DeliberativeObligation, SolutionModel } from "./deliberative-task-contract-types";

function normalize(text: string): string {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function shouldExpandSolutionSpace(prompt: string, obligations: DeliberativeObligation[]): boolean {
  const normalized = normalize(prompt);
  if (/\b(modelos?|alternativas?|opcoes|compare|escolha|priorize|qual abordagem)\b/.test(normalized)) return true;
  return obligations.some((item) => ["proposal", "comparison", "decision", "planning"].includes(item.type));
}

function inferDominantObjective(prompt: string): string {
  const normalized = normalize(prompt);
  if (/\b(custo|economi[ac]|gastar menos)\b/.test(normalized)) return "eficiencia_de_custo";
  if (/\b(tempo|rapido|prazo)\b/.test(normalized)) return "eficiencia_de_tempo";
  if (/\b(seguranca|risco|confianca)\b/.test(normalized)) return "reducao_de_risco";
  if (/\b(qualidade|precisao|rigor)\b/.test(normalized)) return "maximizacao_de_qualidade";
  return "equilibrio_multicriterio";
}

export function solutionSpaceExpander(prompt: string, obligations: DeliberativeObligation[]): SolutionModel[] {
  if (!shouldExpandSolutionSpace(prompt, obligations)) return [];
  const dominantObjective = inferDominantObjective(prompt);

  const models: SolutionModel[] = [
    {
      id: "model_objective_first",
      title: "Modelo Objetivo Dominante com Restricoes",
      normativeCore: `priorizar_${dominantObjective}_sem_violar_restricoes_criticas`,
      operationalMechanism: "filtrar_opcoes_inviaveis_e_otimizar_no_subconjunto_valido",
      leastSacrificedPrinciple: "clareza_de_priorizacao",
      mostTensionedPrinciple: "equilibrio_entre_criterios_secundarios",
      logicalRisk: "hiperfoco_em_um_criterio_pode_subotimizar_o_sistema",
      moralRisk: "impactos_distributivos_podem_ficar_subavaliados",
      institutionalRisk: "resistencia_organizacional_a_hierarquizacao_explicita",
    },
    {
      id: "model_balanced_mcdm",
      title: "Modelo de Equilibrio Multicriterio",
      normativeCore: "ponderar_criterios_com_pesos_justificados_e_revisaveis",
      operationalMechanism: "matriz_multicriterio_com_analise_de_sensibilidade",
      leastSacrificedPrinciple: "equidade_entre_objetivos_concorrentes",
      mostTensionedPrinciple: "simplicidade_decisoria",
      logicalRisk: "dependencia_da_calibragem_dos_pesos",
      moralRisk: "pesos_podem_embutir_vieses_normativos",
      institutionalRisk: "custo_de_governanca_e_manutencao_do_modelo",
    },
    {
      id: "model_robust_adaptive",
      title: "Modelo Robusto Adaptativo",
      normativeCore: "maximizar_robustez_sob_incerteza_com_revisao_iterativa",
      operationalMechanism: "decisao_por_faixas_e_gatilhos_de_recalibracao",
      leastSacrificedPrinciple: "resiliencia_ao_erro_de_estimacao",
      mostTensionedPrinciple: "otimo_imediato_de_curto_prazo",
      logicalRisk: "pode_entregar_solucoes_conservadoras_demais",
      moralRisk: "custos_presentes_para_evitar_riscos_futuros_incerto",
      institutionalRisk: "exige_monitoramento_continuo_e_dados_confiaveis",
    },
  ];

  return models.slice(0, 3);
}
