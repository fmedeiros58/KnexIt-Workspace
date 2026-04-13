import type { ProcessingState } from "../bridges/contracts/processing-state";
import { makeTraceEvent } from "../shared/utils/trace-utils";
import { runGenerationMemoryBridge } from "./generation-memory-bridge";
import { runGenerationEvidenceBridge } from "./generation-evidence-bridge";
import { runGenerationLlmBridge } from "./generation-llm-bridge";
import { buildContextInjection } from "./prompt-construction-core/context-injection-builder";
import { buildEvidenceInjection } from "./prompt-construction-core/evidence-injection-builder";
import { buildHypothesisInjection } from "./prompt-construction-core/hypothesis-injection-builder";
import { buildInferenceInjection } from "./prompt-construction-core/inference-injection-builder";
import { buildMemoryInjection } from "./prompt-construction-core/memory-injection-builder";
import { buildReflectionInjection } from "./prompt-construction-core/reflection-injection-builder";
import { buildStyleConstraints } from "./prompt-construction-core/style-constraint-builder";
import { buildSystemPrompt } from "./prompt-construction-core/system-prompt-builder";
import { buildTaskPrompt } from "./prompt-construction-core/task-prompt-builder";
import { buildDirectAnswerPath } from "./reasoning-core/direct-answer-path";
import { buildDecompositionPath } from "./reasoning-core/decomposition-path";
import { buildChainOfTasksPath } from "./reasoning-core/chain-of-tasks-path";
import { buildMultiHypothesisReasoning } from "./reasoning-core/multi-hypothesis-reasoner";
import { buildAbductiveSupportPath } from "./reasoning-core/abductive-support-path";
import { selectReasoningPath } from "./reasoning-core/compare-and-select-path";
import { buildSynthesisPath } from "./reasoning-core/synthesis-path";
import { runSelfCheckPath } from "./reasoning-core/self-check-path";
import { runReasoningToIterativeAcquisitionBridge } from "./reasoning-core/reasoning-to-iterative-acquisition-bridge";
import { buildInitialDraft } from "./draft-generation-core/initial-draft";
import { buildExpandedDraft } from "./draft-generation-core/expanded-draft";
import { buildCondensedDraft } from "./draft-generation-core/condensed-draft";
import { buildAlternativeDraft } from "./draft-generation-core/alternative-draft";
import { buildFactualAnswerFallback } from "./draft-generation-core/factual-answer-fallback";
import { applyMultimodalDraftBridge } from "./draft-generation-core/multimodal-draft-bridge";
import {
  buildConversationalFallback,
  buildNonEchoRecovery,
  isEchoLike,
  resolveConversationFocus,
} from "./draft-generation-core/chat-response-builder";
import { mergeDraftContent } from "./response-assembly-core/content-merger";
import { unifySemantics } from "./response-assembly-core/semantic-unifier";
import { removeRedundancy } from "./response-assembly-core/redundancy-remover";
import { orderSections } from "./response-assembly-core/section-ordering";
import { buildTransitions } from "./response-assembly-core/transition-builder";
import { buildConclusion } from "./response-assembly-core/conclusion-builder";
import { handoffGenerationToStructure } from "./generation-to-structure-bridge";
import { runCommunicativeElaborationBridge } from "../bridges/communicative-elaboration.bridge";
import { detectAssertionVsProofGap } from "../05b-deliberative-task-contract-layer/assertion-vs-proof-detector";
import { detectPromptRestatement } from "../05b-deliberative-task-contract-layer/prompt-restatement-detector";
import { detectProofVsIllustration } from "../05b-deliberative-task-contract-layer/proof-vs-illustration-detector";
import { checkResponseIntegrity } from "../05b-deliberative-task-contract-layer/response-integrity-gate";
import {
  isAssistantCreatorPrompt,
  isAssistantIdentityPrompt,
  isAssistantNameOriginPrompt,
  isConversationalPrompt,
  isGreetingMessage,
  isSmallTalkMessage,
} from "../shared/utils/conversation-signals";
import { buildFounderReasoningInfluence } from "../12b-founder-influence-layer/founder-reasoning-bridge";

function isGroundedSourceUrl(url: string): boolean {
  return /^https?:\/\//i.test(`${url || ""}`.trim());
}

function countGroundedSources(state: ProcessingState): number {
  return state.retrievedSources.filter((source) => isGroundedSourceUrl(source.url)).length;
}

function isDirectFactualNameQuestion(text: string): boolean {
  const normalized = `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, " ");
  return (
    /\b(governador|presidente|prefeito)\b/.test(normalized) &&
    /\b(qual|quem|nome)\b/.test(normalized)
  );
}

function hasRecentCivicAnchor(state: ProcessingState): boolean {
  return state.recentTurns
    .slice(-6)
    .some((turn) => /\b(presidente|governador|prefeito|mandato|eleit[oa]|posse)\b/i.test(turn.content));
}

function isDirectFactualTimelineQuestion(text: string, state: ProcessingState): boolean {
  const normalized = `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, " ");
  const hasTimelineCue = /\b(quando|em que ano|que ano|ano|mandato|eleit[oa]|reeleit[oa]|posse)\b/.test(normalized);
  if (!hasTimelineCue) return false;
  if (/\b(presidente|governador|prefeito)\b/.test(normalized)) return true;
  if (/\b(ele|ela|dele|dela|esse|essa)\b/.test(normalized) && hasRecentCivicAnchor(state)) return true;
  return false;
}

