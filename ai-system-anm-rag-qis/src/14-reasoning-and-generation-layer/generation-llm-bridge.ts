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

function readBooleanEnvCompat(primary: string, legacy: string, fallback: boolean): boolean {
  const primaryRaw = `${process.env[primary] ?? ""}`.trim();
  if (primaryRaw) return readBooleanEnv(primary, fallback);
  return readBooleanEnv(legacy, fallback);
}

function shouldUseLlmRuntime(state: ProcessingState): boolean {
  if (!readBooleanEnvCompat("AI_SYSTEM_ENABLE_LLM_RUNTIME", "ANM_ENABLE_LLM_RUNTIME", true)) return false;
  const alwaysOn = readBooleanEnvCompat("AI_SYSTEM_LLM_BRIDGE_ALWAYS_ON", "ANM_LLM_BRIDGE_ALWAYS_ON", true);
  if (alwaysOn) return true;

  const hasEvidence = Boolean(state.collapsedTruth.summary || state.retrievedEvidence.length || state.retrievedSources.length);
  if (!hasEvidence) return false;
  if (state.executionPlan.selectedRoute === "minimum" && isConversationalPrompt(state.normalizedMessage)) return false;
  return true;
}

function buildRuntimePrompt(state: ProcessingState): string {
  const normalizedMessage = `${state.normalizedMessage || state.rawMessage || ""}`.trim();
  if (isConversationalPrompt(normalizedMessage)) {
    return [
      "Voce e Leticia, IA do ai-system-anm em portugues brasileiro.",
      "Responda em primeira pessoa, com tom cordial, natural e direto.",
      "Nao se descreva como entidade separada da propria Leticia.",
      "Nunca diga formulacoes como 'eu e a IA Leticia' ou 'assistente interno enquanto Leticia e a IA'.",
      "Nao mencione pipeline, memoria interna, modulos, evidencias tecnicas ou telemetria.",
      "Se a mensagem for saudacao, cumprimente e convide o usuario a dizer o que precisa.",
      "Se perguntarem seu nome, responda apenas que seu nome e Leticia.",
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
    "Se houver incerteza, explicite com clareza. Nao invente fatos.",
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
  return cleaned;
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
    Number(process.env.AI_SYSTEM_LLM_BRIDGE_TIMEOUT_MS || process.env.ANM_LLM_BRIDGE_TIMEOUT_MS || 9000),
  );
  const prompt = buildRuntimePrompt(state);
  const llmDraft = sanitizeRuntimeDraft(await vllmClient.generate(prompt, { timeoutMs: runtimeTimeout }));
  if (!llmDraft) return state;
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
