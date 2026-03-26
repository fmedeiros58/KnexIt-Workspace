import type { ProcessingState } from "../bridges/contracts/processing-state";
import { createVllmClient, vllmClientInfo } from "../infra/llm/vllm-client";
import { isConversationalPrompt } from "../shared/utils/conversation-signals";

const vllmClient = createVllmClient();

function readBooleanEnv(name: string, fallback: boolean): boolean {
  const normalized = `${process.env[name] ?? ""}`.trim().toLowerCase();
  if (!normalized) return fallback;
  if (["1", "true", "yes", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "off"].includes(normalized)) return false;
  return fallback;
}

function shouldUseLlmRuntime(state: ProcessingState): boolean {
  if (!readBooleanEnv("ANM_ENABLE_LLM_RUNTIME", true)) return false;
  const alwaysOn = readBooleanEnv("ANM_LLM_BRIDGE_ALWAYS_ON", true);
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
      "Voce e Leticia, assistente virtual em portugues brasileiro.",
      "Responda em primeira pessoa, com tom cordial, natural e direto.",
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
    "Voce e um assistente de alto rigor factual.",
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

  const runtimeTimeout = Math.max(1_200, Number(process.env.ANM_LLM_BRIDGE_TIMEOUT_MS || 9000));
  const prompt = buildRuntimePrompt(state);
  const llmDraft = sanitizeRuntimeDraft(await vllmClient.generate(prompt, { timeoutMs: runtimeTimeout }));
  if (!llmDraft) return state;

  state.executionArtifacts.generationRuntime.used = true;
  state.executionArtifacts.generationRuntime.llmDraft = llmDraft;
  if (!state.collapsedTruth.summary) {
    state.collapsedTruth.summary = llmDraft;
  }

  return state;
}
