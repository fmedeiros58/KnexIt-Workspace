/**
 * ESPECIFICAÇÃO DO ARQUIVO
 * ------------------------
 * Nome: reasoning-contract-builder.ts
 * Camada: 05b-deliberative-task-contract-layer
 *
 * Responsabilidade principal:
 * - Construir o contrato deliberativo de raciocínio a partir de sinais de profundidade argumentativa,
 *   obrigações deliberativas detectadas e, opcionalmente, do perfil de demanda cognitiva.
 *
 * Função no pipeline:
 * - Este arquivo NÃO gera a resposta final do usuário.
 * - Este arquivo NÃO deve expor metainstruções na superfície textual.
 * - Este arquivo define apenas a arquitetura interna de raciocínio que será usada pelas etapas
 *   seguintes de validação, normalização e entrega.
 *
 * Entradas:
 * - depth: resultado consolidado da profundidade argumentativa do prompt.
 * - obligations: conjunto de obrigações deliberativas detectadas para a tarefa.
 * - profile: perfil cognitivo opcional contendo intensidade, complexidade e demandas adicionais.
 *
 * Saída:
 * - Um objeto ReasoningContract com:
 *   - modo-alvo de resposta interna;
 *   - arquitetura interna de raciocínio;
 *   - seções requeridas;
 *   - transições esperadas;
 *   - atalhos proibidos;
 *   - níveis de exigência de prova e objeção;
 *   - política de incerteza;
 *   - política de assunções;
 *   - limiar mínimo de cobertura;
 *   - ordem preferencial de organização interna;
 *   - critérios de terminação;
 *   - política de superfície para evitar vazamentos do scaffold interno.
 *
 * Regras centrais de projeto:
 * 1) O contrato deliberativo deve organizar o raciocínio sem “engessar” a superfície textual.
 * 2) O modo formal só deve ser ativado quando houver sinais combinados suficientes.
 * 3) O arquivo deve reduzir vazamento de seções literais para a resposta final.
 * 4) O arquivo deve favorecer fluxo natural de resposta, preservação do idioma do usuário
 *    e bloqueio de metadiscurso visível.
 *
 * Garantias esperadas:
 * - Evitar ativação formal excessiva.
 * - Evitar exposição de scaffolding interno na resposta ao usuário.
 * - Tornar explícitos os critérios que justificam a escolha do targetMode.
 * - Produzir contratos estáveis, previsíveis e auditáveis.
 *
 * Não-objetivos:
 * - Não realizar extração de obrigações.
 * - Não validar cobertura final.
 * - Não normalizar a redação final.
 * - Não detectar idioma do usuário diretamente; apenas impor a preservação como política.
 *
 * Observação de auditoria:
 * - Sempre que thresholds ou gatilhos de modo forem alterados, este bloco deve ser revisado
 *   para manter aderência entre implementação e intenção arquitetural.
 */

import type {
  ArgumentativeDepthResult,
  CognitiveDemandProfile,
  DeliberativeObligation,
  ReasoningContract,
} from "./deliberative-task-contract-types";

/**
 * Normaliza um valor contínuo para o intervalo [0, 1].
 * Usado para manter os scores do contrato dentro de uma faixa estável e comparável.
 */
function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/**
 * Verifica se existe ao menos uma obrigação do tipo informado.
 * Isso permite construir regras declarativas e legíveis no builder.
 */
function hasType(
  obligations: DeliberativeObligation[],
  type: DeliberativeObligation["type"],
): boolean {
  return obligations.some((item) => item.type === type);
}

/**
 * Adiciona um item apenas se ele ainda não estiver presente.
 * Evita duplicação na arquitetura interna de seções.
 */
function pushUnique(target: string[], value: string): void {
  if (!target.includes(value)) {
    target.push(value);
  }
}

/**
 * Conta quantos sinais booleanos foram ativados.
 * É usado para reduzir decisões frágeis baseadas em um único gatilho.
 */
function countTrue(values: boolean[]): number {
  return values.filter(Boolean).length;
}

/**
 * Constrói o contrato deliberativo de raciocínio.
 *
 * Estratégia:
 * - Primeiro consolida sinais locais derivados das obrigações.
 * - Depois estima intensidade e complexidade do caso.
 * - Em seguida calcula sinais agregados para decidir o modo-alvo.
 * - Por fim define seções, transições, níveis de exigência e política de superfície.
 *
 * Decisão arquitetural importante:
 * - O builder privilegia o uso de múltiplos sinais combinados para entrar em modo mais formal,
 *   evitando que qualquer pequena obrigação empurre a resposta para uma estrutura artificial.
 */
