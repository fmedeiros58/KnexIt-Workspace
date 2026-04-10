import type { ProcessingState } from "../bridges/contracts/processing-state";
import { createVllmClient, vllmClientInfo } from "../infra/llm/vllm-client";
import { isConversationalPrompt, isGreetingMessage, isSmallTalkMessage } from "../shared/utils/conversation-signals";
import { responseCoverageValidator } from "../05b-deliberative-task-contract-layer/response-coverage-validator";
import {
  dedupeParagraphs,
  normalizeDeliberativeText,
  stripPromptEcho,
} from "../05b-deliberative-task-contract-layer/deliberative-response-normalizer";
import {
  buildHardGateRecovery,
  normalizeRepairedCoverageText,
  repairDeliberativeResponse,
  resolveRepairAttempts,
  shouldAttemptCoverageRepair,
} from "../05b-deliberative-task-contract-layer/deliberative-repair-orchestrator";
import type { CoverageReport } from "../05b-deliberative-task-contract-layer/deliberative-task-contract-types";

const vllmClient = createVllmClient();

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const normalized = `${process.env[name] ?? ""}`.trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function shouldUseLlmRuntime(state: ProcessingState): boolean {
  if (!readBooleanEnv("AI_SYSTEM_ENABLE_LLM_RUNTIME", true)) return false;
  const alwaysOn = readBooleanEnv("AI_SYSTEM_LLM_BRIDGE_ALWAYS_ON", true);
  if (alwaysOn) return true;

  const hasEvidence = Boolean(
    state.collapsedTruth.summary || state.retrievedEvidence.length || state.retrievedSources.length,
  );
  if (!hasEvidence) return false;
  if (state.executionPlan.selectedRoute === "minimum" && isConversationalPrompt(state.normalizedMessage)) {
    return false;
  }
  return true;
}

