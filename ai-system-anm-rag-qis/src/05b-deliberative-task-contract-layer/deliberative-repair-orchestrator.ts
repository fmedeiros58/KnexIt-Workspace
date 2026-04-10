/**
 * Responsabilidade:
 * - Centralizar reparo deliberativo (prompt, tentativas, timeout, fallbacks deterministico/hard-gate).
 * - Expor funcoes puras e async sem mutar o estado recebido.
 */

import type { ProcessingState } from "../bridges/contracts/processing-state";
import { createVllmClient } from "../infra/llm/vllm-client";
import type { CoverageReport } from "./deliberative-task-contract-types";
import {
  dedupeParagraphs,
  ensureNarrativeClosure,
  sanitizeRepairDraft,
  stripPromptEcho,
} from "./deliberative-response-normalizer";

const deliberativeRepairClient = createVllmClient();

function humanizeToken(text: string): string {
  return `${text || ""}`.replace(/_/g, " ").replace(/\s+/g, " ").trim();
}

export function resolveRepairTimeoutMs(): number {
  const configured = Number(process.env.AI_SYSTEM_DELIBERATIVE_REPAIR_TIMEOUT_MS || 12000);
  if (!Number.isFinite(configured)) return 12000;
  return Math.max(2000, Math.min(30000, Math.trunc(configured)));
}

export function resolveRepairAttempts(): number {
  const configured = Number(process.env.AI_SYSTEM_DELIBERATIVE_COVERAGE_REPAIR_ATTEMPTS || 2);
  if (!Number.isFinite(configured)) return 2;
  return Math.max(0, Math.min(3, Math.trunc(configured)));
}

export function shouldAttemptCoverageRepair(report: CoverageReport): boolean {
  return (
    report.gateLevel !== "pass" &&
    (
      report.missing.length > 0 ||
      report.weaklySatisfied.length > 0 ||
      (report.blockingIssues || []).length > 0
    )
  );
}

export function buildCoverageRepairPrompt(params: {
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
  const sourcePrompt = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
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
    "Nao inclua 'Usuario:', 'Leticia:', telemetria, pipeline, scores ou parametros.",
    "Cobertura integral obrigatoria: responda todos os subitens detectados e finalize sem frase truncada.",
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
    sourcePrompt ? `Pergunta do usuario (nao repetir, nao traduzir, nao parafrasear): ${sourcePrompt}` : "",
    candidate ? `Resposta atual a corrigir:\n${candidate}` : "",
    "Entregue apenas a resposta final revisada.",
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildDeterministicCoverageRecovery(state: ProcessingState): string {
  const deliberative = state.deliberativeTaskState;
  if (!deliberative?.isActive || !deliberative.reasoningContract) return "";

  const contract = deliberative.reasoningContract;
  const skeleton = deliberative.proofSkeleton;
  const models = deliberative.solutionModels || [];
  const assumptions = deliberative.assumptionLedger || [];
  const strongestSelfObjection = deliberative.strongestSelfObjection;
  const sections: string[] = [];

  for (const section of contract.requiredSections) {
    if (section === "framing_and_definitions") {
      const definitions = skeleton?.definitions?.slice(0, 3).map((item) => humanizeToken(item)).join(", ");
      const thesis = skeleton?.thesis?.slice(0, 2).map((item) => humanizeToken(item)).join(" ");
      sections.push(
        `Parto de definicoes operacionais antes de concluir: ${definitions || "escopo, restricoes e criterio de escolha"}. A tese de trabalho e ${thesis || "avaliar a compatibilidade entre exigencias concorrentes sob restricao real"}.`,
      );
      continue;
    }

    if (section === "reasoning_chain_or_proof") {
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

  return dedupeParagraphs(sections.filter(Boolean).join("\n\n")).trim();
}

export function buildHardGateRecovery(state: ProcessingState): string {
  const deterministic = buildDeterministicCoverageRecovery(state);
  if (deterministic) return ensureNarrativeClosure(deterministic);

  const deliberative = state.deliberativeTaskState;
  if (!deliberative?.reasoningContract) return "";

  const required = deliberative.reasoningContract.requiredSections || [];
  const genericSections: string[] = [];

  for (const section of required) {
    if (section === "framing_and_definitions") {
      genericSections.push(
        "Definicoes operacionais: fixo os termos centrais, o escopo do problema e as condicoes de aplicacao antes da conclusao.",
      );
      continue;
    }
    if (section === "reasoning_chain_or_proof") {
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

  return ensureNarrativeClosure(dedupeParagraphs(genericSections.join("\n\n")));
}

export async function repairDeliberativeResponse(params: {
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

export function normalizeRepairedCoverageText(state: ProcessingState, text: string): string {
  const sourcePrompt = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  return ensureNarrativeClosure(
    dedupeParagraphs(
      stripPromptEcho(text, sourcePrompt),
    ),
  );
}
