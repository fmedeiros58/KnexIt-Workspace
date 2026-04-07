import type { ProcessingState } from "../bridges/contracts/processing-state";
import { createVllmClient, vllmClientInfo } from "../infra/llm/vllm-client";
import { isConversationalPrompt, isGreetingMessage, isSmallTalkMessage } from "../shared/utils/conversation-signals";

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

  const hasEvidence = Boolean(state.collapsedTruth.summary || state.retrievedEvidence.length || state.retrievedSources.length);
  if (!hasEvidence) return false;
  if (state.executionPlan.selectedRoute === "minimum" && isConversationalPrompt(state.normalizedMessage)) return false;
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

function shouldAttemptContinuation(state: ProcessingState): boolean {
  if (!isDeepMandatoryLikeTurn(state)) return false;
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

  const tokenCount = state.preRouteSignals?.tokenCount || state.textAnalysisSnapshot?.tokenCount || 0;
  const complexity = Math.max(state.complexityProfile.score || 0, state.preRouteSignals?.quickComplexity || 0);

  if (tokenCount >= 120 || complexity >= 0.78) return 2800;
  if (tokenCount >= 75 || complexity >= 0.62) return 2000;
  if (tokenCount >= 45 || complexity >= 0.5) return 1400;
  return 900;
}

function likelyIncompleteDraft(draft: string): boolean {
  const trimmed = `${draft || ""}`.trim();
  if (!trimmed) return true;
  if (trimmed.length < 320) return false;
  if (/[,:;]$/.test(trimmed)) return true;
  if (!/[.!?]$/.test(trimmed)) return true;
  return false;
}

function normalizeContinuationLead(value: string): string {
  return `${value || ""}`
    .replace(/^\s*(continuacao|continua[cç][aã]o|continua|seguindo|prosseguindo)\s*[:\-]\s*/i, "")
    .replace(/^\s*(leticia|letícia)\s*:\s*/i, "")
    .trim();
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

function buildRuntimePrompt(state: ProcessingState): string {
  const normalizedMessage = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  const logicalDirective = buildLogicalDirective(state);
  if (isConversationalPrompt(normalizedMessage)) {
    return [
      "Voce e Leticia, IA do ai-system-anm em portugues brasileiro.",
      "Responda em primeira pessoa, com tom cordial, natural e direto.",
      "Nao se descreva como entidade separada da propria Leticia.",
      "Nunca diga formulacoes como 'eu e a IA Leticia' ou 'assistente interno enquanto Leticia e a IA'.",
      "Nao mencione pipeline, memoria interna, modulos, evidencias tecnicas ou telemetria.",
      "Se a mensagem for saudacao, cumprimente e convide o usuario a dizer o que precisa.",
      "Se perguntarem seu nome, responda apenas que seu nome e Leticia.",
      ...(logicalDirective ? [logicalDirective] : []),
      `Mensagem do usuario: ${normalizedMessage}`,
    ].join("\n");
  }

  const evidence = state.retrievedEvidence.slice(0, 4).map((item) => `- ${item}`);
  const sourceHints = state.retrievedSources.slice(0, 3).map((item) => `- ${item.title}: ${item.url}`);
  const recentTurns = state.recentTurns
    .slice(-4)
    .map((turn) => `- ${turn.role}: ${turn.content}`)
    .join("\n");
  return [
    "Voce e Leticia, IA do ai-system-anm com alto rigor factual.",
    "Nao se descreva como 'assistente interno' nem como entidade separada de Leticia.",
    "Responda em portugues brasileiro, com linguagem natural, clara e util.",
    "Para consultas nao triviais, entregue resposta extensa e profunda, cobrindo argumentos, implicacoes, limites e sintese.",
    "Se houver incerteza, explicite com clareza. Nao invente fatos.",
    ...(logicalDirective ? [logicalDirective] : []),
    `Pergunta: ${normalizedMessage}`,
    recentTurns ? `Contexto recente:\n${recentTurns}` : "Contexto recente: indisponivel",
    evidence.length ? "Evidencias:\n" + evidence.join("\n") : "Evidencias: indisponiveis",
    sourceHints.length ? "Fontes:\n" + sourceHints.join("\n") : "Fontes: indisponiveis",
  ].join("\n");
}

function sanitizeRuntimeDraft(value: string): string {
  const cleaned = `${value || ""}`.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  if (/^Resposta gerada em fallback local/i.test(cleaned)) return "";
  return normalizeContinuationLead(cleaned);
}

function hasDialogueArtifact(text: string): boolean {
  const normalized = `${text || ""}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
  if (!normalized) return false;
  return /\b(?:usuario\s*:|usuario\s+[:\-]|leticia\s*:|pergunta atual\s*:|resposta:\s*usuario)\b/.test(normalized);
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
  const message = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  const conversational = isConversationalPrompt(message) || isLikelyMicroConversationalPrompt(message);
  if (!conversational) return false;

  if (hasDialogueArtifact(draft)) return true;
  if (isLikelyMicroConversationalPrompt(message) && draft.length > 220) return true;
  return false;
}

export async function runGenerationLlmBridge(state: ProcessingState): Promise<ProcessingState> {
  if (!state.collapsedTruth.summary && state.retrievedEvidence.length > 0) {
    state.collapsedTruth.summary = state.retrievedEvidence.slice(0, 2).join(" ");
  }

  state.executionArtifacts = state.executionArtifacts || { knowledge: { cache: {}, lastQuerySignature: "", lastUsedCache: false } };
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
  let llmDraft = sanitizeRuntimeDraft(await vllmClient.generate(prompt, { timeoutMs: runtimeTimeout }));
  if (!llmDraft) return state;

  const targetChars = resolveLongFormTargetChars(state);
  const continuationNeeded =
    (shouldAttemptContinuation(state) && likelyIncompleteDraft(llmDraft)) ||
    (targetChars > 0 && llmDraft.length < targetChars);

  if (continuationNeeded) {
    const maxContinuations = Math.max(0, Math.min(6, Number(process.env.AI_SYSTEM_LLM_BRIDGE_MAX_CONTINUATIONS || 4)));
    for (let attempt = 0; attempt < maxContinuations; attempt += 1) {
      const continuationPrompt = [
        prompt,
        "",
        "Continue a resposta sem reiniciar, sem repetir o que ja foi dito e mantendo coerencia com os paragrafos anteriores.",
        "Entregue apenas a continuacao em portugues brasileiro.",
        `Trecho ja entregue:\n${llmDraft}`,
      ].join("\n");
      const continuation = sanitizeRuntimeDraft(
        await vllmClient.generate(continuationPrompt, { timeoutMs: runtimeTimeout }),
      );
      if (!continuation) break;
      const merged = mergeWithOverlap(llmDraft, continuation);
      if (merged === llmDraft) break;
      llmDraft = merged;
      if (!likelyIncompleteDraft(llmDraft) && (targetChars <= 0 || llmDraft.length >= targetChars)) break;
    }
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