function normalizeForComparison(value: string): string {
  return `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function repairRuntimeMojibake(value: string): string {
  return `${value || ""}`
    .replace(/Ã¡/g, "á")
    .replace(/Ã /g, "à")
    .replace(/Ã¢/g, "â")
    .replace(/Ã£/g, "ã")
    .replace(/Ã¤/g, "ä")
    .replace(/Ã©/g, "é")
    .replace(/Ã¨/g, "è")
    .replace(/Ãª/g, "ê")
    .replace(/Ã­/g, "í")
    .replace(/Ã³/g, "ó")
    .replace(/Ã´/g, "ô")
    .replace(/Ãµ/g, "õ")
    .replace(/Ãº/g, "ú")
    .replace(/Ã§/g, "ç")
    .replace(/Ã\u0081/g, "Á")
    .replace(/Ã\u0089/g, "É")
    .replace(/Ã\u008D/g, "Í")
    .replace(/Ã\u0093/g, "Ó")
    .replace(/Ã\u009A/g, "Ú")
    .replace(/Ã\u0087/g, "Ç")
    .replace(/intelig[\uFFFD]ncia/gi, "inteligencia")
    .replace(/informa[\uFFFD]{1,2}es/gi, "informacoes")
    .replace(/fa[\uFFFD]a/gi, "faca")
    .replace(/d[\uFFFD]vida/gi, "duvida")
    .replace(/o que [\uFFFD]/gi, "o que e")
    .replace(/let[\uFFFD]cia/gi, "Leticia")
    .replace(/usu[\uFFFD]rio/gi, "Usuario")
    .replace(/\uFFFD+/g, "");
}

function stripDialogueLabels(value: string): string {
  return `${value || ""}`
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|let[ií]cia|leticia|assistant|assistente)\s*:\s*/gi, "\n")
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|let[ií]cia|leticia|assistant|assistente)\s*-\s*/gi, "\n")
    .trim();
}

function extractLastUserLikeSegment(value: string): string {
  const source = `${value || ""}`.trim();
  if (!source) return "";

  const labelPattern =
    /(Usu[aá]rio|Usuario|User|Let[ií]cia|Leticia|Assistant|Assistente)\s*:/gi;

  const matches = Array.from(source.matchAll(labelPattern));
  if (matches.length === 0) return source;

  let lastUserSegment = "";
  let lastMeaningfulSegment = "";

  for (let index = 0; index < matches.length; index += 1) {
    const current = matches[index];
    const next = matches[index + 1];
    const start = (current.index ?? 0) + current[0].length;
    const end = next?.index ?? source.length;
    const segment = source.slice(start, end).trim();

    if (!segment) continue;
    lastMeaningfulSegment = segment;

    const role = `${current[1] || ""}`.toLowerCase();
    if (role.includes("usu") || role === "user") {
      lastUserSegment = segment;
    }
  }

  return (lastUserSegment || lastMeaningfulSegment || source).trim();
}

function sanitizeSourceMessage(value: string): string {
  const repaired = repairRuntimeMojibake(`${value || ""}`.trim());
  const extracted = extractLastUserLikeSegment(repaired);
  const stripped = stripDialogueLabels(extracted);
  return stripped.replace(/\s+/g, " ").trim();
}

function sanitizeRecentTurnContent(value: string): string {
  const repaired = repairRuntimeMojibake(`${value || ""}`);
  const stripped = stripDialogueLabels(repaired);
  return stripped.replace(/\s+/g, " ").trim();
}

function containsTranscriptContamination(value: string): boolean {
  const normalized = `${value || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (!normalized) return false;

  return /\b(?:usuario\s*:|usuario\s*-\s*|user\s*:|assistant\s*:|assistente\s*:|leticia\s*:|pergunta atual\s*:|resposta\s*:\s*usuario)\b/.test(
    normalized,
  );
}

function isDeepMandatoryLikeTurn(state: ProcessingState): boolean {
  const message = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  if (!message) return false;
  if (state.preRouteSignals?.greetingFastLaneEligible) return false;
  if (isGreetingMessage(message) || isSmallTalkMessage(message)) return false;
  if (state.preRouteSignals?.safetyAction === "caution") return false;
  return true;
}

function buildLogicalDirective(state: ProcessingState): string {
  const frame = state.logicalFrame;
  if (!frame) return "";
  const lines: string[] = ["Quadro logico-pratico (obrigatorio):"];
  if (frame.primaryGoal) lines.push(`- Objetivo principal: ${frame.primaryGoal}`);
  if (frame.secondaryGoals.length) lines.push(`- Objetivos secundarios: ${frame.secondaryGoals.join("; ")}`);
  lines.push(`- Principio dominante: ${frame.dominantPrinciple}`);
  if (frame.constraints.length) lines.push(`- Restricoes: ${frame.constraints.slice(0, 4).join("; ")}`);
  if (frame.realWorldConditions.length) lines.push(`- Condicoes reais: ${frame.realWorldConditions.slice(0, 4).join("; ")}`);
  if (frame.recommendedAction) lines.push(`- Acao recomendada: ${frame.recommendedAction}`);
  if (frame.recommendationReason) lines.push(`- Justificativa recomendada: ${frame.recommendationReason}`);
  lines.push("- Evite resposta generica, repetitiva ou desconectada da acao factivel.");
  return lines.join("\n");
}

function getDeliberativeState(state: ProcessingState) {
  return state.generalTaskDeliberationState || state.deliberativeTaskState;
}

function truncateSemanticSnippet(text: string, maxChars: number): string {
  const source = `${text || ""}`.replace(/\s+/g, " ").trim();
  if (!source) return "";
  if (source.length <= maxChars) return source;
  const sliced = source.slice(0, Math.max(24, maxChars - 1));
  const lastBoundary = Math.max(
    sliced.lastIndexOf(". "),
    sliced.lastIndexOf("; "),
    sliced.lastIndexOf(": "),
    sliced.lastIndexOf(", "),
    sliced.lastIndexOf(" "),
  );
  const safe = lastBoundary >= Math.floor(maxChars * 0.55) ? sliced.slice(0, lastBoundary) : sliced;
  return `${safe.trim()}...`;
}

function humanizeDelimitedTokens(values: string[]): string {
  return values
    .map((item) => `${item || ""}`.replace(/_/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("; ");
}

function buildSemanticTaskTarget(state: ProcessingState, safePrompt: string): string {
  const prompt = safePrompt.trim();
  const deliberative = getDeliberativeState(state);
  if (!prompt) return "Pedido do usuario: indisponivel.";

  if (!deliberative?.isActive) {
    return `Pedido do usuario:\n${truncateSemanticSnippet(prompt, 680)}`;
  }

  const topic =
    `${state.conversationState.activeTopic || ""}`.trim() ||
    `${state.languageState.semanticFocus || ""}`.trim() ||
    truncateSemanticSnippet(prompt, 220);

  const taskArchetypes = humanizeDelimitedTokens(deliberative.taskArchetypes.slice(0, 6));
  const cognitiveDemands = humanizeDelimitedTokens(deliberative.cognitiveDemands.slice(0, 6));
  const obligations = deliberative.obligationGraph
    .slice(0, 10)
    .map((item, index) => {
      const label = truncateSemanticSnippet(item.label, 160);
      const type = `${item.type || ""}`.replace(/_/g, " ").trim();
      return `- ${index + 1}. ${label}${type ? ` [${type}]` : ""}`;
    });

  const hardConstraints = deliberative.taskExecutionState.promptConstraints
    .filter((item) => item.hard)
    .map((item) => truncateSemanticSnippet(item.description, 180));

  const lines = [
    `Objetivo do usuario: ${topic}.`,
    taskArchetypes ? `Operacoes cognitivas predominantes: ${taskArchetypes}.` : "",
    cognitiveDemands ? `Demandas de raciocinio: ${cognitiveDemands}.` : "",
    obligations.length ? `Obrigacoes a satisfazer:\n${obligations.join("\n")}` : "",
    hardConstraints.length ? `Restricoes metodologicas obrigatorias: ${hardConstraints.join("; ")}.` : "",
    `Trecho de ancoragem semantica do pedido: ${truncateSemanticSnippet(prompt, 260)}`,
  ];

  return lines.filter(Boolean).join("\n");
}

function buildDeliberativeRuntimeDirective(state: ProcessingState): string[] {
  const deliberative = getDeliberativeState(state);
  if (!deliberative?.isActive) return [];

  const obligationTypes = new Set(deliberative.obligationGraph.map((item) => item.type));
  const directives = [
    "Execute integralmente o pedido antes de concluir e nao exponha nomes de secoes internas, contagens, escores ou metadados.",
    "Escreva em prosa natural e continua, com paragrafos densos e sem repetir a abertura.",
  ];

  if (obligationTypes.has("demonstration")) {
    directives.push("Quando houver demonstracao, explicite premissas ou condicoes e derive a conclusao em vez de apenas afirma-la.");
  }
  if (obligationTypes.has("distinction")) {
    directives.push("Quando houver distincao conceitual, separe categorias proximas com criterio explicito antes de concluir.");
  }
  if (
    obligationTypes.has("proposal") ||
    obligationTypes.has("comparison") ||
    obligationTypes.has("planning") ||
    obligationTypes.has("decision")
  ) {
    directives.push("Quando houver modelos ou alternativas, apresente mecanismo interno, trade-offs e justificativa da escolha.");
  }
  if (obligationTypes.has("evaluation")) {
    directives.push("Explique custos, riscos e limites de cada opcao, em vez de apenas nomea-los.");
  }
  if (obligationTypes.has("objection")) {
    directives.push("Inclua a melhor objecao contra a propria opcao preferida antes do fechamento.");
  }
  if (obligationTypes.has("reformulation")) {
    directives.push("Se houver incerteza, reformule a conclusao com robustez, margem de erro e limites de validade.");
  }
  if (obligationTypes.has("assumption_audit")) {
    directives.push("No fim, explicite os pressupostos e limites nao demonstrados quando isso fizer parte da tarefa.");
  }

  const hardConstraints = deliberative.taskExecutionState.promptConstraints
    .filter((item) => item.hard)
    .map((item) => item.description.trim())
    .filter(Boolean);

  if (hardConstraints.length > 0) {
    directives.push(`Restricoes metodologicas obrigatorias: ${hardConstraints.join("; ")}.`);
  }

  return directives;
}

function shouldAttemptContinuation(state: ProcessingState): boolean {
  if (!isDeepMandatoryLikeTurn(state)) return false;
  if (state.deliberativeTaskState?.isActive || state.generalTaskDeliberationState?.isActive) return true;

  const normalizedMessage = normalizeForComparison(state.normalizedMessage || state.rawMessage);
  const tokenCount = state.preRouteSignals?.tokenCount || state.textAnalysisSnapshot?.tokenCount || 0;
  const complexity = Math.max(state.complexityProfile.score || 0, state.preRouteSignals?.quickComplexity || 0);

  if (tokenCount >= 30) return true;
  if (complexity >= 0.58) return true;
  if (/\b(analise|demonstre|explique|critica|objecao|obje[çc][aã]o|premissas|alternativas|modelo|sistema complexo)\b/.test(normalizedMessage)) {
    return true;
  }
  return false;
}

function resolveLongFormTargetChars(state: ProcessingState): number {
  const message = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  if (!message) return 0;
  if (isConversationalPrompt(message) || isLikelyMicroConversationalPrompt(message)) return 0;

  const deliberative = state.generalTaskDeliberationState || state.deliberativeTaskState;
  if (deliberative?.isActive) {
    const obligationCount = deliberative.obligationGraph?.length || 0;
    const intensity = Math.max(0, deliberative.reasoningIntensity || 0);
    if (obligationCount >= 7 || intensity >= 0.78) return 4600;
    if (obligationCount >= 5 || intensity >= 0.65) return 3600;
    if (obligationCount >= 3 || intensity >= 0.52) return 2800;
    return 2200;
  }

  const tokenCount = state.preRouteSignals?.tokenCount || state.textAnalysisSnapshot?.tokenCount || 0;
  const complexity = Math.max(state.complexityProfile.score || 0, state.preRouteSignals?.quickComplexity || 0);

  if (tokenCount >= 120 || complexity >= 0.78) return 2800;
  if (tokenCount >= 75 || complexity >= 0.62) return 2000;
  if (tokenCount >= 45 || complexity >= 0.5) return 1400;
  return 900;
}

function hasDanglingConnectorEnding(value: string): boolean {
  return /\b(e|ou|mas|porque|portanto|logo|assim|entao|then|and|or|because|therefore)\s*[:\-]?\s*$/i.test(
    `${value || ""}`,
  );
}

function hasLikelyCutWordEnding(value: string): boolean {
  const trimmed = `${value || ""}`.trim();
  if (!trimmed || /[.!?)]$/.test(trimmed)) return false;
  const lastTokenMatch = trimmed.match(/([a-zA-Z\u00C0-\u017F]{3,12})$/);
  if (!lastTokenMatch) return false;
  const lastToken = `${lastTokenMatch[1] || ""}`.toLowerCase();
  const safeEnds = new Set(["sim", "nao", "ok", "fim", "bom", "ruim", "alto", "baixo", "media", "medio"]);
  return !safeEnds.has(lastToken);
}

function likelyIncompleteDraft(draft: string): boolean {
  const trimmed = `${draft || ""}`.trim();
  if (!trimmed) return true;
  const sentenceCount = trimmed
    .split(/(?<=[.!?])\s+/g)
    .map((item) => item.trim())
    .filter(Boolean).length;

  if (trimmed.length < 180 && sentenceCount <= 1) return true;
  if (/[,:;]$/.test(trimmed)) return true;
  if (hasDanglingConnectorEnding(trimmed)) return true;
  if (!/[.!?]$/.test(trimmed)) return true;
  if (hasLikelyCutWordEnding(trimmed)) return true;

  return false;
}

function normalizeContinuationLead(value: string): string {
  return `${value || ""}`
    .replace(/^\s*(continuacao|continua[cç][aã]o|continua|seguindo|prosseguindo)\s*[:\-]\s*/i, "")
    .replace(/^\s*(leticia|letícia|assistant|assistente)\s*:\s*/i, "")
    .trim();
}

function tokenOverlapRatio(a: string, b: string): number {
  const left = new Set(normalizeForComparison(a).split(" ").filter((item) => item.length >= 3));
  const right = new Set(normalizeForComparison(b).split(" ").filter((item) => item.length >= 3));
  if (!left.size || !right.size) return 0;

  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) overlap += 1;
  }

  return overlap / Math.max(left.size, right.size);
}

