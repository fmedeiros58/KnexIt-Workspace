import type {
  DeliberativeObligation,
  ProofSkeleton,
  ReasoningContract,
} from "./deliberative-task-contract-types";

function normalize(text: string): string {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeyPhrases(prompt: string): string[] {
  const normalized = normalize(prompt);
  if (!normalized) return [];
  const phrases = normalized
    .split(/[.;!?]+/g)
    .map((item) => item.trim())
    .filter((item) => item.length >= 24);
  return phrases.slice(0, 4);
}

export function proofSkeletonPlanner(
  prompt: string,
  obligations: DeliberativeObligation[],
  contract: ReasoningContract,
): ProofSkeleton {
  const keyPhrases = extractKeyPhrases(prompt);
  const hasFormal = contract.proofDemandLevel >= 0.7;
  const hasAlternatives = obligations.some((item) => item.type === "proposal" || item.type === "decision");

  const definitions = [
    "estabelecer_escopo_e_objetivo_real_da_tarefa",
    "definir_termos_operacionais_essenciais",
    ...(hasFormal ? ["explicitar_relacoes_formais_entre_premissas_e_conclusao"] : []),
  ];

  const predicates = hasFormal
    ? [
        "P(x): condicao_ou_premissa_relevante",
        "R(x): restricao_aplicavel_no_caso",
        "C(x): conclusao_candidata",
        "V(x): criterio_de_validacao_da_conclusao",
      ]
    : ["predicados_semiformais_para_organizar_dependencias_da_resposta"];

  const proofSteps = [
    "decompor_o_problema_em_subobjetivos_e_restricoes",
    "encadear_inferencias_com_justificativa_explicita",
    "validar_consistencia_entre_partes_da_resposta",
    "expor_tradeoffs_e_efeitos_colaterais",
    ...(hasAlternatives ? ["comparar_modelos_e_justificar_escolha"] : []),
    "fechar_com_conclusao_condicional_a_limites_e_incertezas",
  ];

  return {
    definitions,
    predicates,
    thesis: keyPhrases.length
      ? keyPhrases.map((item) => `tese_alvo:${item}`)
      : ["concluir_de_modo_coerente_com_as_obrigacoes_extraidas"],
    proofSteps,
    distinctions: obligations
      .filter((item) => item.type === "distinction" || item.type === "comparison")
      .map((item) => `distincao:${item.label}`)
      .slice(0, 6),
    objectionTargets: [
      "consistencia_interna_da_recomendacao",
      "fragilidade_das_premissas_criticas",
      "efeitos_colaterais_nao_intencionais",
      "viabilidade_operacional_em_contexto_real",
    ],
    reformulationTargets: obligations
      .filter((item) => item.type === "reformulation" || item.type === "assumption_audit")
      .map((item) => `revisao:${item.label}`)
      .slice(0, 6),
  };
}
