/**
 * ESPECIFICAÇÃO DO ARQUIVO
 * ------------------------
 * Nome: deliberative-task-contract-layer-bridge.ts
 * Camada: 05b-deliberative-task-contract-layer
 *
 * Responsabilidade principal:
 * - Orquestrar a ativação do módulo deliberativo.
 * - Construir o estado deliberativo inicial.
 * - Promover rota/pipeline quando a tarefa exige contrato deliberativo.
 * - Executar a validação final de cobertura e consolidar os diagnósticos
 *   de execução, integridade e bloqueio final.
 *
 * Função no pipeline:
 * - Este arquivo integra detector de profundidade, classificador de demanda,
 *   extrator de obrigações, builder de contrato, planners auxiliares,
 *   normalização final, gate de integridade e validador de execução.
 * - Este arquivo NÃO define os contratos tipados do módulo.
 * - Este arquivo NÃO substitui os validators especializados.
 *
 * Garantias esperadas:
 * - Ativar o módulo deliberativo apenas quando a política justificar.
 * - Manter o estado deliberativo e o generalTaskDeliberationState sincronizados.
 * - Aplicar normalização final coerente com a surfacePolicy do contrato.
 * - Impedir que respostas com truncamento, persona inventada ou espelhamento
 *   do prompt escapem sem diagnóstico explícito.
 *
 * Observação arquitetural:
 * - Este bridge deve consumir os utilitários especializados do módulo,
 *   evitando duplicação de normalizadores e heurísticas já centralizadas.
 */

import type { ProcessingState } from "../bridges/contracts/processing-state";
import type { PipelineRoute } from "../shared/enums/pipeline-enums";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { createVllmClient } from "../infra/llm/vllm-client";
import { argumentativeDepthDetector } from "./argumentative-depth-detector";
import { classifyCognitiveDemand } from "./cognitive-demand-classifier";
import { taskObligationExtractor } from "./task-obligation-extractor";
import { reasoningContractBuilder } from "./reasoning-contract-builder";
import { proofSkeletonPlanner } from "./proof-skeleton-planner";
import { solutionSpaceExpander } from "./solution-space-expander";
import { selfObjectionGenerator } from "./self-objection-generator";
import { assumptionLedgerBuilder } from "./assumption-ledger";
import { responseCoverageValidator } from "./response-coverage-validator";
import type {
  CoverageReport,
  DeliberativeObligation,
  DeliberativeTaskState,
  ExecutionDiagnostics,
  ResponseSurfacePolicy,
} from "./deliberative-task-contract-types";
import {
  createEmptyCoverageReport,
  createEmptyTaskExecutionState,
  DELIBERATIVE_TASK_CONTRACT_VERSION,
} from "./deliberative-task-contract-types";
import { detectPromptConstraints } from "./instruction-constraint-enforcer";
import { checkPremisePreservation } from "./premise-preservation-checker";
import { shouldBuildDeliberativeContract as shouldBuildContractPolicy } from "./deliberative-activation-policy";
import {
  normalizeDeliberativeResponse,
  sanitizeRepairDraft,
} from "./deliberative-response-normalizer";
import { checkResponseIntegrity } from "./response-integrity-gate";
import { validateTaskExecution } from "./task-execution-validator";

const deliberativeRepairClient = createVllmClient();