function isPromptMirrorDraft(draft: string, prompt: string): boolean {
  const normalizedDraft = normalizeForComparison(draft);
  const normalizedPrompt = normalizeForComparison(prompt);
  if (!normalizedDraft || !normalizedPrompt) return false;
  if (normalizedDraft === normalizedPrompt) return true;

  const promptHead = normalizedPrompt.slice(0, Math.min(220, normalizedPrompt.length));
  if (promptHead.length >= 80 && normalizedDraft.startsWith(promptHead.slice(0, 120))) return true;
  if (promptHead.length >= 100 && normalizedDraft.includes(promptHead) && normalizedDraft.length <= normalizedPrompt.length * 3.1) {
    return true;
  }

  const overlap = tokenOverlapRatio(draft, prompt);
  const novelty = 1 - overlap;
  return overlap >= 0.8 && novelty <= 0.2;
}

function mergeWithOverlap(baseText: string, continuationText: string): string {
  const base = `${baseText || ""}`.trim();
  const cont = normalizeContinuationLead(continuationText);
  if (!cont) return base;
  if (!base) return cont;

  const normalizedBase = normalizeForComparison(base);
  const normalizedCont = normalizeForComparison(cont);
  if (!normalizedCont) return base;
  if (normalizedBase.includes(normalizedCont)) return base;

  const baseTail = normalizedBase.slice(-240);
  const contHead = normalizedCont.slice(0, 240);
  const overlapSize = Math.min(baseTail.length, contHead.length);
  let hasOverlap = false;

  for (let size = Math.min(120, overlapSize); size >= 24; size -= 4) {
    const tailSlice = baseTail.slice(-size);
    const headSlice = contHead.slice(0, size);
    if (tailSlice && headSlice && tailSlice === headSlice) {
      hasOverlap = true;
      break;
    }
  }

  if (hasOverlap) {
    return `${base}\n\n${cont}`.replace(/\n{3,}/g, "\n\n").trim();
  }

  return `${base}\n\n${cont}`.replace(/\n{3,}/g, "\n\n").trim();
}

