import type { ProcessingState } from "../bridges/contracts/processing-state";
import { createVllmClient, vllmClientInfo } from "../infra/llm/vllm-client";
import { isConversationalPrompt } from "../shared/utils/conversation-signals";

const vllmClient = createVllmClient();

function shouldUseLlmRuntime(state: ProcessingState): boolean {
  const runtimeFlag = `${process.env.ANM_ENABLE_LLM_RUNTIME ?? "true"}`.toLowerCase();
  if (runtimeFlag === "false" || runtimeFlag === "0" || runtimeFlag === "off") return false;
  if (state.executionPlan.selectedRoute === "minimum") return false;
  if (isConversationalPrompt(state.normalizedMessage)) return false;
  if (/\b(qual|quem|nome).*\b(presidente|governador|prefeito)\b/i.test(state.normalizedMessage)) return false;
  return Boolean(state.collapsedTruth.summary || state.retrievedEvidence.length);
}

function buildRuntimePrompt(state: ProcessingState): string {
  const evidence = state.retrievedEvidence.slice(0, 4).map((item) => `- ${item}`);
  const sourceHints = state.retrievedSources.slice(0, 3).map((item) => `- ${item.title}: ${item.url}`);
  return [
    "Voce e um assistente de alto rigor factual.",
    "Responda em portugues brasileiro, de forma objetiva e limpa, em no maximo 5 frases.",
    "Se houver incerteza, explicite com clareza.",
    `Pergunta: ${state.normalizedMessage}`,
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

  const runtimeTimeout = Math.max(700, Number(process.env.ANM_LLM_BRIDGE_TIMEOUT_MS || 1200));
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