export function reasoningContractBuilder(
  depth: ArgumentativeDepthResult,
  obligations: DeliberativeObligation[],
  profile?: CognitiveDemandProfile,
): ReasoningContract {
  const hasExplanation = hasType(obligations, "explanation");
  const hasDemonstration = hasType(obligations, "demonstration");
  const hasDistinction = hasType(obligations, "distinction");
  const hasComparison = hasType(obligations, "comparison");
  const hasProposal = hasType(obligations, "proposal");
  const hasPlanning = hasType(obligations, "planning");
  const hasDecision = hasType(obligations, "decision");
  const hasEvaluation = hasType(obligations, "evaluation");
  const hasObjection = hasType(obligations, "objection");
  const hasReformulation = hasType(obligations, "reformulation");
  const hasAssumptionAudit = hasType(obligations, "assumption_audit");

  const reasoningIntensity = profile?.reasoningIntensity ?? 0;
  const structuralComplexity = profile?.structuralComplexity ?? 0;
  const depthScore = depth.argumentativeDepthScore;

  /**
   * Faixas de profundidade:
   * - moderateDepth: caso já merece estrutura argumentativa mais estável.
   * - highDepth: caso admite contrato mais denso e eventualmente formal.
   */
  const moderateDepth = depthScore >= 0.42 || reasoningIntensity >= 0.45;
  const highDepth = depthScore >= 0.68 || reasoningIntensity >= 0.7 || structuralComplexity >= 0.66;

  /**
   * Sinais de formalização:
   * - exigência explícita de formalização
   * - necessidade demonstrativa
   * - demanda cognitiva de prova/justificação
   * - necessidade de contra-argumentação robusta
   *
   * A ideia aqui é evitar que um único fator isolado force o targetMode formal.
   */
  const formalSignalCount = countTrue([
    depth.needsFormalization,
    hasDemonstration,
    profile?.requiresFormalization ?? false,
    profile?.cognitiveDemands.includes("proof_or_justification") ?? false,
    profile?.cognitiveDemands.includes("counter_argumentation") ?? false,
  ]);

  /**
   * Sinais de estrutura deliberativa:
   * - necessidade de contrato deliberativo
   * - necessidade de cobertura estruturada
   * - necessidade de objeção ou auditoria de assunções
   * - presença de múltiplas obrigações
   *
   * Aqui o objetivo é diferenciar “resposta comum” de “resposta que precisa de disciplina interna”.
   */
  const structuredSignalCount = countTrue([
    depth.requiresDeliberativeContract,
    depth.needsStructuredCoverage,
    depth.needsCounterObjection,
    depth.needsAssumptionAudit,
    profile?.requiresDeliberativeContract ?? false,
    profile?.requiresStructuredCoverage ?? false,
    profile?.requiresSelfObjection ?? false,
    profile?.requiresAssumptionAudit ?? false,
    obligations.length >= 3,
  ]);

  /**
   * requiredSections representa a macroestrutura interna.
   * Importante:
   * - isso não deve ser despejado literalmente para a superfície textual do usuário;
   * - trata-se de um scaffold lógico, não de um template final visível.
   */
  const requiredSections: string[] = [];

  pushUnique(requiredSections, "direct_answer_or_frame");

  if (hasExplanation || hasDemonstration || hasComparison || hasEvaluation || hasDecision) {
    pushUnique(requiredSections, "core_reasoning");
  }

  if ((hasDemonstration || depth.needsFormalization) && highDepth) {
    pushUnique(requiredSections, "reasoning_chain_or_proof");
  }

  if ((hasDistinction || hasComparison) && moderateDepth) {
    pushUnique(requiredSections, "critical_distinctions");
  }

  if (hasProposal || hasPlanning || hasDecision) {
    pushUnique(requiredSections, "options_or_plan");
  }

  if (hasEvaluation || hasDecision || profile?.cognitiveDemands.includes("tradeoff_analysis")) {
    pushUnique(requiredSections, "tradeoffs_and_impacts");
  }

  if ((hasObjection || depth.needsCounterObjection || profile?.requiresSelfObjection) && highDepth) {
    pushUnique(requiredSections, "strong_self_objection");
  }

  if (hasReformulation && moderateDepth) {
    pushUnique(requiredSections, "reformulation_under_uncertainty");
  }

  if ((hasAssumptionAudit || depth.needsAssumptionAudit || profile?.requiresAssumptionAudit) && highDepth) {
    pushUnique(requiredSections, "assumption_and_limit_ledger");
  }

  pushUnique(requiredSections, "conclusion");

  /**
   * proofDemandLevel:
   * - mede o quanto a resposta precisa ir além de afirmações e oferecer sustentação.
   *
   * objectionStrengthLevel:
   * - mede o quanto a resposta deve ser capaz de tensionar a si mesma com objeções reais,
   *   e não apenas ornamentais.
   */
  const proofDemandLevel = clamp01(
    (depthScore * 0.58) +
      (depth.needsFormalization ? 0.2 : 0.04) +
      (hasDemonstration ? 0.12 : 0) +
      ((profile?.cognitiveDemands.includes("proof_or_justification") ?? false) ? 0.08 : 0),
  );

  const objectionStrengthLevel = clamp01(
    (depthScore * 0.52) +
      (depth.needsCounterObjection ? 0.18 : 0.03) +
      (hasObjection ? 0.12 : 0) +
      ((profile?.requiresSelfObjection ?? false) ? 0.08 : 0),
  );

  /**
   * minCoverageThreshold:
   * - cresce conforme a tarefa acumula obrigações;
   * - recebe leve viés do perfil cognitivo;
   * - permanece contido para não inviabilizar a execução em tarefas médias.
   */
  const baseThreshold =
    obligations.length >= 6
      ? 0.86
      : obligations.length >= 4
        ? 0.8
        : obligations.length >= 2
          ? 0.72
          : 0.64;

  const profileBias = Math.min(0.07, reasoningIntensity * 0.08);

  /**
   * Decisão do modo-alvo:
   * - formal_analytical só com profundidade alta + sinais formais combinados;
   * - argumentative_structured quando há necessidade de disciplina argumentativa,
   *   mas sem rigidez formal máxima;
   * - conversational quando o caso não exige scaffold deliberativo pesado.
   */
  const targetMode =
    highDepth && formalSignalCount >= 2
      ? "formal_analytical"
      : moderateDepth || structuredSignalCount >= 2
        ? "argumentative_structured"
        : "conversational";

  /**
   * responseArchitecture é deliberadamente abstrata.
   * Ela não deve espelhar literalmente o encadeamento de seções,
   * para evitar contaminação da superfície textual final.
   */
  const responseArchitecture =
    targetMode === "formal_analytical"
      ? "disciplined_deliberative_analysis"
      : targetMode === "argumentative_structured"
        ? "structured_natural_argument"
        : "natural_progressive_response";

  /**
   * requiredTransitions explicita a ordem lógica mínima esperada entre blocos internos.
   * Isso melhora auditoria e depuração sem forçar a aparência final da resposta.
   */
  const requiredTransitions = requiredSections.slice(0, -1).map((section, index) => {
    return `${section}_to_${requiredSections[index + 1]}`;
  });

  return {
    targetMode,
    responseArchitecture,
    requiredSections,
    requiredTransitions,
    prohibitedShortcuts: [
      "assertion_without_support",
      "single_path_when_alternatives_required",
      "decorative_objection",
      "conclusion_without_constraints_or_limits",
      "overcompression_of_multi_obligation_task",
      "meta_instruction_exposure",
      "literal_section_dump",
      "persona_invention",
      "language_drift",
      "unfinished_enumeration",
    ],
    proofDemandLevel: Number(proofDemandLevel.toFixed(4)),
    objectionStrengthLevel: Number(objectionStrengthLevel.toFixed(4)),
    uncertaintyHandlingMode:
      hasReformulation || (profile?.cognitiveDemands.includes("uncertainty_handling") ?? false)
        ? highDepth
          ? "explicit_but_natural"
          : "lightweight_acknowledgement"
        : "standard",
    assumptionDisclosureMode:
      hasAssumptionAudit || depth.needsAssumptionAudit
        ? highDepth
          ? "explicit_only_if_material"
          : "minimal"
        : "minimal",
    minCoverageThreshold: Number(clamp01(baseThreshold + profileBias).toFixed(4)),
    preferredAnswerOrder:
      targetMode === "conversational"
        ? ["direct_answer_or_frame", "core_reasoning", "conclusion"]
        : targetMode === "argumentative_structured"
          ? [
              "direct_answer_or_frame",
              "core_reasoning",
              "critical_distinctions",
              "tradeoffs_and_impacts",
              "conclusion",
            ]
          : [
              "direct_answer_or_frame",
              "core_reasoning",
              "reasoning_chain_or_proof",
              "critical_distinctions",
              "tradeoffs_and_impacts",
              "conclusion",
            ],
    terminationCriteria: [
      "complete_last_sentence",
      "no_open_enumeration",
      "no_placeholder_sections",
      "no_meta_instruction_visible",
      "preserve_user_language",
      "no_forced_persona",
    ],
    surfacePolicy: {
      preserveUserLanguage: true,
      forbidPersonaInjection: true,
      hideMetaInstructions: true,
      avoidEnumeratedScaffolding: true,
      preferNaturalParagraphFlow: true,
      blockIfAbruptlyTruncated: true,
    },
  };
}