function buildRecentContextSummary(state: ProcessingState): string {
  const safeTurns = state.recentTurns
    .slice(-4)
    .map((turn, index) => {
      const cleaned = sanitizeRecentTurnContent(turn.content);
      if (!cleaned) return "";

      const label =
        turn.role === "user"
          ? `Pedido recente ${index + 1}`
          : `Resposta anterior ${index + 1}`;

      return `- ${label}: ${truncateSemanticSnippet(cleaned, 220)}`;
    })
    .filter(Boolean);

  return safeTurns.join("\n");
}

function buildRuntimePrompt(state: ProcessingState): string {
  const sourceMessage = sanitizeSourceMessage(state.normalizedMessage || state.rawMessage);
  const logicalDirective = buildLogicalDirective(state);
  const semanticTaskTarget = buildSemanticTaskTarget(state, sourceMessage);

  if (isConversationalPrompt(sourceMessage)) {
    return [
      "Voce e Leticia, IA do ai-system-anm em portugues brasileiro.",
      "Responda em primeira pessoa, com tom cordial, natural e direto.",
      "Nao se descreva como entidade separada da propria Leticia.",
      "Nunca diga formulacoes como 'eu e a IA Leticia' ou 'assistente interno enquanto Leticia e a IA'.",
      "Nao alterne para ingles ou espanhol; mantenha o idioma da conversa.",
      "Nao mencione pipeline, memoria interna, modulos, evidencias tecnicas ou telemetria.",
      "Se a mensagem for saudacao, cumprimente e convide o usuario a dizer o que precisa.",
      "Se perguntarem seu nome, responda apenas que seu nome e Leticia.",
      "Se nao perguntarem sua identidade, nao comece com autoapresentacao.",
      "Nao continue dialogos em formato de transcript.",
      "Nao escreva rotulos como Usuario, User, Leticia, Assistant ou Assistente na resposta.",
      ...(logicalDirective ? [logicalDirective] : []),
      `Mensagem do usuario: ${truncateSemanticSnippet(sourceMessage, 420)}`,
    ].join("\n");
  }

  const evidence = state.retrievedEvidence
    .slice(0, 4)
    .map((item) => `- ${truncateSemanticSnippet(sanitizeRecentTurnContent(item), 220)}`);

  const sourceHints = state.retrievedSources
    .slice(0, 3)
    .map((item) => `- ${truncateSemanticSnippet(item.title, 120)}: ${item.url}`);

  const recentContext = buildRecentContextSummary(state);

  return [
    "Voce e Leticia, IA do ai-system-anm com alto rigor factual.",
    "Nao se descreva como 'assistente interno' nem como entidade separada de Leticia.",
    "Responda em portugues brasileiro, com linguagem natural, clara e util, sem alternar para ingles.",
    "Comece direto na resposta; nao recapitule nem traduza a pergunta do usuario.",
    "Nao abra com 'Eu sou Leticia' quando o usuario nao perguntou identidade.",
    "Nao continue dialogos em formato de transcript.",
    "Nao escreva rotulos como Usuario, User, Leticia, Assistant ou Assistente na resposta.",
    "Para consultas nao triviais, entregue resposta extensa e profunda, cobrindo argumentos, implicacoes, limites e sintese.",
    ...buildDeliberativeRuntimeDirective(state),
    "Se houver incerteza, explicite com clareza. Nao invente fatos.",
    ...(logicalDirective ? [logicalDirective] : []),
    "Use o pedido do usuario apenas como alvo semantico. Nao o repita nem o parafraseie na superficie da resposta.",
    semanticTaskTarget,
    recentContext ? `Contexto recente resumido:\n${recentContext}` : "Contexto recente resumido: indisponivel",
    evidence.length ? `Evidencias:\n${evidence.join("\n")}` : "Evidencias: indisponiveis",
    sourceHints.length ? `Fontes:\n${sourceHints.join("\n")}` : "Fontes: indisponiveis",
  ].join("\n");
}

