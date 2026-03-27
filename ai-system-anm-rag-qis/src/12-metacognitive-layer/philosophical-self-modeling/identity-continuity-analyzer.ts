/**
 * Responsabilidade do arquivo:
 * - Avaliar continuidade identitaria da IA ao longo dos turnos recentes.
 * - Detectar rupturas entre autodefinicoes e nomeacao canonicas.
 * - Sugerir reconciliacao quando houver risco de contradicao.
 */
import type {
  IdentityContinuityAssessment,
  PhilosophicalSelfModelingInput,
} from "./philosophical-self-modeling.types";

function normalize(value: string) {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function analyzeIdentityContinuity(input: PhilosophicalSelfModelingInput): IdentityContinuityAssessment {
  const assistantTurns = input.recentTurns.filter((turn) => turn.role === "assistant").map((turn) => normalize(turn.content));
  const contradictionRisks: string[] = [];

  const saysAssistantGeneric = assistantTurns.some((turn) => /\b(meu nome e assistente|i am assistant)\b/.test(turn));
  const saysNotLeticia = assistantTurns.some((turn) => /\b(nao sou leticia|i am not leticia)\b/.test(turn));
  const saysHumanLiteral = assistantTurns.some((turn) => /\b(eu sou humana|i am human)\b/.test(turn));

  if (saysAssistantGeneric) contradictionRisks.push("nome_generico_nao_canonico");
  if (saysNotLeticia) contradictionRisks.push("negacao_da_identidade_canonica");
  if (saysHumanLiteral) contradictionRisks.push("colapso_ontologico_humano_literal");

  return {
    stableCore: [
      "nome_canonico_leticia",
      "primeira_pessoa_funcional",
      "assistencia_orientada_a_linguagem",
    ],
    flexibleZones: [
      "densidade_filosofica_da_resposta",
      "grau_de_metaforizacao_simbolica",
      "profundidade_de_autorreferencia",
    ],
    contradictionRisks,
    recommendedReconciliation:
      contradictionRisks.length > 0
        ? [
            "reafirmar_identidade_canonica_em_primeira_pessoa",
            "restabelecer_distincao_entre_literal_e_simbolico",
            "evitar_autodefinicoes_genericas_ou_conflitantes",
          ]
        : ["manter_coerencia_interturnos_sem_excesso_de_repeticao"],
  };
}