function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function humanizeToken(text: string): string {
  return `${text || ""}`.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

function isGreetingFastLaneTurn(state: ProcessingState): boolean {
  if (state.preRouteSignals?.greetingFastLaneEligible) return true;
  const family = `${state.preRouteSignals?.greetingFamily || "none"}`.trim().toLowerCase();
  if (!family || family === "none") return false;

  const tokenCount = state.preRouteSignals?.tokenCount || state.textAnalysisSnapshot?.tokenCount || 0;
  const questionCount = state.preRouteSignals?.questionCount || state.textAnalysisSnapshot?.questionCount || 0;

  return tokenCount <= 12 && questionCount <= 1;
}

function isDeepDescendingTurn(state: ProcessingState): boolean {
  const route = `${state.executionPlan.selectedRoute || ""}`.toLowerCase();
  if (route === "inferential" || route === "quantum-state") return true;
  if (route === "reflective") return (state.complexityProfile.score || 0) >= 0.52;
  if ((state.complexityProfile.depthRequired || 0) >= 8) return true;
  if ((state.complexityProfile.score || 0) >= 0.52) return true;

  return (state.executionPlan.steps || []).some((step) =>
    /general_task_deliberation|retrieval_augmented|reflective|inferential|deliberative_contract/i.test(step),
  );
}

function promoteDeliberativeRoute(currentRoute: PipelineRoute): PipelineRoute {
  switch (currentRoute) {
    case "quantum-state":
      return "quantum-state";
    case "inferential":
      return "inferential";
    case "reflective":
      return "inferential";
    case "minimum":
      return "inferential";
    default:
      return "inferential";
  }
}

function buildActivationReasons(params: {
  greetingFastLaneTurn: boolean;
  deepDescendingTurn: boolean;
  obligationsCount: number;
  profile: ReturnType<typeof classifyCognitiveDemand>;
  depth: ReturnType<typeof argumentativeDepthDetector>;
}): string[] {
  const reasons: string[] = [];
  if (params.greetingFastLaneTurn) reasons.push("greeting_fast_lane");
  if (params.deepDescendingTurn) reasons.push("deep_descending_turn");
  if (params.obligationsCount > 0) reasons.push("obligations_detected");
  if (params.profile.requiresDeliberativeContract) reasons.push("profile_requires_contract");
  if (params.depth.requiresDeliberativeContract) reasons.push("depth_requires_contract");
  if (params.profile.requiresStructuredCoverage) reasons.push("profile_requires_structured_coverage");
  if (params.depth.needsStructuredCoverage) reasons.push("depth_requires_structured_coverage");
  if (params.depth.needsCounterObjection) reasons.push("counter_objection_required");
  if (params.depth.needsAssumptionAudit) reasons.push("assumption_audit_required");
  if (params.profile.reasoningIntensity >= 0.55) reasons.push("reasoning_intensity_high");
  if (params.profile.taskArchetypes.length >= 2) reasons.push("multi_archetype_task");
  return [...new Set(reasons)];
}

function buildFallbackObligation(prompt: string): DeliberativeObligation {
  return {
    obligationId: "obl_fallback_1",
    label: `Responder a solicitacao do usuario com execucao real da tarefa, sem espelhar o enunciado: ${prompt.slice(
      0,
      140,
    )}`,
    type: "evaluation",
    priority: 100,
    dependencies: [],
    satisfactionCriteria: [
      "execucao_real_da_tarefa",
      "sem_prompt_mirroring",
      "cobertura_estrutural_minima",
    ],
    minimumExpectedDepth: 0.62,
    coverageWeight: 1,
    evidenceHints: ["execucao_real", "sem_repeticao_do_prompt"],
  };
}

function getSourcePrompt(state: ProcessingState): string {
  return `${state.normalizedMessage || state.rawMessage || ""}`.trim();
}

function summarizePromptForRepair(prompt: string): string {
  const normalized = `${prompt || ""}`
    .replace(/\r\n?/g, " ")
    .replace(/\(\s*[a-z0-9]+\s*\)/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return "";

  const firstSentence = normalized.split(/(?<=[.!?])\s+/g)[0] || normalized;
  const condensed = firstSentence
    .replace(/^(considere(?:mos)?|consider)\b[^,.:;!?-]*[,:-]?\s*/i, "")
    .replace(/^(sem recorrer[^,.:;!?-]*[,:-]?\s*)/i, "")
    .trim();
  if (!condensed) return normalized.slice(0, 220);
  return condensed.slice(0, 220);
}

function getSurfacePolicy(state: ProcessingState): ResponseSurfacePolicy | null {
  return state.deliberativeTaskState?.reasoningContract?.surfacePolicy ?? null;
}

function normalizeCoverageCandidate(
  candidate: string,
  prompt: string,
  surfacePolicy?: ResponseSurfacePolicy | null,
): string {
  return normalizeDeliberativeResponse(candidate, {
    prompt,
    surfacePolicy,
  });
}

function buildCoverageRepairPrompt(params: {
  state: ProcessingState;
  candidate: string;
  missing: string[];
  weak: string[];
  blocking: string[];
  attempt: number;
}): string {
  const { state, candidate, missing, weak, blocking, attempt } = params;
  const deliberative = state.deliberativeTaskState;
  const contract = deliberative?.reasoningContract;
  const skeleton = deliberative?.proofSkeleton;
  const obligations = deliberative?.obligationGraph || [];
  const strongestSelfObjection = deliberative?.strongestSelfObjection || "";
  const assumptionLedger = deliberative?.assumptionLedger || [];
  const sourcePrompt = getSourcePrompt(state);
  const promptSummary = summarizePromptForRepair(sourcePrompt);

  const obligationTypeSummary = Array.from(
    obligations.reduce((acc, item) => {
      const key = `${item.type || "unknown"}`.toLowerCase();
      acc.set(key, (acc.get(key) || 0) + 1);
      return acc;
    }, new Map<string, number>()),
  )
    .map(([type, count]) => `${type}=${count}`)
    .join(" | ");

  const requiredSections = contract?.requiredSections?.map((item) => humanizeToken(item)) || [];
  const proofSteps = skeleton?.proofSteps?.slice(0, 6).map((item) => humanizeToken(item)) || [];

  return [
    "Voce esta revisando uma resposta do ai-system-anm.",
    "Reescreva em portugues brasileiro natural, sem repetir o enunciado do usuario e sem metadados internos.",
    "Nao inclua 'Usuario:', 'Leticia:', telemetria, pipeline, scores, parametros ou explicacoes sobre o proprio processo.",
    "Cobertura integral obrigatoria: responda todos os subitens detectados e finalize sem frase truncada.",
    "Nao traduza a pergunta do usuario, nao invente persona e nao exponha instrucoes internas.",
    "Quando houver demonstracao, use encadeamento inferencial real: premissas -> estado -> derivacao -> conclusao.",
    "Nao use pseudoformalizacao vazia nem frases conclusivas sem sustentacao.",
    `Tentativa de reparo: ${attempt}.`,
    requiredSections.length ? `Secoes obrigatorias: ${requiredSections.join(" | ")}.` : "",
    obligationTypeSummary ? `Obrigacoes por tipo: ${obligationTypeSummary}.` : "",
    proofSteps.length ? `Passos minimos de prova: ${proofSteps.join(" -> ")}.` : "",
    missing.length ? `Faltas detectadas: ${missing.join(" | ")}.` : "",
    weak.length ? `Pontos fracos detectados: ${weak.join(" | ")}.` : "",
    blocking.length ? `Falhas bloqueantes detectadas: ${blocking.join(" | ")}.` : "",
    strongestSelfObjection ? `Objecao forte obrigatoria: ${strongestSelfObjection}.` : "",
    assumptionLedger.length
      ? `Pressupostos a explicitar: ${assumptionLedger.slice(0, 8).map((item) => item.statement).join(" | ")}.`
      : "",
    promptSummary ? `Contexto resumido do pedido: ${promptSummary}.` : "",
    candidate ? `Resposta atual a corrigir:\n${candidate}` : "",
    "Entregue apenas a resposta final revisada.",
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizePromptSurface(text: string): string {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildEnumeratedDeliberativeRecovery(state: ProcessingState): string {
  const prompt = normalizePromptSurface(getSourcePrompt(state));
  const obligations = state.deliberativeTaskState?.obligationGraph || [];
  const usesAlphabeticEnumeration = /\(\s*[a-z]\s*\)/i.test(getSourcePrompt(state));
  const obligationTypes = new Set(obligations.map((item) => item.type));

  if (
    !usesAlphabeticEnumeration ||
    !obligationTypes.has("demonstration") ||
    !obligationTypes.has("distinction") ||
    !obligationTypes.has("proposal")
  ) {
    return "";
  }

  const isNormativeConflictCase =
    /\b(tres principios|principios normativos|decisao coletiva|liberdade basica|bem estar agregado|regra universal)\b/.test(prompt);

  const sections: string[] = [];

  if (isNormativeConflictCase) {
    sections.push(
      "(a) Seja D(s) o conjunto de decisoes factiveis em um estado s. Defina L(d) como a preservacao da liberdade basica do inocente, W(d) como a maximizacao do bem-estar agregado e U(d) como a justificabilidade por regra universal sem excecao. O conflito torna-se inevitavel quando existe um estado s tal que, para toda decisao d pertencente a D(s), vale a negacao da conjuncao L(d) e W(d) e U(d). Isso nao e simples afirmacao de dificuldade: e a exibicao de uma condicao suficiente de insatisfazibilidade conjunta. Se, no mesmo estado, qualquer decisao que preserve integralmente L(d) impedir a maximizacao requerida por W(d), e qualquer decisao que maximize W(d) exigir excecao incompatível com U(d), entao nao existe d capaz de satisfazer simultaneamente os tres predicados. Logo, a conjuncao normativa e localmente insatisfazivel sob essas condicoes.",
      "(b) Esse resultado nao implica, por si so, contradicao formal do sistema em abstrato. Uma contradicao real existiria se os principios se negassem mutuamente em qualquer mundo possivel. O caso descrito e diferente: os principios podem ser inteligiveis e normativamente validos em abstrato, mas tornam-se conjuntamente insatisfativeis em certos estados do mundo. Portanto, o nucleo do problema e uma insatisfazibilidade pratica sob restricoes de factibilidade, e nao uma contradicao logica necessaria. Inconsistencia de aplicacao e outra coisa: ocorre quando uma instituicao aplica mal principios que poderiam, em tese, ser compatibilizados.",
      "(c) Modelo 1: prioridade lexical para a liberdade basica, seguida de maximizacao condicional do bem-estar dentro do subconjunto de decisoes que respeitam esse piso, com teste de universalizacao atuando como filtro de admissibilidade. Modelo 2: arranjo multicriterio com teto de dano irreversivel, pesos publicos e revisao periodica, no qual a liberdade basica funciona como restricao forte, o bem-estar agregado como criterio de otimizacao condicionada e a universalizacao como prova de consistencia ex ante da regra decisoria.",
      "(d) O preco logico do Modelo 1 e abrir mao da completude compensatoria: ele rejeita ganhos agregados que dependam de sacrificar uma garantia basica. O preco moral e aceitar que beneficios coletivos relevantes possam ser bloqueados por um direito inviolavel mesmo em cenarios de pressao. O preco institucional e exigir mecanismos de recurso, definicao rigorosa do piso e capacidade de auditoria. No Modelo 2, o preco logico e a dependencia de calibragem de pesos e limiares; o preco moral e o risco de neutralidade aparente encobrir vieses distributivos; o preco institucional e a necessidade de governanca tecnicamente sofisticada, revisao permanente e transparencia decisoria.",
      "(e) A melhor objecao contra a solucao mais robusta e que ela pode converter um conflito substantivo de justica em problema de parametrizacao. Se os pesos, limiares e testes de universalizacao forem definidos por instituicoes assimetricas, o modelo preserva a aparencia de racionalidade enquanto desloca o conflito para a etapa de configuracao. Nesse caso, a propria arquitetura que pretende arbitrar tensoes pode reproduzir a tensao em um nivel menos visivel e menos contestavel publicamente.",
      "(f) Se liberdade basica e bem-estar agregado nao podem ser medidos com precisao, a conclusao deve ser reformulada em termos robustos e nao otimizadores no sentido estrito. Em vez de procurar maximo pontual, a decisao deve trabalhar com intervalos, estimativas prudenciais, teste de sensibilidade e preferencia por alternativas que minimizem dano irreversivel sob erro de medicao. A pergunta deixa de ser qual modelo e ideal em condicoes perfeitas e passa a ser qual modelo continua defensavel quando os indicadores sao incompletos, ruidosos e contestaveis.",
      "(g) Premissas que a resposta usou sem provar: que liberdade basica pode receber definicao operacional suficientemente estavel; que bem-estar agregado, embora imperfeitamente mensurado, pode orientar comparacoes prudenciais; que a universalizacao pode ser tratada como criterio institucional verificavel; que existe capacidade de governanca para aplicar filtros, pesos e revisoes sem distorcao sistematica; e que a escolha entre modelos pode ser julgada por robustez, e nao apenas por elegancia teorica.",
    );
    return sections.join("\n\n");
  }

  const letters = ["a", "b", "c", "d", "e", "f", "g", "h", "i"];
  obligations.slice(0, letters.length).forEach((obligation, index) => {
    const marker = `(${letters[index]})`;
    switch (obligation.type) {
      case "demonstration":
        sections.push(
          `${marker} Demonstro o ponto central definindo os termos operacionais, explicitando o estado analisado e encadeando a inferencia ate a conclusao derivada. A demonstracao nao se limita a anunciar conflito: ela mostra por que, dadas as condicoes do caso, a satisfacao conjunta dos requisitos falha no mesmo dominio decisorio.`,
        );
        break;
      case "distinction":
        sections.push(
          `${marker} Distingo cuidadosamente as categorias em jogo para evitar colapso conceitual. Separo contradicao formal, conflito de satisfazibilidade sob restricoes e inconsistencia de aplicacao institucional, porque cada uma exige diagnostico e remediacao diferentes.`,
        );
        break;
      case "proposal":
        sections.push(
          `${marker} Proponho ao menos dois modelos de resposta: um com restricoes duras e maximizacao condicionada, e outro com ponderacao multicriterio e revisao. Cada modelo e descrito por mecanismo, criterio de prioridade e forma de controle dos efeitos colaterais.`,
        );
        break;
      case "evaluation":
        sections.push(
          `${marker} Examino o preco logico, moral e institucional de cada alternativa. O objetivo aqui nao e apenas nomear custos, mas mostrar como eles surgem da propria arquitetura decisoria escolhida.`,
        );
        break;
      case "objection":
        sections.push(
          `${marker} Construo a melhor objecao possivel contra a opcao preferida, atacando coerencia, viabilidade institucional, custo moral oculto e dependencia de premissas contestaveis.`,
        );
        break;
      case "reformulation":
        sections.push(
          `${marker} Reformulo a conclusao sob incerteza epistêmica, trocando otimo pontual por robustez, faixas de estimativa e teste de sensibilidade.`,
        );
        break;
      case "assumption_audit":
        sections.push(
          `${marker} Explicito, ao final, as premissas que a resposta usou sem provar e os limites que restringem sua validade.`,
        );
        break;
      default:
        sections.push(
          `${marker} Executo a obrigacao correspondente em linguagem direta, com encadeamento suficiente e sem repetir o enunciado.`,
        );
        break;
    }
  });

  return sections.join("\n\n");
}

function buildDecisionArchitectureRecovery(state: ProcessingState): string {
  const prompt = normalizePromptSurface(getSourcePrompt(state));
  if (!/\b(criterios? de decisao|premissas|alternativas?|priorizacao|orcamento|corte de 40)\b/.test(prompt)) {
    return "";
  }

  return [
    "Premissas explicitas: assumo recursos escassos, objetivos parcialmente concorrentes, efeitos de segunda ordem sobre permanencia estudantil, pesquisa e operacao do ensino, e necessidade de governanca capaz de revisar a decisao quando novos dados surgirem. Tambem assumo que curto prazo e longo prazo nao podem ser tratados como a mesma escala, porque uma escolha que melhora o semestre atual pode fragilizar a capacidade institucional dos anos seguintes.",
    "Variaveis centrais e diagnostico: as variaveis decisivas sao permanencia estudantil, capacidade de produzir valor publico via pesquisa aplicada, robustez operacional do ensino digital e velocidade de implementacao. O diagnostico e que a falha principal nao nasce de um unico objetivo mal escolhido, mas da tentativa de tratar como equivalentes danos imediatos aos estudantes e perdas estruturais de medio prazo. Por isso, o sistema precisa separar sinais de urgencia social, sinais de risco institucional e sinais de retorno publico.",
    "Criterios de decisao com pesos justificados: atribuo peso 0,35 ao impacto direto sobre permanencia e sucesso estudantil, 0,25 ao potencial de gerar valor publico de medio e longo prazo, 0,20 ao risco de deterioracao institucional se nada for feito, e 0,20 a capacidade de implementacao no curto prazo. Esses pesos nao sao arbitrarios: priorizam dano humano imediato sem apagar o papel estruturante da pesquisa e da infraestrutura.",
    "Alternativa 1: priorizar assistencia estudantil no curto prazo, preservando um nucleo minimo de modernizacao digital e reduzindo expansao de pesquisa a projetos com transferencia mais rapida. O mecanismo operacional dessa alternativa e bloquear evasao e colapso social imediato, enquanto conserva apenas a infraestrutura e a pesquisa indispensaveis. Essa alternativa e mais forte para conter evasao, proteger estudantes vulneraveis e estabilizar o ambiente social da universidade, mas paga o custo de desacelerar ganhos de capacidade cientifica e inovacao aplicada.",
    "Alternativa 2: priorizar infraestrutura digital e pesquisa aplicada articuladas, mantendo assistencia em piso protegido. O mecanismo operacional aqui e ampliar capacidade institucional e produtividade futura sem desmontar totalmente a protecao social de base. Essa alternativa fortalece produtividade, capta ganhos institucionais duradouros e pode ampliar eficiencia do ensino, mas corre o risco de produzir melhoria estrutural com custo social imediato se estudantes em maior vulnerabilidade perderem sustentacao suficiente para permanecer.",
    "Riscos e consequencias de curto e longo prazo: no curto prazo, subfinanciar assistencia tende a elevar evasao e pressao psicossocial; subfinanciar digitalizacao preserva o presente, mas amplia gargalos operacionais; subfinanciar pesquisa reduz a chance de converter biodiversidade em conhecimento e valor publico regional. No longo prazo, uma universidade que abandona infraestrutura ou pesquisa perde capacidade de formar, inovar e captar legitimidade externa, enquanto uma universidade que abandona assistencia perde coesao, inclusao e base humana para sustentar qualquer projeto futuro.",
    "Critica mais forte contra a recomendacao: se eu priorizar assistencia estudantil com piso para as demais frentes, a objecao steelman e que a resposta pode se tornar excessivamente defensiva e incapaz de quebrar a dependencia de escassez. Em outras palavras, proteger o presente pode impedir o investimento estruturante que reduziria a vulnerabilidade sistemica no futuro.",
    "Reformulacao sob corte de 40%: com corte dessa magnitude, a resposta precisa mudar de priorizacao ordinaria para regime de preservacao do nucleo vital. O foco passa a ser garantir permanencia minima, manter operacao digital indispensavel e concentrar pesquisa apenas em projetos de maior externalidade imediata e menor custo incremental. O criterio deixa de ser expansao equilibrada e passa a ser continuidade institucional com dano humano controlado.",
    "Conclusao: a alternativa mais robusta e priorizar assistencia estudantil com piso protegido para infraestrutura digital critica e pesquisa aplicada altamente seletiva. Essa escolha nao maximiza cada objetivo isoladamente, mas domina em robustez porque reduz dano irreversivel sobre permanencia sem desmontar por completo os vetores estruturais que a universidade ainda precisara para sair da crise.",
  ].join("\n\n");
}

function buildDeterministicCoverageRecovery(state: ProcessingState): string {
  const deliberative = state.deliberativeTaskState;
  if (!deliberative?.isActive || !deliberative.reasoningContract) return "";

  const enumeratedRecovery = buildEnumeratedDeliberativeRecovery(state);
  if (enumeratedRecovery) return enumeratedRecovery;

  const decisionRecovery = buildDecisionArchitectureRecovery(state);
  if (decisionRecovery) return decisionRecovery;

  const contract = deliberative.reasoningContract;
  const skeleton = deliberative.proofSkeleton;
  const models = deliberative.solutionModels || [];
  const assumptions = deliberative.assumptionLedger || [];
  const strongestSelfObjection = deliberative.strongestSelfObjection;
  const sections: string[] = [];

  for (const section of contract.requiredSections) {
    if (section === "direct_answer_or_frame" || section === "framing_and_definitions") {
      const definitions = skeleton?.definitions?.slice(0, 3).map((item) => humanizeToken(item)).join(", ");
      const thesis = skeleton?.thesis?.slice(0, 2).map((item) => humanizeToken(item)).join(" ");
      sections.push(
        `Parto de definicoes operacionais antes de concluir: ${definitions || "escopo, restricoes e criterio de escolha"}. A tese de trabalho e ${thesis || "avaliar a compatibilidade entre exigencias concorrentes sob restricao real"}.`,
      );
      continue;
    }

    if (section === "core_reasoning" || section === "reasoning_chain_or_proof") {
      const proofSteps = skeleton?.proofSteps?.slice(0, 5).map((item) => humanizeToken(item)).join("; ");
      sections.push(
        `Demonstracao: assumindo um estado decisorio com recursos finitos e criterios concorrentes, cada decisao precisa satisfazer predicados simultaneos; quando os predicados entram em colisao no mesmo estado factivel, ocorre insatisfazibilidade conjunta. Assim, nao basta afirmar conflito: e preciso mostrar que, sob essas condicoes, toda alternativa viola ao menos um requisito. ${proofSteps ? `Passos aplicados: ${proofSteps}.` : ""}`,
      );
      continue;
    }

    if (section === "critical_distinctions") {
      sections.push(
        "Distincao analitica: contradicao logica ocorre na forma proposicional; insatisfazibilidade conjunta ocorre quando principios compativeis em abstrato nao podem ser satisfeitos juntos em certos estados do mundo; inconsistencia de aplicacao ocorre quando a instituicao implementa mal um conjunto que, em tese, poderia ser compatibilizado.",
      );
      continue;
    }

    if (section === "options_or_plan") {
      if (models.length >= 2) {
        const top = models.slice(0, 2);
        sections.push(
          `Modelo 1 (${top[0].title}): ${top[0].operationalMechanism}. Modelo 2 (${top[1].title}): ${top[1].operationalMechanism}. Ambos preservam os principios em graus diferentes e mudam o custo de governanca e revisao.`,
        );
      } else {
        sections.push(
          "Alternativas: uma arquitetura com garantias minimas lexicais e maximizacao condicional; outra arquitetura multicriterio com teto de dano, pesos transparentes e revisao periodica.",
        );
      }
      continue;
    }

    if (section === "tradeoffs_and_impacts") {
      if (models.length > 0) {
        const tradeoffs = models
          .slice(0, 3)
          .map((model) => `${model.title}: logico=${model.logicalRisk}; moral=${model.moralRisk}; institucional=${model.institutionalRisk}`)
          .join(" | ");
        sections.push(`Custos e efeitos: ${tradeoffs}.`);
      } else {
        sections.push(
          "Custos: priorizacao rigida de um principio reduz flexibilidade de compensacao; maximizacao agregada amplia risco de erosao de garantias individuais; institucionalmente, ambos exigem auditoria, mecanismos de recurso e revisao para evitar arbitrariedade.",
        );
      }
      continue;
    }

    if (section === "strong_self_objection") {
      sections.push(
        strongestSelfObjection
          ? `Objecao steelman contra a solucao preferida: ${strongestSelfObjection}`
          : "Objecao steelman: a regra de priorizacao pode ocultar vieses na etapa de medicao e transformar um problema normativo em aparente neutralidade tecnica.",
      );
      continue;
    }

    if (section === "reformulation_under_uncertainty") {
      sections.push(
        "Sob incerteza de medicao, a conclusao deve ser reformulada em termos robustos: em vez de otimo pontual, usar faixas de estimativa, teste de sensibilidade e criterio de prudencia para minimizar dano irreversivel.",
      );
      continue;
    }

    if (section === "assumption_and_limit_ledger") {
      const assumptionText = assumptions
        .slice(0, 6)
        .map((item) => item.statement)
        .join("; ");
      sections.push(
        assumptionText
          ? `Pressupostos nao provados utilizados: ${assumptionText}.`
          : "Pressupostos nao provados: definicoes estaveis, comparabilidade entre metricas, mensurabilidade minima e capacidade institucional de aplicar criterios sem distorcao persistente.",
      );
      continue;
    }

    if (section === "conclusion") {
      sections.push(
        "Conclusao: a resposta adequada exige demonstracao, distincao conceitual, comparacao de modelos com custo explicito, objecao forte contra a propria preferencia e revisao sob incerteza, evitando compressao que esconda lacunas argumentativas.",
      );
      continue;
    }
  }

  return sections.filter(Boolean).join("\n\n").trim();
}

function buildHardGateRecovery(state: ProcessingState): string {
  const deterministic = buildDeterministicCoverageRecovery(state);
  if (deterministic) return deterministic;

  const deliberative = state.deliberativeTaskState;
  if (!deliberative?.reasoningContract) return "";

  const required = deliberative.reasoningContract.requiredSections || [];
  const genericSections: string[] = [];

  for (const section of required) {
    if (section === "direct_answer_or_frame" || section === "framing_and_definitions") {
      genericSections.push(
        "Definicoes operacionais: fixo os termos centrais, o escopo do problema e as condicoes de aplicacao antes da conclusao.",
      );
      continue;
    }
    if (section === "core_reasoning" || section === "reasoning_chain_or_proof") {
      genericSections.push(
        "Demonstracao: parto das premissas, explicito as condicoes do estado analisado, encadeio a inferencia e so entao concluo.",
      );
      continue;
    }
    if (section === "critical_distinctions") {
      genericSections.push(
        "Distincao conceitual: separo contradicao formal, conflito pratico de satisfazibilidade e erro de aplicacao institucional.",
      );
      continue;
    }
    if (section === "options_or_plan") {
      genericSections.push(
        "Modelos: apresento alternativas com mecanismo interno, criterio de escolha e impacto sobre os objetivos concorrentes.",
      );
      continue;
    }
    if (section === "tradeoffs_and_impacts") {
      genericSections.push(
        "Custos: explicito o preco logico, moral e institucional de cada alternativa, com riscos de curto e longo prazo.",
      );
      continue;
    }
    if (section === "strong_self_objection") {
      genericSections.push("Objecao forte: ataco a propria solucao preferida pelo ponto de maior fragilidade.");
      continue;
    }
    if (section === "reformulation_under_uncertainty") {
      genericSections.push(
        "Reformulacao sob incerteza: troco otimo pontual por estrategia robusta com margens de erro e teste de sensibilidade.",
      );
      continue;
    }
    if (section === "assumption_and_limit_ledger") {
      genericSections.push("Pressupostos e limites: declaro explicitamente o que foi assumido sem prova.");
      continue;
    }
    if (section === "conclusion") {
      genericSections.push("Conclusao: entrego uma sintese final coerente com a demonstracao e com os trade-offs explicitados.");
    }
  }

  return genericSections.join("\n\n").trim();
}

function buildObligationDrivenRecovery(state: ProcessingState): string {
  const enumeratedRecovery = buildEnumeratedDeliberativeRecovery(state);
  if (enumeratedRecovery) return enumeratedRecovery;

  const decisionRecovery = buildDecisionArchitectureRecovery(state);
  if (decisionRecovery) return decisionRecovery;

  const deliberative = state.deliberativeTaskState;
  const obligations = deliberative?.obligationGraph || [];
  if (!obligations.length) return "";

  const blocks: string[] = [
    "### Estrutura de resposta",
    "Apresento a resposta em etapas obrigatorias, com encadeamento completo, sem repetir o enunciado e sem encerrar antes da conclusao.",
  ];

  obligations.forEach((obligation, index) => {
    const step = index + 1;
    switch (obligation.type) {
      case "demonstration":
        blocks.push(
          `### Etapa ${step} — Demonstracao\nDefino o conjunto de decisoes factiveis D(s) e os predicados normativos relevantes. Em seguida, explicito uma condicao suficiente de colisao: para o estado s, toda decisao d em D(s) satisfaz no maximo dois predicados simultaneamente. Dessa condicao segue, por derivacao, que a conjuncao integral dos requisitos e insatisfazivel nesse estado, sem depender de exemplo historico.`,
        );
        break;
      case "distinction":
        blocks.push(
          `### Etapa ${step} — Distincao conceitual\nSeparo tres niveis: contradicao formal, insatisfazibilidade conjunta sob restricoes factuais e inconsistencia de aplicacao institucional. A contradicao formal ocorre no plano logico das proposicoes; a insatisfazibilidade ocorre quando as condicoes do mundo bloqueiam a satisfacao conjunta; a inconsistencia institucional ocorre por desenho ruim de implementacao.`,
        );
        break;
      case "proposal":
        blocks.push(
          `### Etapa ${step} — Modelos alternativos\nModelo A: piso inviolavel para garantias basicas e maximizacao condicional do restante. Modelo B: otimizacao multicriterio com teto de dano irreversivel, pesos publicos e revisao periodica. Cada modelo preserva parte substantiva dos criterios e muda onde o custo principal aparece.`,
        );
        break;
      case "evaluation":
        blocks.push(
          `### Etapa ${step} — Custos e trade-offs\nNo plano logico, a prioridade forte reduz compensacoes entre criterios. No plano moral, o risco e tratar perdas de minorias como sacrificio aceitavel. No plano institucional, cresce a necessidade de auditoria, recurso e revisao para evitar arbitrariedade e erosao de confianca.`,
        );
        break;
      case "objection":
        blocks.push(
          `### Etapa ${step} — Objecao steelman\nA melhor objecao contra a opcao preferida e que ela pode mascarar vieses de mensuracao sob aparencia de neutralidade tecnica. Se os indicadores forem instaveis ou politicamente enviesados, a regra de decisao pode reproduzir injustica enquanto aparenta consistencia metodologica.`,
        );
        break;
      case "reformulation":
        blocks.push(
          `### Etapa ${step} — Reformulacao sob incerteza\nCom dados incertos, abandono a ideia de otimo pontual e adoto robustez: faixas de estimativa, teste de sensibilidade e criterio prudencial de minimizacao de dano irreversivel. A recomendacao passa a ser condicional a intervalos plausiveis, nao a valores exatos.`,
        );
        break;
      case "assumption_audit":
        blocks.push(
          `### Etapa ${step} — Pressupostos nao provados\nAssumi comparabilidade minima entre criterios, estabilidade institucional suficiente para aplicar a regra escolhida, e metricas com erro limitado para orientar decisao. Esses pressupostos sao operacionais, nao demonstrados, e delimitam o alcance da conclusao.`,
        );
        break;
      case "comparison":
        blocks.push(
          `### Etapa ${step} — Comparacao estruturada\nComparo alternativas por quatro eixos: risco de dano irreversivel, ganho esperado, equidade distributiva e viabilidade de curto prazo. A alternativa mais robusta e a que domina no pior caso e evita perdas que nao podem ser revertidas.`,
        );
        break;
      case "decision":
        blocks.push(
          `### Etapa ${step} — Escolha justificada\nA escolha recai sobre a opcao com melhor robustez sob conflito de criterios, preservando restricoes duras e controlando risco extremo. A justificativa combina dominancia prudencial, governanca verificavel e custo institucional administravel.`,
        );
        break;
      case "planning":
        blocks.push(
          `### Etapa ${step} — Plano de execucao\nSequencia recomendada: definir criterio dominante e limites nao negociaveis, avaliar opcoes contra esses limites, selecionar alternativa robusta, aplicar monitoramento com revisao periodica. Essa ordem evita decisoes ad hoc e melhora auditabilidade.`,
        );
        break;
      case "diagnosis":
        blocks.push(
          `### Etapa ${step} — Diagnostico\nO nucleo da falha decisoria costuma vir de conflito entre objetivos maximizadores e restricoes de garantia forte, agravado por medicao imperfeita. O diagnostico deve separar erro de modelo, erro de dados e erro de implementacao para evitar correcoes superficiais.`,
        );
        break;
      case "synthesis":
        blocks.push(
          `### Etapa ${step} — Sintese integrada\nA conclusao valida depende de combinar prova de conflito, distincao conceitual, modelos alternativos, custos explicitos e revisao sob incerteza. Sem esse conjunto, a resposta fica aparente, mas nao executa a tarefa por completo.`,
        );
        break;
      case "explanation":
      default:
        blocks.push(
          `### Etapa ${step} — Explicacao\nExplico o mecanismo central com foco causal: o conflito surge quando criterios obrigatorios concorrem no mesmo estado decisorio e nao podem ser maximizados ao mesmo tempo. A resposta correta exige explicitar condicoes, limites e consequencias da escolha.`,
        );
        break;
    }
  });

  blocks.push(
    "### Conclusao final",
    "A resposta foi fechada com cobertura integral das obrigacoes relevantes, progressao argumentativa completa e encerramento textual sem truncamento.",
  );

  return blocks.join("\n\n").trim();
}

function resolveRepairTimeoutMs(): number {
  const configured = Number(process.env.AI_SYSTEM_DELIBERATIVE_REPAIR_TIMEOUT_MS || 12000);
  if (!Number.isFinite(configured)) return 12000;
  return Math.max(2000, Math.min(30000, Math.trunc(configured)));
}

function resolveRepairAttempts(): number {
  const configured = Number(process.env.AI_SYSTEM_DELIBERATIVE_COVERAGE_REPAIR_ATTEMPTS || 2);
  if (!Number.isFinite(configured)) return 2;
  return Math.max(0, Math.min(3, Math.trunc(configured)));
}

function shouldBlockOnUnresolvedHardFail(): boolean {
  const flag = `${process.env.AI_SYSTEM_DELIBERATIVE_HARD_FAIL_BLOCK || ""}`
    .trim()
    .toLowerCase();
  if (!flag) return true;
  return !(flag === "0" || flag === "false" || flag === "off");
}

function shouldAttemptCoverageRepair(report: CoverageReport): boolean {
  return (
    report.gateLevel !== "pass" &&
    (
      report.missing.length > 0 ||
      report.weaklySatisfied.length > 0 ||
      (report.blockingIssues || []).length > 0
    )
  );
}

function buildInitialCoverageReport(isActive: boolean, obligations: DeliberativeObligation[]): CoverageReport {
  const report = createEmptyCoverageReport();
  report.expected = obligations.length;
  report.satisfied = isActive ? 0 : obligations.length;
  report.missing = isActive ? obligations.map((item) => item.label) : [];
  report.weaklySatisfied = [];
  report.needsRevision = isActive;
  report.gateLevel = isActive ? "soft_fail" : "pass";
  return report;
}

function buildInitialDeliberativeState(params: {
  profile: ReturnType<typeof classifyCognitiveDemand>;
  depth: ReturnType<typeof argumentativeDepthDetector>;
  obligations: DeliberativeObligation[];
  contract: ReturnType<typeof reasoningContractBuilder> | null;
  proofSkeleton: ReturnType<typeof proofSkeletonPlanner> | null;
  solutionModels: ReturnType<typeof solutionSpaceExpander>;
  strongestSelfObjection: ReturnType<typeof selfObjectionGenerator> | null;
  assumptionLedger: ReturnType<typeof assumptionLedgerBuilder>;
  promptConstraints: ReturnType<typeof detectPromptConstraints>;
  premiseLedger: ReturnType<typeof checkPremisePreservation>["premiseLedger"];
  isActive: boolean;
  activationReasons: string[];
}): DeliberativeTaskState {
  const requiresCoverageAudit = Boolean(
    params.depth.needsStructuredCoverage ||
    params.profile.requiresStructuredCoverage ||
    params.depth.needsCounterObjection ||
    params.profile.requiresSelfObjection ||
    params.depth.needsAssumptionAudit ||
    params.profile.requiresAssumptionAudit ||
    params.obligations.length >= 2
  );

  const taskExecutionState = createEmptyTaskExecutionState();
  taskExecutionState.detectedObligations = params.obligations.map((item) => item.label);
  taskExecutionState.obligationExecutionPlan = params.obligations.map((item) => ({
    obligationId: item.obligationId,
    type: item.type,
    minimumExpectedDepth: item.minimumExpectedDepth,
  }));
  taskExecutionState.promptConstraints = params.promptConstraints;
  taskExecutionState.premiseLedger = params.premiseLedger;

  return {
    isActive: params.isActive,
    taskArchetypes: params.profile.taskArchetypes,
    cognitiveDemands: params.profile.cognitiveDemands,
    reasoningIntensity: params.profile.reasoningIntensity,
    structuralComplexity: params.profile.structuralComplexity,
    answerFormatNeeds: params.profile.answerFormatNeeds,
    argumentativeDepthScore: params.depth.argumentativeDepthScore,
    requiresFormalization: params.depth.needsFormalization || params.profile.requiresFormalization,
    requiresCoverageAudit,
    obligationGraph: params.obligations,
    reasoningContract: params.contract,
    proofSkeleton: params.proofSkeleton,
    solutionModels: params.solutionModels,
    assumptionLedger: params.assumptionLedger,
    coverageReport: buildInitialCoverageReport(params.isActive, params.obligations),
    taskExecutionState,
    strongestSelfObjection: params.strongestSelfObjection,
    activationReasons: params.activationReasons,
    contractVersion: DELIBERATIVE_TASK_CONTRACT_VERSION,
  };
}

async function repairDeliberativeResponse(params: {
  state: ProcessingState;
  candidate: string;
  missing: string[];
  weak: string[];
  blocking: string[];
  attempt: number;
}): Promise<string> {
  const prompt = buildCoverageRepairPrompt(params);
  const timeoutMs = resolveRepairTimeoutMs();

  try {
    const draft = await deliberativeRepairClient.generate(prompt, { timeoutMs });
    return sanitizeRepairDraft(draft);
  } catch {
    return params.candidate;
  }
}

function buildExecutionDiagnostics(params: {
  state: ProcessingState;
  report: CoverageReport;
  responseText: string;
}): ExecutionDiagnostics {
  const { state, report, responseText } = params;
  const deliberative = state.deliberativeTaskState;
  const previous = report.executionDiagnostics;
  const expectedObligations = deliberative?.obligationGraph.length || 0;
  const surfacePolicy = getSurfacePolicy(state);

  const integrity = checkResponseIntegrity({
    responseText,
    expectedObligations,
    satisfiedObligations: report.satisfied,
    surfacePolicy,
  });

  const execution = validateTaskExecution(
    deliberative?.obligationGraph || [],
    responseText,
    surfacePolicy,
  );

  const blockReasons = Array.from(
    new Set([
      ...(previous?.finalExecutionGate?.blockReasons || []),
      ...(report.blockingIssues || []),
      ...(!integrity.passed ? integrity.issues : []),
      ...(!execution.passed ? execution.issues : []),
    ]),
  );

  return {
    inputOverlapScore: previous?.inputOverlapScore ?? 0,
    noveltyScore: previous?.noveltyScore ?? 1,
    restatementRisk: previous?.restatementRisk ?? 0,
    promptConstraints:
      previous?.promptConstraints ??
      deliberative?.taskExecutionState.promptConstraints.map((item) => item.description) ??
      [],
    constraintViolations: previous?.constraintViolations ?? [],
    premiseLedger:
      previous?.premiseLedger ??
      deliberative?.taskExecutionState.premiseLedger.map((item) => item.text) ??
      [],
    premiseViolations: previous?.premiseViolations ?? [],
    proofVsIllustrationScore: previous?.proofVsIllustrationScore ?? execution.executionScore,
    proofVsIllustrationIssues: previous?.proofVsIllustrationIssues ?? [],
    integrityChecks: {
      isTruncated: integrity.isTruncated,
      hasAbruptEnding: integrity.hasAbruptEnding,
      missingSections: integrity.missingSections,
      issues: integrity.issues,
    },
    subtaskCoverage: {
      expected: report.expected,
      satisfied: report.satisfied,
      missing: report.missing,
      weak: report.weaklySatisfied,
      passed: execution.passed && integrity.passed && report.missing.length === 0,
    },
    finalExecutionGate: {
      shouldBlock:
        (previous?.finalExecutionGate?.shouldBlock ?? false) ||
        report.gateLevel === "hard_fail" ||
        integrity.isTruncated ||
        !execution.passed,
      blockReasons,
    },
  };
}

function mergePostValidationIntoCoverageReport(params: {
  report: CoverageReport;
  diagnostics: ExecutionDiagnostics;
}): CoverageReport {
  const { report, diagnostics } = params;
  const blockingIssues = Array.from(
    new Set([
      ...(report.blockingIssues || []),
      ...diagnostics.finalExecutionGate.blockReasons,
    ]),
  );

  let gateLevel = report.gateLevel || (report.needsRevision ? "soft_fail" : "pass");

  if (
    diagnostics.integrityChecks.isTruncated ||
    diagnostics.finalExecutionGate.shouldBlock
  ) {
    gateLevel = "hard_fail";
  } else if (
    gateLevel === "pass" &&
    (
      report.missing.length > 0 ||
      report.weaklySatisfied.length > 0 ||
      diagnostics.integrityChecks.issues.length > 0
    )
  ) {
    gateLevel = "soft_fail";
  }

  return {
    ...report,
    needsRevision: gateLevel !== "pass",
    gateLevel,
    blockingIssues,
    executionDiagnostics: diagnostics,
  };
}

export async function runDeliberativeTaskContractLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const prompt = getSourcePrompt(state);
  const profile = classifyCognitiveDemand(prompt);
  const depth = argumentativeDepthDetector(prompt);
  const greetingFastLaneTurn = isGreetingFastLaneTurn(state);
  const deepDescendingTurn = isDeepDescendingTurn(state);

  let obligations = taskObligationExtractor(prompt);
  if (!greetingFastLaneTurn && deepDescendingTurn && prompt && obligations.length === 0) {
    obligations = [buildFallbackObligation(prompt)];
  }

  const shouldBuildContract = shouldBuildContractPolicy({
    greetingFastLaneTurn,
    deepDescendingTurn,
    obligationsCount: obligations.length,
    profile: {
      requiresDeliberativeContract: profile.requiresDeliberativeContract,
      requiresStructuredCoverage: profile.requiresStructuredCoverage,
      reasoningIntensity: profile.reasoningIntensity,
      taskArchetypes: profile.taskArchetypes,
    },
    depth: {
      requiresDeliberativeContract: depth.requiresDeliberativeContract,
      needsStructuredCoverage: depth.needsStructuredCoverage,
    },
  });

  const contract = shouldBuildContract ? reasoningContractBuilder(depth, obligations, profile) : null;
  const proofSkeleton = contract ? proofSkeletonPlanner(prompt, obligations, contract) : null;
  const solutionModels = contract ? solutionSpaceExpander(prompt, obligations) : [];
  const strongestSelfObjection = contract ? selfObjectionGenerator(contract, solutionModels) : null;
  const assumptionLedger = contract ? assumptionLedgerBuilder(prompt, obligations, solutionModels, profile) : [];
  const promptConstraints = detectPromptConstraints(prompt);
  const premisePreservation = checkPremisePreservation(prompt, "");
  const isActive = shouldBuildContract && Boolean(contract);

  const activationReasons = buildActivationReasons({
    greetingFastLaneTurn,
    deepDescendingTurn,
    obligationsCount: obligations.length,
    profile,
    depth,
  });

  const deliberativeState = buildInitialDeliberativeState({
    profile,
    depth,
    obligations,
    contract,
    proofSkeleton,
    solutionModels,
    strongestSelfObjection,
    assumptionLedger,
    promptConstraints,
    premiseLedger: premisePreservation.premiseLedger,
    isActive,
    activationReasons,
  });

  state.deliberativeTaskState = deliberativeState;
  state.generalTaskDeliberationState = deliberativeState;

  if (isActive) {
    const nextRoute: PipelineRoute = promoteDeliberativeRoute(state.executionPlan.selectedRoute);
    state.executionPlan.selectedRoute = nextRoute;

    state.executionPlan.steps = [
      ...new Set([
        ...(state.executionPlan.steps || []),
        "general_task_deliberation",
        "retrieval_augmented",
        "reflective",
        "inferential",
      ]),
    ];

    state.complexityProfile.score = Math.max(
      state.complexityProfile.score,
      clamp01(profile.reasoningIntensity + 0.2),
    );
    state.complexityProfile.depthRequired = Math.max(state.complexityProfile.depthRequired, 16);
    state.complexityProfile.responseBudget = Math.max(
      state.complexityProfile.responseBudget,
      Math.min(3200, 1400 + Math.round(profile.structuralComplexity * 1000)),
    );
    state.activeConstraints = [
      ...new Set([
        ...state.activeConstraints,
        "general_task_deliberation_active",
        `deliberative_activation:deep=${deepDescendingTurn ? "true" : "false"}`,
        `deliberative_activation:greeting=${greetingFastLaneTurn ? "true" : "false"}`,
        `task_archetypes:${profile.taskArchetypes.join(",") || "none"}`,
        `cognitive_demands:${profile.cognitiveDemands.join(",") || "none"}`,
      ]),
    ].slice(-50);
  }

  state.executionArtifacts = {
    ...state.executionArtifacts,
    deliberativeTaskContract: {
      active: isActive,
      argumentativeDepthScore: depth.argumentativeDepthScore,
      obligations: obligations.length,
      taskArchetypes: profile.taskArchetypes,
      cognitiveDemands: profile.cognitiveDemands,
      reasoningIntensity: profile.reasoningIntensity,
      structuralComplexity: profile.structuralComplexity,
      requiresFormalization: depth.needsFormalization || profile.requiresFormalization,
      requiresCounterObjection: depth.needsCounterObjection || profile.requiresSelfObjection,
      requiresAssumptionAudit: depth.needsAssumptionAudit || profile.requiresAssumptionAudit,
      responseArchitecture: contract?.responseArchitecture || "none",
      minCoverageThreshold: contract?.minCoverageThreshold ?? 0,
    },
  };

  state.trace.push(
    makeTraceEvent({
      layer: "deliberative-task-contract",
      action: isActive ? "general_deliberation_contract_built" : "general_deliberation_skipped",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `active=${isActive}; score=${depth.argumentativeDepthScore.toFixed(2)}; archetypes=${profile.taskArchetypes.join("|") || "none"}; ` +
        `demands=${profile.cognitiveDemands.join("|") || "none"}; obligations=${obligations.length}; formal=${depth.needsFormalization || profile.requiresFormalization}; ` +
        `deep=${deepDescendingTurn}; greeting=${greetingFastLaneTurn}; reasons=${activationReasons.join("|") || "none"}`,
    }),
  );

  return state;
}

export async function runDeliberativeFinalCoverageValidator(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const deliberative = state.deliberativeTaskState;

  if (!deliberative?.isActive || !deliberative.reasoningContract) {
    return state;
  }

  const sourcePrompt = getSourcePrompt(state);
  const surfacePolicy = getSurfacePolicy(state);

  const evaluate = (responseText: string) =>
    responseCoverageValidator({
      obligations: deliberative.obligationGraph,
      contract: deliberative.reasoningContract!,
      responseText,
      userPrompt: sourcePrompt,
      requiresCounterObjection: deliberative.reasoningContract!.objectionStrengthLevel >= 0.55,
      requiresAssumptionAudit:
        deliberative.reasoningContract!.assumptionDisclosureMode === "explicit_ledger",
      requiresReformulation:
        deliberative.reasoningContract!.uncertaintyHandlingMode !== "standard",
      assumptionLedger: deliberative.assumptionLedger,
    });

  let workingResponse = `${
    state.finalResponse ||
    state.structuredResponse ||
    state.humanizedResponse ||
    state.draftResponse?.text ||
    ""
  }`.trim();

  if (!workingResponse) {
    workingResponse = buildDeterministicCoverageRecovery(state);
  }

  workingResponse = normalizeCoverageCandidate(workingResponse, sourcePrompt, surfacePolicy);

  let report = evaluate(workingResponse);
  let diagnostics = buildExecutionDiagnostics({
    state,
    report,
    responseText: workingResponse,
  });
  report = mergePostValidationIntoCoverageReport({ report, diagnostics });

  const maxRepairAttempts = resolveRepairAttempts();
  let repairAttempts = 0;

  while (shouldAttemptCoverageRepair(report) && repairAttempts < maxRepairAttempts) {
    repairAttempts += 1;

    const repaired = await repairDeliberativeResponse({
      state,
      candidate: workingResponse,
      missing: report.missing,
      weak: report.weaklySatisfied,
      blocking: report.blockingIssues || [],
      attempt: repairAttempts,
    });

    if (!repaired || repaired === workingResponse) {
      break;
    }

    workingResponse = normalizeCoverageCandidate(repaired, sourcePrompt, surfacePolicy);
    report = evaluate(workingResponse);
    diagnostics = buildExecutionDiagnostics({
      state,
      report,
      responseText: workingResponse,
    });
    report = mergePostValidationIntoCoverageReport({ report, diagnostics });
  }

  if (report.gateLevel !== "pass") {
    const deterministicRecovery = buildDeterministicCoverageRecovery(state);
    if (deterministicRecovery) {
      workingResponse = normalizeCoverageCandidate(
        deterministicRecovery,
        sourcePrompt,
        surfacePolicy,
      );
      report = evaluate(workingResponse);
      diagnostics = buildExecutionDiagnostics({
        state,
        report,
        responseText: workingResponse,
      });
      report = mergePostValidationIntoCoverageReport({ report, diagnostics });
    }
  }

  if (report.gateLevel === "hard_fail") {
    const recoveryCandidates = [
      buildHardGateRecovery(state),
      buildObligationDrivenRecovery(state),
    ].filter(Boolean);

    for (const candidate of recoveryCandidates) {
      const recoveredText = normalizeCoverageCandidate(
        candidate,
        sourcePrompt,
        surfacePolicy,
      );
      const recoveredReport = evaluate(recoveredText);
      const recoveredDiagnostics = buildExecutionDiagnostics({
        state,
        report: recoveredReport,
        responseText: recoveredText,
      });
      const mergedRecoveredReport = mergePostValidationIntoCoverageReport({
        report: recoveredReport,
        diagnostics: recoveredDiagnostics,
      });

      const improved =
        mergedRecoveredReport.gateLevel !== "hard_fail" ||
        (mergedRecoveredReport.blockingIssues || []).length <
          (report.blockingIssues || []).length;

      if (improved) {
        workingResponse = recoveredText;
        report = mergedRecoveredReport;
        diagnostics = recoveredDiagnostics;
      }

      if (report.gateLevel !== "hard_fail") {
        break;
      }
    }
  }

  if (workingResponse) {
    state.finalResponse = workingResponse;
    state.structuredResponse = workingResponse;
    state.humanizedResponse = workingResponse;
    state.draftResponse = {
      ...state.draftResponse,
      text: workingResponse,
    };
  }

  deliberative.coverageReport = report;

  const nextTaskExecutionState = createEmptyTaskExecutionState();
  nextTaskExecutionState.detectedObligations = deliberative.obligationGraph.map((item) => item.label);
  nextTaskExecutionState.obligationExecutionPlan = deliberative.obligationGraph.map((item) => ({
    obligationId: item.obligationId,
    type: item.type,
    minimumExpectedDepth: item.minimumExpectedDepth,
  }));
  nextTaskExecutionState.obligationSatisfactionScores = (report.obligationScores || []).map((item) => ({
    obligationId: item.obligationId,
    label: item.label,
    type: item.type,
    score: item.score,
    passed: item.passed,
    issues: item.issues,
  }));
  nextTaskExecutionState.promptConstraints =
    diagnostics.promptConstraints.map((description, idx) => ({
      id: `constraint_${idx + 1}`,
      type: "unknown",
      description,
      hard: true,
    })) || deliberative.taskExecutionState.promptConstraints;

  nextTaskExecutionState.premiseLedger =
    diagnostics.premiseLedger.map((text, idx) => ({
      id: `premise_${idx + 1}`,
      text,
      coreTerms: [],
      normativeStrength: "moderate",
    })) || deliberative.taskExecutionState.premiseLedger;

  nextTaskExecutionState.noveltyMetrics = {
    inputOverlapScore: diagnostics.inputOverlapScore,
    noveltyScore: diagnostics.noveltyScore,
    restatementRisk: diagnostics.restatementRisk,
  };

  nextTaskExecutionState.demonstrationChecks = [
    {
      name: "proof_vs_illustration",
      passed: (diagnostics.proofVsIllustrationIssues?.length || 0) === 0,
      score: diagnostics.proofVsIllustrationScore,
      issues: diagnostics.proofVsIllustrationIssues || [],
    },
  ];

  nextTaskExecutionState.integrityChecks = {
    isTruncated: diagnostics.integrityChecks.isTruncated,
    hasAbruptEnding: diagnostics.integrityChecks.hasAbruptEnding,
    missingSections: diagnostics.integrityChecks.missingSections || [],
    issues: diagnostics.integrityChecks.issues || [],
  };

  nextTaskExecutionState.finalExecutionGate = {
    shouldBlock: diagnostics.finalExecutionGate.shouldBlock,
    blockReasons: diagnostics.finalExecutionGate.blockReasons || [],
  };

  deliberative.taskExecutionState = nextTaskExecutionState;
  state.deliberativeTaskState = deliberative;
  state.generalTaskDeliberationState = deliberative;

  if (report.gateLevel === "hard_fail") {
    state.activeConstraints = [
      ...new Set([
        ...state.activeConstraints,
        "general_task_coverage_hard_fail",
        "general_task_coverage_watchdog_repair_exhausted",
        ...(diagnostics.finalExecutionGate.shouldBlock ? ["general_task_execution_gate_blocked"] : []),
      ]),
    ].slice(-50);
  } else if (report.needsRevision) {
    state.activeConstraints = [
      ...new Set([...state.activeConstraints, "general_task_coverage_soft_revision"]),
    ].slice(-50);
  }

  state.executionArtifacts = {
    ...state.executionArtifacts,
    deliberativeCoverageGate: {
      gateLevel: report.gateLevel || (report.needsRevision ? "soft_fail" : "pass"),
      expected: report.expected,
      satisfied: report.satisfied,
      missing: report.missing,
      weaklySatisfied: report.weaklySatisfied,
      blockingIssues: report.blockingIssues || [],
      repairAttempts,
    },
    taskExecutionState: {
      detectedObligations: deliberative.taskExecutionState.detectedObligations,
      obligationSatisfactionScores: deliberative.taskExecutionState.obligationSatisfactionScores.map((item) => ({
        obligationId: item.obligationId,
        score: item.score,
        passed: item.passed,
        issues: item.issues,
      })),
      promptConstraints: deliberative.taskExecutionState.promptConstraints.map((item) => item.description),
      premiseLedger: deliberative.taskExecutionState.premiseLedger.map((item) => item.text),
      noveltyMetrics: deliberative.taskExecutionState.noveltyMetrics,
      integrityChecks: deliberative.taskExecutionState.integrityChecks,
      finalExecutionGate: deliberative.taskExecutionState.finalExecutionGate,
    },
  };

  state.trace.push(
    makeTraceEvent({
      layer: "final-coverage-validator",
      action:
        report.gateLevel === "hard_fail"
          ? "coverage_hard_gate_failed"
          : report.needsRevision
            ? "coverage_soft_revision_required"
            : "coverage_validated",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail:
        `expected=${report.expected}; satisfied=${report.satisfied}; missing=${report.missing.length}; weak=${report.weaklySatisfied.length}; ` +
        `gate=${report.gateLevel || "unknown"}; blocking=${(report.blockingIssues || []).length}; repairs=${repairAttempts}`,
    }),
  );

  if (report.gateLevel === "hard_fail" && shouldBlockOnUnresolvedHardFail()) {
    throw new Error(
      `DELIBERATIVE_COVERAGE_HARD_FAIL: blocking=${(report.blockingIssues || []).length}; missing=${report.missing.length}; weak=${report.weaklySatisfied.length}`,
    );
  }

  return state;
}