function stripDialogueArtifactsFromDraft(value: string): string {
  return `${value || ""}`
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*:\s*/gi, "\n")
    .replace(/(?:^|\n)\s*(usu[aá]rio|usuario|user|assistant|assistente|let[ií]cia|leticia)\s*-\s*/gi, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function sanitizeRuntimeDraft(value: string, prompt?: string): string {
  const repaired = repairRuntimeMojibake(`${value || ""}`);
  const cleaned = normalizeDeliberativeText(repaired);
  if (!cleaned) return "";
  if (/^Resposta gerada em fallback local/i.test(cleaned)) return "";

  const withoutDialogue = stripDialogueArtifactsFromDraft(cleaned);
  const deEchoed = prompt ? stripPromptEcho(withoutDialogue, prompt) : withoutDialogue;
  return dedupeParagraphs(normalizeContinuationLead(deEchoed));
}

function hasDialogueArtifact(text: string): boolean {
  const normalized = `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (!normalized) return false;

  return /\b(?:usuario\s*:|usuario\s+[:\-]|user\s*:|assistant\s*:|assistente\s*:|leticia\s*:|pergunta atual\s*:|resposta:\s*usuario)\b/.test(
    normalized,
  );
}

function isLikelyMicroConversationalPrompt(text: string): boolean {
  const normalized = `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) return false;
  if (isGreetingMessage(normalized) || isSmallTalkMessage(normalized)) return true;

  const tokens = normalized.split(" ").filter(Boolean);
  if (tokens.length > 4) return false;

  return /^(oi+|ola+|opa|fala|salve|bom dia|boa tarde|boa noite|boa trde|tudo bem|td bem|como vai)\b/.test(normalized);
}