function isAuthorYearReferencePrompt(text: string): boolean {
  const normalized = `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  if (!normalized) return false;
  const hasAuthorFrame =
    /\b(segundo|conforme|de acordo com|autor|autora|presented by|according to)\b/.test(normalized) ||
    /\b(de|da|do)\s+[a-z][a-z.'\-\s]{1,80}\s*\((19|20)\d{2}\)/.test(normalized);
  const hasInlineAuthorYear = /\b[a-z][a-z.'\-\s]{1,80}\s*\((19|20)\d{2}\)/.test(normalized);
  const hasYear = /\b(19|20)\d{2}\b/.test(normalized);
  const hasAcademicSourceCue = /\b(dissertacao|tese|artigo|paper|estudo|livro|obra|resenha|citacao|referencia)\b/.test(
    normalized,
  );
  return hasYear && hasAcademicSourceCue && (hasAuthorFrame || hasInlineAuthorYear);
}

function normalizeForTemporalIntent(text: string): string {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isCurrentDateQuestion(text: string): boolean {
  const normalized = normalizeForTemporalIntent(text);
  if (!normalized) return false;

  const asksDate =
    /\b(que dia e hoje|qual o dia de hoje|qual dia e hoje|qual e a data de hoje|data de hoje|dia de hoje)\b/.test(normalized) ||
    (/\b(hoje)\b/.test(normalized) && /\b(que dia|qual dia|data)\b/.test(normalized));
  const asksTimeOnly = /\b(que horas sao|hora agora|horas agora|que horas e agora)\b/.test(normalized);
  return asksDate && !asksTimeOnly;
}

function capitalizeFirst(text: string): string {
  if (!text) return text;
  return text[0].toUpperCase() + text.slice(1);
}

function buildCurrentDateAnswer(timeZone = "America/Sao_Paulo"): string {
  const now = new Date();
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone }).format(now);
  const fullDate = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(now);
  return `Hoje e ${capitalizeFirst(weekday)}, ${fullDate}.`;
}

function resolveReflectiveObjectiveFinalAnswer(state: ProcessingState): string | null {
  const reflective = state.executionArtifacts.reflective;
  if (!reflective?.objectiveRationality?.shouldForceDirectAnswer) return null;
  const answer = `${reflective.objectiveFinalAnswer || ""}`.trim();
  if (!answer) return null;
  return answer;
}

function buildUnresolvedFactualMessage(state: ProcessingState): string {
  const sourceCount = state.retrievedSources.length;
  if (sourceCount > 0) {
    return "Nao consegui confirmar com seguranca o fato pedido nas fontes recuperadas. Posso refazer priorizando fontes oficiais e mais recentes.";
  }
  return "Nao encontrei fontes suficientes para confirmar o fato com seguranca. Posso refazer a busca web agora.";
}

function buildReferenceGroundingMessage(state: ProcessingState): string {
  const groundedSourceCount = countGroundedSources(state);
  if (groundedSourceCount > 0) {
    return "As fontes recuperadas nao permitem confirmar com seguranca a referencia autor-ano pedida. Se voce enviar o trecho ou link da dissertacao, eu explico com base nela.";
  }
  return "Nao encontrei base documental para sustentar a referencia autor-ano pedida. Envie o trecho, link ou DOI da dissertacao para eu explicar com lastro.";
}

function normalizeForDeepFallback(text: string): string {
  return `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function buildGenericDeepFallback(state: ProcessingState): string {
  const complexity = Math.max(state.complexityProfile.score || 0, state.preRouteSignals?.quickComplexity || 0);
  const depthLabel = complexity >= 0.65 ? "alto" : complexity >= 0.45 ? "medio-alto" : "medio";
  return [
    "- A solicitacao exige resposta analitica e nao apenas definicional.",
    "",
    "Premissas de trabalho:",
    "1. O problema envolve objetivos em tensao e restricao de recursos.",
    "2. Decisoes locais podem gerar efeitos sistemicos em cascata.",
    "3. A melhor resposta depende de criterio explicito e trade-off assumido.",
    "",
    "Metodo aplicado:",
    "- decompor o problema em variaveis,",
    "- comparar cenarios com criterios explicitos,",
    "- explicitar riscos de curto e longo prazo,",
    "- revisar a propria recomendacao por critica forte quando necessario.",
    "",
    `Nivel de profundidade aplicado: ${depthLabel}.`,
    "",
    "Resposta objetiva:",
    `- Recomendo tratar o problema por matriz multicriterio com revisao periodica e controle de risco, evitando resposta unica sem justificativa.`,
  ].join("\n");
}

function buildLogicalFrameDeepFallback(state: ProcessingState): string {
  const frame = state.logicalFrame;
  if (!frame) return "";
  const message = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  if (frame.dominantPrinciple === "unknown" && frame.confidence < 0.45) return "";
  if (!frame.shouldAffectRouting && !frame.shouldAffectRetrieval && frame.confidence < 0.55) return "";
  if (!frame.primaryGoal && !frame.recommendedAction && frame.feasibleActions.length === 0) return "";

  const topFeasible = frame.feasibleActions.slice(0, 3);
  const topRejected = frame.rejectedActions.slice(0, 2);

  const lines: string[] = [
    `- Objetivo principal: ${frame.primaryGoal || "nao explicitado com precisao"}.`,
    `- Principio dominante: ${frame.dominantPrinciple}.`,
    ...(frame.secondaryGoals.length ? [`- Objetivos secundarios: ${frame.secondaryGoals.join("; ")}.`] : []),
    ...(frame.constraints.length ? [`- Restricoes relevantes: ${frame.constraints.slice(0, 4).join("; ")}.`] : []),
    ...(frame.realWorldConditions.length ? [`- Condicoes do mundo real: ${frame.realWorldConditions.slice(0, 4).join("; ")}.`] : []),
    ...(frame.relevantCosts.length ? [`- Custos relevantes: ${frame.relevantCosts.join(", ")}.`] : []),
    "",
    "Acoes factiveis:",
  ];

  if (topFeasible.length > 0) {
    for (const action of topFeasible) {
      const marginal = typeof action.estimatedMarginalCost === "number" ? `; custo marginal=${action.estimatedMarginalCost}` : "";
      lines.push(`- ${action.label}: ${action.rationale}${marginal}.`);
    }
  } else {
    lines.push("- Ainda sem acoes suficientemente factiveis com os dados atuais.");
  }

  if (topRejected.length > 0) {
    lines.push("", "Acoes rejeitadas:");
    for (const rejected of topRejected) {
      lines.push(`- ${rejected.label}: ${rejected.reason}.`);
    }
  }

  lines.push(
    "",
    "Recomendacao:",
    frame.recommendedAction
      ? `- Melhor acao pratica: ${frame.recommendedAction}.`
      : "- Melhor acao pratica: ainda indefinida com confianca adequada.",
    `- Justificativa: ${frame.recommendationReason || "melhor relacao entre objetivo principal, restricoes e custo marginal."}`,
    `- Confianca do quadro logico: ${frame.confidence.toFixed(2)}.`,
  );

  return lines.join("\n");
}

function buildDeterministicDeepFallback(state: ProcessingState): string {
  const message = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  if (!message) return "";
  const deliberative = state.generalTaskDeliberationState || state.deliberativeTaskState;
  if (deliberative?.isActive && deliberative.reasoningContract) {
    const obligationTypes = new Set(deliberative.obligationGraph.map((item) => item.type));
    const requiredExecutions: string[] = [];
    if (obligationTypes.has("demonstration")) requiredExecutions.push("demonstracao com premissas, condicoes e derivacao");
    if (obligationTypes.has("distinction")) requiredExecutions.push("distincao conceitual entre categorias proximas");
    if (obligationTypes.has("proposal") || obligationTypes.has("comparison") || obligationTypes.has("decision")) {
      requiredExecutions.push("comparacao de modelos com mecanismo interno explicito");
    }
    if (obligationTypes.has("evaluation")) requiredExecutions.push("avaliacao de custos logicos, morais e institucionais");
    if (obligationTypes.has("objection")) requiredExecutions.push("objecao steelman contra a opcao preferida");
    if (obligationTypes.has("reformulation")) requiredExecutions.push("reformulacao sob incerteza e dados incompletos");
    if (obligationTypes.has("assumption_audit")) requiredExecutions.push("ledger de pressupostos nao demonstrados");
    const paragraph1 = [
      deliberative.taskArchetypes.length > 0
        ? `A tarefa exige operacoes como ${deliberative.taskArchetypes.join(", ")}.`
        : "A tarefa exige execucao analitica completa.",
      deliberative.cognitiveDemands.length > 0
        ? `Isso pede demandas de raciocinio como ${deliberative.cognitiveDemands.join(", ")}.`
        : "",
      requiredExecutions.length > 0
        ? `Portanto, a resposta precisa cobrir ${requiredExecutions.join(", ")} antes de encerrar.`
        : "",
    ]
      .filter(Boolean)
      .join(" ");

    const paragraph2 = deliberative.solutionModels.length > 0
      ? `Os modelos considerados incluem ${deliberative.solutionModels
          .slice(0, 3)
          .map((model) => `${model.title}, cujo nucleo normativo e ${model.normativeCore}`)
          .join("; ")}. A comparacao entre eles deve explicitar mecanismo, principio menos sacrificado e risco dominante.`
      : "A resposta precisa comparar alternativas com mecanismo interno, trade-offs e criterio de escolha explicito.";

    const paragraph3 = [
      deliberative.strongestSelfObjection
        ? `A critica mais forte a enfrentar e: ${deliberative.strongestSelfObjection}.`
        : "A conclusao so e robusta se enfrentar a melhor objecao disponivel.",
      deliberative.assumptionLedger.length > 0
        ? `Ao final, ainda precisam ser expostos pressupostos e limites como ${deliberative.assumptionLedger
            .slice(0, 4)
            .map((item) => item.statement)
            .join("; ")}.`
        : "",
      "O fechamento deve sintetizar a resposta sem repetir o enunciado e deixando os trade-offs explicitos.",
    ]
      .filter(Boolean)
      .join(" ");

    return [paragraph1, paragraph2, paragraph3].filter(Boolean).join("\n\n");
  }
  const logicalFrameFallback = buildLogicalFrameDeepFallback(state);
  if (logicalFrameFallback) return logicalFrameFallback;
  return buildGenericDeepFallback(state);
}

function isCollapsedSummaryPromptReplay(state: ProcessingState, summary: string): boolean {
  if (!summary) return false;
  if (/\bleitura factual direta\b|\bevidencia-guia\b|\bleitura contextual-comparativa\b/i.test(summary)) return true;
  const prompt = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  if (!prompt) return false;
  if (isEchoLike(summary, prompt)) return true;

  const normalizedSummary = normalizeForDeepFallback(summary);
  const normalizedPrompt = normalizeForDeepFallback(prompt);
  if (!normalizedSummary || !normalizedPrompt) return false;
  const promptHead = normalizedPrompt.slice(0, Math.min(160, normalizedPrompt.length));
  return promptHead.length > 40 && normalizedSummary.includes(promptHead);
}

function hasDeclarativeExecutionScaffold(text: string): boolean {
  const normalized = normalizeForDeepFallback(text);
  if (!normalized) return false;
  return /\b(demonstraremos|mostraremos|proponhamos|diremos|faremos o seguinte|nesta resposta vou|vou demonstrar|vou mostrar|i will demonstrate|i will show|let me demonstrate|let me clarify|we will show)\b/.test(
    normalized,
  );
}

function hasPromptReplayLead(text: string): boolean {
  const normalized = normalizeForDeepFallback(text);
  if (!normalized) return false;
  return /^(consideremos|considere)\b/.test(normalized) ||
    /\b(agora suponha|imagine agora|sem recorrer inicialmente|follow these steps|do the following)\b/.test(normalized);
}

function hasDeliberativeExecutionGap(state: ProcessingState, draft: string): boolean {
  const cleanedDraft = `${draft || ""}`.trim();
  if (!cleanedDraft) return true;

  const prompt = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  const deliberative = state.generalTaskDeliberationState || state.deliberativeTaskState;
  const expectedObligations = deliberative?.obligationGraph?.length || 0;

  const restatement = detectPromptRestatement(prompt, cleanedDraft);
  if (
    restatement.detected &&
    (
      restatement.score >= 0.38 ||
      restatement.issues.includes("meta_restatement_lead") ||
      restatement.issues.includes("portuguese_prompt_replay_lead") ||
      restatement.issues.includes("first_paragraph_prompt_replay")
    )
  ) {
    return true;
  }

  const integrity = checkResponseIntegrity({
    responseText: cleanedDraft,
    expectedObligations,
    satisfiedObligations: 0,
  });
  if (integrity.isTruncated || integrity.hasAbruptEnding) {
    return true;
  }

  if (hasDeclarativeExecutionScaffold(cleanedDraft) || hasPromptReplayLead(cleanedDraft)) {
    return true;
  }

  const requiresDemonstration = Boolean(
    deliberative?.obligationGraph?.some((item) => item.type === "demonstration"),
  );
  if (requiresDemonstration) {
    const proofVsIllustration = detectProofVsIllustration(cleanedDraft, {
      requiresDemonstration: true,
    });
    const assertionVsProof = detectAssertionVsProofGap(cleanedDraft);
    if (!proofVsIllustration.passed || !assertionVsProof.passed) {
      return true;
    }
  }

  return false;
}

function resolveSafeSummary(state: ProcessingState): string {
  const deepMandatoryTurn = isDeepPipelineMandatoryTurn(state);
  const collapsedSummary = `${state.collapsedTruth.summary || ""}`.trim();
  if (
    collapsedSummary &&
    !isEchoLike(collapsedSummary, state.normalizedMessage) &&
    !(deepMandatoryTurn && isCollapsedSummaryPromptReplay(state, collapsedSummary))
  ) {
    return collapsedSummary;
  }
  const groundedSourceCount = countGroundedSources(state);
  if (isAuthorYearReferencePrompt(state.normalizedMessage) && groundedSourceCount === 0) {
    return "Nao ha base documental suficiente para uma sintese autor-ano confiavel neste turno.";
  }
  if (groundedSourceCount > 0) {
    return "Ha indicios parciais nas fontes recuperadas, mas ainda sem base suficiente para uma sintese confiavel.";
  }
  if (!state.preRouteSignals?.hasVerifiableSignal && !state.preRouteSignals?.hasRecencySignal) {
    if (deepMandatoryTurn) {
      const deepRecovery = buildDeterministicDeepFallback(state);
      if (deepRecovery) return deepRecovery;
    }
    const conceptualRecovery = `${buildNonEchoRecovery(state) || ""}`.trim();
    if (conceptualRecovery && !isEchoLike(conceptualRecovery, state.normalizedMessage)) {
      return conceptualRecovery;
    }
  }
  if (deepMandatoryTurn) {
    const deepRecovery = buildDeterministicDeepFallback(state);
    if (deepRecovery) return deepRecovery;
  }
  return "Nao ha evidencias suficientes no contexto atual para uma sintese confiavel.";
}

function isDeepPipelineMandatoryTurn(state: ProcessingState): boolean {
  const message = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  if (!message) return false;
  if (state.preRouteSignals?.greetingFastLaneEligible) return false;
  if (isGreetingMessage(message) || isSmallTalkMessage(message)) return false;
  if (state.preRouteSignals?.safetyAction === "caution") return false;
  return true;
}

function shouldRejectLowDepthLlmDraft(state: ProcessingState, draft: string): boolean {
  if (!isDeepPipelineMandatoryTurn(state)) return false;
  const cleanedDraft = `${draft || ""}`.trim();
  if (!cleanedDraft) return true;
  const normalizedDraft = normalizeForDeepFallback(cleanedDraft);
  const normalizedPrompt = normalizeForDeepFallback(`${state.normalizedMessage || state.rawMessage || ""}`);
  const deliberative = state.generalTaskDeliberationState || state.deliberativeTaskState;
  const deliberativeCoverage = deliberative?.coverageReport;

  const focusReference = resolveConversationFocus(state.normalizedMessage);
  if (isEchoLike(cleanedDraft, state.normalizedMessage) || isEchoLike(cleanedDraft, focusReference)) {
    return true;
  }
  if (hasDeliberativeExecutionGap(state, cleanedDraft)) {
    return true;
  }
  const promptRestatement = detectPromptRestatement(`${state.normalizedMessage || state.rawMessage || ""}`, cleanedDraft);
  if (promptRestatement.detected && (promptRestatement.score >= 0.5 || promptRestatement.overlapRatio >= 0.72)) {
    return true;
  }

  if (/^\s*(ola|oi+|opa+)\b/i.test(normalizedDraft)) return true;
  if (/^\s*(?:leticia:)?\s*ola,\s+usuario\b/i.test(normalizedDraft)) return true;
  if (/\b(pipeline|modulo|telemetria|trace|execution plan|selectedroute)\b/i.test(normalizedDraft)) return true;
  if (/\b(?:based on the context|literal or biological|metaphorical|figurative sense)\b/i.test(normalizedDraft)) return true;

  const complexity = Math.max(state.complexityProfile.score || 0, state.preRouteSignals?.quickComplexity || 0);
  const minChars = complexity >= 0.6 ? 260 : complexity >= 0.4 ? 180 : 130;
  if (cleanedDraft.length < minChars) return true;

  const sentenceCount = cleanedDraft
    .split(/[.!?]+/g)
    .map((item) => item.trim())
    .filter(Boolean).length;
  if (sentenceCount < 2) return true;

  const likelyPortuguesePrompt =
    /\b(que|como|porque|por que|qual|quem|entre|com|para|linguagem|cognicao|identidade|leticia|voce|nao)\b/.test(
      normalizedPrompt,
    );
  const englishFunctionHits = (normalizedDraft.match(/\b(the|and|is|are|with|between|through|firstly|however|therefore|will|can)\b/g) || [])
    .length;
  if (likelyPortuguesePrompt && englishFunctionHits >= 5) return true;

  const logicalFrame = state.logicalFrame;
  if (logicalFrame?.shouldAffectRouting && logicalFrame.recommendedAction) {
    const recommendedHead = normalizeForDeepFallback(logicalFrame.recommendedAction).split(" ").slice(0, 6).join(" ");
    if (recommendedHead && !normalizedDraft.includes(recommendedHead)) return true;
  }
  if (/\b(criador|quem te criou|origem do nome|medeiros)\b/.test(normalizedPrompt)) {
    if (/\b(nao possuo criador|nao tenho criador|sem criador)\b/.test(normalizedDraft)) return true;
  }

  if (deliberative?.isActive) {
    if (
      deliberativeCoverage &&
      deliberativeCoverage.gateLevel !== "hard_fail" &&
      !deliberativeCoverage.executionDiagnostics?.finalExecutionGate.shouldBlock &&
      (deliberativeCoverage.missing || []).length === 0 &&
      (deliberativeCoverage.blockingIssues || []).length === 0
    ) {
      return false;
    }

    const obligationCount = deliberative.obligationGraph.length;
    const minDeliberativeChars = Math.max(520, 140 * Math.max(2, obligationCount));
    if (cleanedDraft.length < minDeliberativeChars) return true;
    if (obligationCount >= 6 && !/\b(conclusao|sintese final|fechamento)\b/.test(normalizedDraft)) return true;

    const needsObjection = deliberative.obligationGraph.some((item) => item.type === "objection");
    if (needsObjection && !/\b(obje[cç]ao|objecao|steelman|contra argumento)\b/.test(normalizedDraft)) return true;

    const needsAssumptionAudit = deliberative.obligationGraph.some((item) => item.type === "assumption_audit");
    if (needsAssumptionAudit && !/\b(pressupostos|premissas? nao provad|sem provar|limites)\b/.test(normalizedDraft)) {
      return true;
    }

    const needsAlternatives = deliberative.obligationGraph.some(
      (item) => item.type === "proposal" || item.type === "comparison" || item.type === "decision",
    );
    if (needsAlternatives && !/\b(alternativa|modelo|opcao|cenario)\b/.test(normalizedDraft)) return true;
  }

  return false;
}
function buildDeliberativeContractInjection(state: ProcessingState): string {
  const deliberative = state.generalTaskDeliberationState || state.deliberativeTaskState;
  if (!deliberative?.isActive || !deliberative.reasoningContract) return "";
  const obligationTypes = new Set(deliberative.obligationGraph.map((item) => item.type));
  const directives = [
    "Deliberative execution requirements:",
    "- Keep the response in natural pt-BR and do not mirror the prompt.",
    "- Do not expose internal contract metadata, section names, counters or scores.",
    "- Deliver the answer as continuous reasoning, not as a visible checklist.",
  ];

  if (obligationTypes.has("demonstration")) {
    directives.push("- When formal support is needed, derive the conclusion from premises or conditions instead of merely asserting it.");
  }
  if (obligationTypes.has("distinction")) {
    directives.push("- Separate close categories explicitly before advancing the conclusion.");
  }
  if (
    obligationTypes.has("proposal") ||
    obligationTypes.has("comparison") ||
    obligationTypes.has("planning") ||
    obligationTypes.has("decision")
  ) {
    directives.push("- When alternatives are required, explain mechanism, trade-offs and the final choice rationale.");
  }
  if (obligationTypes.has("objection")) {
    directives.push("- Include the strongest objection against the preferred solution before the final closure.");
  }
  if (obligationTypes.has("assumption_audit")) {
    directives.push("- End by exposing assumptions and limits that were used without proof when that is required.");
  }

  return directives.join("\n");
}

function buildPrompt(state: ProcessingState): string {
  const communicativeInjection = state.communicativeElaborationState
    ? [
        "Communicative elaboration (co-construction):",
        `- Idea seed: ${state.communicativeElaborationState.ideaSeed.coreClaim}`,
        `- Tensions: ${state.communicativeElaborationState.tensions.map((row) => `${row.poleA} x ${row.poleB}`).join("; ") || "none"}`,
        `- Hypothesis branches: ${state.communicativeElaborationState.hypothesisBranches.map((row) => row.claim).join(" | ") || "none"}`,
        `- Refinement unresolved points: ${state.communicativeElaborationState.refinement.unresolvedPoints.join(", ") || "none"}`,
      ].join("\n")
    : "";

  return [
    buildSystemPrompt(),
    buildTaskPrompt(state),
    buildDeliberativeContractInjection(state),
    buildContextInjection(state),
    buildMemoryInjection(state),
    buildEvidenceInjection(state),
    buildHypothesisInjection(state),
    buildReflectionInjection(state),
    buildInferenceInjection(state),
    buildStyleConstraints(state),
    communicativeInjection,
  ].join("\n");
}

function buildReasoningBlock(state: ProcessingState): string {
  const route = selectReasoningPath({
    complexity: state.complexityProfile.score,
    uncertainty: state.collapsedTruth.uncertainty,
    evidenceCount: state.retrievedEvidence.length,
  });

  const direct = buildDirectAnswerPath(state);
  const decomposition = buildDecompositionPath(state);
  const chain = buildChainOfTasksPath(decomposition);
  const multi = buildMultiHypothesisReasoning(state);
  const abductive = buildAbductiveSupportPath(state);
  const synthesis = buildSynthesisPath([direct, chain, multi, abductive]);

  if (route === "direct") return direct;
  if (route === "decomposition") return [chain, multi, abductive].join("\n");
  return synthesis;
}

export async function runGenerationLayer(state: ProcessingState): Promise<ProcessingState> {
  const startedAt = Date.now();
  const founderReasoningInfluence = buildFounderReasoningInfluence();

  state.executionArtifacts.founderInfluence = {
    founderName: founderReasoningInfluence.founderName,
    founderRole: state.executionArtifacts.founderInfluence?.founderRole || "fundador_epistemologico_da_leticia",
    identityWeight: state.executionArtifacts.founderInfluence?.identityWeight || 0,
    reasoningWeight: founderReasoningInfluence.reasoningWeight,
    epistemicWeight: state.executionArtifacts.founderInfluence?.epistemicWeight || 0,
    identityInfluenceDirectives: [...(state.executionArtifacts.founderInfluence?.identityInfluenceDirectives || [])],
    reasoningInfluenceDirectives: [...founderReasoningInfluence.reasoningInfluenceDirectives],
    validationInfluenceDirectives: [...(state.executionArtifacts.founderInfluence?.validationInfluenceDirectives || [])],
    existentialVectors: [...new Set([...(state.executionArtifacts.founderInfluence?.existentialVectors || []), ...founderReasoningInfluence.existentialVectors])],
    epistemicVectors: [...new Set([...(state.executionArtifacts.founderInfluence?.epistemicVectors || []), ...founderReasoningInfluence.epistemicVectors])],
    protectedGroundingFacts: [...new Set([...(state.executionArtifacts.founderInfluence?.protectedGroundingFacts || []), ...founderReasoningInfluence.protectedGroundingFacts])],
  };

  await runGenerationMemoryBridge(state);
  await runGenerationEvidenceBridge(state);
  const reasoningAugmentedEvidence = await runReasoningToIterativeAcquisitionBridge(state);
  await runGenerationLlmBridge(state);
  await runCommunicativeElaborationBridge(state);
  const groundedSourceCount = countGroundedSources(state);
  const llmDraft = state.executionArtifacts.generationRuntime?.llmDraft || "";
  const llmDraftAvailable = llmDraft.trim().length > 0;
  const reflectiveObjectiveAnswer = resolveReflectiveObjectiveFinalAnswer(state);

  if (isCurrentDateQuestion(state.normalizedMessage)) {
    const directDateAnswer = applyMultimodalDraftBridge(
      buildCurrentDateAnswer(),
      state.inputSignals.modality,
    );
    state.generationPrompt = buildPrompt(state);
    state.draftResponse = {
      text: directDateAnswer,
      sections: [{ title: "Resposta", content: directDateAnswer }],
    };
    state.trace.push(
      makeTraceEvent({
        layer: "generation",
        action: "date_question_resolved_directly",
        route: state.executionPlan.selectedRoute,
        latencyMs: Date.now() - startedAt,
        detail: "temporal_guard=enabled; source=system_clock; timezone=America/Sao_Paulo",
      }),
    );
    return handoffGenerationToStructure(state);
  }

  const factualFallback = buildFactualAnswerFallback({
    question: state.normalizedMessage,
    sources: state.retrievedSources,
  });
  if (factualFallback && !llmDraftAvailable) {
    const factualText = applyMultimodalDraftBridge(factualFallback.answer, state.inputSignals.modality);
    state.generationPrompt = buildPrompt(state);
    state.draftResponse = {
      text: factualText,
      sections: [{ title: "Resposta", content: factualText }],
    };
    state.trace.push(
      makeTraceEvent({
        layer: "generation",
        action: "factual_fallback_generated",
        route: state.executionPlan.selectedRoute,
        latencyMs: Date.now() - startedAt,
        detail:
          `role=${factualFallback.role}; place=${factualFallback.place}; confidence=${factualFallback.confidence.toFixed(2)}; ` +
          `iterativeAugmentation=${reasoningAugmentedEvidence ? "true" : "false"}`,
      }),
    );
    return handoffGenerationToStructure(state);
  }

  if (
    !llmDraftAvailable &&
    (
      isDirectFactualNameQuestion(state.normalizedMessage) ||
      isDirectFactualTimelineQuestion(state.normalizedMessage, state)
    )
  ) {
    const unresolvedText = applyMultimodalDraftBridge(
      buildUnresolvedFactualMessage(state),
      state.inputSignals.modality,
    );
    state.generationPrompt = buildPrompt(state);
    state.draftResponse = {
      text: unresolvedText,
      sections: [{ title: "Resposta", content: unresolvedText }],
    };
    state.trace.push(
      makeTraceEvent({
        layer: "generation",
        action: "factual_fallback_unresolved",
        route: state.executionPlan.selectedRoute,
        latencyMs: Date.now() - startedAt,
        detail: `sources=${state.retrievedSources.length}`,
      }),
    );
    return handoffGenerationToStructure(state);
  }

  if (!llmDraftAvailable && isAuthorYearReferencePrompt(state.normalizedMessage) && groundedSourceCount === 0) {
    const unresolvedText = applyMultimodalDraftBridge(
      buildReferenceGroundingMessage(state),
      state.inputSignals.modality,
    );
    state.generationPrompt = buildPrompt(state);
    state.draftResponse = {
      text: unresolvedText,
      sections: [{ title: "Resposta", content: unresolvedText }],
    };
    state.trace.push(
      makeTraceEvent({
        layer: "generation",
        action: "reference_grounding_required",
        route: state.executionPlan.selectedRoute,
        latencyMs: Date.now() - startedAt,
        detail: `author_year_reference_without_grounded_sources; totalSources=${state.retrievedSources.length}; groundedSources=${groundedSourceCount}`,
      }),
    );
    return handoffGenerationToStructure(state);
  }

  const focusForFallbackPriority = resolveConversationFocus(state.normalizedMessage);
  const deepMandatoryTurn = isDeepPipelineMandatoryTurn(state);
  const shouldPrioritizeConversationalFallback =
    isAssistantIdentityPrompt(focusForFallbackPriority) ||
    isAssistantNameOriginPrompt(focusForFallbackPriority) ||
    isAssistantCreatorPrompt(focusForFallbackPriority);

  if (shouldPrioritizeConversationalFallback && !llmDraftAvailable && !deepMandatoryTurn) {
    const priorityFallback = buildConversationalFallback(state);
    if (priorityFallback) {
      const chatText = applyMultimodalDraftBridge(priorityFallback, state.inputSignals.modality);
      state.generationPrompt = buildPrompt(state);
      state.draftResponse = {
        text: chatText,
        sections: [{ title: "Resposta", content: chatText }],
      };
      state.trace.push(
        makeTraceEvent({
          layer: "generation",
          action: "chat_fallback_priority_generated",
          route: state.executionPlan.selectedRoute,
          latencyMs: Date.now() - startedAt,
          detail: "mode=chat-fallback-priority; reason=identity_cue",
        }),
      );
      return handoffGenerationToStructure(state);
    }
  }

  const shouldPrioritizeClarificationFallback =
    state.selectedMode === "chat" &&
    state.conversationState.needsClarification &&
    (
      isConversationalPrompt(state.normalizedMessage) ||
      state.normalizedMessage.trim().split(/\s+/g).filter(Boolean).length <= 8
    );
  if (shouldPrioritizeClarificationFallback && !llmDraftAvailable && !deepMandatoryTurn) {
    const clarificationFallback = buildConversationalFallback(state);
    if (clarificationFallback) {
      const chatText = applyMultimodalDraftBridge(clarificationFallback, state.inputSignals.modality);
      state.generationPrompt = buildPrompt(state);
      state.draftResponse = {
        text: chatText,
        sections: [{ title: "Resposta", content: chatText }],
      };
      state.trace.push(
        makeTraceEvent({
          layer: "generation",
          action: "chat_clarification_fallback_generated",
          route: state.executionPlan.selectedRoute,
          latencyMs: Date.now() - startedAt,
          detail: "mode=chat-fallback-priority; reason=conversation_clarification",
        }),
      );
      return handoffGenerationToStructure(state);
    }
  }

  if (reflectiveObjectiveAnswer && !llmDraftAvailable) {
    const objectiveText = applyMultimodalDraftBridge(
      reflectiveObjectiveAnswer,
      state.inputSignals.modality,
    );
    state.generationPrompt = buildPrompt(state);
    state.draftResponse = {
      text: objectiveText,
      sections: [{ title: "Resposta", content: objectiveText }],
    };
    state.trace.push(
      makeTraceEvent({
        layer: "generation",
        action: "reflective_objective_answer_adopted",
        route: state.executionPlan.selectedRoute,
        latencyMs: Date.now() - startedAt,
        detail: "source=reflective_objective_rationality",
      }),
    );
    return handoffGenerationToStructure(state);
  }

  let llmDraftRejectedForDepth = false;
  if (llmDraft) {
    if (shouldRejectLowDepthLlmDraft(state, llmDraft)) {
      llmDraftRejectedForDepth = true;
      state.activeConstraints = [
        ...new Set([...state.activeConstraints, "llm_deep_low_depth_rejected"]),
      ].slice(-32);
    } else {
      const llmText = applyMultimodalDraftBridge(llmDraft, state.inputSignals.modality);
      state.generationPrompt = buildPrompt(state);
      state.draftResponse = {
        text: llmText,
        sections: [{ title: "Resposta", content: llmText }],
      };
      state.trace.push(
        makeTraceEvent({
          layer: "generation",
          action: "llm_runtime_draft_adopted",
          route: state.executionPlan.selectedRoute,
          latencyMs: Date.now() - startedAt,
          detail: `chars=${llmDraft.length}`,
        }),
      );
      return handoffGenerationToStructure(state);
    }
  }

  if (deepMandatoryTurn && (!llmDraftAvailable || llmDraftRejectedForDepth)) {
    const deterministicDeep = `${buildDeterministicDeepFallback(state) || ""}`.trim();
    if (deterministicDeep) {
      const deepText = applyMultimodalDraftBridge(deterministicDeep, state.inputSignals.modality);
      state.generationPrompt = buildPrompt(state);
      state.draftResponse = {
        text: deepText,
        sections: [{ title: "Resposta", content: deepText }],
      };
      state.trace.push(
        makeTraceEvent({
          layer: "generation",
          action: "deep_deterministic_fallback_generated",
          route: state.executionPlan.selectedRoute,
          latencyMs: Date.now() - startedAt,
          detail: `llmDraftAvailable=${llmDraftAvailable}; llmRejectedForDepth=${llmDraftRejectedForDepth}`,
        }),
      );
      return handoffGenerationToStructure(state);
    }
  }

  const conversationalFallback = buildConversationalFallback(state);
  if (conversationalFallback && !deepMandatoryTurn) {
    const chatText = applyMultimodalDraftBridge(conversationalFallback, state.inputSignals.modality);
    state.generationPrompt = buildPrompt(state);
    state.draftResponse = {
      text: chatText,
      sections: [{ title: "Resposta", content: chatText }],
    };
    state.trace.push(
      makeTraceEvent({
        layer: "generation",
        action: "chat_fallback_generated",
        route: state.executionPlan.selectedRoute,
        latencyMs: Date.now() - startedAt,
        detail: `mode=chat-fallback; iterativeAugmentation=${reasoningAugmentedEvidence ? "true" : "false"}`,
      }),
    );
    return handoffGenerationToStructure(state);
  }

  state.generationPrompt = buildPrompt(state);
  const safeSummary = resolveSafeSummary(state);
  const initialDraft = buildInitialDraft({
    summary: safeSummary,
    status: state.epistemicStatus,
    confidence: state.confidenceScores.epistemic,
  });

  const reasoningBlock = buildReasoningBlock(state);
  const expanded = buildExpandedDraft(initialDraft, [reasoningBlock, ...state.inferentialMap.implications.slice(0, 3)]);
  const condensed = buildCondensedDraft(expanded);
  const alternative = buildAlternativeDraft({
    summary: safeSummary,
    caveat: state.criticalCaveats[0] || "sem ressalvas adicionais",
  });

  const merged = mergeDraftContent([condensed, alternative]);
  const unified = unifySemantics(merged);
  const deduped = removeRedundancy(unified);
  const transitioned = buildTransitions(deduped.split(/\n{2,}/g).filter(Boolean)).join("\n\n");
  const conclusion = buildConclusion({
    summary: safeSummary,
    epistemicStatus: state.epistemicStatus,
  });
  let finalDraftText = applyMultimodalDraftBridge(`${transitioned}\n\n${conclusion}`, state.inputSignals.modality);
  const focusReference = resolveConversationFocus(state.normalizedMessage);
  if (
    isEchoLike(finalDraftText, state.normalizedMessage) ||
    isEchoLike(finalDraftText, focusReference)
  ) {
    const deterministicDeep = deepMandatoryTurn ? `${buildDeterministicDeepFallback(state) || ""}`.trim() : "";
    finalDraftText = applyMultimodalDraftBridge(
      deterministicDeep || buildNonEchoRecovery(state),
      state.inputSignals.modality,
    );
  }

  const sections = orderSections([
    { title: "Resposta", content: safeSummary },
    { title: "Base inferencial", content: state.inferentialMap.implications.join(" ") || "sem implicacoes" },
    { title: "Caveats", content: state.criticalCaveats.join(" ") || "sem caveats" },
    { title: "Conclusao", content: conclusion },
  ]);

  const selfCheck = runSelfCheckPath({ text: finalDraftText, caveats: state.criticalCaveats });
  if (!selfCheck.ok) {
    state.activeConstraints = [...state.activeConstraints, ...selfCheck.notes].slice(-16);
  }

  state.draftResponse = {
    text: finalDraftText,
    sections,
  };

  state.trace.push(
    makeTraceEvent({
      layer: "generation",
      action: "draft_generated",
      route: state.executionPlan.selectedRoute,
      latencyMs: Date.now() - startedAt,
      detail: `sections=${sections.length}; selfCheckOk=${selfCheck.ok}`,
    }),
  );

  return handoffGenerationToStructure(state);
}