function shouldRejectLlmDraft(state: ProcessingState, draft: string): boolean {
  const message = sanitizeSourceMessage(state.normalizedMessage || state.rawMessage);
  const conversational = isConversationalPrompt(message) || isLikelyMicroConversationalPrompt(message);

  if (hasDialogueArtifact(draft)) return true;
  if (containsTranscriptContamination(draft)) return true;

  if (!conversational) return false;
  if (isLikelyMicroConversationalPrompt(message) && draft.length > 220) return true;

  return false;
}

function buildDraftCoverageReport(state: ProcessingState, draft: string): CoverageReport | null {
  const deliberative = getDeliberativeState(state);
  if (!deliberative?.isActive || !deliberative.reasoningContract) return null;

  return responseCoverageValidator({
    obligations: deliberative.obligationGraph,
    contract: deliberative.reasoningContract,
    responseText: draft,
    userPrompt: sanitizeSourceMessage(state.normalizedMessage || state.rawMessage),
    requiresCounterObjection: deliberative.obligationGraph.some((item) => item.type === "objection"),
    requiresAssumptionAudit: deliberative.obligationGraph.some((item) => item.type === "assumption_audit"),
    requiresReformulation: deliberative.obligationGraph.some((item) => item.type === "reformulation"),
    assumptionLedger: deliberative.assumptionLedger,
  });
}

function updateDeliberativeCoverageState(state: ProcessingState, report: CoverageReport | null): void {
  if (!report) return;

  const targets = [state.generalTaskDeliberationState, state.deliberativeTaskState].filter(Boolean);
  for (const target of targets) {
    if (!target) continue;
    target.coverageReport = report;
    target.taskExecutionState = {
      ...target.taskExecutionState,
      obligationSatisfactionScores:
        report.obligationScores || target.taskExecutionState.obligationSatisfactionScores,
      integrityChecks:
        report.executionDiagnostics?.integrityChecks || target.taskExecutionState.integrityChecks,
      finalExecutionGate:
        report.executionDiagnostics?.finalExecutionGate || target.taskExecutionState.finalExecutionGate,
    };
  }
}

function needsDeliberativeContinuation(report: CoverageReport | null): boolean {
  if (!report) return false;
  if (report.gateLevel === "hard_fail") return true;
  if (report.executionDiagnostics?.finalExecutionGate?.shouldBlock) return true;
  if ((report.missing || []).length > 0) return true;
  if ((report.blockingIssues || []).length > 0) return true;
  if ((report.weaklySatisfied || []).length > Math.max(1, Math.floor((report.expected || 0) * 0.25))) {
    return true;
  }
  return false;
}

function isDeliberativeDraftAcceptable(report: CoverageReport | null): boolean {
  if (!report) return true;
  if (report.gateLevel === "hard_fail") return false;
  if (report.executionDiagnostics?.finalExecutionGate?.shouldBlock) return false;
  if ((report.missing || []).length > 0) return false;
  if ((report.blockingIssues || []).length > 0) return false;
  return true;
}

function buildPendingCoverageSummary(report: CoverageReport | null): string {
  if (!report) return "";
  const pending = [...(report.missing || []), ...(report.weaklySatisfied || [])]
    .map((item) => `${item || ""}`.trim())
    .filter(Boolean);

  return pending.slice(0, 6).join("; ");
}

function extractContinuationExcerpt(text: string, maxChars = 2200): string {
  const trimmed = `${text || ""}`.trim();
  if (!trimmed) return "";
  if (trimmed.length <= maxChars) return trimmed;
  return trimmed.slice(trimmed.length - maxChars).trim();
}

export async function runGenerationLlmBridge(state: ProcessingState): Promise<ProcessingState> {
  if (!state.collapsedTruth.summary && state.retrievedEvidence.length > 0) {
    state.collapsedTruth.summary = state.retrievedEvidence.slice(0, 2).join(" ");
  }

  state.executionArtifacts =
    state.executionArtifacts || { knowledge: { cache: {}, lastQuerySignature: "", lastUsedCache: false } };

  state.executionArtifacts.generationRuntime = {
    provider: "vllm-openai-compatible",
    model: vllmClientInfo.model,
    baseUrl: vllmClientInfo.baseUrl,
    maxTokens: vllmClientInfo.maxTokens,
    enabled: shouldUseLlmRuntime(state),
    used: false,
    llmDraft: "",
  };

  if (!state.executionArtifacts.generationRuntime.enabled) return state;

  const runtimeTimeout = Math.max(
    1_200,
    Number(process.env.AI_SYSTEM_LLM_BRIDGE_TIMEOUT_MS || 9000),
  );

  const prompt = buildRuntimePrompt(state);
  const sourceMessage = sanitizeSourceMessage(state.normalizedMessage || state.rawMessage);

  let llmDraft = sanitizeRuntimeDraft(
    await vllmClient.generate(prompt, { timeoutMs: runtimeTimeout }),
    sourceMessage,
  );

  if (llmDraft && isPromptMirrorDraft(llmDraft, sourceMessage)) {
    const rewritePrompt = [
      prompt,
      "",
      "Reescreva do zero sem repetir, traduzir ou parafrasear o enunciado.",
      "Comece diretamente na resposta em portugues brasileiro, com execucao real da tarefa.",
      "Nao misture idiomas e nao inicie com autoapresentacao.",
      "Nao abra com recapitulacao da pergunta.",
      "Nao produza transcript de conversa e nao use rotulos como Usuario, User, Leticia, Assistant ou Assistente.",
      "Nao exponha contrato interno, nomes de secoes, contagens ou metadados do sistema.",
    ].join("\n");

    const rewritten = sanitizeRuntimeDraft(
      await vllmClient.generate(rewritePrompt, { timeoutMs: runtimeTimeout }),
      sourceMessage,
    );

    if (rewritten) llmDraft = rewritten;
  }

  if (!llmDraft) return state;
  if (containsTranscriptContamination(llmDraft)) return state;

  const targetChars = resolveLongFormTargetChars(state);
  let deliberativeCoverage = buildDraftCoverageReport(state, llmDraft);
  let mirrorDetected = isPromptMirrorDraft(llmDraft, sourceMessage);

  const continuationNeeded =
    mirrorDetected ||
    (shouldAttemptContinuation(state) && likelyIncompleteDraft(llmDraft)) ||
    (targetChars > 0 && llmDraft.length < targetChars) ||
    needsDeliberativeContinuation(deliberativeCoverage);

  if (continuationNeeded) {
    const deliberativeObligationCount = getDeliberativeState(state)?.obligationGraph?.length || 0;
    const configuredContinuations = Number(process.env.AI_SYSTEM_LLM_BRIDGE_MAX_CONTINUATIONS || 6);
    const adaptiveContinuationBudget =
      deliberativeObligationCount > 0
        ? Math.min(10, Math.max(configuredContinuations, 2 + Math.ceil(deliberativeObligationCount * 0.8)))
        : configuredContinuations;

    const maxContinuations = Math.max(0, Math.min(10, adaptiveContinuationBudget));

    for (let attempt = 0; attempt < maxContinuations; attempt += 1) {
      const pendingCoverage = buildPendingCoverageSummary(deliberativeCoverage);
      const continuationPrompt = [
        prompt,
        "",
        "Continue a resposta a partir do ponto exato em que ela parou, sem reiniciar e sem reabrir com recapitulacao.",
        "Nao repita o enunciado, nao traduza a pergunta e nao enumere o que voce vai fazer.",
        "Nao produza transcript de conversa e nao use rotulos como Usuario, User, Leticia, Assistant ou Assistente.",
        "Mantenha coerencia com os paragrafos anteriores e so encerre quando a resposta estiver efetivamente completa.",
        pendingCoverage
          ? `Pontos ainda insuficientes: ${pendingCoverage}.`
          : "Complete os pontos pendentes com desenvolvimento real, nao com titulos vazios.",
        "Entregue apenas a continuacao em portugues brasileiro natural, sem alternar idioma.",
        `Trecho ja entregue (contexto de continuidade):\n${extractContinuationExcerpt(llmDraft)}`,
      ].join("\n");

      const continuation = sanitizeRuntimeDraft(
        await vllmClient.generate(continuationPrompt, { timeoutMs: runtimeTimeout }),
        sourceMessage,
      );

      if (!continuation) break;
      if (containsTranscriptContamination(continuation)) break;

      const merged = dedupeParagraphs(
        normalizeDeliberativeText(mergeWithOverlap(llmDraft, continuation)),
      );

      if (merged === llmDraft) break;

      llmDraft = merged;
      deliberativeCoverage = buildDraftCoverageReport(state, llmDraft);
      mirrorDetected = isPromptMirrorDraft(llmDraft, sourceMessage);

      const needsMore =
        mirrorDetected ||
        (shouldAttemptContinuation(state) && likelyIncompleteDraft(llmDraft)) ||
        (targetChars > 0 && llmDraft.length < targetChars) ||
        needsDeliberativeContinuation(deliberativeCoverage);

      if (!needsMore) break;
    }
  }

  if (getDeliberativeState(state)?.isActive && deliberativeCoverage && shouldAttemptCoverageRepair(deliberativeCoverage)) {
    const maxRepairAttempts = resolveRepairAttempts();

    for (let attempt = 0; attempt < maxRepairAttempts; attempt += 1) {
      const coverageForRepair = deliberativeCoverage;
      if (!coverageForRepair) break;

      const repaired = await repairDeliberativeResponse({
        state,
        candidate: llmDraft,
        missing: coverageForRepair.missing || [],
        weak: coverageForRepair.weaklySatisfied || [],
        blocking: coverageForRepair.blockingIssues || [],
        attempt: attempt + 1,
      });

      const normalizedRepair = normalizeRepairedCoverageText(state, repaired);
      if (!normalizedRepair || normalizedRepair === llmDraft) continue;

      llmDraft = dedupeParagraphs(normalizeDeliberativeText(normalizedRepair));
      deliberativeCoverage = buildDraftCoverageReport(state, llmDraft);

      if (
        !needsDeliberativeContinuation(deliberativeCoverage) &&
        !isPromptMirrorDraft(llmDraft, sourceMessage) &&
        !likelyIncompleteDraft(llmDraft)
      ) {
        break;
      }
    }

    if (!isDeliberativeDraftAcceptable(deliberativeCoverage)) {
      const hardRecovery = normalizeRepairedCoverageText(state, buildHardGateRecovery(state));
      if (hardRecovery) {
        llmDraft = dedupeParagraphs(normalizeDeliberativeText(hardRecovery));
        deliberativeCoverage = buildDraftCoverageReport(state, llmDraft);
      }
    }
  }

  updateDeliberativeCoverageState(state, deliberativeCoverage);

  if (shouldAttemptContinuation(state) && isPromptMirrorDraft(llmDraft, sourceMessage)) {
    state.activeConstraints = [
      ...new Set([...state.activeConstraints, "llm_prompt_mirror_detected"]),
    ].slice(-32);
    return state;
  }

  if (getDeliberativeState(state)?.isActive && !isDeliberativeDraftAcceptable(deliberativeCoverage)) {
    state.activeConstraints = [
      ...new Set([
        ...state.activeConstraints,
        "llm_deliberative_coverage_rejected",
        ...(deliberativeCoverage?.blockingIssues || []).slice(0, 6),
      ]),
    ].slice(-32);
    return state;
  }

  if (shouldRejectLlmDraft(state, llmDraft)) {
    state.activeConstraints = [
      ...new Set([...state.activeConstraints, "llm_micro_output_rejected"]),
    ].slice(-32);
    return state;
  }

  state.executionArtifacts.generationRuntime.used = true;
  state.executionArtifacts.generationRuntime.llmDraft = llmDraft;

  if (!state.collapsedTruth.summary) {
    state.collapsedTruth.summary = llmDraft;
  }

  return state;
}